import "server-only";

// Shared core for capturing a chapter's weekly KPI snapshot. Lives in a plain
// server module (NOT a "use server" file) so it can be reused by both the
// explicit "Save snapshot" room action and the automatic capture on weekly
// impact submission WITHOUT being exposed as an unauthenticated server action.
// The CALLER is responsible for authorization; this only computes + upserts.

import { prisma } from "@/lib/prisma";
import { weekKey } from "@/lib/weekly-meetings/week";
import { kpiSnapshotToRow } from "@/lib/chapters/chapter-growth";
import { loadChapterOS } from "@/lib/chapters/chapter-os";

export type CaptureSnapshotResult = { ok: true; weekStartISO: string } | { ok: false; error: string };

/**
 * Compute the chapter's current KPI values and upsert them as the snapshot for
 * `weekStart` (Monday 00:00 UTC). Idempotent by chapter + week — re-running for
 * the same week overwrites that row. No authorization here; callers guard.
 */
export async function captureChapterKpiSnapshot(
  chapterId: string,
  weekStart: Date
): Promise<CaptureSnapshotResult> {
  const model = await loadChapterOS(chapterId);
  if (!model) return { ok: false, error: "Chapter not found" };

  const row = kpiSnapshotToRow(model.growth.current);
  try {
    await prisma.chapterWeeklyKpiSnapshot.upsert({
      where: { chapterId_weekStart: { chapterId, weekStart } },
      create: { chapterId, weekStart, ...row },
      update: row,
    });
  } catch {
    return { ok: false, error: "Could not save snapshot" };
  }

  return { ok: true, weekStartISO: weekKey(weekStart) };
}
