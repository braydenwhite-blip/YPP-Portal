/**
 * Server-side bridge that enforces the pure review-approval rules
 * (`lib/org/review-routing.ts`) against real users.
 *
 * Phase 1 of docs/ROLES_ACCESS_REVIEWS_MENTORSHIP_PLAN.md. This is ADDITIVE and
 * OFF BY DEFAULT: unless `ORG_REVIEW_AUTHORITY_ENFORCED=true`, the guard is a
 * no-op so existing approval flows are completely unchanged. When enabled it
 * layers the "approver outranks author (or has a configured exception)" rule on
 * top of the existing chair/admin checks — it can only ever *restrict*, never
 * widen, who may finalize a review.
 */

import { prisma } from "@/lib/prisma";
import { resolvePersonAuthority } from "@/lib/org/levels";
import {
  evaluateReviewApproval,
  type ApprovalDecision,
  type ReviewParticipant,
} from "@/lib/org/review-routing";

/** Whether level/exception-based review approval enforcement is turned on. */
export function isReviewAuthorityEnforced(): boolean {
  return process.env.ORG_REVIEW_AUTHORITY_ENFORCED === "true";
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

  const [approver, author] = await Promise.all([
    loadParticipant(args.approverId),
    loadParticipant(args.authorId),
  ]);

  // If we cannot resolve both participants, fail open (do not block existing
  // flows on incomplete data while the spine is still being populated).
  if (!approver || !author) return null;

  const decision = evaluateReviewApproval({
    approver,
    author,
    subject: { id: args.subject.id, name: args.subject.name ?? null },
  });

  if (!decision.allowed) {
    throw new Error(`Unauthorized: ${decision.reason}`);
  }
  return decision;
}
