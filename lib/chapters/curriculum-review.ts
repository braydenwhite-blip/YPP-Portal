// Chapter curriculum-review read model. Pure + deterministic (pass `now`) so it
// is fully unit testable.
//
// Phase 4: this is now a REAL two-stage approval model. The portal stores the
// authoritative stage on the `CurriculumApproval` satellite
// (`CurriculumApprovalStage`); when no approval row exists yet a template falls
// back to its legacy single-stage `ClassTemplate.submissionStatus`. The playbook
// pipeline is: Not Submitted → CP Review → (Needs Revision) → CP Approved →
// Global Review → (Global Revision) → Fully Approved. Only a TRUE global
// approval (`fully_approved`) satisfies launch readiness.

const HOUR_MS = 60 * 60 * 1000;

/** Raw stage values stored on `CurriculumApproval.stage` (Prisma enum). */
export const CURRICULUM_APPROVAL_STAGES = [
  "NOT_SUBMITTED",
  "CP_REVIEW",
  "CP_REVISION_REQUESTED",
  "CP_APPROVED",
  "GLOBAL_REVIEW",
  "GLOBAL_REVISION_REQUESTED",
  "FULLY_APPROVED",
] as const;
export type CurriculumApprovalStage = (typeof CURRICULUM_APPROVAL_STAGES)[number];

/** Playbook curriculum statuses — the UI-facing, lower-cased stage keys. */
export const CURRICULUM_PLAYBOOK_STATUSES = [
  "not_submitted",
  "cp_review",
  "cp_revision",
  "cp_approved",
  "global_review",
  "global_revision",
  "fully_approved",
] as const;
export type CurriculumPlaybookStatus = (typeof CURRICULUM_PLAYBOOK_STATUSES)[number];

export const CURRICULUM_PLAYBOOK_STATUS_LABELS: Record<CurriculumPlaybookStatus, string> = {
  not_submitted: "Not Submitted",
  cp_review: "CP Review Needed",
  cp_revision: "Needs Revision",
  cp_approved: "CP Approved",
  global_review: "Global Review Needed",
  global_revision: "Global Revision Requested",
  fully_approved: "Fully Approved",
};

/** Short stage label for the evidence table (the full label is too long there). */
export const CURRICULUM_SHORT_STAGE: Record<CurriculumPlaybookStatus, string> = {
  not_submitted: "Not Started",
  cp_review: "CP Review",
  cp_revision: "Needs Revision",
  cp_approved: "CP Approved",
  global_review: "Global Review",
  global_revision: "Global Revision",
  fully_approved: "Approved",
};

/** Who owes the next move at each stage. */
export type CurriculumActor = "instructor" | "chapter_president" | "global_leadership" | "none";

export const CURRICULUM_STAGE_ACTOR: Record<CurriculumPlaybookStatus, CurriculumActor> = {
  not_submitted: "instructor",
  cp_review: "chapter_president",
  cp_revision: "instructor",
  cp_approved: "chapter_president", // ready to escalate to global review
  global_review: "global_leadership",
  global_revision: "instructor",
  fully_approved: "none",
};

export const CURRICULUM_ACTOR_LABEL: Record<CurriculumActor, string> = {
  instructor: "Instructor",
  chapter_president: "Chapter President",
  global_leadership: "Global Leadership",
  none: "No one — done",
};

function stageToPlaybook(stage: CurriculumApprovalStage): CurriculumPlaybookStatus {
  switch (stage) {
    case "NOT_SUBMITTED":
      return "not_submitted";
    case "CP_REVIEW":
      return "cp_review";
    case "CP_REVISION_REQUESTED":
      return "cp_revision";
    case "CP_APPROVED":
      return "cp_approved";
    case "GLOBAL_REVIEW":
      return "global_review";
    case "GLOBAL_REVISION_REQUESTED":
      return "global_revision";
    case "FULLY_APPROVED":
      return "fully_approved";
  }
}

/**
 * Legacy fallback used when a template has no `CurriculumApproval` row yet.
 * Existing single-stage APPROVED templates are grandfathered to `fully_approved`
 * so pre-Phase-4 chapters keep satisfying launch readiness (no regression); a
 * new submission only becomes fully approved by going through both stages.
 */
function legacyStatusToPlaybook(status: string | null | undefined): CurriculumPlaybookStatus {
  switch (status) {
    case "SUBMITTED":
      return "cp_review";
    case "NEEDS_REVISION":
      return "cp_revision";
    case "APPROVED":
      return "fully_approved";
    default:
      return "not_submitted";
  }
}

/** Minimal shape every derivation accepts. */
export type CurriculumStageInput = { approvalStage?: string | null; status?: string | null };

/** Map a curriculum (two-stage stage, or legacy submissionStatus) → playbook status. */
export function curriculumPlaybookStatus(rec: CurriculumStageInput): CurriculumPlaybookStatus {
  const stage = rec.approvalStage;
  if (stage && (CURRICULUM_APPROVAL_STAGES as readonly string[]).includes(stage)) {
    return stageToPlaybook(stage as CurriculumApprovalStage);
  }
  return legacyStatusToPlaybook(rec.status);
}

/** Who must act next on this curriculum. */
export function curriculumActor(rec: CurriculumStageInput): CurriculumActor {
  return CURRICULUM_STAGE_ACTOR[curriculumPlaybookStatus(rec)];
}

/** Does this curriculum satisfy launch readiness? Only a TRUE global approval. */
export function curriculumSatisfiesLaunch(rec: CurriculumStageInput): boolean {
  return curriculumPlaybookStatus(rec) === "fully_approved";
}

// --- The transition state machine (pure) -----------------------------------

export type CurriculumReviewAction =
  | "submit_for_cp_review"
  | "cp_request_revision"
  | "cp_approve"
  | "send_to_global"
  | "global_approve"
  | "global_request_revision";

/** Reviewer authority each action demands. "author" = instructor (re)submits. */
export type CurriculumActionAuthority = "author" | "chapter_president" | "global_leadership";

export const CURRICULUM_ACTION_AUTHORITY: Record<CurriculumReviewAction, CurriculumActionAuthority> = {
  submit_for_cp_review: "author",
  cp_request_revision: "chapter_president",
  cp_approve: "chapter_president",
  send_to_global: "chapter_president",
  global_approve: "global_leadership",
  global_request_revision: "global_leadership",
};

/**
 * The resulting stage if `action` is applied to `stage`, or null if the action
 * is illegal from that stage. This is the single source of truth the server
 * actions validate against, so an out-of-order request (e.g. approving an
 * already-approved curriculum) is rejected deterministically.
 */
export function nextCurriculumStage(
  stage: CurriculumApprovalStage,
  action: CurriculumReviewAction
): CurriculumApprovalStage | null {
  switch (action) {
    case "submit_for_cp_review":
      return stage === "NOT_SUBMITTED" ||
        stage === "CP_REVISION_REQUESTED" ||
        stage === "GLOBAL_REVISION_REQUESTED"
        ? "CP_REVIEW"
        : null;
    case "cp_request_revision":
      return stage === "CP_REVIEW" ? "CP_REVISION_REQUESTED" : null;
    case "cp_approve":
      return stage === "CP_REVIEW" ? "CP_APPROVED" : null;
    case "send_to_global":
      return stage === "CP_APPROVED" ? "GLOBAL_REVIEW" : null;
    case "global_approve":
      return stage === "GLOBAL_REVIEW" ? "FULLY_APPROVED" : null;
    case "global_request_revision":
      return stage === "GLOBAL_REVIEW" ? "GLOBAL_REVISION_REQUESTED" : null;
  }
}

/**
 * The stage a template with no approval row yet sits at, derived from its legacy
 * single-stage `submissionStatus`. Lets a reviewer act on a pre-Phase-4 template
 * (or one submitted through the old path) without a separate backfill.
 */
export function legacyInitialStage(status: string | null | undefined): CurriculumApprovalStage {
  switch (status) {
    case "SUBMITTED":
      return "CP_REVIEW";
    case "NEEDS_REVISION":
      return "CP_REVISION_REQUESTED";
    case "APPROVED":
      return "FULLY_APPROVED";
    default:
      return "NOT_SUBMITTED";
  }
}

/**
 * Keep the legacy single-stage `submissionStatus` in sync as the two-stage
 * pipeline advances, so the catalog / instructor workspace stay coherent.
 * In-flight stages (CP approved, global review) read as SUBMITTED; only a true
 * full approval maps to APPROVED.
 */
export function legacySubmissionStatusForStage(
  stage: CurriculumApprovalStage
): "DRAFT" | "SUBMITTED" | "APPROVED" | "NEEDS_REVISION" {
  switch (stage) {
    case "NOT_SUBMITTED":
      return "DRAFT";
    case "CP_REVISION_REQUESTED":
    case "GLOBAL_REVISION_REQUESTED":
      return "NEEDS_REVISION";
    case "FULLY_APPROVED":
      return "APPROVED";
    case "CP_REVIEW":
    case "CP_APPROVED":
    case "GLOBAL_REVIEW":
      return "SUBMITTED";
  }
}

/** Decision label recorded on the audit-trail event for an action. */
export const CURRICULUM_ACTION_DECISION: Record<CurriculumReviewAction, string> = {
  submit_for_cp_review: "SUBMITTED",
  cp_request_revision: "CP_REVISION",
  cp_approve: "CP_APPROVED",
  send_to_global: "SENT_TO_GLOBAL",
  global_approve: "GLOBAL_APPROVED",
  global_request_revision: "GLOBAL_REVISION",
};

export type CurriculumNextStep = {
  actor: CurriculumActor;
  label: string;
  /** The primary action available at this stage (null when nothing to do). */
  action: CurriculumReviewAction | null;
};

/** The one recommended next move + who owns it, for a single curriculum. */
export function curriculumNextStep(status: CurriculumPlaybookStatus): CurriculumNextStep {
  switch (status) {
    case "not_submitted":
      return { actor: "instructor", label: "Instructor submits curriculum for review", action: "submit_for_cp_review" };
    case "cp_review":
      return { actor: "chapter_president", label: "Review and approve, or request a revision", action: "cp_approve" };
    case "cp_revision":
      return { actor: "instructor", label: "Instructor revises and resubmits", action: "submit_for_cp_review" };
    case "cp_approved":
      return { actor: "chapter_president", label: "Send to global leadership for final review", action: "send_to_global" };
    case "global_review":
      return { actor: "global_leadership", label: "Global leadership gives the final sign-off", action: "global_approve" };
    case "global_revision":
      return { actor: "instructor", label: "Instructor revises and resubmits for CP review", action: "submit_for_cp_review" };
    case "fully_approved":
      return { actor: "none", label: "Fully approved — ready to launch", action: null };
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
  /** Legacy single-stage `ClassTemplate.submissionStatus` (fallback). */
  status: string | null;
  /** Two-stage `CurriculumApproval.stage` when present (authoritative). */
  approvalStage?: string | null;
  /** When the (latest) submission entered CP review — drives the 48h SLA. */
  submittedAt: Date | null;
  reviewedAt: Date | null;
  /** Latest CP / global review snapshots (for the notes/history view). */
  cpReviewedByName?: string | null;
  cpReviewNotes?: string | null;
  cpReviewedAt?: Date | null;
  globalReviewedByName?: string | null;
  globalReviewNotes?: string | null;
  globalReviewedAt?: Date | null;
  sentToGlobalAt?: Date | null;
};

/** A submitted curriculum still waiting on CP review past the 48-hour SLA. */
export function curriculumReviewOverdue(c: CurriculumRecord, now: Date): boolean {
  if (curriculumPlaybookStatus(c) !== "cp_review") return false;
  if (!c.submittedAt) return false;
  const hours = (now.getTime() - c.submittedAt.getTime()) / HOUR_MS;
  return hours >= CURRICULUM_REVIEW_SLA_HOURS;
}

/** A curriculum escalated to global review that has waited past the 48-hour SLA. */
export function curriculumGlobalReviewOverdue(c: CurriculumRecord, now: Date): boolean {
  if (curriculumPlaybookStatus(c) !== "global_review") return false;
  const since = c.sentToGlobalAt ?? c.submittedAt;
  if (!since) return false;
  const hours = (now.getTime() - since.getTime()) / HOUR_MS;
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
  /** Submitted at least once (everything except not_submitted). */
  submittedEver: number;
  cpReviewNeeded: number; // cp_review — CP owes a review
  cpReviewOverdue: number; // cp_review > 48h
  cpApproved: number; // cp_approved — ready to send to global
  globalReviewNeeded: number; // global_review — global owes a review
  needsRevision: number; // cp_revision + global_revision
  fullyApproved: number; // launch-ready
  // Back-compat aliases (kept so existing call-sites read naturally).
  reviewNeeded: number; // = cpReviewNeeded
  reviewOverdue: number; // = cpReviewOverdue
  approved: number; // = fullyApproved
};

/** Roll a set of curricula into the chapter curriculum-review headline. */
export function summarizeCurriculumReview(
  curricula: CurriculumRecord[],
  now: Date
): CurriculumReviewSummary {
  const byStatus = Object.fromEntries(
    CURRICULUM_PLAYBOOK_STATUSES.map((s) => [s, 0])
  ) as Record<CurriculumPlaybookStatus, number>;

  let cpReviewOverdue = 0;
  for (const c of curricula) {
    byStatus[curriculumPlaybookStatus(c)] += 1;
    if (curriculumReviewOverdue(c, now)) cpReviewOverdue += 1;
  }

  const cpReviewNeeded = byStatus.cp_review;
  const needsRevision = byStatus.cp_revision + byStatus.global_revision;
  const fullyApproved = byStatus.fully_approved;

  return {
    total: curricula.length,
    byStatus,
    submittedEver: curricula.length - byStatus.not_submitted,
    cpReviewNeeded,
    cpReviewOverdue,
    cpApproved: byStatus.cp_approved,
    globalReviewNeeded: byStatus.global_review,
    needsRevision,
    fullyApproved,
    reviewNeeded: cpReviewNeeded,
    reviewOverdue: cpReviewOverdue,
    approved: fullyApproved,
  };
}

// --- Curriculum evidence rows (the Deliberable table) ----------------------

/** Health of a single curriculum in the evidence table. */
export type CurriculumEvidenceStatus = "ready" | "needs_feedback" | "not_started";

export type CurriculumEvidenceRow = {
  id: string;
  title: string;
  subject: string;
  /** Short stage label, e.g. "CP Review". */
  stage: string;
  /** Who needs to act next, e.g. "Chapter President". */
  actor: string;
  owner: string;
  status: CurriculumEvidenceStatus;
};

/** Map playbook status → the table's three-way health. */
export function curriculumEvidenceStatus(rec: CurriculumStageInput): CurriculumEvidenceStatus {
  switch (curriculumPlaybookStatus(rec)) {
    case "fully_approved":
      return "ready";
    case "not_submitted":
      return "not_started";
    default:
      return "needs_feedback";
  }
}

/** Build one curriculum evidence row. */
export function curriculumEvidenceRow(c: CurriculumRecord): CurriculumEvidenceRow {
  const status = curriculumPlaybookStatus(c);
  return {
    id: c.id,
    title: c.title,
    subject: c.subject && c.subject.trim() ? c.subject.trim() : "—",
    stage: CURRICULUM_SHORT_STAGE[status],
    actor: CURRICULUM_ACTOR_LABEL[CURRICULUM_STAGE_ACTOR[status]],
    owner: c.instructorName && c.instructorName.trim() ? c.instructorName.trim() : "Unassigned",
    status: curriculumEvidenceStatus(c),
  };
}

/** The curriculum Deliberable's one recommended next step. */
export function curriculumReviewRecommendation(summary: CurriculumReviewSummary): string {
  if (summary.total === 0) return "No curricula yet — instructors submit theirs as classes take shape.";
  const n = (x: number) => (x === 1 ? "" : "s");
  if (summary.cpReviewOverdue > 0) {
    return `Review ${summary.cpReviewOverdue} curriculum${n(summary.cpReviewOverdue)} overdue past the 48-hour window.`;
  }
  if (summary.cpReviewNeeded > 0) {
    return `Give feedback on ${summary.cpReviewNeeded} curriculum${
      n(summary.cpReviewNeeded)
    } in CP review to move ${summary.cpReviewNeeded === 1 ? "it" : "them"} forward.`;
  }
  if (summary.cpApproved > 0) {
    return `Send ${summary.cpApproved} CP-approved curriculum${n(summary.cpApproved)} to global review for final sign-off.`;
  }
  if (summary.globalReviewNeeded > 0) {
    return `${summary.globalReviewNeeded} curriculum${n(summary.globalReviewNeeded)} ${
      summary.globalReviewNeeded === 1 ? "is" : "are"
    } awaiting global review.`;
  }
  if (summary.needsRevision > 0) {
    return `Follow up on ${summary.needsRevision} curriculum${n(summary.needsRevision)} needing revision.`;
  }
  const notStarted = summary.byStatus.not_submitted;
  if (notStarted > 0) {
    return `Nudge ${notStarted} instructor${n(notStarted)} to submit their curriculum.`;
  }
  return "Curriculum is fully approved for your planned classes.";
}
