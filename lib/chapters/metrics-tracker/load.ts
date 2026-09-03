import "server-only";

import { pacePercent, paceStatus, type PaceStatus } from "@/lib/chapters/analytics-pace";
import { ensureOperatingChapters } from "@/lib/chapters/operating";
import { OPERATING_CHAPTERS } from "@/lib/chapters/operating-chapters";
import {
  categoriesForScope,
  type CategoryDef,
  type EditableCategorySnapshot,
  type EditableChapterGroupSnapshot,
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

function actualFor(
  def: MetricDef,
  monthIndex: number,
  chapterMonth: number,
  chapterKey?: string
): number {
  const target = def.monthlyTargets[Math.min(monthIndex, 5)];
  const seedBase = chapterKey
    ? `${def.id}:${monthIndex}:${chapterKey}`
    : `${def.id}:${monthIndex}`;
  if (target == null) {
    return Math.round(8 + chapterMonth * 1.5 + hash01(`${seedBase}:f`) * 4);
  }
  const ratio = 0.72 + hash01(`${seedBase}:r`) * 0.4;
  if (def.reset === "cumulative") {
    return Math.round(target * Math.min(1.15, ratio));
  }
  if (def.id === "mttr") {
    return Math.round(target * (0.7 + hash01(seedBase) * 0.5));
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

function seriesFor(
  def: MetricDef,
  chapterMonth: number,
  chapterKey?: string
): MetricPoint[] {
  return MONTH_LABELS.map((month, i) => ({
    month,
    actual: actualFor(def, i, chapterMonth, chapterKey),
    target: def.monthlyTargets[i],
  }));
}

function snapshotMetric(
  def: MetricDef,
  chapterMonth: number,
  rowId: string,
  chapterKey?: string
): EditableMetricSnapshot {
  const idx = Math.min(Math.max(chapterMonth, 1), 6) - 1;
  const series = seriesFor(def, chapterMonth, chapterKey);
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
  chapterMonth: number,
  chapterKey?: string
): EditableMetricSnapshot[] {
  return rows
    .filter((r) => r.categoryId === category.id)
    .map((r) => snapshotMetric(rowToMetricDef(r), chapterMonth, r.id, chapterKey));
}

function chapterSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

function normalizeOwnerName(name: string): string {
  return name.trim().toLowerCase();
}

function ownerMatchesPerson(metricOwner: string, personName: string): boolean {
  const person = normalizeOwnerName(personName);
  if (!person) return false;
  return normalizeOwnerName(metricOwner) === person;
}

function isInstructorTemplateOwner(owner: string): boolean {
  return normalizeOwnerName(owner) === "instructor";
}

function rowAssignedToPerson(
  row: DbMetricRow,
  personName: string,
  includeInstructorTemplate: boolean
): boolean {
  if (ownerMatchesPerson(row.owner, personName)) return true;
  return (
    includeInstructorTemplate &&
    row.scope === "instructor" &&
    isInstructorTemplateOwner(row.owner)
  );
}

function metricDefForPerson(row: DbMetricRow, personName: string): MetricDef {
  const def = rowToMetricDef(row);
  if (row.scope === "instructor" && isInstructorTemplateOwner(row.owner)) {
    return { ...def, owner: personName.trim() || def.owner };
  }
  return def;
}

function assignedMetricsForCategory(
  rows: DbMetricRow[],
  category: CategoryDef,
  chapterMonth: number,
  personId: string,
  personName: string,
  includeInstructorTemplate: boolean
): EditableMetricSnapshot[] {
  const seed = `person:${personId}`;
  return rows
    .filter((r) => r.categoryId === category.id)
    .filter((r) => rowAssignedToPerson(r, personName, includeInstructorTemplate))
    .map((r) =>
      snapshotMetric(metricDefForPerson(r, personName), chapterMonth, r.id, seed)
    );
}

const PERSON_SCOPE_ORDER: MetricsScope[] = ["org", "chapter_president", "instructor"];

export type PersonMetricsCategorySnapshot = EditableCategorySnapshot & {
  scope: MetricsScope;
};

async function loadChapterGroups(
  cpRows: DbMetricRow[],
  instructorRows: DbMetricRow[],
  chapterMonth: number
): Promise<EditableChapterGroupSnapshot[]> {
  const dbChapters = await ensureOperatingChapters();
  const byName = new Map(dbChapters.map((c) => [c.name, c.id]));

  return OPERATING_CHAPTERS.map((chapter) => {
    const chapterKey = chapter.name;
    const cpCategories: EditableCategorySnapshot[] = categoriesForScope("chapter_president").map(
      (def) => {
        const metrics = metricsForCategory(cpRows, def, chapterMonth, chapterKey);
        return {
          def,
          status: rollupStatus(metrics.map((m) => m.status)),
          percentOfTarget: rollupPercent(metrics),
          metrics,
        };
      }
    );
    const instructorCategories: EditableCategorySnapshot[] = categoriesForScope("instructor").map(
      (def) => {
        const metrics = metricsForCategory(instructorRows, def, chapterMonth, chapterKey);
        return {
          def,
          status: rollupStatus(metrics.map((m) => m.status)),
          percentOfTarget: rollupPercent(metrics),
          metrics,
        };
      }
    );
    const categories = [...cpCategories, ...instructorCategories];
    const allMetrics = categories.flatMap((c) => c.metrics);

    return {
      id: chapterSlug(chapter.name),
      chapterId: byName.get(chapter.name) ?? null,
      label: chapter.name,
      blurb: `${chapter.city} · ${chapter.region}`,
      status: rollupStatus(allMetrics.map((m) => m.status)),
      categories,
    };
  });
}

export async function loadScopeSnapshot(
  scope: MetricsScope,
  opts: { chapterMonth?: number } = {}
): Promise<EditableScopeSnapshot> {
  const chapterMonth = opts.chapterMonth ?? 3;
  const meta = SCOPE_META[scope];

  if (scope === "chapter_president") {
    const cpRows = await listActiveMetricsForScope("chapter_president");
    const instructorRows = await listActiveMetricsForScope("instructor");
    const chapterGroups = await loadChapterGroups(cpRows, instructorRows, chapterMonth);
    const categories = chapterGroups[0]?.categories ?? [];

    return {
      scope,
      label: meta.label,
      blurb: meta.blurb,
      icon: meta.icon,
      status: rollupStatus(chapterGroups.map((g) => g.status)),
      categories,
      chapterGroups,
    };
  }

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
    (["org", "chapter_president"] as MetricsScope[]).map((scope) =>
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

/**
 * Metrics assigned to one person (mentorship Metrics tab).
 * Includes org/chapter rows whose owner matches their name, plus instructor-track
 * template metrics when requested.
 */
export async function loadPersonAssignedMetrics(
  personId: string,
  opts: {
    chapterMonth?: number;
    personName?: string;
    /** Include generic instructor-catalog metrics for instructor-track people. */
    includeInstructorTemplate?: boolean;
  } = {}
): Promise<{ categories: PersonMetricsCategorySnapshot[]; status: PaceStatus }> {
  const chapterMonth = opts.chapterMonth ?? 3;
  const personName = opts.personName?.trim() ?? "";
  const includeInstructorTemplate = opts.includeInstructorTemplate ?? true;

  const rowsByScope = await Promise.all(
    PERSON_SCOPE_ORDER.map(async (scope) => ({
      scope,
      rows: await listActiveMetricsForScope(scope),
    }))
  );

  const categories: PersonMetricsCategorySnapshot[] = [];

  for (const { scope, rows } of rowsByScope) {
    for (const catDef of categoriesForScope(scope)) {
      const metrics = assignedMetricsForCategory(
        rows,
        catDef,
        chapterMonth,
        personId,
        personName,
        includeInstructorTemplate
      );
      if (metrics.length === 0) continue;
      categories.push({
        def: catDef,
        scope,
        status: rollupStatus(metrics.map((m) => m.status)),
        percentOfTarget: rollupPercent(metrics),
        metrics,
      });
    }
  }

  return {
    categories,
    status: rollupStatus(categories.map((c) => c.status)),
  };
}

/** @deprecated Use loadPersonAssignedMetrics */
export async function loadPersonInstructorMetrics(
  personId: string,
  opts: { chapterMonth?: number; personName?: string } = {}
): Promise<EditableScopeSnapshot> {
  const meta = SCOPE_META.instructor;
  const { categories, status } = await loadPersonAssignedMetrics(personId, {
    ...opts,
    includeInstructorTemplate: true,
  });
  return {
    scope: "instructor",
    label: meta.label,
    blurb: meta.blurb,
    icon: meta.icon,
    status,
    categories,
  };
}
