import "server-only";

import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import type { MetricsScope } from "./catalog";
import type { DbMetricRow } from "./store";

const DATA_PATH = path.join(process.cwd(), "data", "metrics-tracker-overrides.json");

export type MetricOverride = Partial<
  Pick<
    DbMetricRow,
    | "label"
    | "owner"
    | "targetLabel"
    | "monthlyTargets"
    | "targetDisplay"
    | "reset"
    | "unit"
    | "chart"
    | "tracks"
    | "why"
    | "noTarget"
  >
>;

type OverrideFile = {
  overrides: Record<string, MetricOverride>;
  archived: string[];
};

function metricKey(scope: string, categoryId: string, key: string) {
  return `${scope}:${categoryId}:${key}`;
}

export function parseCatalogRowId(id: string): { scope: MetricsScope; categoryId: string; key: string } | null {
  if (!id.startsWith("catalog:")) return null;
  const parts = id.slice("catalog:".length).split(":");
  if (parts.length < 3) return null;
  const scope = parts[0] as MetricsScope;
  const key = parts[parts.length - 1]!;
  const categoryId = parts.slice(1, -1).join(":");
  return { scope, categoryId, key };
}

async function readStore(): Promise<OverrideFile> {
  try {
    const raw = await readFile(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw) as OverrideFile;
    return {
      overrides: parsed.overrides ?? {},
      archived: Array.isArray(parsed.archived) ? parsed.archived : [],
    };
  } catch {
    return { overrides: {}, archived: [] };
  }
}

async function writeStore(data: OverrideFile): Promise<void> {
  await mkdir(path.dirname(DATA_PATH), { recursive: true });
  await writeFile(DATA_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function applyOverrides(rows: DbMetricRow[], store: OverrideFile): DbMetricRow[] {
  const archived = new Set(store.archived);
  return rows
    .map((row) => {
      const k = metricKey(row.scope, row.categoryId, row.key);
      const patch = store.overrides[k];
      if (!patch) return row;
      return {
        ...row,
        ...patch,
        id: row.id,
        key: row.key,
        scope: row.scope,
        categoryId: row.categoryId,
        sortOrder: row.sortOrder,
      };
    })
    .filter((row) => !archived.has(metricKey(row.scope, row.categoryId, row.key)));
}

export async function upsertFileOverride(
  scope: MetricsScope,
  categoryId: string,
  key: string,
  patch: MetricOverride
): Promise<string> {
  const store = await readStore();
  const k = metricKey(scope, categoryId, key);
  store.overrides[k] = { ...store.overrides[k], ...patch };
  store.archived = store.archived.filter((id) => id !== k);
  await writeStore(store);
  return `catalog:${scope}:${categoryId}:${key}`;
}

export async function archiveFileOverride(scope: MetricsScope, categoryId: string, key: string): Promise<void> {
  const store = await readStore();
  const k = metricKey(scope, categoryId, key);
  if (!store.archived.includes(k)) store.archived.push(k);
  await writeStore(store);
}

export async function createFileOverride(
  scope: MetricsScope,
  categoryId: string,
  key: string,
  row: Omit<DbMetricRow, "id" | "scope" | "categoryId" | "key">
): Promise<string> {
  const store = await readStore();
  const k = metricKey(scope, categoryId, key);
  store.overrides[k] = {
    label: row.label,
    owner: row.owner,
    targetLabel: row.targetLabel,
    monthlyTargets: row.monthlyTargets,
    targetDisplay: row.targetDisplay,
    reset: row.reset,
    unit: row.unit,
    chart: row.chart,
    tracks: row.tracks,
    why: row.why,
    noTarget: row.noTarget,
  };
  await writeStore(store);
  return `catalog:${scope}:${categoryId}:${key}`;
}

export async function loadFileStore(): Promise<OverrideFile> {
  return readStore();
}
