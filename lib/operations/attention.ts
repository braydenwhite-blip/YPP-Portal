import type {
  OperationalReviewItem,
  OperationalReviewSeverity,
} from "@/lib/people-strategy/operational-digest";

import type { Entity360Type } from "./entity-360";
import { deriveClassReadiness, INACTIVE_PARTNER_STAGES } from "./signals";

/**
 * Data 360 — the Needs Attention intelligence layer.
 *
 * The digest already ranks tracker problems (overdue work, blocked actions,
 * meetings without follow-through, drifting entities) via
 * `rankReviewItems`. This module widens the lens to the parts of YPP the
 * tracker does NOT see: partner pipelines with no scheduled next step,
 * instructor applicants stuck in review, mentorships that have gone quiet, and
 * classes starting soon without basic setup. Every item explains WHY it
 * matters, suggests the next move, and carries a category so the queue reads
 * as labeled groups instead of one undifferentiated list.
 *
 * Pure derivations over lite input shapes (callers inject `now`); the query
 * layer (`lib/operations/data-360-queries.ts`) loads the inputs. The shared
 * judgment calls (class readiness, partner activity) live in `signals.ts` so
 * the drawers and this engine can never disagree.
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

/**
 * The operational categories the queue groups by, in triage order. An item
 * belongs to exactly one — the most actionable description of what is wrong.
 */
export const ATTENTION_CATEGORIES = [
  "urgent",
  "missing_owner",
  "missing_next_step",
  "stalled",
  "upcoming_risk",
  "data_incomplete",
] as const;
export type AttentionCategory = (typeof ATTENTION_CATEGORIES)[number];

export const ATTENTION_CATEGORY_LABELS: Record<AttentionCategory, string> = {
  urgent: "Urgent",
  missing_owner: "Missing an owner",
  missing_next_step: "Missing a next step",
  stalled: "Stalled",
  upcoming_risk: "Upcoming risk",
  data_incomplete: "Data incomplete",
};

export const ATTENTION_CATEGORY_HINTS: Record<AttentionCategory, string> = {
  urgent: "Past due or on fire — rescue first",
  missing_owner: "Work nobody is on the hook for",
  missing_next_step: "Decided or discussed, but nothing scheduled",
  stalled: "No movement — quietly drifting",
  upcoming_risk: "Fine today, a problem soon",
  data_incomplete: "The record itself needs filling in",
};

export type AttentionItem = {
  /** Stable, list-unique id (e.g. `partner:p1:no-next-step`). */
  id: string;
  kind: AttentionKind;
  category: AttentionCategory;
  title: string;
  /** One sentence: why this matters / what is at stake. */
  why: string;
  /** The concrete next move, phrased as an instruction. */
  suggestedStep: string | null;
  /** Compact recency/urgency read ("6 days overdue", "quiet 60 days"). */
  ageLabel: string | null;
  severity: OperationalReviewSeverity;
  /** Deterministic ranking score — higher = review sooner. */
  score: number;
  /** Where to go to act. */
  href: string;
  /** Optional drawer target so the UI can open a 360 panel in place. */
  entityType?: Entity360Type;
  entityId?: string;
  /** Display name of the related entity, for the relationship chip. */
  relatedLabel?: string;
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
        category: "urgent",
        title: `${partner.name} follow-up is ${days} day${days === 1 ? "" : "s"} overdue`,
        why: lead
          ? `${lead} planned a follow-up that never happened — the relationship is cooling.`
          : "A planned follow-up never happened and nobody owns this relationship.",
        suggestedStep: lead
          ? `Ask ${lead} to reschedule the follow-up — or reassign the relationship.`
          : "Assign a relationship owner and reschedule the follow-up.",
        ageLabel: `${days} day${days === 1 ? "" : "s"} overdue`,
        severity: days >= 14 ? "critical" : "warning",
        score: 24 + Math.min(days, 30),
        href: `/admin/partners/${partner.id}`,
        entityType: "partner",
        entityId: partner.id,
        relatedLabel: partner.name,
      });
    } else if (!partner.nextFollowUpAt) {
      const sinceContact = partner.lastContactedAt
        ? daysBetween(partner.lastContactedAt, now)
        : null;
      items.push({
        id: `partner:${partner.id}:no-next-step`,
        kind: "partner",
        category: "missing_next_step",
        title: `${partner.name} has no next step`,
        why:
          sinceContact != null
            ? `Last contact was ${sinceContact} day${sinceContact === 1 ? "" : "s"} ago and nothing is scheduled next.`
            : "This partnership is in the pipeline but nothing is scheduled next.",
        suggestedStep: "Schedule the next touchpoint or log the agreed next step.",
        ageLabel:
          sinceContact != null
            ? `quiet ${sinceContact} day${sinceContact === 1 ? "" : "s"}`
            : "no contact on record",
        severity: sinceContact != null && sinceContact > 30 ? "warning" : "watch",
        score: 14 + Math.min(sinceContact ?? 0, 20),
        href: `/admin/partners/${partner.id}`,
        entityType: "partner",
        entityId: partner.id,
        relatedLabel: partner.name,
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
      category: "stalled",
      title: `${applicant.name}'s application has sat ${idleDays} days`,
      why: "Applicants who wait this long without a decision usually walk away.",
      suggestedStep: "Assign a reviewer or schedule the interview.",
      ageLabel: `${idleDays} days without movement`,
      severity: idleDays >= APPLICANT_STUCK_DAYS * 2 ? "warning" : "watch",
      score: 12 + Math.min(idleDays, 40),
      href: `/admin/instructor-applicants/${applicant.id}`,
      entityType: "applicant",
      entityId: applicant.id,
      relatedLabel: applicant.name,
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

/**
 * The COARSE, program-wide "this pairing has gone silent" sweep for the
 * cross-domain Data 360 queue — a single `lastActivityAt` signal at
 * {@link MENTORSHIP_QUIET_DAYS} (45d). This is deliberately distinct from the
 * canonical PER-RELATIONSHIP derivation in `lib/mentorship/attention.ts`
 * (`deriveMentorshipAttention`), which reads actual next steps + check-ins. Keep
 * the two separate: this one spans the whole org with one cheap signal; that one
 * answers "what's the next move on THIS relationship?".
 */
export function deriveStalledMentorshipAttention(
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
      category: "stalled",
      title: `${m.mentorName} → ${m.menteeName} has been quiet ${quietDays} days`,
      why: "No check-ins, reviews, or sessions recorded — the pairing may have stalled.",
      suggestedStep: `Ask ${m.mentorName} for a check-in, or confirm the pairing is still active.`,
      ageLabel: `quiet ${quietDays} days`,
      severity: quietDays >= MENTORSHIP_QUIET_DAYS * 2 ? "warning" : "watch",
      score: 10 + Math.min(quietDays, 30),
      href: `/admin/mentorship/relationships/${m.id}`,
      entityType: "mentorship",
      entityId: m.id,
      relatedLabel: m.menteeName,
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
    // The shared readiness rule (signals.ts) decides what counts as missing
    // setup — this engine only decides when it is worth surfacing.
    const readiness = deriveClassReadiness(
      {
        status: cls.status,
        startDate: cls.startDate,
        endDate: cls.endDate,
        hasInstructor: cls.instructorName != null,
        sessionCount: cls.sessionCount,
        enrolledCount: cls.enrolledCount,
      },
      now
    );
    if (!readiness || readiness.missing.length === 0) continue;
    if (cls.startDate.getTime() > windowEnd) continue;

    const missing = readiness.missing;
    const started = cls.startDate.getTime() <= now.getTime();
    const daysOut = started ? 0 : daysBetween(now, cls.startDate);
    items.push({
      id: `class:${cls.id}:setup`,
      kind: "class",
      category: started ? "urgent" : "upcoming_risk",
      title: `${cls.title} ${started ? "is running" : `starts in ${daysOut} day${daysOut === 1 ? "" : "s"}`} but is missing ${missing.join(", ")}`,
      why: cls.instructorName
        ? `${cls.instructorName} cannot deliver this class until setup is finished.`
        : "This class has no path to delivery until setup is finished.",
      suggestedStep: `Not completed: ${missing.join(", ")}.`,
      ageLabel: started ? "already running" : `starts in ${daysOut} day${daysOut === 1 ? "" : "s"}`,
      severity: started || daysOut <= 7 ? "critical" : "warning",
      score: 26 + (started ? 14 : Math.max(0, 14 - daysOut)) + missing.length * 4,
      href: `/admin/classes/${cls.id}`,
      entityType: "class",
      entityId: cls.id,
      relatedLabel: cls.title,
    });
  }
  return items;
}

// --- digest review items ------------------------------------------------------------

/**
 * Deterministic category for a digest review item, read from the kind + the
 * engine's own reason strings (they are generated, not free text, so matching
 * on them is stable and unit-tested here).
 */
export function categoryForReviewItem(item: OperationalReviewItem): AttentionCategory {
  const reasons = item.reasons.join(" · ").toLowerCase();
  if (reasons.includes("overdue")) return "urgent";
  if (reasons.includes("no owner") || reasons.includes("no executor") || reasons.includes("unassigned")) {
    return "missing_owner";
  }
  if (item.kind === "decision") return "missing_next_step";
  if (reasons.includes("no action") || reasons.includes("follow-up")) {
    return "missing_next_step";
  }
  if (reasons.includes("blocked")) return "stalled";
  if (reasons.includes("no meeting") || reasons.includes("stale") || reasons.includes("quiet")) {
    return "stalled";
  }
  if (reasons.includes("prep") || reasons.includes("tomorrow") || reasons.includes("today")) {
    return "upcoming_risk";
  }
  return item.severity === "critical" ? "urgent" : "stalled";
}

const REVIEW_KIND_SUGGESTION: Partial<Record<OperationalReviewItem["kind"], string>> = {
  action: "Reassign, reschedule, or unblock it.",
  decision: "Convert the decision into a tracked action.",
  meeting: "Close the open follow-ups or convert them into actions.",
  class: "Open the class and clear the overdue or unowned work.",
  partner: "Open the partner and clear the overdue or unowned work.",
  mentorship: "Open the pairing and clear the overdue or unowned work.",
  instructor: "Open the application and move it to the next stage.",
  person: "Check in with them about the open work.",
  area: "Review the area's open work and meetings.",
};

/** Map a digest review item into the unified attention shape. */
export function attentionFromReviewItem(item: OperationalReviewItem): AttentionItem {
  return {
    id: `review:${item.id}`,
    kind: item.kind,
    category: categoryForReviewItem(item),
    title: item.title,
    why: item.reasons.join(" · ") || item.reason,
    suggestedStep: REVIEW_KIND_SUGGESTION[item.kind] ?? null,
    ageLabel: null,
    severity: item.severity,
    score: item.score,
    href: item.href,
  };
}

// --- assembly ------------------------------------------------------------------------

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
    ...deriveStalledMentorshipAttention(input.mentorships, now),
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

export type AttentionGroup = {
  category: AttentionCategory;
  label: string;
  hint: string;
  items: AttentionItem[];
};

/**
 * Group an already-ranked queue into its categories, in triage order, dropping
 * empty groups. Item order within a group preserves the queue's ranking.
 */
export function groupAttentionItems(items: AttentionItem[]): AttentionGroup[] {
  const byCategory = new Map<AttentionCategory, AttentionItem[]>();
  for (const item of items) {
    const list = byCategory.get(item.category) ?? [];
    list.push(item);
    byCategory.set(item.category, list);
  }
  return ATTENTION_CATEGORIES.filter((category) => byCategory.has(category)).map(
    (category) => ({
      category,
      label: ATTENTION_CATEGORY_LABELS[category],
      hint: ATTENTION_CATEGORY_HINTS[category],
      items: byCategory.get(category) as AttentionItem[],
    })
  );
}
