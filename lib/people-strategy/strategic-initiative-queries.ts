import { isActionTrackerEnabled } from "@/lib/feature-flags";

import { type ActionViewer } from "./action-permissions";
import {
  loadDigestInputs,
  type DigestInputs,
} from "./operational-digest-queries";
import {
  getInitiativeDef,
  listInitiativeDefs,
} from "./strategic-initiatives";
import {
  classifyInitiativeWork,
  deriveInitiativeSummary,
  derivePortfolioStats,
  selectAtRiskInitiatives,
  selectFastestMovingInitiatives,
  selectInitiativesNeedingAttention,
  selectLeadershipPriorities,
  selectRecentlyCompletedMilestones,
  selectStrategicRisks,
  selectUpcomingMilestones,
  type InitiativeSummary,
  type PortfolioStats,
  type RecentMilestone,
  type StrategicRisk,
  type UpcomingMilestone,
} from "./strategic-initiative-summary";
import { deriveStrategicMap, type StrategicMap } from "./strategic-map";

/**
 * YPP Execution OS — Strategic Initiative QUERIES.
 *
 * The single batched read layer for the Strategic Initiatives surfaces. It does
 * NOT introduce a second source of truth: it REUSES the exact operational digest
 * read ({@link loadDigestInputs} — every visible action, the meetings in the
 * operating window, and the full meeting history of each entity with open work)
 * and then CLASSIFIES that already-loaded work into the config-defined
 * initiatives in memory. No new query per initiative, no N+1.
 *
 * Permission model (mirrors the Command Center): actions are visibility-filtered
 * via the viewer, so a scoped officer only ever feeds the initiatives the work
 * they may see; the meeting reads are officer-gated at the page guard. Always
 * call these from an officer-gated surface (`requireOfficer`). Every function
 * fails safe (empty pool) when the tracker flag is off.
 */

export type StrategicQueryOptions = {
  now?: Date;
  limits?: { timeline?: number; keyMoments?: number; recommendations?: number };
};

function emptyPool(): DigestInputs {
  return { actions: [], meetings: [], decisions: [], labels: new Map() };
}

async function loadPool(viewer: ActionViewer, now: Date): Promise<DigestInputs> {
  if (!isActionTrackerEnabled()) return emptyPool();
  return loadDigestInputs(viewer, now).catch(() => emptyPool());
}

/**
 * Every strategic initiative with its full derived summary, sorted worst-health
 * first (terminal initiatives sink to the bottom). Backs the initiatives index +
 * the executive dashboard + the strategic map. Officer-gate the caller.
 */
export async function getStrategicInitiativesOverview(
  viewer: ActionViewer,
  options: StrategicQueryOptions = {}
): Promise<InitiativeSummary[]> {
  const now = options.now ?? new Date();
  const pool = await loadPool(viewer, now);

  const summaries = listInitiativeDefs().map((def) =>
    deriveInitiativeSummary({
      def,
      ...classifyInitiativeWork(def, pool),
      labels: pool.labels,
      now,
      // The index/dashboard render compact cards — keep the timeline light.
      limits: { timeline: 0, keyMoments: 4, recommendations: 3, ...options.limits },
    })
  );
  return summaries.sort(compareForOverview);
}

/** Worst-health first, then highest priority, then most overdue, then title. */
function compareForOverview(a: InitiativeSummary, b: InitiativeSummary): number {
  const rank = healthRank(b) - healthRank(a);
  if (rank !== 0) return rank;
  return (
    b.priorityWeight - a.priorityWeight ||
    b.counts.overdueActions - a.counts.overdueActions ||
    a.title.localeCompare(b.title)
  );
}

function healthRank(s: InitiativeSummary): number {
  const order: Record<string, number> = {
    archived: -2,
    completed: -1,
    healthy: 0,
    drifting: 1,
    at_risk: 2,
    critical: 3,
  };
  return order[s.health.level] ?? 0;
}

/**
 * One initiative's complete command-center summary, or null when the id is
 * unknown. Loads the shared pool once and classifies just this initiative's
 * work, with the full timeline + recommendations. Officer-gate the caller.
 */
export async function getStrategicInitiativeDetail(
  initiativeId: string,
  viewer: ActionViewer,
  options: StrategicQueryOptions = {}
): Promise<InitiativeSummary | null> {
  const def = getInitiativeDef(initiativeId);
  if (!def) return null;
  const now = options.now ?? new Date();
  const pool = await loadPool(viewer, now);
  return deriveInitiativeSummary({
    def,
    ...classifyInitiativeWork(def, pool),
    labels: pool.labels,
    now,
    limits: { timeline: 60, keyMoments: 8, recommendations: 8, ...options.limits },
  });
}

/** The strategic map (YPP → areas → initiatives → milestones). Officer-gate the caller. */
export async function getStrategicMapData(
  viewer: ActionViewer,
  options: StrategicQueryOptions = {}
): Promise<StrategicMap> {
  const now = options.now ?? new Date();
  const summaries = await getStrategicInitiativesOverview(viewer, options);
  return deriveStrategicMap(summaries, now);
}

export type StrategicDashboardData = {
  generatedAt: Date;
  stats: PortfolioStats;
  needingAttention: InitiativeSummary[];
  atRisk: InitiativeSummary[];
  fastestMoving: InitiativeSummary[];
  leadershipPriorities: InitiativeSummary[];
  recentMilestones: RecentMilestone[];
  upcomingMilestones: UpcomingMilestone[];
  strategicRisks: StrategicRisk[];
};

/**
 * The executive read across all initiatives — the data the Command Center's
 * Strategic Initiatives section and the initiatives index header render. One
 * batched read; all selections are deterministic. Officer-gate the caller.
 */
export async function getStrategicDashboardData(
  viewer: ActionViewer,
  options: StrategicQueryOptions = {}
): Promise<StrategicDashboardData> {
  const now = options.now ?? new Date();
  const summaries = await getStrategicInitiativesOverview(viewer, options);
  return {
    generatedAt: now,
    stats: derivePortfolioStats(summaries),
    needingAttention: selectInitiativesNeedingAttention(summaries),
    atRisk: selectAtRiskInitiatives(summaries),
    fastestMoving: selectFastestMovingInitiatives(summaries),
    leadershipPriorities: selectLeadershipPriorities(summaries),
    recentMilestones: selectRecentlyCompletedMilestones(summaries, now),
    upcomingMilestones: selectUpcomingMilestones(summaries, now),
    strategicRisks: selectStrategicRisks(summaries),
  };
}
