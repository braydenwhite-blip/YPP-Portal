import { addDays } from "@/lib/leadership-action-center/dates";

import type {
  InitiativeHealth,
  InitiativeMomentum,
  InitiativeOwnership,
  InitiativeRisk,
} from "./strategic-initiative-health";
import type { InitiativeMilestoneSummary } from "./strategic-milestones";
import type { InitiativeRecommendation } from "./strategic-recommendations";
import type { StrategicTimelineEvent } from "./strategic-timeline";
import type { DecisionCenter } from "./strategic-decision-center";
import type { InitiativeDependencyView } from "./strategic-dependencies";

/**
 * YPP Execution OS — INITIATIVE OPERATING REVIEWS (Phase H).
 *
 * An initiative should be reviewable like a real business unit. This module
 * assembles a Weekly / Monthly / Quarterly operating review for one initiative
 * from its already-derived state: wins, losses, risks, decisions, open questions,
 * milestone progress, a capacity review, a dependency review, and the recommended
 * priorities. Every line is deterministic and traceable to real signals — no
 * narrative is invented. Pure (only the injected `now`).
 */

export type OperatingReviewCadence = "weekly" | "monthly" | "quarterly";

export const REVIEW_CADENCE_META: Record<
  OperatingReviewCadence,
  { label: string; windowDays: number }
> = {
  weekly: { label: "Weekly review", windowDays: 7 },
  monthly: { label: "Monthly review", windowDays: 30 },
  quarterly: { label: "Quarterly review", windowDays: 90 },
};

export type ReviewPriority = {
  title: string;
  detail: string;
  href: string;
};

export type OperatingReview = {
  cadence: OperatingReviewCadence;
  label: string;
  windowStartISO: string;
  generatedISO: string;
  headline: string;
  wins: string[];
  losses: string[];
  risks: string[];
  decisions: string[];
  openQuestions: string[];
  milestoneProgress: { complete: number; total: number; lines: string[] };
  capacityReview: string[];
  dependencyReview: string[];
  recommendedPriorities: ReviewPriority[];
};

export type ReviewCounts = {
  overdueActions: number;
  blockedActions: number;
  openActions: number;
  completedActions: number;
  unassignedActions: number;
  openFollowUps: number;
  milestonesBehind: number;
};

export type DeriveOperatingReviewInput = {
  cadence: OperatingReviewCadence;
  initiativeTitle: string;
  health: InitiativeHealth;
  momentum: InitiativeMomentum;
  risk: InitiativeRisk;
  ownership: InitiativeOwnership;
  counts: ReviewCounts;
  milestones: InitiativeMilestoneSummary[];
  recommendations: InitiativeRecommendation[];
  /** The full event list (past + upcoming) for windowed wins. */
  timelineEvents: StrategicTimelineEvent[];
  decisionCenter: DecisionCenter;
  dependencies: InitiativeDependencyView;
  now?: Date;
};

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Assemble one operating review for an initiative. Pure + deterministic. */
export function deriveOperatingReview(input: DeriveOperatingReviewInput): OperatingReview {
  const now = input.now ?? new Date();
  const meta = REVIEW_CADENCE_META[input.cadence];
  const windowStart = addDays(now, -meta.windowDays);
  const windowStartMs = windowStart.getTime();
  const { counts } = input;

  // Wins — completions + milestones reached inside the window.
  const wins: string[] = [];
  for (const e of input.timelineEvents) {
    if (e.upcoming) continue;
    if (new Date(e.occurredAtISO).getTime() < windowStartMs) continue;
    if (e.type === "milestone_reached") wins.push(`Milestone reached: ${e.title}`);
    else if (e.type === "action_completed") wins.push(`Completed: ${e.title}`);
  }
  const winList = wins.slice(0, 6);

  // Losses — what is stuck or slipping.
  const losses: string[] = [];
  if (counts.overdueActions > 0) losses.push(`${plural(counts.overdueActions, "action")} overdue`);
  if (counts.blockedActions > 0) losses.push(`${plural(counts.blockedActions, "action")} blocked`);
  if (counts.milestonesBehind > 0) {
    losses.push(`${plural(counts.milestonesBehind, "milestone")} behind schedule`);
  }
  if (input.momentum.level === "stalled" && counts.openActions > 0) losses.push("Momentum stalled");

  // Risks — the derived risk factors.
  const risks = input.risk.factors.slice(0, 4).map((f) => f.label);

  // Decisions — what shaped the initiative recently + what still needs action.
  const decisions: string[] = [];
  for (const d of input.decisionCenter.critical.slice(0, 4)) {
    decisions.push(`Awaiting action: ${d.decision}`);
  }
  for (const d of input.decisionCenter.inMotion.slice(0, 2)) {
    decisions.push(`In motion: ${d.decision}`);
  }

  // Open questions — what needs an owner / a decision.
  const openQuestions: string[] = [];
  if (input.ownership.unassignedOpen > 0) {
    openQuestions.push(`Who owns the ${plural(input.ownership.unassignedOpen, "unowned action")}?`);
  }
  for (const d of input.decisionCenter.needsFollowThrough.slice(0, 3)) {
    openQuestions.push(`Who will action: "${d.decision}"?`);
  }
  if (counts.openFollowUps > 0) {
    openQuestions.push(`Are the ${plural(counts.openFollowUps, "open follow-up")} being closed?`);
  }

  // Milestone progress.
  const complete = input.milestones.filter((m) => m.status === "complete").length;
  const milestoneLines = input.milestones
    .slice(0, 8)
    .map((m) => `${m.status === "complete" ? "✓" : "→"} ${m.title} (${m.percent}%)`);

  // Capacity review — who is carrying the work.
  const capacityReview: string[] = [input.ownership.reason];
  if (input.ownership.topLeads.length > 0) {
    capacityReview.push(
      `Leads: ${input.ownership.topLeads.map((l) => `${l.name} (${l.openActions})`).join(", ")}`
    );
  }

  // Dependency review — what we're waiting on / what we unblock.
  const dependencyReview: string[] = [];
  if (input.dependencies.onCriticalPath) dependencyReview.push("On the portfolio critical path.");
  for (const e of input.dependencies.blockedBy) {
    dependencyReview.push(
      `${e.blocking ? "⚠ Blocked by" : "Depends on"} ${e.fromTitle}${e.reason ? ` — ${e.reason}` : ""}`
    );
  }
  for (const e of input.dependencies.unlocks.slice(0, 3)) {
    dependencyReview.push(`Unlocks ${e.toTitle}`);
  }

  const recommendedPriorities: ReviewPriority[] = input.recommendations.slice(0, 4).map((r) => ({
    title: r.title,
    detail: r.detail,
    href: r.href,
  }));

  const headline = `${input.health.label} — ${plural(winList.length, "win")}, ${plural(
    risks.length,
    "risk"
  )} this ${input.cadence === "weekly" ? "week" : input.cadence === "monthly" ? "month" : "quarter"}.`;

  return {
    cadence: input.cadence,
    label: meta.label,
    windowStartISO: windowStart.toISOString(),
    generatedISO: now.toISOString(),
    headline,
    wins: winList,
    losses,
    risks,
    decisions,
    openQuestions,
    milestoneProgress: { complete, total: input.milestones.length, lines: milestoneLines },
    capacityReview,
    dependencyReview,
    recommendedPriorities,
  };
}
