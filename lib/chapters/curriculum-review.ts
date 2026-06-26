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
  /** Passion / interest area, e.g. "Computer Science" — the table's Subject. */
  subject: string | null;
  instructorName: string | null;
  status: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
};

/** Short stage label for the evidence table (the full label is too long there). */
export const CURRICULUM_SHORT_STAGE: Record<CurriculumPlaybookStatus, string> = {
  not_submitted: "Not Started",
  submitted: "In Review",
  needs_revision: "Needs Revision",
  approved: "Approved",
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

// --- Curriculum evidence rows (the Deliberable table) ----------------------

/** Health of a single curriculum in the evidence table. */
export type CurriculumEvidenceStatus = "ready" | "needs_feedback" | "not_started";

export type CurriculumEvidenceRow = {
  id: string;
  title: string;
  subject: string;
  /** Short stage label, e.g. "In Review". */
  stage: string;
  owner: string;
  status: CurriculumEvidenceStatus;
};

/** Map playbook status → the table's three-way health. */
export function curriculumEvidenceStatus(status: string | null | undefined): CurriculumEvidenceStatus {
  switch (curriculumPlaybookStatus(status)) {
    case "approved":
      return "ready";
    case "submitted":
    case "needs_revision":
      return "needs_feedback";
    default:
      return "not_started";
  }
}

/** Build one curriculum evidence row. */
export function curriculumEvidenceRow(c: CurriculumRecord): CurriculumEvidenceRow {
  return {
    id: c.id,
    title: c.title,
    subject: c.subject && c.subject.trim() ? c.subject.trim() : "—",
    stage: CURRICULUM_SHORT_STAGE[curriculumPlaybookStatus(c.status)],
    owner: c.instructorName && c.instructorName.trim() ? c.instructorName.trim() : "Unassigned",
    status: curriculumEvidenceStatus(c.status),
  };
}

/** The curriculum Deliberable's one recommended next step. */
export function curriculumReviewRecommendation(summary: CurriculumReviewSummary): string {
  if (summary.total === 0) return "No curricula yet — instructors submit theirs as classes take shape.";
  const n = (x: number) => (x === 1 ? "" : "s");
  if (summary.reviewOverdue > 0) {
    return `Review ${summary.reviewOverdue} curriculum${summary.reviewOverdue === 1 ? "" : "s"} overdue past the 48-hour window.`;
  }
  if (summary.reviewNeeded > 0) {
    return `Give feedback on ${summary.reviewNeeded} curriculum${
      summary.reviewNeeded === 1 ? "" : "s"
    } in review to move ${summary.reviewNeeded === 1 ? "it" : "them"} to approval.`;
  }
  if (summary.needsRevision > 0) {
    return `Follow up on ${summary.needsRevision} curriculum${
      summary.needsRevision === 1 ? "" : "s"
    } needing revision.`;
  }
  const notStarted = summary.byStatus.not_submitted;
  if (notStarted > 0) {
    return `Nudge ${notStarted} instructor${n(notStarted)} to submit their curriculum.`;
  }
  return "Curriculum is ready for your planned classes.";
}
