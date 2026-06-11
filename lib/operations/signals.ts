import type { OperationalDigestCounts } from "@/lib/people-strategy/operational-digest";

import type { Entity360Tone } from "./entity-360";
import type { OrgWideCounts } from "./metrics";

/**
 * Data 360 — derived readiness / health / activity signals.
 *
 * The ONE place operational judgment calls about classes, partners, and people
 * are made, so the attention engine, the 360 drawers, and the explorer can
 * never disagree about what "needs setup" or "stalled" means. Every function
 * is PURE (no DB, no session; callers inject `now`) and unit-tested.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));
}

// --- class readiness -------------------------------------------------------------

export type ClassReadinessLevel = "ready" | "almost" | "needs_setup" | "at_risk";

export type ClassReadinessInput = {
  /** ClassOfferingStatus string. */
  status: string;
  startDate: Date;
  endDate: Date;
  hasInstructor: boolean;
  sessionCount: number;
  enrolledCount: number;
};

export type ClassReadiness = {
  level: ClassReadinessLevel;
  label: string;
  tone: Entity360Tone;
  /** Setup items still missing, in fix-first order. Empty when ready. */
  missing: string[];
};

export const CLASS_READINESS_META: Record<
  ClassReadinessLevel,
  { label: string; tone: Entity360Tone }
> = {
  ready: { label: "Ready", tone: "success" },
  almost: { label: "Almost ready", tone: "info" },
  needs_setup: { label: "Needs setup", tone: "warning" },
  at_risk: { label: "At risk", tone: "overdue" },
};

/** Days before start within which missing setup escalates to "at risk". */
export const CLASS_READINESS_URGENT_DAYS = 7;

/**
 * How deliverable is this class? Missing-setup detection is THE shared rule —
 * the attention engine and the Class 360 panel both read from here. Terminal
 * classes (cancelled / completed / already ended) return null: readiness is a
 * question about classes still being delivered.
 */
export function deriveClassReadiness(
  input: ClassReadinessInput,
  now: Date = new Date()
): ClassReadiness | null {
  if (input.status === "CANCELLED" || input.status === "COMPLETED") return null;
  if (input.endDate.getTime() < now.getTime()) return null;

  const missing: string[] = [];
  if (!input.hasInstructor) missing.push("instructor");
  if (input.sessionCount === 0) missing.push("session schedule");
  if (input.status === "DRAFT") missing.push("publish the class");
  if (input.enrolledCount === 0) missing.push("student enrollment");

  if (missing.length === 0) {
    return { level: "ready", ...CLASS_READINESS_META.ready, missing };
  }
  const started = input.startDate.getTime() <= now.getTime();
  const startsSoon =
    input.startDate.getTime() <= now.getTime() + CLASS_READINESS_URGENT_DAYS * DAY_MS;
  if (started || startsSoon) {
    return { level: "at_risk", ...CLASS_READINESS_META.at_risk, missing };
  }
  if (missing.length >= 2) {
    return { level: "needs_setup", ...CLASS_READINESS_META.needs_setup, missing };
  }
  return { level: "almost", ...CLASS_READINESS_META.almost, missing };
}

// --- partner health ----------------------------------------------------------------

export type PartnerHealthLevel = "healthy" | "needs_follow_up" | "stalled" | "at_risk";

export type PartnerHealthInput = {
  /** Pipeline stage string; null/inactive stages yield no health read. */
  stage: string | null;
  nextFollowUpAt: Date | null;
  lastContactedAt: Date | null;
  /** Open / overdue tracker actions linked to this partner. */
  openActions: number;
  overdueActions: number;
};

export type PartnerHealth = {
  level: PartnerHealthLevel;
  label: string;
  tone: Entity360Tone;
  reasons: string[];
};

export const PARTNER_HEALTH_META: Record<
  PartnerHealthLevel,
  { label: string; tone: Entity360Tone }
> = {
  healthy: { label: "Healthy", tone: "success" },
  needs_follow_up: { label: "Needs follow-up", tone: "info" },
  stalled: { label: "Stalled", tone: "warning" },
  at_risk: { label: "At risk", tone: "overdue" },
};

/** Stages that mean "we are not actively working this partner" (mirrors attention.ts). */
export const INACTIVE_PARTNER_STAGES = new Set([
  "NOT_STARTED",
  "CLOSED",
  "DECLINED",
  "ARCHIVED",
]);

/** Days a follow-up may be overdue before the relationship reads as at risk. */
export const PARTNER_AT_RISK_OVERDUE_DAYS = 14;
/** Days since last contact past which a partner with no next step reads stalled. */
export const PARTNER_STALLED_QUIET_DAYS = 30;

/**
 * How is this relationship doing? Null for inactive pipeline stages — health is
 * a question about relationships being worked.
 */
export function derivePartnerHealth(
  input: PartnerHealthInput,
  now: Date = new Date()
): PartnerHealth | null {
  if (input.stage == null || INACTIVE_PARTNER_STAGES.has(input.stage)) return null;

  const reasons: string[] = [];
  const followUpOverdueDays =
    input.nextFollowUpAt && input.nextFollowUpAt.getTime() < now.getTime()
      ? daysBetween(input.nextFollowUpAt, now)
      : 0;
  const quietDays = input.lastContactedAt
    ? daysBetween(input.lastContactedAt, now)
    : null;

  if (followUpOverdueDays > 0) {
    reasons.push(
      `Planned follow-up is ${followUpOverdueDays} day${followUpOverdueDays === 1 ? "" : "s"} overdue`
    );
  }
  if (input.overdueActions > 0) {
    reasons.push(
      `${input.overdueActions} overdue action${input.overdueActions === 1 ? "" : "s"}`
    );
  }
  if (!input.nextFollowUpAt) {
    reasons.push("No next step scheduled");
  }
  if (quietDays != null && quietDays > PARTNER_STALLED_QUIET_DAYS) {
    reasons.push(`No contact in ${quietDays} days`);
  } else if (quietDays == null) {
    reasons.push("No contact on record");
  }

  let level: PartnerHealthLevel;
  if (followUpOverdueDays >= PARTNER_AT_RISK_OVERDUE_DAYS || input.overdueActions > 0) {
    level = "at_risk";
  } else if (
    !input.nextFollowUpAt &&
    (quietDays == null || quietDays > PARTNER_STALLED_QUIET_DAYS)
  ) {
    level = "stalled";
  } else if (followUpOverdueDays > 0 || !input.nextFollowUpAt) {
    level = "needs_follow_up";
  } else {
    level = "healthy";
  }

  return {
    level,
    ...PARTNER_HEALTH_META[level],
    reasons: level === "healthy" ? [] : reasons,
  };
}

// --- person activity / completeness ---------------------------------------------------

export type PersonProfileFields = {
  hasBio: boolean;
  hasAvatar: boolean;
  hasPhone: boolean;
  hasSchool: boolean;
  hasLocation: boolean;
  hasChapter: boolean;
};

export type PersonProfileCompleteness = {
  /** 0–100, share of the six public profile fields filled in. */
  percent: number;
  /** Human names of the missing fields, in display order. */
  missing: string[];
};

const PROFILE_FIELD_LABELS: Array<[keyof PersonProfileFields, string]> = [
  ["hasBio", "bio"],
  ["hasAvatar", "photo"],
  ["hasPhone", "phone"],
  ["hasSchool", "school"],
  ["hasLocation", "location"],
  ["hasChapter", "chapter"],
];

/** How filled-in is a member's public profile? */
export function derivePersonProfileCompleteness(
  fields: PersonProfileFields
): PersonProfileCompleteness {
  const missing = PROFILE_FIELD_LABELS.filter(([key]) => !fields[key]).map(
    ([, label]) => label
  );
  const total = PROFILE_FIELD_LABELS.length;
  return {
    percent: Math.round(((total - missing.length) / total) * 100),
    missing,
  };
}

/** The newest of a set of optional dates, as an ISO string (null when none). */
export function latestActivityISO(
  dates: Array<Date | string | null | undefined>
): string | null {
  let latest: number | null = null;
  for (const d of dates) {
    if (!d) continue;
    const t = new Date(d).getTime();
    if (Number.isNaN(t)) continue;
    if (latest == null || t > latest) latest = t;
  }
  return latest == null ? null : new Date(latest).toISOString();
}

/** "today" / "3 days ago" / "Jun 2" — compact recency label for glance rows. */
export function recencyLabel(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "no activity yet";
  const days = daysBetween(new Date(iso), now);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days <= 14) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// --- today's brief -------------------------------------------------------------------

/**
 * The morning-stand-up read: the org's state as a handful of plain sentences,
 * worst news first, wins last. Only non-zero facts make the brief; a calm org
 * gets one calm sentence instead of a wall of zeroes.
 */
export function buildTodaysBrief(input: {
  counts: OperationalDigestCounts;
  org: OrgWideCounts;
}): string[] {
  const { counts, org } = input;
  const lines: string[] = [];
  const plural = (n: number, one: string, many = `${one}s`) =>
    `${n} ${n === 1 ? one : many}`;

  if (counts.overdueActions > 0) {
    lines.push(`${plural(counts.overdueActions, "action is", "actions are")} overdue.`);
  }
  if (counts.blockedActions > 0) {
    lines.push(`${plural(counts.blockedActions, "action is", "actions are")} blocked.`);
  }
  if (counts.unassignedActions > 0) {
    lines.push(`${plural(counts.unassignedActions, "action has", "actions have")} no owner.`);
  }
  if (org.partnersNeedingFollowUp > 0) {
    lines.push(`${plural(org.partnersNeedingFollowUp, "partner needs", "partners need")} follow-up.`);
  }
  if (org.applicantsStuck > 0) {
    lines.push(
      `${plural(org.applicantsStuck, "applicant has", "applicants have")} waited too long for a decision.`
    );
  }
  if (org.mentorshipsQuiet > 0) {
    lines.push(`${plural(org.mentorshipsQuiet, "mentorship has", "mentorships have")} gone quiet.`);
  }
  if (org.initiativesAtRisk > 0) {
    lines.push(`${plural(org.initiativesAtRisk, "initiative is", "initiatives are")} at risk.`);
  }
  if (counts.decisionsNeedingAction > 0) {
    lines.push(
      `${plural(counts.decisionsNeedingAction, "decision still needs", "decisions still need")} an action.`
    );
  }
  if (counts.dueSoonActions > 0) {
    lines.push(`${plural(counts.dueSoonActions, "action is", "actions are")} due this week.`);
  }
  if (counts.meetingsThisWeek > 0) {
    lines.push(
      `${plural(counts.meetingsThisWeek, "meeting is", "meetings are")} on the calendar this week.`
    );
  }
  if (counts.recentlyCompletedActions > 0) {
    lines.push(
      `${plural(counts.recentlyCompletedActions, "action was", "actions were")} completed this week.`
    );
  }

  if (lines.length === 0) {
    return ["All clear — nothing overdue, blocked, or waiting on a decision."];
  }
  return lines.slice(0, 6);
}
