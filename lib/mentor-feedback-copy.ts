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

/**
 * Calm Mentorship (Phase 8) — the single feedback headline. Calm leads with the
 * one thing that matters: for a mentor, how many requests are waiting on them;
 * for a mentee, a warm nudge to ask. Pure so the framing stays unit-pinned.
 */
export function feedbackCalmHeadline(isMentor: boolean, pendingCount: number): string {
  if (isMentor) {
    if (pendingCount === 0) return "You're all caught up on feedback";
    if (pendingCount === 1) return "1 request needs your response";
    return `${pendingCount} requests need your response`;
  }
  if (pendingCount === 0) return "Ask for feedback whenever you're ready";
  return `${pendingCount} request${pendingCount === 1 ? "" : "s"} waiting on a mentor`;
}

export function feedbackCalmReason(isMentor: boolean, pendingCount: number): string {
  if (isMentor) {
    return pendingCount === 0
      ? "No mentees are waiting on you right now — new requests will show up here."
      : "Respond inline below — a clear next step and one suggestion go a long way.";
  }
  return pendingCount === 0
    ? "Share a real piece of work and a specific question to get personalized notes."
    : "Your mentor has been notified and will reply with personalized notes soon.";
}
