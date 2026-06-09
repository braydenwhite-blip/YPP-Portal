import type {
  InitiativeHealth,
  InitiativeHealthTone,
  InitiativeMomentum,
  InitiativeOwnership,
  InitiativeProgress,
  InitiativeRisk,
  InitiativeWorkSignals,
} from "./strategic-initiative-health";

/**
 * YPP Execution OS — STRATEGIC PROJECT HEALTH (Strategic Initiatives 3.0).
 *
 * The project layer REUSES the 2.0 health / momentum / risk / ownership / progress
 * engines on the project's classified work subset. This module adds the
 * project-specific intelligence those engines don't cover:
 *
 *   - CONFIDENCE — a single read of "will this land?", blending progress,
 *     momentum, risk, and ownership clarity.
 *   - BLOCKERS — honestly split into DECLARED (config dependency) vs OBSERVED
 *     (overdue / blocked work), per the data-honesty rules.
 *   - FOLLOW-THROUGH — decision → action, meeting → follow-up, and action
 *     completion coverage.
 *   - REVIEW NEED — whether and how urgently leadership should review the project.
 *   - STATUS EXPLANATION — why the project reads the way it does, distinguishing
 *     "no data" from "healthy".
 *
 * Pure: no DB, no React. Every output is explainable.
 */

// --- confidence --------------------------------------------------------------

export type ProjectConfidenceLevel = "high" | "moderate" | "low" | "unknown";

export type ProjectConfidence = {
  level: ProjectConfidenceLevel;
  label: string;
  tone: InitiativeHealthTone;
  /** 0–100; null when there is no work to judge from. */
  score: number | null;
  reasons: string[];
};

export const PROJECT_CONFIDENCE_META: Record<
  ProjectConfidenceLevel,
  { label: string; tone: InitiativeHealthTone }
> = {
  high: { label: "High confidence", tone: "success" },
  moderate: { label: "Moderate confidence", tone: "info" },
  low: { label: "Low confidence", tone: "warning" },
  unknown: { label: "Not enough signal", tone: "neutral" },
};

export type DeriveProjectConfidenceInput = {
  progress: InitiativeProgress;
  momentum: InitiativeMomentum;
  risk: InitiativeRisk;
  ownership: InitiativeOwnership;
  hasWork: boolean;
};

/**
 * Will this project land? Blends progress (the base), momentum, risk, and
 * ownership clarity into a 0–100 confidence with an explainable reason list. With
 * no tracked work we say so honestly ("not enough signal") rather than implying
 * certainty either way.
 */
export function deriveProjectConfidence(
  input: DeriveProjectConfidenceInput
): ProjectConfidence {
  if (!input.hasWork) {
    return {
      level: "unknown",
      ...PROJECT_CONFIDENCE_META.unknown,
      score: null,
      reasons: ["No tracked work yet — confidence can't be assessed from execution."],
    };
  }

  const reasons: string[] = [];
  let score = Math.round(input.progress.percent * 0.5); // progress is half the base
  reasons.push(`${input.progress.percent}% of tracked work complete`);

  switch (input.momentum.level) {
    case "accelerating":
      score += 22;
      reasons.push("momentum is accelerating");
      break;
    case "steady":
      score += 12;
      reasons.push("momentum is steady");
      break;
    case "slowing":
      score -= 8;
      reasons.push("momentum is slowing");
      break;
    case "stalled":
      score -= 18;
      reasons.push("momentum has stalled");
      break;
  }

  switch (input.risk.level) {
    case "low":
      score += 14;
      break;
    case "moderate":
      score += 6;
      break;
    case "elevated":
      score -= 8;
      reasons.push("risk is elevated");
      break;
    case "high":
      score -= 18;
      reasons.push("risk is high");
      break;
  }

  switch (input.ownership.clarity) {
    case "clear":
      score += 14;
      reasons.push("ownership is clear");
      break;
    case "shared":
      score += 6;
      break;
    case "unclear":
      score -= 8;
      reasons.push("ownership is unclear");
      break;
    case "unowned":
      score -= 16;
      reasons.push("no owner is accountable");
      break;
  }

  score = Math.max(0, Math.min(100, score));
  const level: ProjectConfidenceLevel = score >= 68 ? "high" : score >= 42 ? "moderate" : "low";
  return { level, ...PROJECT_CONFIDENCE_META[level], score, reasons };
}

// --- blockers ----------------------------------------------------------------

export type ProjectBlockerKind = "declared" | "observed";
export type ProjectBlockerSeverity = "critical" | "high" | "moderate";

export type ProjectBlocker = {
  kind: ProjectBlockerKind;
  severity: ProjectBlockerSeverity;
  label: string;
  /** The honest basis — what makes this a blocker. */
  detail: string;
};

export type DeriveProjectBlockersInput = {
  signals: InitiativeWorkSignals;
  /** Declared upstream dependency labels (config). */
  declaredDependsOn?: string[];
  /** True when a declared upstream is itself unhealthy (turns "declared" into a live risk). */
  dependencyAtRisk?: boolean;
};

/**
 * The project's blockers, honestly labelled. OBSERVED blockers come from real
 * execution (blocked / overdue actions); DECLARED blockers come from config
 * dependencies and are labelled as such — a declared dependency is only a live
 * risk when its upstream is unhealthy. Severity orders the list worst-first.
 */
export function deriveProjectBlockers(
  input: DeriveProjectBlockersInput
): ProjectBlocker[] {
  const out: ProjectBlocker[] = [];
  const s = input.signals;

  if (s.blockedActions > 0) {
    out.push({
      kind: "observed",
      severity: "critical",
      label: `${s.blockedActions} blocked action${s.blockedActions === 1 ? "" : "s"}`,
      detail: "Work is explicitly marked blocked — an observed blocker.",
    });
  }
  if (s.overdueActions > 0) {
    out.push({
      kind: "observed",
      severity: s.overdueActions >= 3 ? "high" : "moderate",
      label: `${s.overdueActions} overdue action${s.overdueActions === 1 ? "" : "s"}`,
      detail: "Open work is past its deadline — an observed blocker.",
    });
  }

  for (const dep of input.declaredDependsOn ?? []) {
    out.push({
      kind: "declared",
      severity: input.dependencyAtRisk ? "high" : "moderate",
      label: `Depends on: ${dep}`,
      detail: input.dependencyAtRisk
        ? "A declared dependency whose upstream is currently unhealthy."
        : "A declared dependency (config) — not an observed execution blocker.",
    });
  }

  const order: Record<ProjectBlockerSeverity, number> = { critical: 0, high: 1, moderate: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}

// --- follow-through ----------------------------------------------------------

export type ProjectFollowThrough = {
  /** decisions that became tracked action / total decisions; null when none. */
  decisionFollowThroughPct: number | null;
  decisionsWithoutAction: number;
  /** open follow-ups still hanging off the project's meetings. */
  openFollowUps: number;
  /** completed / (completed + open) of the project's actions; null when none. */
  actionCompletionPct: number | null;
  /** meetings the project has held. */
  meetingCount: number;
  reasons: string[];
};

export type DeriveProjectFollowThroughInput = {
  signals: InitiativeWorkSignals;
};

/** Decision → action, action completion, and open-follow-up coverage. Pure. */
export function deriveProjectFollowThrough(
  input: DeriveProjectFollowThroughInput
): ProjectFollowThrough {
  const s = input.signals;
  const reasons: string[] = [];

  const decisionFollowThroughPct =
    s.decisionCount > 0
      ? Math.round(((s.decisionCount - s.decisionsWithoutAction) / s.decisionCount) * 100)
      : null;
  if (s.decisionsWithoutAction > 0) {
    reasons.push(
      `${s.decisionsWithoutAction} decision${s.decisionsWithoutAction === 1 ? "" : "s"} without a linked action`
    );
  }

  const trackedForCompletion = s.completedActions + s.openActions;
  const actionCompletionPct =
    trackedForCompletion > 0 ? Math.round((s.completedActions / trackedForCompletion) * 100) : null;

  if (s.openFollowUps > 0) {
    reasons.push(`${s.openFollowUps} open meeting follow-up${s.openFollowUps === 1 ? "" : "s"}`);
  }
  if (reasons.length === 0) {
    reasons.push("Decisions, meetings, and actions are following through cleanly.");
  }

  return {
    decisionFollowThroughPct,
    decisionsWithoutAction: s.decisionsWithoutAction,
    openFollowUps: s.openFollowUps,
    actionCompletionPct,
    meetingCount: s.meetingCount,
    reasons,
  };
}

// --- review need -------------------------------------------------------------

export type ProjectReviewUrgency = "now" | "soon" | "routine";

export type ProjectReviewNeed = {
  needed: boolean;
  urgency: ProjectReviewUrgency;
  reason: string;
};

export type DeriveProjectReviewNeedInput = {
  health: InitiativeHealth;
  momentum: InitiativeMomentum;
  signals: InitiativeWorkSignals;
  pastTargetDate: boolean;
  hasWork: boolean;
};

/**
 * Whether and how urgently leadership should review the project. Critical health,
 * a stalled-with-overdue project, or a blown target date warrant a review now;
 * drifting / slowing reads warrant one soon; everything else is routine.
 */
export function deriveProjectReviewNeed(
  input: DeriveProjectReviewNeedInput
): ProjectReviewNeed {
  const { health, momentum, signals, pastTargetDate } = input;

  if (health.level === "completed" || health.level === "archived") {
    return { needed: false, urgency: "routine", reason: `Project is ${health.label.toLowerCase()}.` };
  }
  if (!input.hasWork) {
    return {
      needed: true,
      urgency: "soon",
      reason: "No tracked work yet — review to kick the project off or confirm it's still active.",
    };
  }
  if (health.level === "critical" || (momentum.level === "stalled" && signals.overdueActions > 0)) {
    return { needed: true, urgency: "now", reason: "Critical health or stalled with overdue work." };
  }
  if (pastTargetDate) {
    return { needed: true, urgency: "now", reason: "Past its target date and not complete." };
  }
  if (health.level === "at_risk" || momentum.level === "slowing" || momentum.level === "stalled") {
    return { needed: true, urgency: "soon", reason: "At risk or losing momentum." };
  }
  return { needed: false, urgency: "routine", reason: "Healthy and moving — routine cadence is fine." };
}

// --- status explanation ------------------------------------------------------

export type ProjectStatusExplanation = {
  headline: string;
  reasons: string[];
  /** Honestly distinguishes "no data" from a judged read. */
  basis: "tracked" | "no_work";
};

export type ExplainProjectStatusInput = {
  health: InitiativeHealth;
  confidence: ProjectConfidence;
  blockers: ProjectBlocker[];
  hasWork: boolean;
};

/** Compose the project's one-line "why" + supporting reasons, data-honestly. */
export function explainProjectStatus(
  input: ExplainProjectStatusInput
): ProjectStatusExplanation {
  if (!input.hasWork) {
    return {
      headline: "No tracked work yet — this is a declared project waiting for execution.",
      reasons: [
        "Status is derived from real actions, meetings, and decisions; none are linked yet.",
        "Create a linked action or hold a meeting to bring it to life.",
      ],
      basis: "no_work",
    };
  }

  const reasons: string[] = [...input.health.reasons];
  const observed = input.blockers.filter((b) => b.kind === "observed");
  if (observed.length > 0) reasons.push(observed[0].label);
  if (input.confidence.score != null) {
    reasons.push(`${input.confidence.label.toLowerCase()} (${input.confidence.score}/100)`);
  }

  const headline = `${input.health.label} · ${input.confidence.label.toLowerCase()}.`;
  return { headline, reasons: reasons.slice(0, 5), basis: "tracked" };
}
