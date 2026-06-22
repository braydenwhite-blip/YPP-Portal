import { InstructorApplicationStatus } from "@prisma/client";

/**
 * Stage rules for the instructor-applicant *initial* (paper) review.
 *
 * An `InstructorApplicationReview` may only be created or edited while the
 * applicant is still in the initial-review stage. The moment the applicant
 * advances to the interview stage — or any later stage — every submitted
 * initial review becomes permanently read-only. Historical reviews are never
 * deleted or overwritten; they remain visible as evidence on the Chair's
 * decision workspace.
 *
 * This module is intentionally dependency-free (a pure status predicate) so it
 * can be shared by server actions, API routes, server components, and client
 * components without pulling Prisma into the client bundle.
 */
export const INITIAL_REVIEW_EDITABLE_STATUSES: ReadonlyArray<InstructorApplicationStatus> = [
  InstructorApplicationStatus.SUBMITTED,
  InstructorApplicationStatus.UNDER_REVIEW,
  InstructorApplicationStatus.INFO_REQUESTED,
];

/** User-facing message shown when an initial review is accessed after lock. */
export const INITIAL_REVIEW_LOCKED_MESSAGE =
  "Initial reviews are locked after the applicant advances to the interview stage.";

/**
 * `true` while the applicant is still in the initial-review stage and initial
 * reviews may be created or edited. Accepts the enum or its string form so it
 * is callable from serialized (client) payloads too.
 */
export function isInitialReviewStage(
  status: InstructorApplicationStatus | string | null | undefined
): boolean {
  if (!status) return false;
  return (INITIAL_REVIEW_EDITABLE_STATUSES as ReadonlyArray<string>).includes(String(status));
}

/** Inverse convenience: the applicant has advanced and initial reviews are locked. */
export function isInitialReviewLocked(
  status: InstructorApplicationStatus | string | null | undefined
): boolean {
  return !isInitialReviewStage(status);
}
