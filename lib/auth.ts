import { compare } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
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

export const authOptions: NextAuthOptions = {
  providers: [
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
  ],
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 }, // 24 hour max session
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.roles = (user as any).roles;
        token.primaryRole = (user as any).primaryRole;
        token.rolesRefreshedAt = Date.now();
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
      }
      return session;
    }
  },
  pages: {
    signIn: "/login"
  }
};
