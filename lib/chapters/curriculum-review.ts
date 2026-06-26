// Chapter curriculum-review read model. Pure + deterministic (pass `now`) so it
// is fully unit testable. Maps the portal's existing ClassTemplate.submissionStatus
// (and CurriculumDraft) onto the Chapter President playbook's curriculum statuses
// and flags the work waiting on the CP — chiefly the 48-hour review SLA.
//
// NOTE (Phase 1): the portal currently has a SINGLE approval (a chapter
// president / admin approves a submitted curriculum to APPROVED). The playbook
// also distinguishes "CP Approved" from a later "Global Review" / "Fully
// Approved". Until that two-stage split lands (Phase 2), APPROVED maps to
// "approved" and the global stage is surfaced as a recommendation, not invented
// data.

const HOUR_MS = 60 * 60 * 1000;

/** Playbook curriculum statuses (the words the CP playbook uses). */
export const CURRICULUM_PLAYBOOK_STATUSES = [
  "not_submitted",
  "submitted",
  "needs_revision",
  "approved",
] as const;
export type CurriculumPlaybookStatus = (typeof CURRICULUM_PLAYBOOK_STATUSES)[number];

export const CURRICULUM_PLAYBOOK_STATUS_LABELS: Record<CurriculumPlaybookStatus, string> = {
  not_submitted: "Not Submitted",
  submitted: "Submitted — CP review needed",
  needs_revision: "Needs Revision",
  approved: "Approved",
};

/** Map ClassTemplate.submissionStatus (or CurriculumDraft.status) → playbook status. */
export function curriculumPlaybookStatus(status: string | null | undefined): CurriculumPlaybookStatus {
  switch (status) {
    case "SUBMITTED":
      return "submitted";
    case "NEEDS_REVISION":
      return "needs_revision";
    case "APPROVED":
      return "approved";
    case "DRAFT":
    case "IN_PROGRESS":
    case "COMPLETED":
    case "REJECTED":
    case null:
    case undefined:
      return "not_submitted";
    default:
      return "not_submitted";
  }
}

/** Hours a CP has to review a submitted curriculum before it's overdue (playbook: 48h). */
export const CURRICULUM_REVIEW_SLA_HOURS = 48;

/** The minimal curriculum shape the summarizer needs. */
export type CurriculumRecord = {
  id: string;
  title: string;
  instructorName: string | null;
  status: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
};

/** A submitted curriculum still waiting on CP review past the 48-hour SLA. */
export function curriculumReviewOverdue(c: CurriculumRecord, now: Date): boolean {
  if (curriculumPlaybookStatus(c.status) !== "submitted") return false;
  if (!c.submittedAt) return false;
  const hours = (now.getTime() - c.submittedAt.getTime()) / HOUR_MS;
  return hours >= CURRICULUM_REVIEW_SLA_HOURS;
}

/** Whole hours a submitted curriculum has been waiting (for "waiting 3 days" copy). */
export function curriculumHoursWaiting(c: CurriculumRecord, now: Date): number {
  if (!c.submittedAt) return 0;
  return Math.max(0, Math.floor((now.getTime() - c.submittedAt.getTime()) / HOUR_MS));
}

export type CurriculumReviewSummary = {
  total: number;
  byStatus: Record<CurriculumPlaybookStatus, number>;
  reviewNeeded: number; // submitted, awaiting CP
  reviewOverdue: number; // submitted > 48h
  needsRevision: number;
  approved: number;
};

/** Roll a set of curricula into the chapter curriculum-review headline. */
export function summarizeCurriculumReview(
  curricula: CurriculumRecord[],
  now: Date
): CurriculumReviewSummary {
  const byStatus = Object.fromEntries(
    CURRICULUM_PLAYBOOK_STATUSES.map((s) => [s, 0])
  ) as Record<CurriculumPlaybookStatus, number>;

  let reviewOverdue = 0;
  for (const c of curricula) {
    byStatus[curriculumPlaybookStatus(c.status)] += 1;
    if (curriculumReviewOverdue(c, now)) reviewOverdue += 1;
  }

  return {
    total: curricula.length,
    byStatus,
    reviewNeeded: byStatus.submitted,
    reviewOverdue,
    needsRevision: byStatus.needs_revision,
    approved: byStatus.approved,
  };
}
