/**
 * Chapter Analytics — DB-backed goal targets.
 *
 * Resolution order for a given (chapterId, metric, monthKey):
 *   1. Per-chapter exception (ChapterAnalyticsGoalException)
 *   2. Network-wide default (ChapterAnalyticsGoal)
 *   3. Hardcoded ramp fallback (expectedAtMonth)
 */

import "server-only";

import { prisma } from "@/lib/prisma";

import {
  ANALYTICS_METRIC_KEYS,
  METRIC_LABELS,
  endOfMonthUtc,
  expectedAtMonth,
  lastNMonths,
  monthsActiveAsOf,
  type AnalyticsMetricKey,
} from "./analytics-pace";
import { ensureOperatingChapters, OPERATING_CHAPTER_NAMES } from "./operating";

export type GoalOverrides = {
  defaults: Map<string, number>; // key: `${metric}:${monthKey}`
  exceptions: Map<string, number>; // key: `${chapterId}:${metric}:${monthKey}`
};

function defaultKey(metric: string, monthKey: string): string {
  return `${metric}:${monthKey}`;
}

function exceptionKey(chapterId: string, metric: string, monthKey: string): string {
  return `${chapterId}:${metric}:${monthKey}`;
}

export async function loadGoalOverrides(
  chapterIds: string[],
  monthKeys: string[]
): Promise<GoalOverrides> {
  if (monthKeys.length === 0) return { defaults: new Map(), exceptions: new Map() };

  const [defaults, exceptions] = await Promise.all([
    prisma.chapterAnalyticsGoal.findMany({
      where: { monthKey: { in: monthKeys } },
      select: { metric: true, monthKey: true, targetValue: true },
    }),
    prisma.chapterAnalyticsGoalException.findMany({
      where: { chapterId: { in: chapterIds }, monthKey: { in: monthKeys } },
      select: { chapterId: true, metric: true, monthKey: true, targetValue: true },
    }),
  ]);

  return {
    defaults: new Map(defaults.map((d) => [defaultKey(d.metric, d.monthKey), d.targetValue])),
    exceptions: new Map(
      exceptions.map((e) => [exceptionKey(e.chapterId, e.metric, e.monthKey), e.targetValue])
    ),
  };
}

/** Resolve the expected value for a metric, honoring exceptions/defaults over the ramp. */
export function resolveExpected(
  overrides: GoalOverrides,
  chapterId: string,
  metric: AnalyticsMetricKey,
  monthKey: string,
  monthsActive: number
): number {
  const exception = overrides.exceptions.get(exceptionKey(chapterId, metric, monthKey));
  if (exception != null) return exception;
  const def = overrides.defaults.get(defaultKey(metric, monthKey));
  if (def != null) return def;
  return expectedAtMonth(metric, monthsActive);
}

// ============================================
// GOALS SETTINGS SCREEN — read model
// ============================================

export type GoalsSettingsCell = {
  monthKey: string;
  /** The calculated fallback (hardcoded ramp) — shown as a placeholder when no default is set. */
  rampValue: number;
  /** The DB-backed network default, or null if unset (falls back to rampValue). */
  defaultValue: number | null;
};

export type GoalsSettingsMetricRow = {
  metric: AnalyticsMetricKey;
  label: string;
  cells: GoalsSettingsCell[];
};

export type GoalsSettingsException = {
  id: string;
  chapterId: string;
  chapterName: string;
  metric: AnalyticsMetricKey;
  monthKey: string;
  targetValue: number;
  updatedByName: string;
  updatedAt: string;
};

/** Same shape as GoalsSettingsCell, but rampValue/effective are computed for one real chapter. */
export type GoalsSettingsChapterCell = {
  monthKey: string;
  /** This chapter's actual calculated ramp value for this calendar month (real months-active). */
  rampValue: number;
  /** The network default at this metric/month, if set. */
  defaultValue: number | null;
  /** This chapter's own exception at this metric/month, if set. */
  exceptionValue: number | null;
};

export type GoalsSettingsChapterMetricRow = {
  metric: AnalyticsMetricKey;
  label: string;
  cells: GoalsSettingsChapterCell[];
};

export type GoalsSettingsByChapter = {
  chapterId: string;
  chapterName: string;
  rows: GoalsSettingsChapterMetricRow[];
};

export type GoalsSettingsModel = {
  months: Array<{ key: string; label: string }>;
  rows: GoalsSettingsMetricRow[];
  chapters: Array<{ id: string; name: string; monthsActive: number }>;
  exceptions: GoalsSettingsException[];
  /** Per-chapter view of the same grid — one entry per operating chapter. */
  perChapter: GoalsSettingsByChapter[];
};

export async function loadGoalsSettings(
  opts: { rangeMonths?: 6 | 12; now?: Date } = {}
): Promise<GoalsSettingsModel> {
  const now = opts.now ?? new Date();
  const rangeMonths = opts.rangeMonths ?? 12;
  const rawMonths = lastNMonths(now, rangeMonths);
  const months = rawMonths.map((m) => ({ key: m.key, label: `${m.label} '${String(m.year).slice(2)}` }));
  const monthKeys = months.map((m) => m.key);

  await ensureOperatingChapters();

  const chapters = await prisma.chapter.findMany({
    where: { archivedAt: null, name: { in: [...OPERATING_CHAPTER_NAMES] } },
    select: { id: true, name: true, launchedAt: true, createdAt: true },
    orderBy: { name: "asc" },
  });

  const [defaults, exceptionRows] = await Promise.all([
    prisma.chapterAnalyticsGoal.findMany({
      where: { monthKey: { in: monthKeys } },
      select: { metric: true, monthKey: true, targetValue: true },
    }),
    prisma.chapterAnalyticsGoalException.findMany({
      where: { monthKey: { in: monthKeys } },
      select: {
        id: true,
        chapterId: true,
        metric: true,
        monthKey: true,
        targetValue: true,
        updatedAt: true,
        updatedBy: { select: { name: true } },
        chapter: { select: { name: true } },
      },
      orderBy: [{ chapterId: "asc" }, { monthKey: "asc" }],
    }),
  ]);

  const defaultsMap = new Map(defaults.map((d) => [defaultKey(d.metric, d.monthKey), d.targetValue]));
  const exceptionsMap = new Map(
    exceptionRows.map((e) => [exceptionKey(e.chapterId, e.metric, e.monthKey), e.targetValue])
  );

  // Ramp preview treats the oldest visible month as "month 1" — a reference point for what
  // the hardcoded ramp would produce, not tied to any single chapter's real launch date.
  const rows: GoalsSettingsMetricRow[] = ANALYTICS_METRIC_KEYS.map((metric) => ({
    metric,
    label: METRIC_LABELS[metric],
    cells: months.map((m, idx) => ({
      monthKey: m.key,
      rampValue: expectedAtMonth(metric, idx + 1),
      defaultValue: defaultsMap.get(defaultKey(metric, m.key)) ?? null,
    })),
  }));

  const perChapter: GoalsSettingsByChapter[] = chapters.map((c) => {
    const launch = c.launchedAt ?? c.createdAt;
    return {
      chapterId: c.id,
      chapterName: c.name,
      rows: ANALYTICS_METRIC_KEYS.map((metric) => ({
        metric,
        label: METRIC_LABELS[metric],
        cells: rawMonths.map((m) => {
          const asOf = endOfMonthUtc(m.year, m.monthIndex);
          const monthsActive = monthsActiveAsOf(launch, asOf);
          return {
            monthKey: m.key,
            rampValue: expectedAtMonth(metric, monthsActive),
            defaultValue: defaultsMap.get(defaultKey(metric, m.key)) ?? null,
            exceptionValue: exceptionsMap.get(exceptionKey(c.id, metric, m.key)) ?? null,
          };
        }),
      })),
    };
  });

  return {
    months,
    rows,
    chapters: chapters.map((c) => ({
      id: c.id,
      name: c.name,
      monthsActive: monthsActiveAsOf(c.launchedAt ?? c.createdAt, now),
    })),
    exceptions: exceptionRows.map((e) => ({
      id: e.id,
      chapterId: e.chapterId,
      chapterName: e.chapter.name,
      metric: e.metric as AnalyticsMetricKey,
      monthKey: e.monthKey,
      targetValue: e.targetValue,
      updatedByName: e.updatedBy.name,
      updatedAt: e.updatedAt.toISOString(),
    })),
    perChapter,
  };
}
