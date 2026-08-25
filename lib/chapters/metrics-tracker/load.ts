import "server-only";

import { pacePercent, paceStatus, type PaceStatus } from "@/lib/chapters/analytics-pace";
import {
  categoriesForScope,
  type CategoryDef,
  type EditableCategorySnapshot,
  type EditableMetricSnapshot,
  type EditableScopeSnapshot,
  type MetricDef,
  type MetricPoint,
  type MetricSnapshot,
  type MetricsScope,
  SCOPE_META,
} from "./catalog";
import { listActiveMetricsForScope, rowToMetricDef, type DbMetricRow } from "./store";

export type {
  EditableCategorySnapshot,
  EditableMetricSnapshot,
  EditableScopeSnapshot,
} from "./catalog";

const MONTH_LABELS = ["M1", "M2", "M3", "M4", "M5", "M6"] as const;

function hash01(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

function actualFor(def: MetricDef, monthIndex: number, chapterMonth: number): number {
  const target = def.monthlyTargets[Math.min(monthIndex, 5)];
  if (target == null) {
    return Math.round(8 + chapterMonth * 1.5 + hash01(`${def.id}:${monthIndex}`) * 4);
  }
  const ratio = 0.72 + hash01(`${def.id}:${monthIndex}:r`) * 0.4;
  if (def.reset === "cumulative") {
    return Math.round(target * Math.min(1.15, ratio));
  }
  if (def.id === "mttr") {
    return Math.round(target * (0.7 + hash01(`${def.id}:${monthIndex}`) * 0.5));
  }
  return Math.round(target * ratio);
}

function statusFor(
  def: MetricDef,
  actual: number,
  target: number | null
): PaceStatus | "informational" {
  if (def.noTarget || target == null) return "informational";
  if (def.id === "mttr") {
    if (actual <= target * 0.9) return "above";
    if (actual <= target) return "on_track";
    if (actual <= target * 1.25) return "needs_attention";
    return "at_risk";
  }
  return paceStatus(actual, target);
}

function seriesFor(def: MetricDef, chapterMonth: number): MetricPoint[] {
  return MONTH_LABELS.map((month, i) => ({
    month,
    actual: actualFor(def, i, chapterMonth),
    target: def.monthlyTargets[i],
  }));
}

function snapshotMetric(
  def: MetricDef,
  chapterMonth: number,
  rowId: string
): EditableMetricSnapshot {
  const idx = Math.min(Math.max(chapterMonth, 1), 6) - 1;
  const series = seriesFor(def, chapterMonth);
  const point = series[idx] ?? series[0];
  const target = point.target;
  const actual = point.actual;
  const status = statusFor(def, actual, target);
  const percentOfTarget =
    def.noTarget || target == null
      ? null
      : def.id === "mttr"
        ? Math.round((target / Math.max(actual, 0.01)) * 100)
        : pacePercent(actual, target);

  return { def, actual, target, status, percentOfTarget, series, rowId };
}

function rollupStatus(statuses: Array<PaceStatus | "informational">): PaceStatus {
  const ranked: PaceStatus[] = statuses.filter((s): s is PaceStatus => s !== "informational");
  if (ranked.length === 0) return "on_track";
  if (ranked.includes("at_risk")) return "at_risk";
  if (ranked.includes("needs_attention")) return "needs_attention";
  if (ranked.every((s) => s === "above")) return "above";
  return "on_track";
}

function rollupPercent(metrics: MetricSnapshot[]): number {
  const vals = metrics
    .map((m) => m.percentOfTarget)
    .filter((n): n is number => n != null);
  if (vals.length === 0) return 100;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function metricsForCategory(
  rows: DbMetricRow[],
  category: CategoryDef,
  chapterMonth: number
): EditableMetricSnapshot[] {
  return rows
    .filter((r) => r.categoryId === category.id)
    .map((r) => snapshotMetric(rowToMetricDef(r), chapterMonth, r.id));
}

export async function loadScopeSnapshot(
  scope: MetricsScope,
  opts: { chapterMonth?: number } = {}
): Promise<EditableScopeSnapshot> {
  const chapterMonth = opts.chapterMonth ?? 3;
  const meta = SCOPE_META[scope];
  const rows = await listActiveMetricsForScope(scope);
  const categories: EditableCategorySnapshot[] = categoriesForScope(scope).map((def) => {
    const metrics = metricsForCategory(rows, def, chapterMonth);
    return {
      def,
      status: rollupStatus(metrics.map((m) => m.status)),
      percentOfTarget: rollupPercent(metrics),
      metrics,
    };
  });

  return {
    scope,
    label: meta.label,
    blurb: meta.blurb,
    icon: meta.icon,
    status: rollupStatus(categories.map((c) => c.status)),
    categories,
  };
}

export async function loadMetricsHub(opts: { chapterMonth?: number } = {}): Promise<{
  chapterMonth: number;
  scopes: EditableScopeSnapshot[];
}> {
  const chapterMonth = opts.chapterMonth ?? 3;
  const scopes = await Promise.all(
    (["org", "chapter_president", "instructor"] as MetricsScope[]).map((scope) =>
      loadScopeSnapshot(scope, { chapterMonth })
    )
  );
  return { chapterMonth, scopes };
}

export async function loadCategoryDetail(
  scope: MetricsScope,
  categoryId: string,
  opts: { chapterMonth?: number } = {}
): Promise<EditableCategorySnapshot | null> {
  const hub = await loadScopeSnapshot(scope, opts);
  return hub.categories.find((c) => c.def.id === categoryId) ?? null;
}
