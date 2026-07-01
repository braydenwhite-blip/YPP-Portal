/**
 * Data 360 — chapter comparison shapes + drilldowns (pure).
 *
 * The serializable types the chapter-comparison grid renders and the drilldown
 * href for each chapter × metric cell. Kept free of server imports so both the
 * server loader (`./chapter-analytics`) and the client grid can share them, and
 * so the drilldown logic is unit-testable. Every href resolves to a real,
 * filterable route (or `null` for an honest disabled state).
 */

import { workflowData360DrilldownHref } from "./workflow-analytics-core";
import {
  expectationStatus,
  expectationTone,
  type ChapterMetricKey,
  type ChapterPhase,
  type ExpectationStatus,
} from "./expectations";
import type { MetricTone } from "./types";

export type ChapterMetricCell = {
  key: ChapterMetricKey;
  value: number | null;
  status: ExpectationStatus;
  tone: MetricTone;
  href: string | null;
};

export type ChapterComparisonRow = {
  chapterId: string;
  chapterName: string;
  region: string | null;
  lifecycleStatus: string;
  phase: ChapterPhase;
  phaseLabel: string;
  metrics: Record<ChapterMetricKey, ChapterMetricCell>;
};

export type ChapterComparison = {
  expectations: import("./expectations").ChapterExpectation[];
  rows: ChapterComparisonRow[];
};

/** Drilldown into the records behind one chapter × metric cell. */
export function chapterMetricDrilldownHref(
  chapterId: string,
  key: ChapterMetricKey
): string | null {
  switch (key) {
    case "partners":
      return `/partners?chapterId=${chapterId}`;
    case "applicants":
      return `/admin/instructor-applicants?chapterId=${chapterId}`;
    case "instructors":
      return `/admin/instructors?chapterId=${chapterId}`;
    case "students":
      return `/admin/students?chapterId=${chapterId}`;
    case "classes":
      return `/admin/classes?chapterId=${chapterId}`;
    case "sessions":
      // No master sessions list route exists — link to the chapter's classes.
      return `/admin/classes?chapterId=${chapterId}`;
    case "attendance":
      // No attendance master list — honest disabled state.
      return null;
    case "meetingsHeld":
      return `/meetings?chapterId=${chapterId}&status=COMPLETED`;
    case "pendingFollowUps":
      return `/meetings?chapterId=${chapterId}`;
    case "completedFollowUps":
      return `/meetings?chapterId=${chapterId}`;
    case "completedActions":
      return `/actions?chapter=${chapterId}&status=COMPLETE`;
    case "activeWorkflows":
      return workflowData360DrilldownHref({ chapterId });
    case "blockedWorkflows":
      return workflowData360DrilldownHref({ chapterId, health: "BLOCKED" });
    case "overdueWorkflows":
      return workflowData360DrilldownHref({ chapterId, health: "OVERDUE" });
    default:
      return null;
  }
}

/** Build a graded cell for a chapter × metric value. */
export function buildChapterMetricCell(
  key: ChapterMetricKey,
  value: number | null,
  phase: ChapterPhase,
  chapterId: string
): ChapterMetricCell {
  const status = expectationStatus(key, value, phase);
  return {
    key,
    value,
    status,
    tone: expectationTone(status),
    href: chapterMetricDrilldownHref(chapterId, key),
  };
}
