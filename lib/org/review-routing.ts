/**
 * Review approval routing — who is allowed to FINALIZE a review.
 *
 * Phase 1 of docs/ROLES_ACCESS_REVIEWS_MENTORSHIP_PLAN.md. Pure rules layer
 * (no DB). Combines the org level spine (`lib/org/levels.ts`) with the
 * configurable carve-outs (`lib/org/review-exceptions.ts`).
 *
 * Proposal rules encoded here:
 *   - The approver must have a HIGHER internal level than the review author.
 *   - A mentor should not normally finalize a review they drafted
 *     (conflict of interest), UNLESS a self-finalize exception applies.
 *   - Board-on-Board: when the author is a Board Member (top level), another
 *     (different) Board Member may approve at the same level.
 */

import {
  TOP_INTERNAL_LEVEL,
  type PersonAuthority,
} from "@/lib/org/levels";
import {
  findSelfFinalizeException,
  refsMatch,
  type PersonRef,
} from "@/lib/org/review-exceptions";

/**
 * Does `approverLevel` clear the level bar to approve a review authored at
 * `authorLevel`? Strictly higher, except Board-on-Board where equal (top) passes.
 * Returns false when either level is unknown.
 */
export function hasApprovalLevelAuthority(
  approverLevel: number | null,
  authorLevel: number | null
): boolean {
  if (approverLevel == null || authorLevel == null) return false;
  if (authorLevel >= TOP_INTERNAL_LEVEL) {
    return approverLevel >= TOP_INTERNAL_LEVEL;
  }
  return approverLevel > authorLevel;
}

/** The minimum internal level required to approve a review by `author`. */
export function requiredApproverLevel(author: PersonAuthority): number | null {
  if (author.internalLevel == null) return null;
  if (author.internalLevel >= TOP_INTERNAL_LEVEL) return TOP_INTERNAL_LEVEL;
  return author.internalLevel + 1;
}

/**
 * True when finalizing this author's review requires Board-Member approval —
 * i.e. the author is an Officer (5) or above. Surfaces the proposal's rule that
 * Senior Officers cannot self-finalize when Board approval is required.
 */
export function requiresBoardApproval(author: PersonAuthority): boolean {
  return author.internalLevel != null && author.internalLevel >= 5;
}

export interface ReviewParticipant {
  ref: PersonRef;
  authority: PersonAuthority;
}

export interface ApprovalDecision {
  allowed: boolean;
  /** True when allowed only because a self-finalize exception applied. */
  viaException: boolean;
  /** Plain-language explanation (feeds "Why This Person Has Access"). */
  reason: string;
}

/**
 * Evaluate whether `approver` may finalize a review that `author` drafted about
 * `subject` (the mentee/person being reviewed). Pure — callers resolve refs and
 * authorities first.
 */
export function evaluateReviewApproval(args: {
  approver: ReviewParticipant;
  author: ReviewParticipant;
  subject: PersonRef;
  now?: Date;
}): ApprovalDecision {
  const { approver, author, subject, now } = args;

  const isSelf = refsMatch(approver.ref, author.ref);

  if (isSelf) {
    const exception = findSelfFinalizeException(author.ref, subject, now);
    if (exception) {
      return {
        allowed: true,
        viaException: true,
        reason:
          exception.note ??
          "Self-finalize allowed by a configured review-routing exception.",
      };
    }
    return {
      allowed: false,
      viaException: false,
      reason: "A mentor cannot give final approval to a review they drafted.",
    };
  }

  if (hasApprovalLevelAuthority(approver.authority.internalLevel, author.authority.internalLevel)) {
    return {
      allowed: true,
      viaException: false,
      reason: `Approver internal level ${approver.authority.internalLevel} outranks author level ${author.authority.internalLevel}.`,
    };
  }

  const needed = requiredApproverLevel(author.authority);
  return {
    allowed: false,
    viaException: false,
    reason:
      needed == null
        ? "Cannot determine the author's internal level, so approval authority is unknown."
        : `Approver internal level ${approver.authority.internalLevel ?? "unknown"} is below the required level ${needed}.`,
  };
}
