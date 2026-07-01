/**
 * Data 360 — data-triggered workflow suggestions (pure).
 *
 * Deterministic, explainable "a gap here → start this workflow" rules. No AI,
 * no scoring: a suggestion fires only when a real metric is below (or a
 * target-zero metric above) its central expectation, and it names the concrete
 * blueprint template that addresses it. Every suggestion carries the metric,
 * its current value, the expected benchmark, the chapter, and a link to the
 * records behind it.
 */

import {
  CHAPTER_EXPECTATIONS,
  expectationStatus,
  isMetricRelevant,
  type ChapterMetricKey,
} from "./expectations";
import { chapterMetricDrilldownHref, type ChapterComparisonRow } from "./chapter-metrics";
import { workflowData360DrilldownHref } from "./workflow-analytics-core";

/** Human labels for the blueprint template keys a suggestion can start. */
export const SUGGESTION_TEMPLATE_LABELS: Record<string, string> = {
  "partner-acquisition": "Partner Outreach Sprint",
  "instructor-recruiting-campaign": "Instructor Recruitment",
  "program-launch": "Class Launch",
  "chapter-launch": "Chapter Launch playbook",
  "chapter-recovery": "Workflow Recovery",
};

export type WorkflowSuggestion = {
  id: string;
  reason: string;
  metricKey: ChapterMetricKey;
  metricLabel: string;
  currentValue: number | null;
  expectedLabel: string;
  chapterId: string;
  chapterName: string;
  templateKey: string;
  templateLabel: string;
  /** Where the suggested work would be tracked. */
  primaryActionHref: string;
  primaryActionLabel: string;
  /** The records that prove the gap. */
  sourceHref: string | null;
};

function templateLabel(key: string): string {
  return SUGGESTION_TEMPLATE_LABELS[key] ?? key;
}

/**
 * Suggestions for one chapter row. Fires on:
 *   - a growth metric below its target (with a gap template), or
 *   - a target-zero workflow metric that is non-zero (blocked / overdue).
 */
export function suggestionsForChapter(row: ChapterComparisonRow): WorkflowSuggestion[] {
  const out: WorkflowSuggestion[] = [];

  for (const key of Object.keys(row.metrics) as ChapterMetricKey[]) {
    const exp = CHAPTER_EXPECTATIONS[key];
    if (!exp.gapTemplateKey) continue;
    if (!isMetricRelevant(key, row.phase)) continue;

    const cellVal = row.metrics[key].value;
    const status = expectationStatus(key, cellVal, row.phase);
    const isGap = status === "below" || status === "over";
    if (!isGap) continue;

    const templateKey = exp.gapTemplateKey;
    let reason: string;
    if (exp.direction === "target-zero") {
      reason = `${cellVal ?? 0} ${exp.label.toLowerCase()} — the target is ${exp.expectationLabel}.`;
    } else {
      reason = `${exp.label} at ${cellVal ?? 0}, below the ${exp.expectationLabel} target.`;
    }

    out.push({
      id: `${row.chapterId}:${key}`,
      reason,
      metricKey: key,
      metricLabel: exp.label,
      currentValue: cellVal,
      expectedLabel: exp.expectationLabel,
      chapterId: row.chapterId,
      chapterName: row.chapterName,
      templateKey,
      templateLabel: templateLabel(templateKey),
      primaryActionHref: workflowData360DrilldownHref({ chapterId: row.chapterId }),
      primaryActionLabel: `Start ${templateLabel(templateKey)}`,
      sourceHref: chapterMetricDrilldownHref(row.chapterId, key),
    });
  }

  return out;
}

/**
 * Suggestions across every chapter, worst-gaps-first. Deterministic ordering:
 * target-zero breaches (blocked/overdue workflows) rank above growth shortfalls,
 * then by chapter name for stability.
 */
export function buildWorkflowSuggestions(
  rows: ChapterComparisonRow[]
): WorkflowSuggestion[] {
  const all = rows.flatMap(suggestionsForChapter);
  const rank = (s: WorkflowSuggestion) =>
    CHAPTER_EXPECTATIONS[s.metricKey].direction === "target-zero" ? 0 : 1;
  return all.sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    return a.chapterName.localeCompare(b.chapterName) || a.metricKey.localeCompare(b.metricKey);
  });
}
