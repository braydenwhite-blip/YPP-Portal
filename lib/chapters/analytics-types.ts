/**
 * Chapter Analytics — serializable view models (client-safe).
 */

import type { AnalyticsCategoryKey, AnalyticsMetricKey, PaceStatus } from "./analytics-pace";

export type AnalyticsRangeMonths = 3 | 6 | 12;

export type MetricSnapshot = Record<AnalyticsMetricKey, number>;

export type PaceCell = {
  metric: AnalyticsMetricKey;
  actual: number;
  expected: number;
  status: PaceStatus;
  display: string;
  percentOfExpected: number;
  discussedOn: string | null;
};

export type MonthlyCategoryCell = {
  category: AnalyticsCategoryKey;
  monthKey: string;
  label: string;
  actual: number;
  expected: number;
  status: PaceStatus;
  display: string;
};

export type TrendPoint = {
  monthKey: string;
  label: string;
  actual: number;
  expected: number;
};

export type ChapterOverviewModel = {
  chapterId: string;
  chapterName: string;
  launchedAt: string | null;
  launchedLabel: string;
  monthsActive: number;
  rangeMonths: AnalyticsRangeMonths;
  months: Array<{ key: string; label: string }>;
  heatmap: MonthlyCategoryCell[];
  current: MetricSnapshot;
  expected: MetricSnapshot;
  trends: Record<AnalyticsCategoryKey, TrendPoint[]>;
  kpis: {
    students: { retention: number; gap: number };
    instructors: { utilization: number; unassignedTrained: number };
    partners: { pendingMeetings: number; gap: number };
    quality: {
      instructorReviewAvg: number | null;
      parentFeedbackAvg: number | null;
      retention: number;
      followUpFlagged: number;
    };
  };
  chapters: Array<{ id: string; name: string }>;
  /** Current-month free-text note per category, keyed by AnalyticsCategoryKey. */
  notes: Record<AnalyticsCategoryKey, string | null>;
  /** Whether any month in `heatmap` used a DB-backed goal (default or exception) rather than the ramp. */
  hasCustomGoals: boolean;
};

export type LeaderboardRow = {
  chapterId: string;
  chapterName: string;
  monthsActive: number;
  cells: Record<AnalyticsMetricKey, PaceCell>;
  /** Mean percent-of-expected across count metrics — used for ranking. */
  paceScore: number;
};

export type MetricActionItem = {
  id: string;
  title: string;
  status: string;
  deadlineStart: string;
  completedAt: string | null;
  leadInitials: string;
  leadName: string;
  late: boolean;
};

export type MetricPanelModel = {
  chapterId: string;
  chapterName: string;
  metric: AnalyticsMetricKey;
  cell: PaceCell;
  deltaVsPriorMonth: number | null;
  warning: string | null;
  actions: MetricActionItem[];
  actionsCompleted: number;
  actionsOnTime: number;
  actionsLate: number;
  lastCompletedLabel: string | null;
  discussedOn: string | null;
  assignedInitials: string | null;
};

export type LeaderboardModel = {
  asOfLabel: string;
  asOfKey: string;
  updatedLabel: string;
  rows: LeaderboardRow[];
  panels: Record<string, MetricPanelModel>;
};
