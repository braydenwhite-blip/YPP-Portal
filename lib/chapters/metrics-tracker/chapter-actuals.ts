import "server-only";

import { readFile } from "fs/promises";
import path from "path";

const DATA_PATH = path.join(process.cwd(), "data", "metrics-tracker-chapter-actuals.json");

export type ChapterMetricActual = {
  /** M1–M6 actuals; null = not recorded yet. */
  actualByMonth: Array<number | null>;
  statusNote?: string | null;
  notes?: string[];
};

export type ChapterActuals = {
  chapterMonth?: number;
  metrics: Record<string, ChapterMetricActual>;
  categoryNotes?: Record<string, string[]>;
};

type ActualsFile = {
  chapters: Record<string, ChapterActuals>;
};

let cached: ActualsFile | null = null;

async function readActuals(): Promise<ActualsFile> {
  if (cached) return cached;
  try {
    const raw = await readFile(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw) as ActualsFile;
    cached = { chapters: parsed.chapters ?? {} };
    return cached;
  } catch {
    cached = { chapters: {} };
    return cached;
  }
}

export async function getChapterActuals(chapterName: string): Promise<ChapterActuals | null> {
  const store = await readActuals();
  return store.chapters[chapterName] ?? null;
}

export function actualForMonth(
  actuals: ChapterActuals | null | undefined,
  metricId: string,
  monthIndex: number
): number | null {
  if (!actuals) return null;
  const row = actuals.metrics[metricId];
  if (!row) return null;
  const v = row.actualByMonth[monthIndex];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
