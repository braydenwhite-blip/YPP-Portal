// Chapter pipeline read model — PARTNERS and INSTRUCTORS.
//
// Pure + deterministic (pass `now`) so it is fully unit testable: no Prisma, no
// `server-only`, only type-level imports. The DB loader in
// `lib/chapters/operating-system.ts` gathers the raw rows and hands plain
// records to these summarizers. Everything here maps the portal's existing
// stage/status vocabularies onto the Chapter President playbook's lanes so a CP
// sees their pipeline in the words the playbook uses — without a parallel model.

import { relativeAgo } from "./format";
import { PORTAL_SETTINGS_DEFAULTS } from "../portal-settings/defaults";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Tunable thresholds for the pipeline health rules. The pure functions below take
 * these as an optional trailing argument that defaults to
 * `DEFAULT_PIPELINE_THRESHOLDS`, so existing callers and unit tests are
 * unaffected; the Chapter OS loader passes admin-configured values resolved from
 * portal settings. Defaults are sourced from `PORTAL_SETTINGS_DEFAULTS` so there
 * is a single source of truth.
 */
export type PipelineThresholds = {
  partnerFollowUpOverdueStuckDays: number;
  partnerSinceContactStuckDays: number;
  instructorDecisionSlaHours: number;
  instructorTriageStaleDays: number;
};

export const DEFAULT_PIPELINE_THRESHOLDS: PipelineThresholds = {
  partnerFollowUpOverdueStuckDays: PORTAL_SETTINGS_DEFAULTS.chapterOs.partnerFollowUpOverdueStuckDays,
  partnerSinceContactStuckDays: PORTAL_SETTINGS_DEFAULTS.chapterOs.partnerSinceContactStuckDays,
  instructorDecisionSlaHours: PORTAL_SETTINGS_DEFAULTS.chapterOs.instructorDecisionSlaHours,
  instructorTriageStaleDays: PORTAL_SETTINGS_DEFAULTS.chapterOs.instructorTriageStaleDays,
};

/** Whole business days (Mon–Fri) elapsed from `from` to `to`. Negative ⇒ 0. */
export function businessDaysBetween(from: Date, to: Date): number {
  if (to.getTime() <= from.getTime()) return 0;
  let count = 0;
  // Walk day boundaries; cheap because outreach windows are days, not years.
  const cursor = new Date(from.getTime());
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(to.getTime());
  end.setUTCHours(0, 0, 0, 0);
  while (cursor.getTime() < end.getTime()) {
    cursor.setTime(cursor.getTime() + DAY_MS);
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) count += 1;
  }
  return count;
}

// ---------------------------------------------------------------------------
// PARTNERS
// ---------------------------------------------------------------------------

/** Playbook partner statuses (the words the CP playbook uses). */
export const PARTNER_PLAYBOOK_STATUSES = [
  "researching",
  "contacted",
  "interested",
  "meeting_scheduled",
  "final_conversation",
  "confirmed",
  "closed",
] as const;
export type PartnerPlaybookStatus = (typeof PARTNER_PLAYBOOK_STATUSES)[number];

export const PARTNER_PLAYBOOK_STATUS_LABELS: Record<PartnerPlaybookStatus, string> = {
  researching: "Researching",
  contacted: "Contacted",
  interested: "Interested",
  meeting_scheduled: "Meeting Scheduled",
  final_conversation: "Final Conversation",
  confirmed: "Confirmed",
  closed: "Closed",
};

/** Map an existing Partner.stage onto the playbook status vocabulary. */
export function partnerPlaybookStatus(stage: string | null | undefined): PartnerPlaybookStatus {
  switch (stage) {
    case "RESEARCHING":
    case "NOT_STARTED":
    case null:
    case undefined:
      return "researching";
    case "REACHED_OUT":
      return "contacted";
    case "RESPONDED":
    case "NEEDS_PROPOSAL":
    case "PROPOSAL_SENT":
      return "interested";
    case "MEETING_SCHEDULED":
      return "meeting_scheduled";
    case "NEGOTIATING":
      return "final_conversation";
    case "ACTIVE_PARTNERSHIP":
      return "confirmed";
    case "COMPLETED":
    case "PAUSED":
    case "NOT_A_FIT":
      return "closed";
    default:
      return "researching";
  }
}

/** A partner is "in flight" (still being worked) — eligible for follow-up nudges. */
export function partnerIsInFlight(stage: string | null | undefined): boolean {
  const s = partnerPlaybookStatus(stage);
  return s !== "confirmed" && s !== "closed";
}

/** A partner is "confirmed" once it reaches an active partnership. */
export function partnerIsConfirmed(stage: string | null | undefined): boolean {
  return partnerPlaybookStatus(stage) === "confirmed";
}

/** The minimal partner shape the pipeline summarizers need. */
export type PartnerRecord = {
  id: string;
  name: string;
  /** Free-text / structured partner category, e.g. "School", "Nonprofit". */
  type: string | null;
  stage: string | null;
  lastContactedAt: Date | null;
  nextFollowUpAt: Date | null;
  hasRelationshipLead: boolean;
  /** Resolved name of the relationship lead, when known — for lane owner chips. */
  relationshipLeadName?: string | null;
  // Confirmed-partner logistics, derived in the loader from linked offerings +
  // signed agreements (the playbook's "lock it in" list).
  confirmedRoom: boolean;
  confirmedTimes: boolean;
  confirmedLaunchDate: boolean;
  hasSupervisor: boolean;
  writtenConfirmation: boolean;
  openIssues: number;
};

export type PartnerFollowUp = {
  needed: boolean;
  /** Concrete reason, e.g. "Follow-up overdue by 4 days". null when not needed. */
  reason: string | null;
};

/**
 * Detect whether a partner needs a follow-up right now. Only in-flight partners
 * qualify (a confirmed/closed partner doesn't need chasing). The rule mirrors
 * the playbook: chase if the follow-up date has passed, or none is set.
 */
export function partnerFollowUp(p: PartnerRecord, now: Date): PartnerFollowUp {
  if (!partnerIsInFlight(p.stage)) return { needed: false, reason: null };
  if (p.nextFollowUpAt && p.nextFollowUpAt.getTime() < now.getTime()) {
    const days = Math.floor((now.getTime() - p.nextFollowUpAt.getTime()) / DAY_MS);
    return { needed: true, reason: days <= 0 ? "Follow-up due today" : `Follow-up overdue by ${days} day${days === 1 ? "" : "s"}` };
  }
  if (!p.nextFollowUpAt) {
    return { needed: true, reason: "No follow-up scheduled" };
  }
  return { needed: false, reason: null };
}

export type PartnerLogisticsItem = { key: string; label: string; done: boolean };
export type PartnerLogistics = {
  items: PartnerLogisticsItem[];
  done: number;
  total: number;
  complete: boolean;
  missing: string[];
};

/**
 * The "lock it in" checklist for a confirmed partner: exact room, exact times,
 * launch date, supervisor/contact, and written confirmation. Pure so the
 * loader can render it and needs-attention can flag the gaps.
 */
export function partnerLogistics(p: PartnerRecord): PartnerLogistics {
  const items: PartnerLogisticsItem[] = [
    { key: "room", label: "Room / space confirmed", done: p.confirmedRoom },
    { key: "times", label: "Days & times confirmed", done: p.confirmedTimes },
    { key: "launch", label: "Launch date confirmed", done: p.confirmedLaunchDate },
    { key: "supervisor", label: "Supervisor / point of contact", done: p.hasSupervisor },
    { key: "written", label: "Confirmed in writing", done: p.writtenConfirmation },
  ];
  const done = items.filter((i) => i.done).length;
  return {
    items,
    done,
    total: items.length,
    complete: done === items.length,
    missing: items.filter((i) => !i.done).map((i) => i.label),
  };
}

export type PartnerPipelineSummary = {
  total: number;
  byStatus: Record<PartnerPlaybookStatus, number>;
  followUpNeeded: number;
  confirmed: number;
  confirmedWithIncompleteLogistics: number;
  noLead: number;
};

/** Roll a set of partners into the chapter partner-pipeline headline. */
export function summarizePartnerPipeline(partners: PartnerRecord[], now: Date): PartnerPipelineSummary {
  const byStatus = Object.fromEntries(
    PARTNER_PLAYBOOK_STATUSES.map((s) => [s, 0])
  ) as Record<PartnerPlaybookStatus, number>;

  let followUpNeeded = 0;
  let confirmedWithIncompleteLogistics = 0;
  let noLead = 0;

  for (const p of partners) {
    byStatus[partnerPlaybookStatus(p.stage)] += 1;
    if (partnerFollowUp(p, now).needed) followUpNeeded += 1;
    if (partnerIsConfirmed(p.stage) && !partnerLogistics(p).complete) confirmedWithIncompleteLogistics += 1;
    if (partnerIsInFlight(p.stage) && !p.hasRelationshipLead) noLead += 1;
  }

  return {
    total: partners.length,
    byStatus,
    followUpNeeded,
    confirmed: byStatus.confirmed,
    confirmedWithIncompleteLogistics,
    noLead,
  };
}

// --- Partner evidence rows (the Deliberable table) -------------------------

/** Health of a single partner in the evidence table. */
export type EvidenceStatus = "on_track" | "at_risk" | "stuck";

export type PartnerEvidenceRow = {
  id: string;
  name: string;
  /** Partner category, e.g. "School" — shown under the name. */
  subtitle: string | null;
  /** Playbook stage label, e.g. "Meeting Scheduled". */
  stage: string;
  /** "2 days ago" — humanized last-contact. */
  lastContact: string;
  /** The single most useful next action, derived from stage + logistics. */
  nextStep: string;
  status: EvidenceStatus;
  /** Resolved relationship-lead name, when known — the lane "owner" chip. */
  ownerName: string | null;
};

/** The stage-appropriate next action for a partner (never invented data). */
export function partnerNextStep(p: PartnerRecord): string {
  const status = partnerPlaybookStatus(p.stage);
  if (status === "confirmed") {
    const logistics = partnerLogistics(p);
    if (!logistics.complete) return "Lock in remaining logistics";
    return "Schedule classes";
  }
  if (p.openIssues > 0 && status !== "closed") {
    return `Resolve ${p.openIssues} open request${p.openIssues === 1 ? "" : "s"}`;
  }
  switch (status) {
    case "researching":
      return "Send first outreach";
    case "contacted":
      return "Follow up on outreach";
    case "interested":
      return "Schedule a meeting";
    case "meeting_scheduled":
      return "Hold the partner meeting";
    case "final_conversation":
      return "Finalize the agreement";
    default:
      return "—";
  }
}

/** Derive a partner's health (On Track / At Risk / Stuck) from contact cadence. */
export function partnerEvidenceStatus(
  p: PartnerRecord,
  now: Date,
  t: PipelineThresholds = DEFAULT_PIPELINE_THRESHOLDS
): EvidenceStatus {
  if (partnerIsConfirmed(p.stage)) {
    return partnerLogistics(p).complete ? "on_track" : "at_risk";
  }
  if (!partnerIsInFlight(p.stage)) return "on_track"; // closed / parked
  const fuOverdueDays =
    p.nextFollowUpAt && p.nextFollowUpAt.getTime() < now.getTime()
      ? Math.floor((now.getTime() - p.nextFollowUpAt.getTime()) / DAY_MS)
      : 0;
  if (fuOverdueDays >= t.partnerFollowUpOverdueStuckDays) return "stuck";
  const sinceContact =
    p.lastContactedAt != null ? Math.floor((now.getTime() - p.lastContactedAt.getTime()) / DAY_MS) : null;
  if (sinceContact != null && sinceContact >= t.partnerSinceContactStuckDays) return "stuck";
  // Claims progress past the first touch but no contact was ever logged.
  if (sinceContact == null && partnerPlaybookStatus(p.stage) !== "researching") return "stuck";
  if (partnerFollowUp(p, now).needed || !p.hasRelationshipLead) return "at_risk";
  return "on_track";
}

/** Build one partner evidence row. */
export function partnerEvidenceRow(
  p: PartnerRecord,
  now: Date,
  t: PipelineThresholds = DEFAULT_PIPELINE_THRESHOLDS
): PartnerEvidenceRow {
  return {
    id: p.id,
    name: p.name,
    subtitle: p.type,
    stage: PARTNER_PLAYBOOK_STATUS_LABELS[partnerPlaybookStatus(p.stage)],
    lastContact: relativeAgo(p.lastContactedAt, now),
    nextStep: partnerNextStep(p),
    status: partnerEvidenceStatus(p, now, t),
    ownerName: p.relationshipLeadName ?? null,
  };
}

/** The partner Deliberable's one recommended next step, from the rows themselves. */
export function partnerPipelineRecommendation(rows: PartnerEvidenceRow[]): string {
  if (rows.length === 0) return "Add your first partner prospects to start the pipeline.";
  const stuck = rows.filter((r) => r.status === "stuck").length;
  if (stuck > 0) {
    return `Reach out to ${stuck} stuck partner${stuck === 1 ? "" : "s"} this week to get ${
      stuck === 1 ? "it" : "them"
    } moving again.`;
  }
  const atRisk = rows.filter((r) => r.status === "at_risk").length;
  if (atRisk > 0) {
    return `Reconnect with ${atRisk} at-risk partner${atRisk === 1 ? "" : "s"} before ${
      atRisk === 1 ? "it slips" : "they slip"
    }.`;
  }
  return "Pipeline looks healthy — keep moving conversations toward confirmation.";
}

// ---------------------------------------------------------------------------
// INSTRUCTORS
// ---------------------------------------------------------------------------

/** Playbook instructor-applicant stages. */
export const INSTRUCTOR_PLAYBOOK_STAGES = [
  "applied",
  "under_review",
  "interview_ready",
  "interview_scheduled",
  "interview_complete",
  "hired",
  "rejected",
] as const;
export type InstructorPlaybookStage = (typeof INSTRUCTOR_PLAYBOOK_STAGES)[number];

export const INSTRUCTOR_PLAYBOOK_STAGE_LABELS: Record<InstructorPlaybookStage, string> = {
  applied: "Applied",
  under_review: "Under Review",
  interview_ready: "Interview Ready",
  interview_scheduled: "Interview Scheduled",
  interview_complete: "Interview Complete",
  hired: "Hired",
  rejected: "Rejected",
};

/** Map an existing InstructorApplicationStatus onto the playbook stage vocabulary. */
export function instructorPlaybookStage(status: string): InstructorPlaybookStage {
  switch (status) {
    case "SUBMITTED":
      return "applied";
    case "UNDER_REVIEW":
    case "INFO_REQUESTED":
    case "ON_HOLD":
    case "WAITLISTED":
      return "under_review";
    case "PRE_APPROVED":
      return "interview_ready";
    case "INTERVIEW_SCHEDULED":
      return "interview_scheduled";
    case "INTERVIEW_COMPLETED":
    case "CHAIR_REVIEW":
      return "interview_complete";
    case "APPROVED":
      return "hired";
    case "REJECTED":
    case "WITHDRAWN":
      return "rejected";
    default:
      return "applied";
  }
}

/** Hours a chair has after an interview to record a decision (playbook: 12h). */
export const INSTRUCTOR_DECISION_SLA_HOURS = 12;

/** The minimal applicant shape the instructor-pipeline summarizers need. */
export type InstructorApplicantRecord = {
  id: string;
  name: string;
  status: string;
  /** When the application was submitted — drives the "Applied" column. */
  appliedAt: Date;
  /** Free-text subjects the applicant can teach, e.g. "Python, Robotics". */
  specialties: string | null;
  hasReviewer: boolean;
  interviewScheduledAt: Date | null;
  /** Best-available timestamp the applicant entered "interview complete". */
  interviewCompletedAt: Date | null;
  hasDecision: boolean;
  hasCourseDescription: boolean;
  hasLessonPlan: boolean;
  updatedAt: Date;
};

/** An applicant sitting in review with no reviewer / no movement. */
export function instructorWaitingForReview(a: InstructorApplicantRecord): boolean {
  const stage = instructorPlaybookStage(a.status);
  if (stage === "applied") return true; // submitted, nobody assigned to triage yet
  if (stage === "under_review") return !a.hasReviewer;
  return false;
}

/** Approved-to-interview but no interview on the calendar. */
export function instructorInterviewReadyNotScheduled(a: InstructorApplicantRecord): boolean {
  return instructorPlaybookStage(a.status) === "interview_ready" && !a.interviewScheduledAt;
}

/** Interview happened but the decision is missing past the 12-hour SLA. */
export function instructorDecisionOverdue(
  a: InstructorApplicantRecord,
  now: Date,
  t: PipelineThresholds = DEFAULT_PIPELINE_THRESHOLDS
): boolean {
  if (instructorPlaybookStage(a.status) !== "interview_complete") return false;
  if (a.hasDecision) return false;
  const completedAt = a.interviewCompletedAt ?? a.updatedAt;
  const hours = (now.getTime() - completedAt.getTime()) / (60 * 60 * 1000);
  return hours >= t.instructorDecisionSlaHours;
}

/** Pre-interview materials the playbook requires before an interview is run. */
export function instructorMissingMaterials(a: InstructorApplicantRecord): boolean {
  const stage = instructorPlaybookStage(a.status);
  // Only relevant while still pre-interview and in play.
  if (stage === "hired" || stage === "rejected") return false;
  if (stage === "interview_scheduled" || stage === "interview_complete" || stage === "interview_ready") {
    return !a.hasCourseDescription || !a.hasLessonPlan;
  }
  return false;
}

export type InstructorPipelineSummary = {
  total: number;
  byStage: Record<InstructorPlaybookStage, number>;
  applicants: number; // everyone who applied (excludes rejected/withdrawn from "active")
  hired: number;
  waitingForReview: number;
  interviewReadyNotScheduled: number;
  decisionOverdue: number;
  missingMaterials: number;
};

/** Roll a set of applicants into the chapter instructor-pipeline headline. */
export function summarizeInstructorPipeline(
  applicants: InstructorApplicantRecord[],
  now: Date,
  t: PipelineThresholds = DEFAULT_PIPELINE_THRESHOLDS
): InstructorPipelineSummary {
  const byStage = Object.fromEntries(
    INSTRUCTOR_PLAYBOOK_STAGES.map((s) => [s, 0])
  ) as Record<InstructorPlaybookStage, number>;

  let waitingForReview = 0;
  let interviewReadyNotScheduled = 0;
  let decisionOverdue = 0;
  let missingMaterials = 0;

  for (const a of applicants) {
    byStage[instructorPlaybookStage(a.status)] += 1;
    if (instructorWaitingForReview(a)) waitingForReview += 1;
    if (instructorInterviewReadyNotScheduled(a)) interviewReadyNotScheduled += 1;
    if (instructorDecisionOverdue(a, now, t)) decisionOverdue += 1;
    if (instructorMissingMaterials(a)) missingMaterials += 1;
  }

  return {
    total: applicants.length,
    byStage,
    applicants: applicants.length - byStage.rejected,
    hired: byStage.hired,
    waitingForReview,
    interviewReadyNotScheduled,
    decisionOverdue,
    missingMaterials,
  };
}

// --- Instructor evidence rows (the Deliberable table) ----------------------

/** Health of a single applicant in the evidence table. */
export type InstructorEvidenceStatus = "strong" | "on_track" | "at_risk";

export type InstructorEvidenceRow = {
  id: string;
  name: string;
  /** Playbook stage label, e.g. "Under Review". */
  stage: string;
  /** "3 days ago" — humanized application date. */
  applied: string;
  /** Subjects the applicant can teach, e.g. "Python, Robotics". */
  specialties: string;
  status: InstructorEvidenceStatus;
};

/** Derive an applicant's health (Strong / On Track / At Risk) deterministically. */
export function instructorEvidenceStatus(
  a: InstructorApplicantRecord,
  now: Date,
  t: PipelineThresholds = DEFAULT_PIPELINE_THRESHOLDS
): InstructorEvidenceStatus {
  if (instructorDecisionOverdue(a, now, t) || instructorMissingMaterials(a)) return "at_risk";
  if (instructorWaitingForReview(a)) {
    const days = Math.floor((now.getTime() - a.appliedAt.getTime()) / DAY_MS);
    if (days >= t.instructorTriageStaleDays) return "at_risk"; // stalled in triage
  }
  if (instructorPlaybookStage(a.status) === "hired") return "strong";
  // Well-prepared and supported: has both planning docs and a reviewer assigned.
  if (a.hasCourseDescription && a.hasLessonPlan && a.hasReviewer) return "strong";
  return "on_track";
}

/** Build one instructor evidence row. */
export function instructorEvidenceRow(
  a: InstructorApplicantRecord,
  now: Date,
  t: PipelineThresholds = DEFAULT_PIPELINE_THRESHOLDS
): InstructorEvidenceRow {
  return {
    id: a.id,
    name: a.name,
    stage: INSTRUCTOR_PLAYBOOK_STAGE_LABELS[instructorPlaybookStage(a.status)],
    applied: relativeAgo(a.appliedAt, now),
    specialties: a.specialties && a.specialties.trim() ? a.specialties.trim() : "—",
    status: instructorEvidenceStatus(a, now, t),
  };
}

/** The instructor Deliberable's one recommended next step. */
export function instructorPipelineRecommendation(summary: InstructorPipelineSummary): string {
  if (summary.total === 0) return "Open applications to start building your instructor bench.";
  const n = (x: number) => (x === 1 ? "" : "s");
  if (summary.waitingForReview > 0) {
    return `Review ${summary.waitingForReview} application${n(summary.waitingForReview)} waiting on you.`;
  }
  if (summary.decisionOverdue > 0) {
    return `Record ${summary.decisionOverdue} interview decision${n(
      summary.decisionOverdue
    )} now — past the 12-hour window.`;
  }
  if (summary.interviewReadyNotScheduled > 0) {
    return `Schedule ${summary.interviewReadyNotScheduled} interview${n(
      summary.interviewReadyNotScheduled
    )} to keep candidates moving.`;
  }
  if (summary.missingMaterials > 0) {
    return `Collect course materials from ${summary.missingMaterials} candidate${n(
      summary.missingMaterials
    )} before their interview.`;
  }
  return "Pipeline is healthy — keep candidates progressing toward approval.";
}
