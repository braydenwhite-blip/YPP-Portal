import { operationalAreaLabel, type OperationalArea } from "./operational-context";
import { INITIATIVE_HEALTH_META, type InitiativeHealthLevel } from "./strategic-initiative-health";
import { isTerminalStatus, type InitiativePriority } from "./strategic-initiatives";
import { getInitiativeProfile } from "./strategic-initiative-profile";
import {
  compareInitiativesByConcern,
  derivePortfolioStats,
  selectAtRiskInitiatives,
  selectFastestMovingInitiatives,
  type InitiativeSummary,
  type PortfolioStats,
} from "./strategic-initiative-summary";

/**
 * YPP Execution OS — INITIATIVE PORTFOLIO MANAGEMENT (Phase I).
 *
 * The executive layer: from ONE page, leadership should understand the entire
 * organization — what matters most, what's growing, what's risky, where the
 * resources and the gaps are, what's blocked, and where the strategic
 * opportunities lie. Every list is a deterministic selection over the
 * already-assembled initiative summaries; nothing is invented. Pure.
 */

function active(summaries: InitiativeSummary[]): InitiativeSummary[] {
  return summaries.filter((s) => !isTerminalStatus(s.status));
}

function impactScore(s: InitiativeSummary): number {
  return (
    s.priorityWeight * 20 +
    (s.counts.openActions + s.counts.completedActions) +
    s.counts.milestonesComplete * 3
  );
}

function resourceScore(s: InitiativeSummary): number {
  return s.counts.openActions * 3 + s.counts.meetingCount + s.counts.totalActions;
}

/** Most important: highest configured priority, then worst-health first. */
export function selectMostImportant(summaries: InitiativeSummary[]): InitiativeSummary[] {
  return active(summaries).sort(
    (a, b) => b.priorityWeight - a.priorityWeight || compareInitiativesByConcern(a, b)
  );
}

/** Highest impact: priority × scale of delivered + active work. */
export function selectHighestImpact(summaries: InitiativeSummary[]): InitiativeSummary[] {
  return active(summaries)
    .map((s) => ({ s, score: impactScore(s) }))
    .sort((a, b) => b.score - a.score || a.s.title.localeCompare(b.s.title))
    .map((x) => x.s);
}

/** Most resource-intensive: the initiatives consuming the most execution capacity. */
export function selectMostResourceIntensive(summaries: InitiativeSummary[]): InitiativeSummary[] {
  return active(summaries)
    .filter((s) => s.counts.openActions > 0 || s.counts.meetingCount > 0)
    .sort((a, b) => resourceScore(b) - resourceScore(a) || a.title.localeCompare(b.title));
}

/** Understaffed: ownership is unclear/unowned, or open work has no executor. */
export function selectUnderstaffed(summaries: InitiativeSummary[]): InitiativeSummary[] {
  return active(summaries)
    .filter(
      (s) =>
        s.counts.openActions > 0 &&
        (s.ownership.clarity === "unowned" ||
          s.ownership.clarity === "unclear" ||
          s.counts.unassignedActions > 0)
    )
    .sort(
      (a, b) =>
        b.counts.unassignedActions - a.counts.unassignedActions ||
        compareInitiativesByConcern(a, b)
    );
}

/** Blocked: open work that is stuck behind blockers or stalled momentum. */
export function selectBlocked(summaries: InitiativeSummary[]): InitiativeSummary[] {
  return active(summaries)
    .filter(
      (s) =>
        s.counts.blockedActions > 0 ||
        (s.momentum.level === "stalled" && s.counts.openActions > 0)
    )
    .sort(
      (a, b) =>
        b.counts.blockedActions - a.counts.blockedActions || compareInitiativesByConcern(a, b)
    );
}

export type StrategicOpportunity = {
  initiativeId: string;
  initiativeTitle: string;
  href: string;
  opportunity: string;
};

/** Strategic opportunities: authored future opportunities + stretch/best scenarios. */
export function selectStrategicOpportunities(
  summaries: InitiativeSummary[]
): StrategicOpportunity[] {
  const out: StrategicOpportunity[] = [];
  for (const s of summaries) {
    if (isTerminalStatus(s.status)) continue;
    const profile = getInitiativeProfile(s.id);
    for (const opp of profile.charter.futureOpportunities.slice(0, 2)) {
      out.push({ initiativeId: s.id, initiativeTitle: s.title, href: s.href, opportunity: opp });
    }
    const stretch = profile.scenarios.find((sc) => sc.kind === "stretch" || sc.kind === "best");
    if (stretch) {
      out.push({
        initiativeId: s.id,
        initiativeTitle: s.title,
        href: s.href,
        opportunity: `${stretch.kind === "best" ? "Best case" : "Stretch"}: ${stretch.headline}`,
      });
    }
  }
  return out;
}

export type PortfolioBalance = {
  byArea: Array<{ area: OperationalArea; label: string; count: number; openActions: number; atRisk: number }>;
  byHealth: Record<InitiativeHealthLevel, number>;
  byPriority: Record<InitiativePriority, number>;
};

export function derivePortfolioBalance(summaries: InitiativeSummary[]): PortfolioBalance {
  const areaMap = new Map<OperationalArea, { count: number; openActions: number; atRisk: number }>();
  const byHealth: Record<InitiativeHealthLevel, number> = {
    healthy: 0,
    drifting: 0,
    at_risk: 0,
    critical: 0,
    completed: 0,
    archived: 0,
  };
  const byPriority: Record<InitiativePriority, number> = { flagship: 0, high: 0, medium: 0, low: 0 };

  for (const s of summaries) {
    const a = areaMap.get(s.area) ?? { count: 0, openActions: 0, atRisk: 0 };
    a.count += 1;
    a.openActions += s.counts.openActions;
    if (s.health.level === "at_risk" || s.health.level === "critical") a.atRisk += 1;
    areaMap.set(s.area, a);
    byHealth[s.health.level] += 1;
    byPriority[s.priority] += 1;
  }

  const byArea = [...areaMap.entries()]
    .map(([area, v]) => ({ area, label: operationalAreaLabel(area), ...v }))
    .sort((x, y) => y.count - x.count || x.label.localeCompare(y.label));

  return { byArea, byHealth, byPriority };
}

export type FocusArea = {
  area: OperationalArea;
  label: string;
  score: number;
  reason: string;
  initiativeCount: number;
  openActions: number;
  overdueActions: number;
  atRiskCount: number;
};

/** Where leadership should focus: areas weighted by concern + overdue load. */
export function deriveLeadershipFocusAreas(summaries: InitiativeSummary[]): FocusArea[] {
  const map = new Map<
    OperationalArea,
    { count: number; open: number; overdue: number; atRisk: number; worst: InitiativeHealthLevel }
  >();
  for (const s of summaries) {
    if (isTerminalStatus(s.status)) continue;
    const cur =
      map.get(s.area) ?? { count: 0, open: 0, overdue: 0, atRisk: 0, worst: "healthy" as InitiativeHealthLevel };
    cur.count += 1;
    cur.open += s.counts.openActions;
    cur.overdue += s.counts.overdueActions;
    if (s.health.level === "at_risk" || s.health.level === "critical") cur.atRisk += 1;
    if (INITIATIVE_HEALTH_META[s.health.level].rank > INITIATIVE_HEALTH_META[cur.worst].rank) {
      cur.worst = s.health.level;
    }
    map.set(s.area, cur);
  }
  const rows: FocusArea[] = [];
  for (const [area, v] of map) {
    const score = INITIATIVE_HEALTH_META[v.worst].rank * 10 + v.overdue * 4 + v.atRisk * 6 + v.open;
    rows.push({
      area,
      label: operationalAreaLabel(area),
      score,
      reason:
        v.overdue > 0
          ? `${v.overdue} overdue action${v.overdue === 1 ? "" : "s"}`
          : v.atRisk > 0
          ? `${v.atRisk} initiative${v.atRisk === 1 ? "" : "s"} at risk`
          : `${v.open} open action${v.open === 1 ? "" : "s"}`,
      initiativeCount: v.count,
      openActions: v.open,
      overdueActions: v.overdue,
      atRiskCount: v.atRisk,
    });
  }
  return rows.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
}

export type StrategicPortfolio = {
  stats: PortfolioStats;
  mostImportant: InitiativeSummary[];
  fastestGrowing: InitiativeSummary[];
  highestRisk: InitiativeSummary[];
  mostResourceIntensive: InitiativeSummary[];
  highestImpact: InitiativeSummary[];
  understaffed: InitiativeSummary[];
  blocked: InitiativeSummary[];
  strategicOpportunities: StrategicOpportunity[];
  balance: PortfolioBalance;
  focusAreas: FocusArea[];
};

/** Assemble the entire portfolio executive read. Pure. */
export function deriveStrategicPortfolio(summaries: InitiativeSummary[]): StrategicPortfolio {
  return {
    stats: derivePortfolioStats(summaries),
    mostImportant: selectMostImportant(summaries),
    fastestGrowing: selectFastestMovingInitiatives(summaries),
    highestRisk: selectAtRiskInitiatives(summaries),
    mostResourceIntensive: selectMostResourceIntensive(summaries),
    highestImpact: selectHighestImpact(summaries),
    understaffed: selectUnderstaffed(summaries),
    blocked: selectBlocked(summaries),
    strategicOpportunities: selectStrategicOpportunities(summaries),
    balance: derivePortfolioBalance(summaries),
    focusAreas: deriveLeadershipFocusAreas(summaries),
  };
}
