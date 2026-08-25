/**
 * Chapter Analytics — month-adjusted pace vs expectations.
 *
 * Pure helpers shared by the Overview heatmap and the network Leaderboard.
 * Targets ramp linearly to mature baselines over RAMP_MONTHS so a month-3
 * chapter is never graded against a month-12 chapter.
 */

export const ANALYTICS_METRIC_KEYS = [
  "partners",
  "instructors",
  "students",
  "classes",
  "retention",
  "quality",
] as const;

export type AnalyticsMetricKey = (typeof ANALYTICS_METRIC_KEYS)[number];

export const ANALYTICS_CATEGORY_KEYS = [
  "students",
  "instructors",
  "partners",
  "quality",
] as const;

export type AnalyticsCategoryKey = (typeof ANALYTICS_CATEGORY_KEYS)[number];

export type PaceStatus = "above" | "on_track" | "needs_attention" | "at_risk";

export const PACE_STATUS_LABELS: Record<PaceStatus, string> = {
  above: "Above or Beyond",
  on_track: "On Track",
  needs_attention: "Needs Attention",
  at_risk: "At Risk",
};

/** Mature (fully ramped) baselines — aligned with chapter operating targets. */
export const MATURE_TARGETS: Record<AnalyticsMetricKey, number> = {
  partners: 10,
  instructors: 18,
  students: 100,
  classes: 10,
  retention: 80,
  quality: 4.5,
};

/** Months to reach mature target. */
export const RAMP_MONTHS = 12;

export const METRIC_LABELS: Record<AnalyticsMetricKey, string> = {
  partners: "Partners",
  instructors: "Instructors",
  students: "Active Students",
  classes: "Classes Launched",
  retention: "Retention",
  quality: "Class Quality",
};

export const CATEGORY_LABELS: Record<AnalyticsCategoryKey, string> = {
  students: "Students",
  instructors: "Instructors",
  partners: "Partners",
  quality: "Quality",
};

/** Category → primary metric used in the monthly status heatmap. */
export const CATEGORY_PRIMARY_METRIC: Record<AnalyticsCategoryKey, AnalyticsMetricKey> = {
  students: "students",
  instructors: "instructors",
  partners: "partners",
  quality: "retention",
};

export function monthsActiveAsOf(launchedAt: Date | null, asOf: Date): number {
  if (!launchedAt || launchedAt > asOf) return 1;
  const years = asOf.getUTCFullYear() - launchedAt.getUTCFullYear();
  const months = asOf.getUTCMonth() - launchedAt.getUTCMonth();
  return Math.max(1, years * 12 + months + 1);
}

/** Expected value at a given months-active (linear ramp, capped at mature). */
export function expectedAtMonth(metric: AnalyticsMetricKey, monthsActive: number): number {
  const mature = MATURE_TARGETS[metric];
  const progress = Math.min(1, Math.max(0, monthsActive) / RAMP_MONTHS);
  if (metric === "quality") {
    // Quality floors early: 4.0 → 4.5
    return Math.round((4 + (mature - 4) * progress) * 10) / 10;
  }
  if (metric === "retention") {
    // Retention floors at 70% and ramps to 80%
    return Math.round(70 + (mature - 70) * progress);
  }
  return Math.max(1, Math.round(mature * progress));
}

/**
 * Grade actual vs expected.
 *   ≥110% → above · ≥90% → on_track · ≥70% → needs_attention · else at_risk
 * Quality / retention use absolute thresholds vs expected (same ratios).
 */
export function paceStatus(actual: number, expected: number): PaceStatus {
  if (expected <= 0) return actual > 0 ? "above" : "on_track";
  const ratio = actual / expected;
  if (ratio >= 1.1) return "above";
  if (ratio >= 0.9) return "on_track";
  if (ratio >= 0.7) return "needs_attention";
  return "at_risk";
}

export function pacePercent(actual: number, expected: number): number {
  if (expected <= 0) return actual > 0 ? 100 : 0;
  return Math.round((actual / expected) * 100);
}

export function formatMetricValue(metric: AnalyticsMetricKey, value: number): string {
  if (metric === "retention") return `${Math.round(value)}%`;
  if (metric === "quality") return value.toFixed(1);
  return String(Math.round(value));
}

export function formatMetricCell(metric: AnalyticsMetricKey, actual: number, expected: number): string {
  if (metric === "retention") return `${Math.round(actual)}%`;
  if (metric === "quality") return `${actual.toFixed(1)} / ${expected.toFixed(1)}`;
  return `${Math.round(actual)} / ${Math.round(expected)}`;
}

/** End-of-month UTC for year/month (0-indexed month). */
export function endOfMonthUtc(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));
}

/** First day of month UTC. */
export function startOfMonthUtc(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex, 1));
}

export function monthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

export function monthShortLabel(year: number, monthIndex: number): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, monthIndex, 1))
  );
}

export function monthLongLabel(year: number, monthIndex: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthIndex, 1)));
}

/** Last N calendar months ending at `asOf` (inclusive), oldest → newest. */
export function lastNMonths(asOf: Date, n: number): Array<{ year: number; monthIndex: number; key: string; label: string }> {
  const out: Array<{ year: number; monthIndex: number; key: string; label: string }> = [];
  let y = asOf.getUTCFullYear();
  let m = asOf.getUTCMonth();
  for (let i = 0; i < n; i += 1) {
    out.unshift({ year: y, monthIndex: m, key: monthKey(y, m), label: monthShortLabel(y, m) });
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
  }
  return out;
}

export function analyticsPanelKey(chapterId: string, metric: AnalyticsMetricKey): string {
  return `${chapterId}:${metric}`;
}

export function analyticsDiscussedSourceId(
  chapterId: string,
  metric: AnalyticsMetricKey,
  periodKey: string
): string {
  return `chapter-analytics:discussed:${chapterId}:${metric}:${periodKey}`;
}
