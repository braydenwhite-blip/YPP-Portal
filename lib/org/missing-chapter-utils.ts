/**
 * Pure helpers for the Missing Chapter status (Phase 6 of
 * docs/ROLES_ACCESS_REVIEWS_MENTORSHIP_PLAN.md). No DB — the server module
 * `lib/org/missing-chapter.ts` consumes these.
 *
 * Every operational record is, conceptually, ASSIGNED to a chapter, GLOBAL
 * (intentionally org-wide), or MISSING (a temporary status that still needs a
 * chapter before it is fully set up).
 */

export type ChapterAssignment = "ASSIGNED" | "GLOBAL" | "MISSING";

export const CHAPTER_ASSIGNMENT_LABELS: Record<ChapterAssignment, string> = {
  ASSIGNED: "Assigned",
  GLOBAL: "Global",
  MISSING: "Missing Chapter",
};

export function chapterAssignmentLabel(status: ChapterAssignment): string {
  return CHAPTER_ASSIGNMENT_LABELS[status];
}

/**
 * Classify a record's chapter assignment. A record with a chapter is ASSIGNED;
 * one explicitly marked global is GLOBAL; otherwise — including an unresolved
 * Missing Chapter flag — it is MISSING.
 */
export function classifyChapterAssignment(input: {
  chapterId?: string | null;
  isGlobal?: boolean;
  hasUnresolvedMissingFlag?: boolean;
}): ChapterAssignment {
  if (input.chapterId) return "ASSIGNED";
  if (input.hasUnresolvedMissingFlag) return "MISSING";
  if (input.isGlobal) return "GLOBAL";
  return "MISSING";
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Whole days a record has been unresolved (never negative). */
export function missingChapterAgeDays(createdAt: Date, now: Date = new Date()): number {
  const diff = now.getTime() - createdAt.getTime();
  return Math.max(0, Math.floor(diff / MS_PER_DAY));
}

/** Compact age label: "today", "1 day", "12 days". */
export function formatMissingChapterAge(createdAt: Date, now: Date = new Date()): string {
  const days = missingChapterAgeDays(createdAt, now);
  if (days === 0) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
}
