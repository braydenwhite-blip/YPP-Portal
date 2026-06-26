// Chapter President daily-operations triage. A small, cheap set of "needs your
// action" signals the chapter home surfaces inline — so a CP never has to
// remember to check recruiting, curriculum, join requests, or overdue work in
// separate tabs. Each item links straight into the existing workflow that
// resolves it. This is deliberately NOT a separate dashboard: it is the one
// chapter home pointing at real, already-existing work.

import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";

export type ChapterAttentionTone = "danger" | "warning" | "brand";

export type ChapterAttentionItem = {
  key: string;
  /** Plural-aware noun, e.g. "applicants to review" — the count is rendered separately. */
  label: string;
  count: number;
  href: string;
  tone: ChapterAttentionTone;
};

/**
 * Resolve the handful of things waiting on the Chapter President right now.
 * Overdue actions are passed in from the workspace signals (already loaded) so
 * we never re-query them; everything else is a single indexed count guarded by
 * the shared Prisma fallback so a hiccup in one queue can't blank the home.
 */
export async function loadChapterAttention(
  chapterId: string,
  opts?: { overdueActions?: number }
): Promise<ChapterAttentionItem[]> {
  const [joinRequests, candidatesAwaitingDecision, curriculumToReview] = await Promise.all([
    withPrismaFallback(
      "chapter:attention:join-requests",
      () => prisma.chapterJoinRequest.count({ where: { chapterId, status: "PENDING" } }),
      0
    ),
    withPrismaFallback(
      "chapter:attention:candidates",
      () =>
        prisma.application.count({
          where: { position: { chapterId }, decision: null, status: { not: "WITHDRAWN" } },
        }),
      0
    ),
    withPrismaFallback(
      "chapter:attention:curriculum",
      () =>
        prisma.classTemplate.count({
          where: { chapterId, submissionStatus: "SUBMITTED" },
        }),
      0
    ),
  ]);

  const items: ChapterAttentionItem[] = [];
  const overdue = opts?.overdueActions ?? 0;

  if (overdue > 0) {
    items.push({
      key: "overdue",
      label: overdue === 1 ? "overdue action" : "overdue actions",
      count: overdue,
      href: `/actions?ch=${chapterId}`,
      tone: "danger",
    });
  }
  if (candidatesAwaitingDecision > 0) {
    items.push({
      key: "candidates",
      label: candidatesAwaitingDecision === 1 ? "applicant to review" : "applicants to review",
      count: candidatesAwaitingDecision,
      href: "/chapter/recruiting?tab=candidates",
      tone: "warning",
    });
  }
  if (curriculumToReview > 0) {
    items.push({
      key: "curriculum",
      label: curriculumToReview === 1 ? "curriculum to review" : "curricula to review",
      count: curriculumToReview,
      href: "/admin/curricula",
      tone: "warning",
    });
  }
  if (joinRequests > 0) {
    items.push({
      key: "join",
      label: joinRequests === 1 ? "join request" : "join requests",
      count: joinRequests,
      href: "/chapter/settings",
      tone: "brand",
    });
  }

  return items;
}
