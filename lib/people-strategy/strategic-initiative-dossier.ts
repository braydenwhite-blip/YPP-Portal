import type { ActionItemWithRelations } from "./action-queries";
import type { MeetingCardDTO } from "./meeting-card-types";
import type { RelatedEntitySummary } from "./connections";
import type { DigestDecisionInput } from "./operational-digest";
import {
  deriveInitiativeSummary,
  type InitiativeSummary,
} from "./strategic-initiative-summary";
import {
  getInitiativeProfile,
  type InitiativeProfile,
} from "./strategic-initiative-profile";
import { deriveWorkstreams, type WorkstreamSummary } from "./strategic-workstreams";
import { deriveDecisionCenter, type DecisionCenter } from "./strategic-decision-center";
import { deriveInitiativeRoadmap, type InitiativeRoadmap } from "./strategic-roadmap";
import { deriveScenarioBoard, type ScenarioBoard } from "./strategic-scenarios";
import {
  deriveOperatingReview,
  type OperatingReview,
  type OperatingReviewCadence,
} from "./strategic-operating-reviews";
import {
  deriveExecutionGraph,
  type ExecutionGraph,
} from "./strategic-execution-graph";
import { deriveTimelineEvents } from "./strategic-timeline";
import type { InitiativeDependencyView } from "./strategic-dependencies";
import type { StrategicInitiativeDef } from "./strategic-initiatives";

/**
 * YPP Execution OS — Strategic Initiative DOSSIER assembly (Phase II "2.0").
 *
 * The dossier is the COMPLETE living-program read for one initiative — the
 * derived summary PLUS the new strategic layers that turn a dashboard into an
 * operating business unit: its charter + knowledge base (config), its workstreams,
 * its decision center, its roadmap, its scenarios, its dependency view, its
 * weekly/monthly/quarterly operating reviews, and the full execution graph. It is
 * the single composition point so every surface renders the same numbers. Pure
 * (only the injected `now`).
 */

const EMPTY_DEPENDENCY_VIEW: InitiativeDependencyView = {
  blockedBy: [],
  unlocks: [],
  relatedTo: [],
  onCriticalPath: false,
  atRisk: false,
};

export type InitiativeDossier = {
  summary: InitiativeSummary;
  profile: InitiativeProfile;
  workstreams: WorkstreamSummary[];
  decisionCenter: DecisionCenter;
  roadmap: InitiativeRoadmap;
  scenarios: ScenarioBoard;
  dependencies: InitiativeDependencyView;
  reviews: Record<OperatingReviewCadence, OperatingReview>;
  executionGraph: ExecutionGraph;
};

export type DeriveInitiativeDossierInput = {
  def: StrategicInitiativeDef;
  actions: ActionItemWithRelations[];
  meetings: MeetingCardDTO[];
  decisions: DigestDecisionInput[];
  labels: ReadonlyMap<string, RelatedEntitySummary>;
  /** The initiative's slice of the portfolio dependency graph (injected by the query). */
  dependencyView?: InitiativeDependencyView;
  now?: Date;
};

/** Build the complete dossier for one initiative from its classified work. Pure. */
export function deriveInitiativeDossier(
  input: DeriveInitiativeDossierInput
): InitiativeDossier {
  const now = input.now ?? new Date();
  const { def, actions, meetings, decisions, labels } = input;
  const dependencies = input.dependencyView ?? EMPTY_DEPENDENCY_VIEW;

  const summary = deriveInitiativeSummary({
    def,
    actions,
    meetings,
    decisions,
    labels,
    now,
    limits: { timeline: 60, keyMoments: 8, recommendations: 8 },
  });

  const profile = getInitiativeProfile(def.id);

  // Workstreams (Phase B) — count declared dependencies per workstream for context.
  const depCounts = new Map<string, number>();
  for (const d of profile.dependencies) {
    if (d.workstreamId) depCounts.set(d.workstreamId, (depCounts.get(d.workstreamId) ?? 0) + 1);
  }
  const workstreams = deriveWorkstreams({
    def,
    actions,
    meetings,
    decisions,
    labels,
    dependencyCounts: depCounts,
    now,
  });

  // Decision Center (Phase C).
  const decisionCenter = deriveDecisionCenter(decisions, now);

  // Roadmap (Phase E).
  const roadmap = deriveInitiativeRoadmap({ def, milestones: summary.milestones, now });

  // Scenarios (Phase F).
  const scenarios = deriveScenarioBoard(profile.scenarios, {
    healthLevel: summary.health.level,
    momentumLevel: summary.momentum.level,
    riskLevel: summary.risk.level,
    progressPercent: summary.progress.percent,
  });

  // The full provable event list (for reviews + execution graph) — past only.
  const allEvents = deriveTimelineEvents({
    def,
    actions,
    meetings,
    decisions,
    milestones: summary.milestones,
    now,
  });
  const pastEvents = allEvents.filter((e) => !e.upcoming);

  // Operating reviews (Phase H) — weekly / monthly / quarterly.
  const reviewCounts = {
    overdueActions: summary.counts.overdueActions,
    blockedActions: summary.counts.blockedActions,
    openActions: summary.counts.openActions,
    completedActions: summary.counts.completedActions,
    unassignedActions: summary.counts.unassignedActions,
    openFollowUps: summary.counts.openFollowUps,
    milestonesBehind: summary.counts.milestonesBehind,
  };
  const reviewBase = {
    initiativeTitle: summary.title,
    health: summary.health,
    momentum: summary.momentum,
    risk: summary.risk,
    ownership: summary.ownership,
    counts: reviewCounts,
    milestones: summary.milestones,
    recommendations: summary.recommendations,
    timelineEvents: pastEvents,
    decisionCenter,
    dependencies,
    now,
  };
  const reviews: Record<OperatingReviewCadence, OperatingReview> = {
    weekly: deriveOperatingReview({ ...reviewBase, cadence: "weekly" }),
    monthly: deriveOperatingReview({ ...reviewBase, cadence: "monthly" }),
    quarterly: deriveOperatingReview({ ...reviewBase, cadence: "quarterly" }),
  };

  // Execution graph (Phase J).
  const executionGraph = deriveExecutionGraph({
    initiativeId: def.id,
    initiativeTitle: summary.title,
    initiativeHealthLevel: summary.health.level,
    workstreams,
    timelineEvents: pastEvents,
    decisionCenter,
  });

  return {
    summary,
    profile,
    workstreams,
    decisionCenter,
    roadmap,
    scenarios,
    dependencies,
    reviews,
    executionGraph,
  };
}
