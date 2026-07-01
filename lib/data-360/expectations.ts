/**
 * Data 360 — chapter operating expectations (the benchmark row).
 *
 * ONE central definition of what a healthy chapter looks like, reused by:
 *   - the Data 360 chapter-comparison grid (expectations row at the top)
 *   - Chapter Data 360
 *   - the Chapter Impact Meeting "Chapter Health Update" table
 *   - data-triggered workflow suggestions
 *   - metric status pills
 *
 * Every expectation is a concrete number or range — never a synthetic score.
 * `status()` returns a plain, explainable label. Metrics are gated by chapter
 * lifecycle phase so a pre-launch chapter isn't graded on attendance it can't
 * have yet (the "gray-out" behaviour Part 8 asks for).
 *
 * Initial targets come from the YPP operating playbook (Part 9 of the brief):
 *   partners 8–10 · applicants 30+ · instructors 15–20 · students 80–100 ·
 *   blocked/overdue workflows target 0. They are intentionally easy to tune
 *   here without touching any consumer.
 */

export const CHAPTER_METRIC_KEYS = [
  // growth
  "partners",
  "applicants",
  "instructors",
  "students",
  "classes",
  "sessions",
  "attendance",
  "meetingsHeld",
  "pendingFollowUps",
  "completedFollowUps",
  "completedActions",
  // workflow operating
  "activeWorkflows",
  "blockedWorkflows",
  "overdueWorkflows",
] as const;

export type ChapterMetricKey = (typeof CHAPTER_METRIC_KEYS)[number];

/** Lifecycle phase a chapter is in, derived from its lifecycleStatus. */
export type ChapterPhase = "prelaunch" | "launching" | "operating" | "mature";

export const CHAPTER_PHASE_LABELS: Record<ChapterPhase, string> = {
  prelaunch: "Pre-launch",
  launching: "Launching",
  operating: "Operating",
  mature: "Mature",
};

/**
 * Map a Chapter.lifecycleStatus string onto an operating phase. Kept as a
 * string arg (not the Prisma enum) so this module stays free of server imports.
 */
export function chapterPhase(lifecycleStatus: string | null | undefined): ChapterPhase {
  switch (lifecycleStatus) {
    case "PROSPECT":
    case "APPROVED":
      return "prelaunch";
    case "LAUNCHING":
      return "launching";
    case "ALUMNI":
      return "mature";
    case "ACTIVE":
    case "NEEDS_SUPPORT":
    case "AT_RISK":
    case "PAUSED":
    default:
      return "operating";
  }
}

export type ExpectationDirection = "higher-is-better" | "lower-is-better" | "target-zero";

/**
 * How a current value compares to expectation:
 *   met         — at or above target (or exactly 0 for target-zero)
 *   approaching — within striking distance of the target
 *   below       — short of a higher-is-better target
 *   over        — above a lower-is-better ceiling / non-zero for target-zero
 *   none        — metric not yet relevant for this chapter phase (gray out)
 */
export type ExpectationStatus = "met" | "approaching" | "below" | "over" | "none";

export type ChapterExpectation = {
  key: ChapterMetricKey;
  label: string;
  shortLabel: string;
  direction: ExpectationDirection;
  /** at-least threshold for higher-is-better metrics */
  min?: number;
  /** top of the healthy range (higher-is-better) or ceiling (lower-is-better) */
  max?: number;
  /** exact target for target-zero metrics */
  target?: number;
  unit: "count" | "percent";
  /** phases in which this metric is graded; others render muted */
  relevantPhases: ChapterPhase[];
  /** the compact benchmark string shown in the expectations row */
  expectationLabel: string;
  description: string;
  /** blueprint template key a gap here can start (Part 4/5 suggestions) */
  gapTemplateKey?: string;
};

const ALL_PHASES: ChapterPhase[] = ["prelaunch", "launching", "operating", "mature"];
const OPERATING_UP: ChapterPhase[] = ["operating", "mature"];
const LAUNCH_UP: ChapterPhase[] = ["launching", "operating", "mature"];

export const CHAPTER_EXPECTATIONS: Record<ChapterMetricKey, ChapterExpectation> = {
  partners: {
    key: "partners",
    label: "Active partners",
    shortLabel: "Partners",
    direction: "higher-is-better",
    min: 8,
    max: 10,
    unit: "count",
    relevantPhases: ALL_PHASES,
    expectationLabel: "8–10",
    description: "Confirmed partner organizations hosting or supporting the chapter.",
    gapTemplateKey: "partner-acquisition",
  },
  applicants: {
    key: "applicants",
    label: "Instructor applicants",
    shortLabel: "Applicants",
    direction: "higher-is-better",
    min: 30,
    unit: "count",
    relevantPhases: ALL_PHASES,
    expectationLabel: "30+",
    description: "Instructor applications in the hiring pipeline for this chapter.",
    gapTemplateKey: "instructor-recruiting-campaign",
  },
  instructors: {
    key: "instructors",
    label: "Instructors",
    shortLabel: "Instructors",
    direction: "higher-is-better",
    min: 15,
    max: 20,
    unit: "count",
    relevantPhases: ALL_PHASES,
    expectationLabel: "15–20",
    description: "Approved instructors attached to the chapter.",
    gapTemplateKey: "instructor-recruiting-campaign",
  },
  students: {
    key: "students",
    label: "Students",
    shortLabel: "Students",
    direction: "higher-is-better",
    min: 80,
    max: 100,
    unit: "count",
    relevantPhases: LAUNCH_UP,
    expectationLabel: "80–100",
    description: "Students enrolled in the chapter's classes.",
    gapTemplateKey: "program-launch",
  },
  classes: {
    key: "classes",
    label: "Active classes",
    shortLabel: "Classes",
    direction: "higher-is-better",
    min: 4,
    unit: "count",
    relevantPhases: LAUNCH_UP,
    expectationLabel: "Enough for enrollment",
    description: "Published or in-progress class offerings supporting enrollment.",
    gapTemplateKey: "program-launch",
  },
  sessions: {
    key: "sessions",
    label: "Sessions held",
    shortLabel: "Sessions",
    direction: "higher-is-better",
    min: 1,
    unit: "count",
    relevantPhases: OPERATING_UP,
    expectationLabel: "Per schedule",
    description: "Class sessions that have taken place, by the class schedule.",
  },
  attendance: {
    key: "attendance",
    label: "Attendance",
    shortLabel: "Attendance",
    direction: "higher-is-better",
    min: 80,
    unit: "percent",
    relevantPhases: OPERATING_UP,
    expectationLabel: "80%+",
    description: "Share of enrolled students attending recent sessions.",
  },
  meetingsHeld: {
    key: "meetingsHeld",
    label: "Meetings held",
    shortLabel: "Meetings",
    direction: "higher-is-better",
    min: 1,
    unit: "count",
    relevantPhases: ALL_PHASES,
    expectationLabel: "Weekly",
    description: "Completed operating meetings — a weekly cadence is the target.",
    gapTemplateKey: "chapter-launch",
  },
  pendingFollowUps: {
    key: "pendingFollowUps",
    label: "Pending follow-ups",
    shortLabel: "Pending",
    direction: "lower-is-better",
    max: 8,
    unit: "count",
    relevantPhases: ALL_PHASES,
    expectationLabel: "≤ 8",
    description: "Open meeting follow-ups — visible, but a backlog signals slippage.",
  },
  completedFollowUps: {
    key: "completedFollowUps",
    label: "Follow-ups completed",
    shortLabel: "Done f/u",
    direction: "higher-is-better",
    min: 1,
    unit: "count",
    relevantPhases: ALL_PHASES,
    expectationLabel: "Evidence of discipline",
    description: "Meeting follow-ups closed — evidence of operating discipline.",
  },
  completedActions: {
    key: "completedActions",
    label: "Actions completed",
    shortLabel: "Done actions",
    direction: "higher-is-better",
    min: 1,
    unit: "count",
    relevantPhases: ALL_PHASES,
    expectationLabel: "Evidence of execution",
    description: "Action-tracker items completed — evidence of execution.",
  },
  activeWorkflows: {
    key: "activeWorkflows",
    label: "Active workflows",
    shortLabel: "Active wf",
    direction: "higher-is-better",
    min: 1,
    unit: "count",
    relevantPhases: ALL_PHASES,
    expectationLabel: "Reflects current work",
    description: "Running workflows — enough to reflect current operating needs.",
  },
  blockedWorkflows: {
    key: "blockedWorkflows",
    label: "Blocked workflows",
    shortLabel: "Blocked wf",
    direction: "target-zero",
    target: 0,
    unit: "count",
    relevantPhases: ALL_PHASES,
    expectationLabel: "0",
    description: "Workflows with a blocked step — the target is zero.",
    gapTemplateKey: "chapter-recovery",
  },
  overdueWorkflows: {
    key: "overdueWorkflows",
    label: "Overdue workflows",
    shortLabel: "Overdue wf",
    direction: "target-zero",
    target: 0,
    unit: "count",
    relevantPhases: ALL_PHASES,
    expectationLabel: "0",
    description: "Workflows past a required step's due date — the target is zero.",
    gapTemplateKey: "chapter-recovery",
  },
};

export const CHAPTER_EXPECTATION_LIST: ChapterExpectation[] =
  CHAPTER_METRIC_KEYS.map((k) => CHAPTER_EXPECTATIONS[k]);

/** Is this metric graded for a chapter in the given phase? */
export function isMetricRelevant(key: ChapterMetricKey, phase: ChapterPhase): boolean {
  return CHAPTER_EXPECTATIONS[key].relevantPhases.includes(phase);
}

/**
 * Compare a current value against its expectation. `phase` gates relevance:
 * a metric not relevant to the phase returns "none" (render muted / gray).
 * Pure and deterministic.
 */
export function expectationStatus(
  key: ChapterMetricKey,
  value: number | null,
  phase: ChapterPhase = "operating"
): ExpectationStatus {
  const exp = CHAPTER_EXPECTATIONS[key];
  if (!isMetricRelevant(key, phase)) return "none";
  if (value === null) return "none";

  switch (exp.direction) {
    case "target-zero":
      return value <= (exp.target ?? 0) ? "met" : "over";
    case "lower-is-better": {
      const ceiling = exp.max ?? Infinity;
      if (value <= ceiling) return "met";
      // within 50% over the ceiling is "approaching" trouble, else clearly over
      return value <= ceiling * 1.5 ? "approaching" : "over";
    }
    case "higher-is-better":
    default: {
      const min = exp.min ?? 0;
      if (value >= min) return "met";
      if (value >= Math.ceil(min * 0.7)) return "approaching";
      return "below";
    }
  }
}

/** Cosmetic tone for a status — maps to the Data 360 MetricTone vocabulary. */
export function expectationTone(
  status: ExpectationStatus
): "positive" | "warning" | "danger" | "muted" | "default" {
  switch (status) {
    case "met":
      return "positive";
    case "approaching":
      return "warning";
    case "below":
    case "over":
      return "danger";
    case "none":
      return "muted";
    default:
      return "default";
  }
}

/** A short human phrase for a status, used in pills and the meeting table. */
export function expectationStatusLabel(status: ExpectationStatus): string {
  switch (status) {
    case "met":
      return "On target";
    case "approaching":
      return "Approaching";
    case "below":
      return "Below target";
    case "over":
      return "Over target";
    case "none":
      return "Not yet";
    default:
      return "—";
  }
}
