/**
 * Review approval routing — who is allowed to FINALIZE a review.
 *
 * Phase 1 of docs/ROLES_ACCESS_REVIEWS_MENTORSHIP_PLAN.md. Pure rules layer
 * (no DB). Combines the org level spine (`lib/org/levels.ts`) with the
 * configurable carve-outs (`lib/org/review-exceptions.ts`).
 *
 * Proposal rules encoded here:
 *   - The approver must be in a HIGHER role than the person being reviewed.
 *   - A mentor should not normally finalize a review they drafted
 *     (conflict of interest), UNLESS a self-finalize exception applies.
 *   - Officer and Senior Officer reviews require Board approval.
 *   - Board-on-Board: when the subject is a Board Member (top level), another
 *     (different) Board Member may approve at the same level.
 */

import {
  TOP_INTERNAL_LEVEL,
  type PersonAuthority,
} from "@/lib/org/levels";
import {
  findBoardApprovalReviewRoute,
  findSelfFinalizeException,
  refsMatch,
  type PersonRef,
  type SelfFinalizeException,
  type BoardApprovalReviewRoute,
} from "@/lib/org/review-exceptions";

/**
 * Does `approverLevel` clear the role bar to approve a review for someone at
 * `subjectLevel`? Strictly higher, except Board-on-Board where equal (top) passes.
 * Returns false when either level is unknown.
 */
export function hasApprovalLevelAuthority(
  approverLevel: number | null,
  subjectLevel: number | null
): boolean {
  if (approverLevel == null || subjectLevel == null) return false;
  if (subjectLevel >= TOP_INTERNAL_LEVEL) {
    return approverLevel >= TOP_INTERNAL_LEVEL;
  }
  return approverLevel > subjectLevel;
}

/** The minimum role bar required to approve a review about `subject`. */
export function requiredApproverLevel(subject: PersonAuthority): number | null {
  if (subject.internalLevel == null) return null;
  if (subject.internalLevel >= TOP_INTERNAL_LEVEL) return TOP_INTERNAL_LEVEL;
  return subject.internalLevel + 1;
}

/**
 * True when finalizing this subject's review requires Board-Member approval.
 * Officer, Senior Officer, and Board reviews go to Board approval.
 */
export function requiresBoardApproval(subject: PersonAuthority): boolean {
  return subject.internalLevel != null && subject.internalLevel >= 5;
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
  subject: ReviewParticipant;
  now?: Date;
  /** Overrides for the built-in exception lists — merge in admin-configured rows. */
  selfFinalizeExceptions?: SelfFinalizeException[];
  boardApprovalRoutes?: BoardApprovalReviewRoute[];
}): ApprovalDecision {
  const { approver, author, subject, now, selfFinalizeExceptions, boardApprovalRoutes } = args;

  // Fail open while the org-authority spine is being populated: if either the
  // approver or subject role is unknown we cannot evaluate the comparison,
  // so this additive guard defers to the existing chair/admin approval checks
  // rather than blocking. Once levels are backfilled the rules below apply.
  if (
    approver.authority.internalLevel == null ||
    subject.authority.internalLevel == null
  ) {
    return {
      allowed: true,
      viaException: false,
      reason:
        "Role setup is not complete yet; deferring to existing approval checks.",
    };
  }

  const isSelf = refsMatch(approver.ref, author.ref);

  if (isSelf) {
    const exception = findSelfFinalizeException(
      author.ref,
      subject.ref,
      now,
      selfFinalizeExceptions
    );
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

  const boardRoute = findBoardApprovalReviewRoute(
    author.ref,
    subject.ref,
    subject.authority,
    now,
    boardApprovalRoutes
  );
  if (boardRoute || requiresBoardApproval(subject.authority)) {
    if (approver.authority.internalLevel >= TOP_INTERNAL_LEVEL) {
      return {
        allowed: true,
        viaException: false,
        reason: boardRoute?.note ?? "Board approval is required and the approver is Board.",
      };
    }
    return {
      allowed: false,
      viaException: false,
      reason: boardRoute?.note ?? "Officer and Senior Officer reviews require Board approval.",
    };
  }

  if (hasApprovalLevelAuthority(approver.authority.internalLevel, subject.authority.internalLevel)) {
    return {
      allowed: true,
      viaException: false,
      reason: "Approver is in a higher role than the person being reviewed.",
    };
  }

  const needed = requiredApproverLevel(subject.authority);
  return {
    allowed: false,
    viaException: false,
    reason:
      needed == null
        ? "Cannot determine the person's role, so approval authority is unknown."
        : "This review needs approval from someone in a higher role than the person being reviewed.",
  };
}
