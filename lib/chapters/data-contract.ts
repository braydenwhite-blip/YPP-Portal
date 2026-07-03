// Chapter data contract — the standardized row shapes chapter metrics can
// arrive in from OUTSIDE the portal: workbook exports, weekly snapshot uploads,
// or structured spreadsheet rows. Portal-native surfaces already compute these
// numbers live; this contract exists so an import path can land the same data
// into `ChapterWeeklyKpiSnapshot` without a schema change. Aligned 1:1 with the
// KPI keys in lib/chapters/chapter-growth.ts. Pure zod + mapping, fully unit
// testable; no importer is wired yet — validation and mapping are ready for it.

import { z } from "zod";

import {
  KPI_KEYS,
  buildChapterKpiSnapshot,
  type KpiKey,
  type KpiSnapshotInput,
  type WeeklyKpiRow,
} from "@/lib/chapters/chapter-growth";

/** KPI columns that are percentages (validated 0–100 instead of open-ended). */
const PERCENT_KEYS: ReadonlySet<KpiKey> = new Set<KpiKey>(["attendancePercent", "retentionPercent"]);

const count = z.coerce.number().int().min(0);
const percent = z.coerce.number().min(0).max(100);

const kpiFields = Object.fromEntries(
  KPI_KEYS.map((k) => [k, (PERCENT_KEYS.has(k) ? percent : count).optional()])
) as Record<KpiKey, z.ZodOptional<z.ZodNumber>>;

/**
 * One standardized weekly snapshot row for one chapter. `chapterSlug` (or a
 * portal `chapterId`) identifies the chapter; `weekStart` must be the Monday of
 * the reporting week in YYYY-MM-DD. Missing KPI columns default to 0 on import.
 */
export const ChapterWeeklySnapshotRowSchema = z
  .object({
    chapterId: z.string().trim().min(1).optional(),
    chapterSlug: z.string().trim().min(1).optional(),
    weekStart: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "weekStart must be YYYY-MM-DD"),
    ...kpiFields,
  })
  .refine((row) => row.chapterId != null || row.chapterSlug != null, {
    message: "Each row needs a chapterId or a chapterSlug",
  });

export type ChapterWeeklySnapshotRow = z.infer<typeof ChapterWeeklySnapshotRowSchema>;

export type SnapshotRowError = { index: number; message: string };

export type ParsedSnapshotRows = {
  rows: ChapterWeeklySnapshotRow[];
  errors: SnapshotRowError[];
};

/**
 * Validate a batch of unknown rows (e.g. parsed workbook/CSV records). Valid
 * rows and per-row errors are returned side by side so an importer can show
 * exactly which rows need fixing without rejecting the whole file.
 */
export function parseChapterSnapshotRows(input: unknown): ParsedSnapshotRows {
  if (!Array.isArray(input)) {
    return { rows: [], errors: [{ index: -1, message: "Expected an array of snapshot rows" }] };
  }
  const rows: ChapterWeeklySnapshotRow[] = [];
  const errors: SnapshotRowError[] = [];
  input.forEach((raw, index) => {
    const result = ChapterWeeklySnapshotRowSchema.safeParse(raw);
    if (result.success) rows.push(result.data);
    else {
      const issue = result.error.issues[0];
      errors.push({
        index,
        message: issue ? `${issue.path.join(".") || "row"}: ${issue.message}` : "Invalid row",
      });
    }
  });
  return { rows, errors };
}

/** Map a validated contract row → the KPI snapshot input the growth model reads. */
export function snapshotRowToKpiInput(
  row: ChapterWeeklySnapshotRow,
  weekNumber: number
): KpiSnapshotInput {
  const values: Partial<Record<KpiKey, number>> = {};
  for (const k of KPI_KEYS) {
    const v = row[k];
    if (v != null) values[k] = v;
  }
  return { weekStartISO: row.weekStart, weekNumber, values };
}

/** Map a validated contract row → the persisted ChapterWeeklyKpiSnapshot columns. */
export function snapshotRowToWeeklyKpiRow(row: ChapterWeeklySnapshotRow): WeeklyKpiRow {
  const snapshot = buildChapterKpiSnapshot(snapshotRowToKpiInput(row, 1));
  const v = snapshot.values;
  return {
    partnersContacted: v.partnersContacted,
    partnerMeetingsScheduled: v.partnerMeetingsScheduled,
    confirmedPartners: v.confirmedPartners,
    instructorApplicants: v.instructorApplicants,
    interviewsCompleted: v.interviewsCompleted,
    instructorsHired: v.instructorsHired,
    curriculaSubmitted: v.curriculaSubmitted,
    curriculaApproved: v.curriculaApproved,
    classesCreated: v.classesCreated,
    classesReady: v.classesReady,
    studentsEnrolled: v.studentsEnrolled,
    attendancePercent: v.attendancePercent,
    retentionPercent: v.retentionPercent,
    feedbackCount: v.feedbackCollected,
    unresolvedBlockers: v.unresolvedBlockers,
  };
}
