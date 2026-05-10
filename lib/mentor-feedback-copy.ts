/**
 * Pure copy helpers for the /mentor/feedback portal. Extracted so the
 * mentor-side framing (mentee, not student) can be unit-pinned. The portal
 * routes feedback for both student and instructor mentees, so the mentor
 * copy must use the generic "mentee" term.
 */
export function feedbackPortalSubtitle(isMentor: boolean): string {
  return isMentor
    ? "Review submitted work from your mentees and provide personalized notes and resources."
    : "Submit your work for review and receive personalized feedback from experienced mentors.";
}

export function feedbackPortalEmptyState(isMentor: boolean): string {
  return isMentor
    ? "When your mentees submit work for review, their requests will appear here."
    : "Submit your work for review to get personalized feedback from experienced mentors.";
}
