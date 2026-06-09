import {
  SCENARIO_META,
  type InitiativeScenarioDef,
} from "./strategic-initiative-profile";
import type { InitiativeHealthLevel, InitiativeMomentumLevel, InitiativeRiskLevel } from "./strategic-initiative-health";

/**
 * YPP Execution OS — INITIATIVE SCENARIOS (Phase F).
 *
 * Every initiative should reason about more than one future: the BEST, EXPECTED,
 * RISK, and STRETCH cases (Summer Camps: 12 / 4 / 2 / 8 camps). The scenarios
 * themselves are config (leadership's planning); this module ENRICHES each with a
 * deterministic "readiness" read derived from the initiative's CURRENT state — so
 * the page can answer, for each scenario, "are we on track for this, is it within
 * reach, or is it slipping / aspirational?". Pure + explainable: same inputs →
 * same readiness + reason.
 */

export type ScenarioReadiness =
  | "on_track"
  | "within_reach"
  | "at_risk"
  | "aspirational"
  | "avoiding";

export const SCENARIO_READINESS_META: Record<
  ScenarioReadiness,
  { label: string; tone: "success" | "info" | "warning" | "purple" | "neutral" }
> = {
  on_track: { label: "On track", tone: "success" },
  within_reach: { label: "Within reach", tone: "info" },
  at_risk: { label: "Slipping", tone: "warning" },
  aspirational: { label: "Aspirational", tone: "purple" },
  avoiding: { label: "Avoiding", tone: "neutral" },
};

export type ScenarioContext = {
  healthLevel: InitiativeHealthLevel;
  momentumLevel: InitiativeMomentumLevel;
  riskLevel: InitiativeRiskLevel;
  progressPercent: number;
};

export type ScenarioView = InitiativeScenarioDef & {
  meta: (typeof SCENARIO_META)[keyof typeof SCENARIO_META];
  readiness: ScenarioReadiness;
  readinessReason: string;
  requirementCount: number;
  blockerCount: number;
  unlockCount: number;
};

export type ScenarioBoard = {
  scenarios: ScenarioView[];
  /** The base-plan scenario, surfaced first for the headline read. */
  expected: ScenarioView | null;
  hasScenarios: boolean;
};

function strongMomentum(m: InitiativeMomentumLevel): boolean {
  return m === "accelerating" || m === "steady";
}

/** Deterministically read how ready the initiative is for ONE scenario. Pure. */
export function scenarioReadiness(
  scenario: InitiativeScenarioDef,
  ctx: ScenarioContext
): { readiness: ScenarioReadiness; reason: string } {
  const blockers = scenario.blockers.length;
  const blockerNote = blockers > 0 ? `${blockers} blocker${blockers === 1 ? "" : "s"} to clear` : "no blockers logged";

  // Upside cases — only "within reach" when the path is genuinely clear.
  if (scenario.kind === "best" || scenario.kind === "stretch") {
    if (blockers === 0 && strongMomentum(ctx.momentumLevel) && ctx.healthLevel === "healthy") {
      return { readiness: "within_reach", reason: `Momentum is strong and ${blockerNote}.` };
    }
    return {
      readiness: "aspirational",
      reason:
        blockers > 0
          ? `Aspirational until the ${blockerNote}.`
          : "Aspirational — needs sustained momentum to reach.",
    };
  }

  // The base plan — readiness mirrors current health.
  if (scenario.kind === "expected") {
    switch (ctx.healthLevel) {
      case "healthy":
      case "completed":
        return { readiness: "on_track", reason: "Health is good — the base plan is on track." };
      case "drifting":
        return { readiness: "within_reach", reason: `Drifting but recoverable; ${blockerNote}.` };
      case "at_risk":
        return { readiness: "at_risk", reason: `At risk — ${blockerNote}.` };
      default:
        return { readiness: "at_risk", reason: "Health is critical — the base plan is slipping." };
    }
  }

  // The downside we're trying to avoid — high current risk means we're drifting
  // toward it; low risk means we're successfully avoiding it.
  if (ctx.riskLevel === "high") {
    return { readiness: "at_risk", reason: "Risk is high — drifting toward this downside." };
  }
  if (ctx.riskLevel === "elevated") {
    return { readiness: "within_reach", reason: "Elevated risk — this downside is possible." };
  }
  return { readiness: "avoiding", reason: "Risk is contained — successfully avoiding this." };
}

/** Build the scenario board for an initiative. Pure. */
export function deriveScenarioBoard(
  scenarios: InitiativeScenarioDef[],
  ctx: ScenarioContext
): ScenarioBoard {
  const views: ScenarioView[] = scenarios
    .map((s) => {
      const { readiness, reason } = scenarioReadiness(s, ctx);
      return {
        ...s,
        meta: SCENARIO_META[s.kind],
        readiness,
        readinessReason: reason,
        requirementCount: s.requirements.length,
        blockerCount: s.blockers.length,
        unlockCount: s.unlockingDecisions.length,
      };
    })
    .sort((a, b) => a.meta.order - b.meta.order);

  return {
    scenarios: views,
    expected: views.find((v) => v.kind === "expected") ?? null,
    hasScenarios: views.length > 0,
  };
}
