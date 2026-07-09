/**
 * Server-side bridge that enforces the pure review-approval rules
 * (`lib/org/review-routing.ts`) against real users.
 *
 * Phase 1 of docs/ROLES_ACCESS_REVIEWS_MENTORSHIP_PLAN.md. This is ADDITIVE and
 * ON BY DEFAULT — see isReviewAuthorityEnforced() below for the exact rule and
 * its kill-switch (`ORG_REVIEW_AUTHORITY_ENFORCED=false`). It layers the
 * "approver outranks author (or has a configured exception)" rule on top of
 * the existing chair/admin checks — it can only ever *restrict*, never widen,
 * who may finalize a review, and it fails open when a participant's org
 * authority can't be resolved.
 */

import { prisma } from "@/lib/prisma";
import { resolvePersonAuthority } from "@/lib/org/levels";
import {
  evaluateReviewApproval,
  type ApprovalDecision,
  type ReviewParticipant,
} from "@/lib/org/review-routing";

/**
 * Whether level/exception-based review approval enforcement is turned on.
 * Default ON (canonical model) with an explicit kill-switch:
 * `ORG_REVIEW_AUTHORITY_ENFORCED=false` disables it. The guard still fails open
 * when participants or internal levels can't be resolved, so flipping this on
 * before the org-authority backfill never locks anyone out.
 */
export function isReviewAuthorityEnforced(): boolean {
  return process.env.ORG_REVIEW_AUTHORITY_ENFORCED !== "false";
}

async function loadParticipant(userId: string): Promise<ReviewParticipant | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      title: true,
      primaryRole: true,
      internalLevel: true,
      ladder: true,
      canonicalTitle: true,
      adminSubtypes: { select: { subtype: true } },
    },
  });
  if (!user) return null;
  return {
    ref: { id: user.id, name: user.name },
    authority: resolvePersonAuthority({
      title: user.title,
      primaryRole: user.primaryRole,
      internalLevel: user.internalLevel,
      ladder: user.ladder,
      canonicalTitle: user.canonicalTitle,
      adminSubtypes: user.adminSubtypes.map((s) => s.subtype),
    }),
  };
}

/**
 * Throws Unauthorized when the flag is on and `approverId` is not permitted to
 * finalize a review authored by `authorId` about `subject`. No-op (returns the
 * decision, or null) when the flag is off or a participant cannot be loaded.
 */
export async function assertReviewApprovalAuthority(args: {
  approverId: string;
  authorId: string;
  subject: { id: string; name?: string | null };
}): Promise<ApprovalDecision | null> {
  if (!isReviewAuthorityEnforced()) return null;

  const [approver, author, subject] = await Promise.all([
    loadParticipant(args.approverId),
    loadParticipant(args.authorId),
    loadParticipant(args.subject.id),
  ]);

  // If we cannot resolve participants, fail open (do not block existing
  // flows on incomplete data while the spine is still being populated).
  if (!approver || !author || !subject) return null;

  const decision = evaluateReviewApproval({
    approver,
    author,
    subject,
  });

  if (!decision.allowed) {
    throw new Error(`Unauthorized: ${decision.reason}`);
  }
  return decision;
}
