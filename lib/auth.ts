import { compare } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { checkLoginRateLimit } from "@/lib/rate-limit-redis";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

// Track consecutive failed login attempts (in-memory; for lockout alerts)
const failedAttempts = new Map<string, number>();
const LOCKOUT_THRESHOLD = 5;

function buildProviders() {
  const providers: NextAuthOptions["providers"] = [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const email = parsed.data.email.toLowerCase();

        // Rate limit: 10 login attempts per email per 15 minutes
        // Uses Redis in production, falls back to in-memory in development
        const rl = await checkLoginRateLimit(email);
        if (!rl.success) {
          throw new Error("Too many login attempts. Please try again later.");
        }

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            name: true,
            email: true,
            passwordHash: true,
            primaryRole: true,
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
          // Track failed attempts and create audit log after lockout threshold
          const current = (failedAttempts.get(email) || 0) + 1;
          failedAttempts.set(email, current);

          if (current === LOCKOUT_THRESHOLD) {
            // Log to audit if available (non-blocking, best effort)
            try {
              const { logAuditEvent } = await import("@/lib/audit-log-actions");
              await logAuditEvent({
                action: "SETTINGS_CHANGED",
                actorId: user.id,
                targetType: "User",
                targetId: user.id,
                description: `Account lockout alert: ${LOCKOUT_THRESHOLD} failed login attempts for ${email}`,
              });
            } catch {
              // Audit logging failure should not block auth
            }
          }

          return null;
        }

        // Clear failed attempts on success
        failedAttempts.delete(email);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          roles: user.roles.map((role) => role.role),
          primaryRole: user.primaryRole
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
          (user as any).roles = dbUser.roles.map((r) => r.role);
          (user as any).primaryRole = dbUser.primaryRole;

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
            token.roles = dbUser.roles.map((r) => r.role);
            token.primaryRole = dbUser.primaryRole;
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
