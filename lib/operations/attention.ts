import type {
  OperationalReviewItem,
  OperationalReviewSeverity,
} from "@/lib/people-strategy/operational-digest";

/**
 * Data 360 — the Needs Attention intelligence layer.
 *
 * The digest already ranks tracker problems (overdue work, blocked actions,
 * meetings without follow-through, drifting entities) via
 * `rankReviewItems`. This module widens the lens to the parts of YPP the
 * tracker does NOT see: partner pipelines with no scheduled next step,
 * instructor applicants stuck in review, mentorships that have gone quiet, and
 * classes starting soon without basic setup. Every item explains WHY it
 * matters in one plain sentence, so the page never shows a bare red number.
 *
 * Pure derivations over lite input shapes (callers inject `now`); the query
 * layer (`lib/operations/data-360-queries.ts`) loads the inputs.
 */

export const ATTENTION_KINDS = [
  "action",
  "meeting",
  "decision",
  "class",
  "instructor",
  "person",
  "partner",
  "mentorship",
  "applicant",
  "area",
] as const;
export type AttentionKind = (typeof ATTENTION_KINDS)[number];

export const ATTENTION_KIND_LABELS: Record<AttentionKind, string> = {
  action: "Action",
  meeting: "Meeting",
  decision: "Decision",
  class: "Class",
  instructor: "Instructor",
  person: "Person",
  partner: "Partner",
  mentorship: "Mentorship",
  applicant: "Applicant",
  area: "Area",
};

export type AttentionItem = {
  /** Stable, list-unique id (e.g. `partner:p1:no-next-step`). */
  id: string;
  kind: AttentionKind;
  title: string;
  /** One sentence: why this matters / what is at stake. */
  why: string;
  severity: OperationalReviewSeverity;
  /** Deterministic ranking score — higher = review sooner. */
  score: number;
  /** Where to go to act. */
  href: string;
  /** Optional drawer target so the UI can open a 360 panel in place. */
  entityType?: "person" | "class" | "partner" | "initiative" | "meeting" | "action";
  entityId?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days an applicant may sit in review before being flagged as stuck. */
export const APPLICANT_STUCK_DAYS = 14;
/** Days an active mentorship may go without recorded activity. */
export const MENTORSHIP_QUIET_DAYS = 45;
/** How close a class start date must be for missing setup to be urgent. */
export const CLASS_SETUP_WINDOW_DAYS = 21;

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));
}

// --- partner signals -----------------------------------------------------------

export type PartnerAttentionInput = {
  id: string;
  name: string;
  /** Pipeline stage string (e.g. "IN_CONVERSATION"); null/NOT_STARTED = not active. */
  stage: string | null;
  nextFollowUpAt: Date | null;
  lastContactedAt: Date | null;
  relationshipLeadName: string | null;
};

/** Stages that mean "we are not actively working this partner". */
const INACTIVE_PARTNER_STAGES = new Set(["NOT_STARTED", "CLOSED", "DECLINED", "ARCHIVED"]);

export function partnerIsActive(partner: PartnerAttentionInput): boolean {
  return partner.stage != null && !INACTIVE_PARTNER_STAGES.has(partner.stage);
}

export function derivePartnerAttention(
  partners: PartnerAttentionInput[],
  now: Date = new Date()
): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const partner of partners) {
    if (!partnerIsActive(partner)) continue;
    const lead = partner.relationshipLeadName;
    if (partner.nextFollowUpAt && partner.nextFollowUpAt.getTime() < now.getTime()) {
      const days = daysBetween(partner.nextFollowUpAt, now);
      items.push({
        id: `partner:${partner.id}:follow-up-overdue`,
        kind: "partner",
        title: `${partner.name} follow-up is ${days} day${days === 1 ? "" : "s"} overdue`,
        why: lead
          ? `${lead} planned a follow-up that never happened — the relationship is cooling.`
          : "A planned follow-up never happened and nobody owns this relationship.",
        severity: days >= 14 ? "critical" : "warning",
        score: 24 + Math.min(days, 30),
        href: "/admin/partners",
        entityType: "partner",
        entityId: partner.id,
      });
    } else if (!partner.nextFollowUpAt) {
      const sinceContact = partner.lastContactedAt
        ? daysBetween(partner.lastContactedAt, now)
        : null;
      items.push({
        id: `partner:${partner.id}:no-next-step`,
        kind: "partner",
        title: `${partner.name} has no next step`,
        why:
          sinceContact != null
            ? `Last contact was ${sinceContact} day${sinceContact === 1 ? "" : "s"} ago and nothing is scheduled next.`
            : "This partnership is in the pipeline but nothing is scheduled next.",
        severity: sinceContact != null && sinceContact > 30 ? "warning" : "watch",
        score: 14 + Math.min(sinceContact ?? 0, 20),
        href: "/admin/partners",
        entityType: "partner",
        entityId: partner.id,
      });
    }
  }
  return items;
}

// --- applicant signals -----------------------------------------------------------

export type ApplicantAttentionInput = {
  id: string;
  name: string;
  /** InstructorApplicationStatus string. */
  status: string;
  submittedAt: Date;
  /** Last touch on the application row. */
  updatedAt: Date;
  interviewScheduledAt: Date | null;
};

/** Statuses where the ball is in YPP's court. */
const APPLICANT_WAITING_STATUSES = new Set([
  "SUBMITTED",
  "UNDER_REVIEW",
  "INTERVIEW_COMPLETED",
  "CHAIR_REVIEW",
]);

export function deriveApplicantAttention(
  applicants: ApplicantAttentionInput[],
  now: Date = new Date()
): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const applicant of applicants) {
    if (!APPLICANT_WAITING_STATUSES.has(applicant.status)) continue;
    if (applicant.interviewScheduledAt && applicant.interviewScheduledAt.getTime() > now.getTime()) {
      continue; // An upcoming interview means the pipeline is moving.
    }
    const idleDays = daysBetween(applicant.updatedAt, now);
    if (idleDays < APPLICANT_STUCK_DAYS) continue;
    items.push({
      id: `applicant:${applicant.id}:stuck`,
      kind: "applicant",
      title: `${applicant.name}'s application has sat ${idleDays} days`,
      why: "Applicants who wait this long without a decision usually walk away.",
      severity: idleDays >= APPLICANT_STUCK_DAYS * 2 ? "warning" : "watch",
      score: 12 + Math.min(idleDays, 40),
      href: "/admin/instructor-applicants",
    });
  }
  return items;
}

// --- mentorship signals ------------------------------------------------------------

export type MentorshipAttentionInput = {
  id: string;
  mentorName: string;
  menteeName: string;
  menteeId: string;
  /** Most recent recorded activity of any kind on the pairing. */
  lastActivityAt: Date;
};

export function deriveMentorshipAttention(
  mentorships: MentorshipAttentionInput[],
  now: Date = new Date()
): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const m of mentorships) {
    const quietDays = daysBetween(m.lastActivityAt, now);
    if (quietDays < MENTORSHIP_QUIET_DAYS) continue;
    items.push({
      id: `mentorship:${m.id}:quiet`,
      kind: "mentorship",
      title: `${m.mentorName} → ${m.menteeName} has been quiet ${quietDays} days`,
      why: "No check-ins, reviews, or sessions recorded — the pairing may have stalled.",
      severity: quietDays >= MENTORSHIP_QUIET_DAYS * 2 ? "warning" : "watch",
      score: 10 + Math.min(quietDays, 30),
      href: `/mentorship/mentees/${m.menteeId}`,
    });
  }
  return items;
}

// --- class setup signals ----------------------------------------------------------

export type ClassSetupAttentionInput = {
  id: string;
  title: string;
  /** ClassOfferingStatus string. */
  status: string;
  startDate: Date;
  endDate: Date;
  instructorName: string | null;
  sessionCount: number;
  enrolledCount: number;
};

export function deriveClassSetupAttention(
  classes: ClassSetupAttentionInput[],
  now: Date = new Date()
): AttentionItem[] {
  const items: AttentionItem[] = [];
  const windowEnd = now.getTime() + CLASS_SETUP_WINDOW_DAYS * DAY_MS;
  for (const cls of classes) {
    if (cls.status === "CANCELLED" || cls.status === "COMPLETED") continue;
    if (cls.endDate.getTime() < now.getTime()) continue;
    const startsSoon = cls.startDate.getTime() <= windowEnd;
    if (!startsSoon) continue;

    const missing: string[] = [];
    if (cls.sessionCount === 0) missing.push("no sessions scheduled");
    if (cls.status === "DRAFT") missing.push("still in draft");
    if (cls.enrolledCount === 0) missing.push("no students enrolled");
    if (missing.length === 0) continue;

    const started = cls.startDate.getTime() <= now.getTime();
    const daysOut = started ? 0 : daysBetween(now, cls.startDate);
    items.push({
      id: `class:${cls.id}:setup`,
      kind: "class",
      title: `${cls.title} ${started ? "is running" : `starts in ${daysOut} day${daysOut === 1 ? "" : "s"}`} but is ${missing.join(", ")}`,
      why: cls.instructorName
        ? `${cls.instructorName} cannot deliver this class until setup is finished.`
        : "This class has no path to delivery until setup is finished.",
      severity: started || daysOut <= 7 ? "critical" : "warning",
      score: 26 + (started ? 14 : Math.max(0, 14 - daysOut)) + missing.length * 4,
      href: `/admin/classes/${cls.id}`,
      entityType: "class",
      entityId: cls.id,
    });
  }
  return items;
}

// --- assembly ------------------------------------------------------------------------

/** Map a digest review item into the unified attention shape. */
export function attentionFromReviewItem(item: OperationalReviewItem): AttentionItem {
  return {
    id: `review:${item.id}`,
    kind: item.kind,
    title: item.title,
    why: item.reasons.join(" · ") || item.reason,
    severity: item.severity,
    score: item.score,
    href: item.href,
  };
}

const SEVERITY_RANK: Record<OperationalReviewSeverity, number> = {
  critical: 3,
  warning: 2,
  watch: 1,
  neutral: 0,
};

/**
 * The unified Needs Attention queue: the digest's ranked tracker problems plus
 * the cross-domain signals, in one deterministic worst-first order. Same
 * inputs → same queue, always.
 */
export function buildNeedsAttention(input: {
  reviewItems: OperationalReviewItem[];
  partners: PartnerAttentionInput[];
  applicants: ApplicantAttentionInput[];
  mentorships: MentorshipAttentionInput[];
  classes: ClassSetupAttentionInput[];
  now?: Date;
  limit?: number;
}): AttentionItem[] {
  const now = input.now ?? new Date();
  const items: AttentionItem[] = [
    ...input.reviewItems.map(attentionFromReviewItem),
    ...derivePartnerAttention(input.partners, now),
    ...deriveApplicantAttention(input.applicants, now),
    ...deriveMentorshipAttention(input.mentorships, now),
    ...deriveClassSetupAttention(input.classes, now),
  ];
  items.sort(
    (a, b) =>
      SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
      b.score - a.score ||
      a.title.localeCompare(b.title)
  );
  return typeof input.limit === "number" ? items.slice(0, input.limit) : items;
}
