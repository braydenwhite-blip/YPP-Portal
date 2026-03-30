import { createServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { normalizeRoleValues, normalizeRoleValue } from "@/lib/role-utils";

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  roles: string[];
  primaryRole: string;
  chapterId?: string | null;
};

/**
 * Get the current authenticated user from Supabase Auth,
 * resolved to the Prisma User record with roles.
 *
 * Returns null if not authenticated or user not found in DB.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const prismaUser = await prisma.user.findUnique({
    where: { supabaseAuthId: authUser.id },
    select: {
      id: true,
      name: true,
      email: true,
      primaryRole: true,
      chapterId: true,
      roles: { select: { role: true } },
    },
  });

  if (!prismaUser) return null;

  const roles = normalizeRoleValues(prismaUser.roles.map((r) => r.role));
  const primaryRole =
    normalizeRoleValue(prismaUser.primaryRole) ?? roles[0] ?? "STUDENT";

  if (!roles.includes(primaryRole)) {
    roles.unshift(primaryRole);
  }

  return {
    id: prismaUser.id,
    name: prismaUser.name,
    email: prismaUser.email,
    roles: Array.from(new Set(roles)),
    primaryRole,
    chapterId: prismaUser.chapterId,
  };
}

/**
 * Drop-in replacement for `getServerSession(authOptions)`.
 * Returns a session-like object with `user` property, matching
 * the shape that all existing code expects.
 */
export async function getSession(): Promise<{
  user: SessionUser & { image?: string | null };
} | null> {
  const user = await getSessionUser();
  if (!user) return null;
  return { user: { ...user, image: null } };
}
