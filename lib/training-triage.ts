/**
 * Cohort triage — the single source of truth for bucketing a learner's
 * Instructor Academy progress into an at-a-glance lane an admin can act on.
 *
 * Phase 6 (admin visibility): the admin Learner Progress view and the
 * per-instructor readiness surfaces classify every learner into one of these
 * lanes so reviewers can spot who is stuck or awaiting a Studio review without
 * expanding every row.
 *
 * Server-safe and React-free: importable from server components, client
 * components, and tests.
 */

export type TriageBucket =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "STUCK"
  | "AWAITING_STUDIO"
  | "PASSED";

export const TRIAGE_BUCKETS: readonly TriageBucket[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "STUCK",
  "AWAITING_STUDIO",
  "PASSED",
] as const;

export const TRIAGE_LABEL: Record<TriageBucket, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  STUCK: "Stuck",
  AWAITING_STUDIO: "Awaiting Studio review",
  PASSED: "Passed",
};

/** Token-driven accent per lane (hue, not raw status hex sprinkled inline). */
export const TRIAGE_ACCENT: Record<TriageBucket, string> = {
  NOT_STARTED: "var(--muted)",
  IN_PROGRESS: "#6366f1",
  STUCK: "#d97706",
  AWAITING_STUDIO: "#7c3aed",
  PASSED: "#16a34a",
};

/**
 * A learner counts as "stuck" once they have started the academy but their
 * most recent activity is older than this many days without finishing. Long
 * enough to avoid flagging an instructor mid-session, short enough that a
 * stalled learner surfaces before they churn.
 */
export const STUCK_AFTER_DAYS = 14;

export type TriageInput = {
  /** Required modules marked COMPLETE for this learner. */
  requiredComplete: number;
  /** Total required modules assigned to this learner. */
  requiredModulesCount: number;
  /** Most recent completion / attempt timestamp, ISO string or null. */
  lastActivity: string | null;
  /**
   * Whether every readiness requirement (academy + capstone) is satisfied.
   * Instructors only — derived from `InstructorReadiness.trainingComplete`.
   * Students have no capstone, so leave undefined and the all-required-complete
   * check below stands in for "passed".
   */
  trainingComplete?: boolean;
  /** Instructors only: Studio capstone SUBMITTED but not yet APPROVED. */
  studioCapstoneInReview?: boolean;
  /** Reference "now" for the staleness window; defaults to Date.now(). */
  now?: number;
};

function isStale(lastActivity: string | null, now: number): boolean {
  if (!lastActivity) return true;
  const last = Date.parse(lastActivity);
  if (Number.isNaN(last)) return true;
  const ageDays = (now - last) / (1000 * 60 * 60 * 24);
  return ageDays >= STUCK_AFTER_DAYS;
}

/**
 * Classify a single learner into a triage lane. Pure and deterministic so the
 * admin page can pre-compute a `triage` field per row and tests can pin every
 * lane. Precedence: passed → awaiting Studio → not started → stuck → in
 * progress.
 */
export function classifyLearnerTriage(input: TriageInput): TriageBucket {
  const {
    requiredComplete,
    requiredModulesCount,
    lastActivity,
    trainingComplete,
    studioCapstoneInReview,
    now = Date.now(),
  } = input;

  const allModulesComplete =
    requiredModulesCount > 0 && requiredComplete >= requiredModulesCount;

  // Fully cleared: readiness says complete (instructors), or — when readiness
  // is not tracked for this learner (students) — every required module is done.
  if (trainingComplete === true) return "PASSED";
  if (trainingComplete === undefined && allModulesComplete) return "PASSED";

  // Modules done but the Studio capstone is still in review.
  if (studioCapstoneInReview === true) return "AWAITING_STUDIO";

  // Never touched the academy — no completed module and no recorded activity.
  if (requiredComplete === 0 && !lastActivity) return "NOT_STARTED";

  // Started but stalled out (no activity inside the staleness window).
  if (isStale(lastActivity, now)) return "STUCK";

  return "IN_PROGRESS";
}
