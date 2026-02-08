import { compare } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

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

        // Rate limit: 10 login attempts per email per 15 minutes
        const rl = checkRateLimit(`login:${parsed.data.email}`, 10, 15 * 60 * 1000);
        if (!rl.success) {
          throw new Error("Too many login attempts. Please try again later.");
        }

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          // Use explicit select so deploys don't break if new columns
          // (like xp/level) haven't been migrated yet.
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
          return null;
        }

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
