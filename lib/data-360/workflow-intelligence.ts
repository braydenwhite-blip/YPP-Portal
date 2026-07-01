/**
 * Data 360 — workflow intelligence aggregator (server).
 *
 * Loads the active, health-scored workflow instances ONCE and assembles every
 * workflow Data 360 view from that single read: overview, by-chapter,
 * by-entity-type, by-template, the needs-attention queue, operating trends, the
 * chapter comparison grid, and the deterministic gap suggestions. The page
 * calls this once and hands the (fully serializable) result to the client shell.
 */

import "server-only";

import type { TimeSeries } from "./types";
import {
  buildWorkflowData360Overview,
  groupWorkflowsByChapter,
  groupWorkflowsByEntityType,
  groupWorkflowsByTemplate,
  isActiveHealth,
  type WorkflowAnalyticsInstance,
  type WorkflowData360Overview,
  type WorkflowGroupRow,
  type WorkflowTemplateRow,
} from "./workflow-analytics-core";
import { loadWorkflowAnalyticsInstances } from "./workflow-analytics";
import { loadWorkflowTrends } from "./workflow-trends";
import { loadChapterComparison, type ChapterComparison } from "./chapter-analytics";
import { buildWorkflowSuggestions, type WorkflowSuggestion } from "./suggestions";

const ATTENTION_RANK: Record<string, number> = {
  BLOCKED: 0,
  OVERDUE: 1,
  STALLED: 2,
  NEEDS_ATTENTION: 3,
};

const NEEDS_ATTENTION_LIMIT = 40;

/** Worst-first queue of workflows that are not On track. Pure sort/filter. */
export function buildNeedsAttentionQueue(
  instances: WorkflowAnalyticsInstance[],
  limit = NEEDS_ATTENTION_LIMIT
): WorkflowAnalyticsInstance[] {
  return instances
    .filter((i) => isActiveHealth(i.health) && i.health !== "ON_TRACK")
    .sort((a, b) => {
      const r = (ATTENTION_RANK[a.health] ?? 9) - (ATTENTION_RANK[b.health] ?? 9);
      return r !== 0 ? r : b.ageDays - a.ageDays;
    })
    .slice(0, limit);
}

export type WorkflowIntelligence = {
  overview: WorkflowData360Overview;
  byChapter: WorkflowGroupRow[];
  byEntityType: WorkflowGroupRow[];
  byTemplate: WorkflowTemplateRow[];
  needsAttention: WorkflowAnalyticsInstance[];
  needsAttentionTotal: number;
  trends: TimeSeries[];
  chapterComparison: ChapterComparison;
  suggestions: WorkflowSuggestion[];
};

export async function loadWorkflowIntelligence(
  now: Date = new Date()
): Promise<WorkflowIntelligence> {
  const instances = await loadWorkflowAnalyticsInstances(now);

  const [trends, chapterComparison] = await Promise.all([
    loadWorkflowTrends(now),
    loadChapterComparison(now, instances),
  ]);

  const queue = buildNeedsAttentionQueue(instances);
  const needsAttentionTotal = instances.filter(
    (i) => isActiveHealth(i.health) && i.health !== "ON_TRACK"
  ).length;

  return {
    overview: buildWorkflowData360Overview(instances),
    byChapter: groupWorkflowsByChapter(instances),
    byEntityType: groupWorkflowsByEntityType(instances),
    byTemplate: groupWorkflowsByTemplate(instances),
    needsAttention: queue,
    needsAttentionTotal,
    trends: trends.series,
    chapterComparison,
    suggestions: buildWorkflowSuggestions(chapterComparison.rows),
  };
}
