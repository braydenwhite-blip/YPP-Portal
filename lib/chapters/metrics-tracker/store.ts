import "server-only";

import { prisma } from "@/lib/prisma";
import {
  categoriesForScope,
  type ChartKind,
  type MetricDef,
  type MetricReset,
  type MetricsScope,
} from "./catalog";
import { applyOverrides, loadFileStore } from "./file-store";

export type DbMetricRow = {
  id: string;
  key: string;
  scope: string;
  categoryId: string;
  label: string;
  owner: string;
  targetLabel: string;
  monthlyTargets: unknown;
  targetDisplay: unknown;
  reset: string;
  unit: string;
  chart: string;
  tracks: string | null;
  why: string | null;
  noTarget: boolean;
  sortOrder: number;
};

type MetricsDelegate = {
  count: (args?: unknown) => Promise<number>;
  createMany: (args: unknown) => Promise<unknown>;
  findMany: (args: unknown) => Promise<DbMetricRow[]>;
  findFirst: (args: unknown) => Promise<{ id: string } | null>;
  create: (args: unknown) => Promise<{ id: string }>;
  update: (args: unknown) => Promise<unknown>;
  aggregate: (args: unknown) => Promise<{ _max: { sortOrder: number | null } }>;
};

function metricsDelegate(): MetricsDelegate | null {
  const client = prisma as unknown as { metricsTrackerMetric?: MetricsDelegate };
  return client.metricsTrackerMetric ?? null;
}

function asNullNumberArray(value: unknown): Array<number | null> {
  if (!Array.isArray(value)) return [null, null, null, null, null, null];
  const out: Array<number | null> = [];
  for (let i = 0; i < 6; i += 1) {
    const v = value[i];
    out.push(typeof v === "number" && Number.isFinite(v) ? v : null);
  }
  return out;
}

function asNullStringArray(value: unknown): Array<string | null> | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.slice(0, 6).map((v) => (typeof v === "string" ? v : v == null ? null : String(v)));
}

export function rowToMetricDef(row: DbMetricRow): MetricDef {
  return {
    id: row.key,
    label: row.label,
    owner: row.owner,
    targetLabel: row.targetLabel,
    monthlyTargets: asNullNumberArray(row.monthlyTargets),
    targetDisplay: asNullStringArray(row.targetDisplay),
    reset: (row.reset === "cumulative" ? "cumulative" : "monthly") as MetricReset,
    unit: (["count", "percent", "currency", "hours", "text"].includes(row.unit)
      ? row.unit
      : "count") as MetricDef["unit"],
    chart: (["line", "bar", "area", "scatter"].includes(row.chart)
      ? row.chart
      : "line") as ChartKind,
    tracks: row.tracks ?? undefined,
    why: row.why ?? undefined,
    noTarget: row.noTarget,
  };
}

/** Catalog-backed rows when Prisma client / table is not ready yet. */
export function catalogRowsForScope(scope: MetricsScope): DbMetricRow[] {
  return categoriesForScope(scope).flatMap((cat) =>
    cat.metrics.map((m, index) => ({
      id: `catalog:${scope}:${cat.id}:${m.id}`,
      key: m.id,
      scope,
      categoryId: cat.id,
      label: m.label,
      owner: m.owner,
      targetLabel: m.targetLabel,
      monthlyTargets: m.monthlyTargets,
      targetDisplay: m.targetDisplay ?? null,
      reset: m.reset,
      unit: m.unit,
      chart: m.chart,
      tracks: m.tracks ?? null,
      why: m.why ?? null,
      noTarget: Boolean(m.noTarget),
      sortOrder: index,
    }))
  );
}

/** Insert catalog defaults once so admins can edit from a real table. */
export async function ensureMetricsTrackerSeeded(): Promise<boolean> {
  const delegate = metricsDelegate();
  if (!delegate) return false;

  try {
    const count = await delegate.count();
    if (count > 0) return true;

    const scopes: MetricsScope[] = ["org", "chapter_president", "instructor"];
    const rows: Array<Record<string, unknown>> = [];

    for (const scope of scopes) {
      for (const cat of categoriesForScope(scope)) {
        cat.metrics.forEach((m, index) => {
          rows.push({
            key: m.id,
            scope,
            categoryId: cat.id,
            label: m.label,
            owner: m.owner,
            targetLabel: m.targetLabel,
            monthlyTargets: m.monthlyTargets,
            targetDisplay: m.targetDisplay ?? undefined,
            reset: m.reset,
            unit: m.unit,
            chart: m.chart,
            tracks: m.tracks ?? null,
            why: m.why ?? null,
            noTarget: Boolean(m.noTarget),
            sortOrder: index,
          });
        });
      }
    }

    if (rows.length > 0) {
      await delegate.createMany({ data: rows, skipDuplicates: true });
    }
    return true;
  } catch {
    return false;
  }
}

export async function listActiveMetricsForScope(scope: MetricsScope): Promise<DbMetricRow[]> {
  const fileStore = await loadFileStore();
  const ready = await ensureMetricsTrackerSeeded();
  const delegate = metricsDelegate();

  if (!ready || !delegate) {
    return applyOverrides(catalogRowsForScope(scope), fileStore);
  }

  try {
    const rows = await delegate.findMany({
      where: { scope, archivedAt: null },
      orderBy: [{ categoryId: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
      select: {
        id: true,
        key: true,
        scope: true,
        categoryId: true,
        label: true,
        owner: true,
        targetLabel: true,
        monthlyTargets: true,
        targetDisplay: true,
        reset: true,
        unit: true,
        chart: true,
        tracks: true,
        why: true,
        noTarget: true,
        sortOrder: true,
      },
    });
    return applyOverrides(rows, fileStore);
  } catch {
    return applyOverrides(catalogRowsForScope(scope), fileStore);
  }
}

export function isMetricsTrackerDbReady(): boolean {
  return metricsDelegate() != null;
}
