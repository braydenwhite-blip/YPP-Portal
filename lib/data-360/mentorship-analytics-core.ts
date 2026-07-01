/**
 * Data 360 — mentorship (student-advising) operating analytics (PURE).
 *
 * The mentorship vertical of the operating-intelligence layer. This module has
 * NO Prisma and NO React so every rule is unit-testable and deterministic — the
 * server loader (`./mentorship-analytics.ts`) hydrates the input shape and the
 * Data 360 section / Chapter Impact Meeting / Needs Attention surfaces all read
 * the SAME metrics, so they can never disagree.
 *
 * "Advising" here means the advisor↔student relationship modelled by
 * `StudentAdvisorAssignment` + `AdvisingNote` (check-ins) + `AdvisingRecommendation`
 * — the system the advising cockpit (`/operations/advising`) runs on. We reuse
 * that cockpit's SINGLE source of truth for lifecycle + caseload health
 * (`deriveAdvisingLifecycle`, `summarizeAdvisorCaseloads`) rather than inventing
 * a second at-risk engine, and grade against conservative, defensible targets
 * only (unassigned → 0, overdue check-in → 0, stale recommendation → 0). No
 * synthetic health score.
 */

import { deriveAdvisingLifecycle } from "@/lib/advising/relationship";
import {
  summarizeAdvisorCaseloads,
  type AssignmentLike,
} from "@/lib/leadership/caseload";
import { weekKey, weekStartFor } from "@/lib/weekly-meetings/week";

import {
  expectationStatusLabel,
  expectationTone,
  type ExpectationStatus,
} from "./expectations";
import type { MetricTone, TimeSeriesPoint } from "./types";
import { bucketDatesByWeek, DEFAULT_TREND_WEEKS } from "./week-buckets";

/** A SUGGESTED recommendation with no action after this many days reads as stale. */
export const STALE_RECOMMENDATION_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

// ── Input shapes (DB → pure) ────────────────────────────────────────────────
// Mirror what lib/advising/queries.ts already loads, kept minimal + serializable.

export type MentorshipAssignmentInput = {
  assignmentId: string;
  isActive: boolean;
  advisingStatus: "ENGAGED" | "NEEDS_ATTENTION" | "INACTIVE" | "READY_FOR_NEXT";
  needsFollowUp: boolean;
  followUpNote: string | null;
  lastCheckInAt: Date | null;
  nextCheckInDueAt: Date | null;
  startDate: Date;
  studentId: string;
  studentName: string;
  advisorId: string;
  advisorName: string;
  chapterId: string | null;
};

export type MentorshipRecommendationInput = {
  id: string;
  /** SUGGESTED | IN_PROGRESS | DONE | DISMISSED (TEXT vocabulary). */
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

/** One logged advising check-in (an AdvisingNote of kind CHECK_IN). */
export type MentorshipCheckInInput = { createdAt: Date };

export type MentorshipAnalyticsInput = {
  assignments: MentorshipAssignmentInput[];
  recommendations: MentorshipRecommendationInput[];
  checkIns: MentorshipCheckInInput[];
  /** Every student in scope, so "unassigned" is real (not just advised−total). */
  studentIds: string[];
};

// ── Metric definitions ──────────────────────────────────────────────────────

export const MENTORSHIP_METRIC_KEYS = [
  "studentsSupported",
  "unassignedStudents",
  "activeAdvisors",
  "overloadedAdvisors",
  "kickoffsNeeded",
  "overdueCheckIns",
  "checkInsThisWeek",
  "openRecommendations",
  "staleRecommendations",
  "recommendationsCompletedThisWeek",
] as const;

export type MentorshipMetricKey = (typeof MENTORSHIP_METRIC_KEYS)[number];

export type MentorshipDirection = "target-zero" | "higher-is-better" | "informational";

export type MentorshipExpectation = {
  key: MentorshipMetricKey;
  label: string;
  shortLabel: string;
  direction: MentorshipDirection;
  /** exact target for target-zero metrics */
  target?: number;
  /** at-least threshold for higher-is-better metrics */
  min?: number;
  /** compact benchmark string shown next to the value */
  expectationLabel: string;
  description: string;
  /** blueprint template key a gap here can start */
  gapTemplateKey?: string;
  /** advising cockpit lane the drilldown focuses */
  lane?: string;
};

/**
 * Conservative, defensible mentorship expectations. Only genuine problems have
 * a target (target-zero); volume/throughput metrics are informational so the
 * section never grades a chapter on numbers it can't control (advising cadence
 * varies by chapter maturity). Targets come from the advising cockpit's own
 * lifecycle thresholds, not invented benchmarks.
 */
export const MENTORSHIP_EXPECTATIONS: Record<MentorshipMetricKey, MentorshipExpectation> = {
  studentsSupported: {
    key: "studentsSupported",
    label: "Students supported",
    shortLabel: "Supported",
    direction: "informational",
    expectationLabel: "—",
    description: "Students with an active advisor relationship.",
  },
  unassignedStudents: {
    key: "unassignedStudents",
    label: "Students without an advisor",
    shortLabel: "Unassigned",
    direction: "target-zero",
    target: 0,
    expectationLabel: "0",
    description: "Students with no active advisor — every student should have one once advising is running.",
    gapTemplateKey: "student-advising",
    lane: "needs_advisor",
  },
  activeAdvisors: {
    key: "activeAdvisors",
    label: "Active advisors",
    shortLabel: "Advisors",
    direction: "informational",
    expectationLabel: "—",
    description: "People currently carrying at least one advising relationship.",
  },
  overloadedAdvisors: {
    key: "overloadedAdvisors",
    label: "Advisors over capacity",
    shortLabel: "Overloaded",
    direction: "target-zero",
    target: 0,
    expectationLabel: "0",
    description: "Advisors carrying a heavy caseload — the target is a balanced load.",
    lane: "advisor_overloaded",
  },
  kickoffsNeeded: {
    key: "kickoffsNeeded",
    label: "Kickoffs needed",
    shortLabel: "Kickoffs",
    direction: "target-zero",
    target: 0,
    expectationLabel: "0",
    description: "Assigned students whose first (kickoff) check-in hasn't happened yet.",
    gapTemplateKey: "student-advising",
    lane: "kickoff_needed",
  },
  overdueCheckIns: {
    key: "overdueCheckIns",
    label: "Overdue check-ins",
    shortLabel: "Overdue",
    direction: "target-zero",
    target: 0,
    expectationLabel: "0",
    description: "Active relationships past a scheduled check-in or gone quiet — the target is zero.",
    gapTemplateKey: "student-advising",
    lane: "follow_up_due",
  },
  checkInsThisWeek: {
    key: "checkInsThisWeek",
    label: "Check-ins this week",
    shortLabel: "Check-ins",
    direction: "informational",
    expectationLabel: "—",
    description: "Advising check-ins logged in the current reporting week.",
  },
  openRecommendations: {
    key: "openRecommendations",
    label: "Open recommendations",
    shortLabel: "Open recs",
    direction: "informational",
    expectationLabel: "—",
    description: "Next-step recommendations still awaiting action (SUGGESTED or in progress).",
  },
  staleRecommendations: {
    key: "staleRecommendations",
    label: "Stale recommendations",
    shortLabel: "Stale recs",
    direction: "target-zero",
    target: 0,
    expectationLabel: "0",
    description: `Suggested recommendations with no movement in over ${STALE_RECOMMENDATION_DAYS} days.`,
    gapTemplateKey: "student-advising",
    lane: "recommendations_ready",
  },
  recommendationsCompletedThisWeek: {
    key: "recommendationsCompletedThisWeek",
    label: "Recommendations completed this week",
    shortLabel: "Completed recs",
    direction: "informational",
    expectationLabel: "—",
    description: "Recommendations marked done in the current reporting week.",
  },
};

export const MENTORSHIP_EXPECTATION_LIST: MentorshipExpectation[] =
  MENTORSHIP_METRIC_KEYS.map((k) => MENTORSHIP_EXPECTATIONS[k]);

// ── Raw counts ──────────────────────────────────────────────────────────────

export type MentorshipCounts = Record<MentorshipMetricKey, number> & {
  /** True once any advising relationship exists — gates "unassigned" grading. */
  advisingActive: boolean;
  totalStudents: number;
  totalAssignments: number;
};

const OPEN_REC_STATUSES = new Set(["SUGGESTED", "IN_PROGRESS"]);

function inThisWeek(d: Date, now: Date): boolean {
  return weekKey(weekStartFor(d)) === weekKey(weekStartFor(now));
}

/** Compute every mentorship count from the loaded advising snapshot. Pure. */
export function computeMentorshipCounts(
  input: MentorshipAnalyticsInput,
  now: Date = new Date()
): MentorshipCounts {
  const active = input.assignments.filter((a) => a.isActive);

  // Lifecycle per active relationship, via the advising cockpit's own logic.
  let kickoffsNeeded = 0;
  let overdueCheckIns = 0;
  for (const a of active) {
    const life = deriveAdvisingLifecycle(a, now);
    if (life.lifecycle === "KICKOFF_NEEDED") kickoffsNeeded += 1;
    else if (life.lifecycle === "FOLLOW_UP_DUE" || life.lifecycle === "STALE") {
      overdueCheckIns += 1;
    }
  }

  // Caseload bands, via the advisor dashboard's own math.
  const caseloadInput: AssignmentLike[] = input.assignments.map((a) => ({
    advisorId: a.advisorId,
    studentId: a.studentId,
    isActive: a.isActive,
    advisingStatus: a.advisingStatus,
    needsFollowUp: a.needsFollowUp,
    lastCheckInAt: a.lastCheckInAt,
    startDate: a.startDate,
  }));
  const caseloads = summarizeAdvisorCaseloads(caseloadInput, now);
  const overloadedAdvisors = caseloads.filter((c) => c.band === "HIGH").length;
  const activeAdvisors = caseloads.filter((c) => c.activeCount > 0).length;

  const advisedStudents = new Set(active.map((a) => a.studentId));
  const studentsSupported = advisedStudents.size;
  const unassignedStudents = input.studentIds.filter((id) => !advisedStudents.has(id)).length;

  const checkInsThisWeek = input.checkIns.filter((c) => inThisWeek(c.createdAt, now)).length;

  const openRecommendations = input.recommendations.filter((r) =>
    OPEN_REC_STATUSES.has(r.status)
  ).length;
  const staleRecommendations = input.recommendations.filter(
    (r) =>
      r.status === "SUGGESTED" &&
      now.getTime() - r.createdAt.getTime() > STALE_RECOMMENDATION_DAYS * DAY_MS
  ).length;
  const recommendationsCompletedThisWeek = input.recommendations.filter(
    (r) => r.status === "DONE" && inThisWeek(r.updatedAt, now)
  ).length;

  return {
    studentsSupported,
    unassignedStudents,
    activeAdvisors,
    overloadedAdvisors,
    kickoffsNeeded,
    overdueCheckIns,
    checkInsThisWeek,
    openRecommendations,
    staleRecommendations,
    recommendationsCompletedThisWeek,
    advisingActive: input.assignments.length > 0,
    totalStudents: input.studentIds.length,
    totalAssignments: input.assignments.length,
  };
}

// ── Graded metrics ──────────────────────────────────────────────────────────

export type MentorshipMetric = {
  key: MentorshipMetricKey;
  label: string;
  shortLabel: string;
  value: number;
  direction: MentorshipDirection;
  expectationLabel: string;
  status: ExpectationStatus;
  statusLabel: string;
  tone: MetricTone;
  href: string | null;
  description: string;
  /** True when a target-zero metric is breached (a real, actionable gap). */
  isGap: boolean;
};

/** Grade one mentorship value against its expectation. Pure + explainable. */
export function gradeMentorshipMetric(
  exp: MentorshipExpectation,
  value: number,
  advisingActive: boolean
): ExpectationStatus {
  // "Unassigned students" only grades once advising is actually running.
  if (exp.key === "unassignedStudents" && !advisingActive) return "none";
  switch (exp.direction) {
    case "target-zero":
      return value <= (exp.target ?? 0) ? "met" : "over";
    case "higher-is-better": {
      const min = exp.min ?? 0;
      if (value >= min) return "met";
      if (value >= Math.ceil(min * 0.7)) return "approaching";
      return "below";
    }
    case "informational":
    default:
      return "none";
  }
}

/** The advising-cockpit lane a metric drills into (a real, navigable route). */
export function mentorshipMetricHref(exp: MentorshipExpectation): string | null {
  if (exp.key === "studentsSupported") return "/admin/students";
  if (exp.lane) return `/operations/advising?lane=${exp.lane}`;
  return "/operations/advising";
}

export function buildMentorshipMetrics(
  counts: MentorshipCounts
): MentorshipMetric[] {
  return MENTORSHIP_EXPECTATION_LIST.map((exp) => {
    const value = counts[exp.key];
    const status = gradeMentorshipMetric(exp, value, counts.advisingActive);
    const informational = exp.direction === "informational" || status === "none";
    return {
      key: exp.key,
      label: exp.label,
      shortLabel: exp.shortLabel,
      value,
      direction: exp.direction,
      expectationLabel: exp.expectationLabel,
      status,
      statusLabel: informational ? "" : expectationStatusLabel(status),
      tone: exp.direction === "informational" ? "default" : expectationTone(status),
      href: mentorshipMetricHref(exp),
      description: exp.description,
      isGap: exp.direction === "target-zero" && status === "over",
    };
  });
}

// ── Deterministic workflow suggestions (with active-workflow dedupe) ─────────

export type MentorshipSuggestion = {
  id: string;
  metricKey: MentorshipMetricKey;
  metricLabel: string;
  currentValue: number;
  expectedLabel: string;
  reason: string;
  templateKey: string;
  templateLabel: string;
  primaryActionHref: string;
  primaryActionLabel: string;
  /** The records that prove the gap. */
  sourceHref: string | null;
  /** True when an active workflow of the same template already addresses it. */
  covered: boolean;
};

export const MENTORSHIP_TEMPLATE_LABELS: Record<string, string> = {
  "student-advising": "Student Advising workflow",
};

function mentorshipTemplateLabel(key: string): string {
  return MENTORSHIP_TEMPLATE_LABELS[key] ?? key;
}

function suggestionReason(key: MentorshipMetricKey, value: number): string {
  switch (key) {
    case "unassignedStudents":
      return `${value} student${value === 1 ? "" : "s"} without an advisor — the target is 0.`;
    case "kickoffsNeeded":
      return `${value} assigned student${value === 1 ? "" : "s"} still waiting on a first check-in.`;
    case "overdueCheckIns":
      return `${value} advising relationship${value === 1 ? "" : "s"} past a scheduled check-in.`;
    case "staleRecommendations":
      return `${value} recommendation${value === 1 ? "" : "s"} with no movement in over ${STALE_RECOMMENDATION_DAYS} days.`;
    default:
      return `${value} ${MENTORSHIP_EXPECTATIONS[key].label.toLowerCase()} — the target is 0.`;
  }
}

/**
 * Suggestions for the mentorship gaps that have a blueprint. A target-zero
 * metric that is non-zero fires one suggestion. `activeTemplateKeys` is the set
 * of blueprint keys with a live (active/blocked/on-hold) advising workflow — a
 * suggestion whose template already has an active workflow is kept but marked
 * `covered` so the UI can show "already in progress" instead of nagging.
 * Deterministic: worst gaps (largest count) first, then by metric key.
 */
export function buildMentorshipSuggestions(
  counts: MentorshipCounts,
  activeTemplateKeys: ReadonlySet<string> = new Set()
): MentorshipSuggestion[] {
  const out: MentorshipSuggestion[] = [];
  for (const exp of MENTORSHIP_EXPECTATION_LIST) {
    if (exp.direction !== "target-zero" || !exp.gapTemplateKey) continue;
    if (exp.key === "unassignedStudents" && !counts.advisingActive) continue;
    const value = counts[exp.key];
    if (value <= (exp.target ?? 0)) continue;

    const templateKey = exp.gapTemplateKey;
    out.push({
      id: `mentorship:${exp.key}`,
      metricKey: exp.key,
      metricLabel: exp.label,
      currentValue: value,
      expectedLabel: exp.expectationLabel,
      reason: suggestionReason(exp.key, value),
      templateKey,
      templateLabel: mentorshipTemplateLabel(templateKey),
      primaryActionHref: "/operations/advising",
      primaryActionLabel: `Open advising queue`,
      sourceHref: mentorshipMetricHref(exp),
      covered: activeTemplateKeys.has(templateKey),
    });
  }
  return out.sort((a, b) => {
    if (a.covered !== b.covered) return a.covered ? 1 : -1; // uncovered gaps first
    if (b.currentValue !== a.currentValue) return b.currentValue - a.currentValue;
    return a.metricKey.localeCompare(b.metricKey);
  });
}

// ── Weekly trends (real timestamps only) ────────────────────────────────────

export type MentorshipTrends = {
  checkIns: TimeSeriesPoint[];
  recommendationsOpened: TimeSeriesPoint[];
  recommendationsCompleted: TimeSeriesPoint[];
};

/**
 * Week-by-week series from real record timestamps: check-ins logged,
 * recommendations opened (createdAt), and recommendations completed (updatedAt
 * of DONE rows). Dense buckets — zero weeks are shown, so the chart never lies.
 */
export function buildMentorshipTrends(
  input: MentorshipAnalyticsInput,
  now: Date = new Date(),
  weeks: number = DEFAULT_TREND_WEEKS
): MentorshipTrends {
  return {
    checkIns: bucketDatesByWeek(
      input.checkIns.map((c) => c.createdAt),
      now,
      weeks
    ),
    recommendationsOpened: bucketDatesByWeek(
      input.recommendations.map((r) => r.createdAt),
      now,
      weeks
    ),
    recommendationsCompleted: bucketDatesByWeek(
      input.recommendations.filter((r) => r.status === "DONE").map((r) => r.updatedAt),
      now,
      weeks
    ),
  };
}

// ── Assembled snapshot (what surfaces render) ───────────────────────────────

export type MentorshipSnapshotCore = {
  counts: MentorshipCounts;
  metrics: MentorshipMetric[];
  suggestions: MentorshipSuggestion[];
  trends: MentorshipTrends;
  /** Count of target-zero metrics currently breached. */
  gapCount: number;
};

export function assembleMentorshipSnapshot(
  input: MentorshipAnalyticsInput,
  opts: { activeTemplateKeys?: ReadonlySet<string>; now?: Date; weeks?: number } = {}
): MentorshipSnapshotCore {
  const now = opts.now ?? new Date();
  const counts = computeMentorshipCounts(input, now);
  const metrics = buildMentorshipMetrics(counts);
  const suggestions = buildMentorshipSuggestions(counts, opts.activeTemplateKeys ?? new Set());
  const trends = buildMentorshipTrends(input, now, opts.weeks ?? DEFAULT_TREND_WEEKS);
  return {
    counts,
    metrics,
    suggestions,
    trends,
    gapCount: metrics.filter((m) => m.isGap).length,
  };
}
