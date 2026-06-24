/**
 * Cross-system "what I did this week" suggestions for the Weekly Impact form.
 *
 * Weekly Impact is meant to capture a person's whole week — including the
 * mentorship they ran and the reviews they wrote. This module turns those
 * dated artifacts (completed mentorship sessions, mentor goal reviews, people
 * quarterly reviews) into one-click impact-row suggestions. Pure + client-safe
 * (no prisma/server-only) so the form can import the types and the mapping is
 * unit-testable; the server loader lives in ./contributions.
 */

export type ContributionKind =
  | "mentorship_session"
  | "mentor_review"
  | "quarterly_review";

export type ContributionSuggestion = {
  /** Stable key for dedupe + React lists. */
  key: string;
  kind: ContributionKind;
  kindLabel: string;
  /** Prefill for the row's Type column. */
  type: string;
  /** Prefill for What / Goal. */
  whatGoal: string;
  /** Prefill for Evidence / Next action. */
  evidenceNext: string;
  /** When it happened (ISO), for ordering + display. */
  dateISO: string;
};

const SESSION_TYPE_LABELS: Record<string, string> = {
  KICKOFF: "Kickoff",
  CHECK_IN: "Check-in",
  REVIEW_PREP: "Review prep",
  QUARTERLY_REVIEW: "Quarterly review",
  OFFICE_HOURS: "Office hours",
};

export function mentorshipSessionTypeLabel(type: string): string {
  return SESSION_TYPE_LABELS[type] ?? "Session";
}

export type RawContributions = {
  sessions: Array<{
    id: string;
    title: string;
    type: string;
    menteeId: string;
    completedISO: string;
  }>;
  mentorReviews: Array<{
    id: string;
    menteeId: string;
    isQuarterly: boolean;
    updatedISO: string;
  }>;
  quarterlyReviews: Array<{
    id: string;
    userId: string;
    quarter: string;
    createdISO: string;
  }>;
  /** Resolved display names by user id. */
  names: Record<string, string>;
};

function nameOf(names: Record<string, string>, id: string): string {
  return names[id]?.trim() || "a teammate";
}

/**
 * Fold the raw cross-system rows into impact-row suggestions, newest first.
 * Pure: callers resolve names + ISO strings; this only formats + sorts.
 */
export function buildContributions(input: RawContributions): ContributionSuggestion[] {
  const out: ContributionSuggestion[] = [];

  for (const s of input.sessions) {
    const mentee = nameOf(input.names, s.menteeId);
    const typeLabel = mentorshipSessionTypeLabel(s.type);
    out.push({
      key: `mentorship_session:${s.id}`,
      kind: "mentorship_session",
      kindLabel: "Mentorship",
      type: "Mentorship",
      whatGoal: s.title?.trim() || `${typeLabel} with ${mentee}`,
      evidenceNext: `Ran a ${typeLabel.toLowerCase()} mentorship session with ${mentee}`,
      dateISO: s.completedISO,
    });
  }

  for (const r of input.mentorReviews) {
    const mentee = nameOf(input.names, r.menteeId);
    out.push({
      key: `mentor_review:${r.id}`,
      kind: "mentor_review",
      kindLabel: "Mentorship review",
      type: "Mentorship",
      whatGoal: `${r.isQuarterly ? "Quarterly" : "Monthly"} mentorship review for ${mentee}`,
      evidenceNext: "Submitted the goal review with ratings and a plan of action",
      dateISO: r.updatedISO,
    });
  }

  for (const q of input.quarterlyReviews) {
    const subject = nameOf(input.names, q.userId);
    out.push({
      key: `quarterly_review:${q.id}`,
      kind: "quarterly_review",
      kindLabel: "Quarterly review",
      type: "Review",
      whatGoal: `Quarterly review — ${subject} (${q.quarter})`,
      evidenceNext: "Recorded performance, potential, and the review decision",
      dateISO: q.createdISO,
    });
  }

  return out.sort((a, b) => b.dateISO.localeCompare(a.dateISO));
}
