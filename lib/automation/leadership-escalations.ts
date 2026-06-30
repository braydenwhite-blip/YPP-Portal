// Reusable cross-chapter ESCALATION rollup for the leadership dashboard.
//
// Surfaces the conditions that should rise to global leadership across a set of
// chapters, sorted most-severe first. This is a read model — it does not send
// notifications. Heavy by nature (one OS load per chapter), so callers should
// scope `chapterIds` to the chapters they manage. Read-only.

import "server-only";

import { SEVERITY_RANK } from "@/lib/automation/types";
import type { ChapterEscalation } from "@/lib/automation/escalation";
import { loadChapterAutomations } from "@/lib/automation/build-chapter-automation";

/**
 * Build the leadership escalation feed across the given chapters. A chapter that
 * fails to load contributes nothing rather than failing the whole feed.
 */
export async function loadLeadershipEscalations(chapterIds: string[]): Promise<ChapterEscalation[]> {
  const results = await Promise.all(
    chapterIds.map((id) => loadChapterAutomations(id).catch(() => null))
  );
  const all = results.filter((a): a is NonNullable<typeof a> => a != null).flatMap((a) => a.escalations);
  return all.sort((x, y) => SEVERITY_RANK[x.severity] - SEVERITY_RANK[y.severity]);
}
