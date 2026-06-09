import { OPERATIONAL_AREA_VALUES, operationalAreaLabel, type OperationalArea } from "./operational-context";
import {
  compareInitiativeHealth,
  INITIATIVE_HEALTH_META,
  type InitiativeHealthLevel,
  type InitiativeHealthTone,
  type InitiativeMomentumLevel,
  type InitiativeRiskLevel,
} from "./strategic-initiative-health";
import { type MilestoneStatus } from "./strategic-milestones";
import {
  compareInitiativesByConcern,
  type InitiativeSummary,
} from "./strategic-initiative-summary";
import type { InitiativeStatus, InitiativePriority } from "./strategic-initiatives";

/**
 * YPP Execution OS — STRATEGIC MAP (Phase G).
 *
 * The executive visualization: YPP → operating areas → initiatives → milestones
 * → work. Each node carries its rolled-up health, progress, momentum, risk, and
 * ownership so a leader can scan the whole portfolio top-down and click straight
 * into any command center. Pure: it derives the tree from the already-assembled
 * {@link InitiativeSummary}[] — no new query, no new analytics.
 */

export type StrategicMapMilestoneNode = {
  id: string;
  title: string;
  status: MilestoneStatus;
  statusLabel: string;
  percent: number;
  href: string;
};

export type StrategicMapInitiativeNode = {
  id: string;
  title: string;
  area: OperationalArea;
  status: InitiativeStatus;
  statusLabel: string;
  priority: InitiativePriority;
  priorityLabel: string;
  healthLevel: InitiativeHealthLevel;
  healthLabel: string;
  healthTone: InitiativeHealthTone;
  progressPercent: number;
  momentumLevel: InitiativeMomentumLevel;
  riskLevel: InitiativeRiskLevel;
  ownerName: string | null;
  href: string;
  openActions: number;
  overdueActions: number;
  milestonesComplete: number;
  milestonesTotal: number;
  milestones: StrategicMapMilestoneNode[];
};

export type StrategicMapAreaNode = {
  area: OperationalArea;
  label: string;
  initiativeCount: number;
  healthLevel: InitiativeHealthLevel;
  healthLabel: string;
  healthTone: InitiativeHealthTone;
  progressPercent: number;
  openActions: number;
  overdueActions: number;
  criticalCount: number;
  atRiskCount: number;
  initiatives: StrategicMapInitiativeNode[];
};

export type StrategicMap = {
  generatedAtISO: string;
  totalInitiatives: number;
  areas: StrategicMapAreaNode[];
};

function toMilestoneNode(
  summary: InitiativeSummary,
  m: InitiativeSummary["milestones"][number]
): StrategicMapMilestoneNode {
  return {
    id: m.id,
    title: m.title,
    status: m.status,
    statusLabel: m.statusLabel,
    percent: m.percent,
    href: `${summary.href}#milestone-${m.id}`,
  };
}

function toInitiativeNode(s: InitiativeSummary): StrategicMapInitiativeNode {
  return {
    id: s.id,
    title: s.title,
    area: s.area,
    status: s.status,
    statusLabel: s.statusLabel,
    priority: s.priority,
    priorityLabel: s.priorityLabel,
    healthLevel: s.health.level,
    healthLabel: s.health.label,
    healthTone: s.health.tone,
    progressPercent: s.progress.percent,
    momentumLevel: s.momentum.level,
    riskLevel: s.risk.level,
    ownerName: s.owner,
    href: s.href,
    openActions: s.counts.openActions,
    overdueActions: s.counts.overdueActions,
    milestonesComplete: s.counts.milestonesComplete,
    milestonesTotal: s.counts.milestonesTotal,
    milestones: s.milestones.map((m) => toMilestoneNode(s, m)),
  };
}

/**
 * Build the strategic map from the assembled initiative summaries. Areas are
 * emitted in the canonical operating-area order, but only when they actually
 * contain an initiative; within an area, initiatives sort by priority then by
 * concern (worst health first). An area's health rolls up to its most-concerning
 * member; its progress is the mean of its members'. Pure.
 */
export function deriveStrategicMap(
  summaries: InitiativeSummary[],
  now: Date = new Date()
): StrategicMap {
  const byArea = new Map<OperationalArea, InitiativeSummary[]>();
  for (const s of summaries) {
    const list = byArea.get(s.area) ?? [];
    list.push(s);
    byArea.set(s.area, list);
  }

  const areas: StrategicMapAreaNode[] = [];
  for (const area of OPERATIONAL_AREA_VALUES) {
    const members = byArea.get(area);
    if (!members || members.length === 0) continue;

    const sorted = [...members].sort(
      (a, b) => b.priorityWeight - a.priorityWeight || compareInitiativesByConcern(a, b)
    );

    // Area health = the most-concerning member's health.
    const worst = [...members].sort((a, b) => compareInitiativeHealth(a.health, b.health))[0];
    const meta = INITIATIVE_HEALTH_META[worst.health.level];
    const progressPercent = Math.round(
      members.reduce((sum, m) => sum + m.progress.percent, 0) / members.length
    );

    areas.push({
      area,
      label: operationalAreaLabel(area),
      initiativeCount: members.length,
      healthLevel: worst.health.level,
      healthLabel: meta.label,
      healthTone: meta.tone,
      progressPercent,
      openActions: members.reduce((s, m) => s + m.counts.openActions, 0),
      overdueActions: members.reduce((s, m) => s + m.counts.overdueActions, 0),
      criticalCount: members.filter((m) => m.health.level === "critical").length,
      atRiskCount: members.filter((m) => m.health.level === "at_risk").length,
      initiatives: sorted.map(toInitiativeNode),
    });
  }

  // Most-concerning areas first so the map reads worst → best top to bottom.
  areas.sort((a, b) => {
    const rank =
      INITIATIVE_HEALTH_META[b.healthLevel].rank - INITIATIVE_HEALTH_META[a.healthLevel].rank;
    if (rank !== 0) return rank;
    return b.overdueActions - a.overdueActions || a.label.localeCompare(b.label);
  });

  return {
    generatedAtISO: now.toISOString(),
    totalInitiatives: summaries.length,
    areas,
  };
}
