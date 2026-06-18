/**
 * Pure mentor-transfer planning (Phase 4 of
 * docs/ROLES_ACCESS_REVIEWS_MENTORSHIP_PLAN.md).
 *
 * Given the current primary mentor (if any) and the desired one, decide what a
 * non-destructive reassignment must do: complete the old mentorship, close its
 * history row, create the new mentorship, and open a new history row. No DB
 * here — `lib/mentorship-reassign-actions.ts` executes the plan in a
 * transaction. Notes, check-ins, and reviews are never touched: they stay on
 * the old (now completed) Mentorship row, so history is preserved by design.
 */

export type FocusArea = "INSTRUCTION" | "LEADERSHIP";

export interface CurrentAssignment {
  mentorshipId: string;
  mentorId: string;
  focusArea: FocusArea | null;
}

export interface DesiredAssignment {
  menteeId: string;
  newMentorId: string;
  focusArea: FocusArea | null;
  isTemporary: boolean;
}

export interface MentorTransferPlan {
  /** True when the desired mentor already holds this assignment — do nothing. */
  noop: boolean;
  /** Mentorship row to mark COMPLETE + end-date, or null when there is none. */
  completeMentorshipId: string | null;
  /** The mentor being replaced (whose open history row should be closed). */
  previousMentorId: string | null;
  /** The mentor taking over. */
  newMentorId: string;
  focusArea: FocusArea | null;
  isTemporary: boolean;
}

function sameFocus(a: FocusArea | null, b: FocusArea | null): boolean {
  return (a ?? null) === (b ?? null);
}

/**
 * Build the transfer plan. When the current mentor already matches the desired
 * mentor for the same focus area, the plan is a no-op.
 */
export function buildMentorTransferPlan(
  current: CurrentAssignment | null,
  desired: DesiredAssignment
): MentorTransferPlan {
  if (
    current &&
    current.mentorId === desired.newMentorId &&
    sameFocus(current.focusArea, desired.focusArea)
  ) {
    return {
      noop: true,
      completeMentorshipId: null,
      previousMentorId: current.mentorId,
      newMentorId: desired.newMentorId,
      focusArea: desired.focusArea,
      isTemporary: desired.isTemporary,
    };
  }

  return {
    noop: false,
    completeMentorshipId: current?.mentorshipId ?? null,
    previousMentorId: current?.mentorId ?? null,
    newMentorId: desired.newMentorId,
    focusArea: desired.focusArea,
    isTemporary: desired.isTemporary,
  };
}
