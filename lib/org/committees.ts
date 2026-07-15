/**
 * Real committee-membership access — the `Committee` / `CommitteeMembership`
 * models (prisma/schema.prisma) exist so a person can gain a specific
 * committee's permissions without their title/ladder level changing, but
 * until now nothing actually read them: `canAccessInstructionCommittee` etc.
 * in `lib/org/capabilities.ts` are derived purely from ladder level. This
 * module is the missing bridge — an active `CommitteeMembership` row grants
 * access on its own, independent of level.
 */

import { prisma } from "@/lib/prisma";

/** True when `userId` has an active membership in the named (or slugged) committee. */
export async function isActiveCommitteeMember(
  userId: string,
  committee: { name?: string; slug?: string }
): Promise<boolean> {
  const nameOrSlug = [
    committee.name ? { name: committee.name } : null,
    committee.slug ? { slug: committee.slug } : null,
  ].filter((clause): clause is { name: string } | { slug: string } => clause !== null);
  if (nameOrSlug.length === 0) return false;

  const membership = await prisma.committeeMembership.findFirst({
    where: {
      userId,
      isActive: true,
      committee: { archivedAt: null, OR: nameOrSlug },
    },
    select: { id: true },
  });
  return membership != null;
}

/** Convenience wrapper for the Instruction Committee specifically. */
export function isOnInstructionCommittee(userId: string): Promise<boolean> {
  return isActiveCommitteeMember(userId, {
    name: "Instruction Committee",
    slug: "instruction-committee",
  });
}
