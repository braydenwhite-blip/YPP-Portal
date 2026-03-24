import { compare } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  checkLoginRateLimit,
  checkAccountLockout,
  recordFailedLoginAttempt,
  clearAccountLockout,
} from "@/lib/rate-limit-redis";
import { normalizeRoleValue, normalizeRoleValues } from "@/lib/role-utils";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

function normalizeAuthRolePayload(input: {
  roles: string[];
  primaryRole?: string | null;
}) {
  const roles = normalizeRoleValues(input.roles);
  const primaryRole = normalizeRoleValue(input.primaryRole) ?? roles[0] ?? "STUDENT";

  if (!roles.includes(primaryRole)) {
    roles.unshift(primaryRole);
  }

  return {
    roles: Array.from(new Set(roles)),
    primaryRole,
  };
}

function buildProviders() {
  const providers: NextAuthOptions["providers"] = [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        mt: { label: "Magic Token", type: "text" },
        challengeToken: { label: "2FA Challenge Token", type: "text" },
        totpCode: { label: "2FA Code", type: "text" },
      },
      async authorize(credentials) {
        const raw = credentials as Record<string, string> | undefined;

        // --- 2FA challenge completion path ---
        const challengeToken = raw?.challengeToken;
        const totpCode = raw?.totpCode;
        if (challengeToken && totpCode) {
          const { resolveChallengeToken, verifyTwoFactorCode } = await import("@/lib/two-factor-actions");
          const userId = await resolveChallengeToken(challengeToken);
          if (!userId) {
            throw new Error("2FA session expired. Please sign in again.");
          }

          const isValid = await verifyTwoFactorCode(userId, totpCode);
          if (!isValid) {
            throw new Error("Invalid verification code. Please try again.");
          }

          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
              id: true,
              name: true,
              email: true,
              primaryRole: true,
              roles: { select: { role: true } },
            },
          });

          if (!user) return null;

          const normalizedRoles = normalizeAuthRolePayload({
            roles: user.roles.map((r) => r.role),
            primaryRole: user.primaryRole,
          });

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            roles: normalizedRoles.roles,
            primaryRole: normalizedRoles.primaryRole,
          } as any;
        }

        // --- Magic relay token path (from /magic-link page) ---
        const mt = raw?.mt;
        if (mt) {
          const record = await prisma.emailVerificationToken.findUnique({
            where: { token: mt },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  primaryRole: true,
                  roles: { select: { role: true } },
                },
              },
            },
          });

          if (!record || record.usedAt || record.expiresAt < new Date()) {
            throw new Error("MAGIC_LINK_EXPIRED");
          }

          await prisma.emailVerificationToken.update({
            where: { id: record.id },
            data: { usedAt: new Date() },
          });

          const normalizedRoles = normalizeAuthRolePayload({
            roles: record.user.roles.map((r) => r.role),
            primaryRole: record.user.primaryRole,
          });

          return {
            id: record.user.id,
            name: record.user.name,
            email: record.user.email,
            roles: normalizedRoles.roles,
            primaryRole: normalizedRoles.primaryRole,
          } as any;
        }

        // --- Normal email/password path ---
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const email = parsed.data.email.toLowerCase();

        // Rate limit: 10 attempts per email per 15 minutes
        const rl = await checkLoginRateLimit(email);
        if (!rl.success) {
          throw new Error("Too many login attempts. Please try again later.");
        }

        // Check persistent account lockout (5 failed passwords → 30-min block)
        const lockout = await checkAccountLockout(email);
        if (lockout.locked) {
          throw new Error("Account temporarily locked. Please try again in 30 minutes or reset your password.");
        }

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            name: true,
            email: true,
            passwordHash: true,
            primaryRole: true,
            emailVerified: true,
            twoFactorEnabled: true,
            roles: { select: { role: true } }
          }
        });

        if (!user) {
          return null;
        }

        // OAuth-only users (empty passwordHash) cannot sign in with credentials
        if (!user.passwordHash) {
          throw new Error("This account uses Google sign-in. Please use the 'Sign in with Google' button.");
        }

        const isValid = await compare(parsed.data.password, user.passwordHash);
        if (!isValid) {
          const failCount = await recordFailedLoginAttempt(email);

          // Audit log when lockout threshold is first reached
          if (failCount === 5) {
            try {
              const { logAuditEvent } = await import("@/lib/audit-log-actions");
              await logAuditEvent({
                action: "SETTINGS_CHANGED",
                actorId: user.id,
                targetType: "User",
                targetId: user.id,
                description: `Account locked: 5 consecutive failed login attempts for ${email}`,
              });
            } catch {
              // Audit logging failure should not block auth
            }
          }

          return null;
        }

        // Clear lockout counter on successful login
        await clearAccountLockout(email);

        // Block unverified accounts — frontend detects this error code and shows resend prompt
        // IMPORTANT: run `npm run backfill:email-verified` against production BEFORE enabling this
        if (!user.emailVerified) {
          throw new Error("EMAIL_NOT_VERIFIED");
        }

        // If 2FA is enabled, issue a challenge token and require second factor
        if ((user as any).twoFactorEnabled) {
          const { issueTwoFactorChallenge } = await import("@/lib/two-factor-actions");
          const challengeToken = await issueTwoFactorChallenge(user.id);
          throw new Error(`TWO_FACTOR_REQUIRED::${challengeToken}`);
        }

        const normalizedRoles = normalizeAuthRolePayload({
          roles: user.roles.map((role) => role.role),
          primaryRole: user.primaryRole,
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          roles: normalizedRoles.roles,
          primaryRole: normalizedRoles.primaryRole
        } as any;
      }
    })
  ];

  // Add Google OAuth provider only when credentials are configured
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      })
    );
  }

  return providers;
}

export const authOptions: NextAuthOptions = {
  providers: buildProviders(),
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 }, // 24 hour max session
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  callbacks: {
    async signIn({ user, account }) {
      // Handle Google OAuth sign-in
      if (account?.provider === "google") {
        try {
          // Find existing user by email
          let dbUser = await prisma.user.findUnique({
            where: { email: user.email! },
            select: {
              id: true,
              primaryRole: true,
              oauthProvider: true,
              oauthId: true,
              emailVerified: true,
              image: true,
              roles: { select: { role: true } }
            }
          });

          if (!dbUser) {
            // Create new user with default STUDENT role
            dbUser = await prisma.user.create({
              data: {
                email: user.email!,
                name: user.name || "Google User",
                image: user.image,
                primaryRole: "STUDENT",
                oauthProvider: "google",
                oauthId: account.providerAccountId,
                emailVerified: new Date(),
                passwordHash: "",
                roles: { create: [{ role: "STUDENT" }] }
              },
              select: {
                id: true,
                primaryRole: true,
                oauthProvider: true,
                oauthId: true,
                emailVerified: true,
                image: true,
                roles: { select: { role: true } }
              }
            });
          } else {
            // Link Google account to existing user if not already linked
            await prisma.user.update({
              where: { id: dbUser.id },
              data: {
                oauthProvider: dbUser.oauthProvider ?? "google",
                oauthId: dbUser.oauthId ?? account.providerAccountId,
                emailVerified: dbUser.emailVerified ?? new Date(),
                image: dbUser.image ?? user.image,
              }
            });
          }

          // Upsert the OAuth account record (stores tokens for potential future use)
          await prisma.oAuthAccount.upsert({
            where: {
              provider_providerAccountId: {
                provider: account.provider,
                providerAccountId: account.providerAccountId,
              }
            },
            create: {
              userId: dbUser.id,
              type: account.type,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              access_token: account.access_token,
              refresh_token: account.refresh_token,
              expires_at: account.expires_at,
              token_type: account.token_type,
              scope: account.scope,
              id_token: account.id_token,
              session_state: account.session_state as string | undefined,
            },
            update: {
              access_token: account.access_token,
              refresh_token: account.refresh_token,
              expires_at: account.expires_at,
            }
          });

          // Inject the database user's id and roles into the user object
          // so the jwt callback can pick them up
          (user as any).id = dbUser.id;
          const normalizedRoles = normalizeAuthRolePayload({
            roles: dbUser.roles.map((r) => r.role),
            primaryRole: dbUser.primaryRole,
          });
          (user as any).roles = normalizedRoles.roles;
          (user as any).primaryRole = normalizedRoles.primaryRole;

          return true;
        } catch (error) {
          console.error("[Auth] Google OAuth sign-in error:", error);
          return false;
        }
      }

      return true; // Allow credentials sign-in (handled in authorize)
    },

    async jwt({ token, user, account }) {
      if (user) {
        token.id = (user as any).id;
        token.roles = (user as any).roles;
        token.primaryRole = (user as any).primaryRole;
        token.rolesRefreshedAt = Date.now();
      }

      if (account?.provider === "google") {
        token.provider = "google";
      }

      // Re-query roles from the database every 5 minutes
      const REFRESH_INTERVAL = 5 * 60 * 1000;
      if (
        token.id &&
        (!token.rolesRefreshedAt || Date.now() - (token.rolesRefreshedAt as number) > REFRESH_INTERVAL)
      ) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: {
              primaryRole: true,
              roles: { select: { role: true } }
            }
          });
          if (dbUser) {
            const normalizedRoles = normalizeAuthRolePayload({
              roles: dbUser.roles.map((r) => r.role),
              primaryRole: dbUser.primaryRole,
            });
            token.roles = normalizedRoles.roles;
            token.primaryRole = normalizedRoles.primaryRole;
          }
          token.rolesRefreshedAt = Date.now();
        } catch {
          // If DB query fails, keep existing roles
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).roles = token.roles;
        (session.user as any).primaryRole = token.primaryRole;
        (session.user as any).provider = token.provider;
      }
      return session;
    }
  },
  pages: {
    signIn: "/login"
  }
};
