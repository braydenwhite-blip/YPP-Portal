import "server-only";

import { prisma } from "@/lib/prisma";
import { computeLeadershipPreviewAccessFlag } from "@/lib/leadership-preview-access";
import { updateSupabasePortalUser } from "@/lib/portal-auth-utils";
import { normalizeRoleValue, normalizeRoleValues } from "@/lib/role-utils";

/**
 * Mirror Prisma roles + org ladder into Supabase `user_metadata` so edge
 * middleware and JWT claims match the database (officer tier, Sam/Zach pilots).
 */
export async function syncPortalAuthMetadataForPrismaUser(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      primaryRole: true,
      chapterId: true,
      archivedAt: true,
      internalLevel: true,
      supabaseAuthId: true,
      roles: { select: { role: true } },
    },
  });

  if (!user?.supabaseAuthId || !user.email || user.archivedAt) return;

  const roles = normalizeRoleValues(user.roles.map((entry) => entry.role));
  const primaryRole = roles.includes("ADMIN")
    ? "ADMIN"
    : normalizeRoleValue(user.primaryRole) ?? roles[0] ?? "STUDENT";
  const leadershipPreviewAccess = computeLeadershipPreviewAccessFlag({
    id: user.id,
    email: user.email,
    roles,
    primaryRole,
    internalLevel: user.internalLevel,
  });

  await updateSupabasePortalUser({
    supabaseAuthId: user.supabaseAuthId,
    email: user.email,
    name: user.name ?? user.email,
    chapterId: user.chapterId,
    portalArchived: false,
    primaryRole,
    prismaUserId: user.id,
    roles,
    internalLevel: user.internalLevel,
    leadershipPreviewAccess,
  });
}
