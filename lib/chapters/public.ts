// Public-facing chapter network stats for the "Become a Chapter President"
// opportunity surface. Aggregate counts only — safe to show to any signed-in
// user, including applicants.

import type { ChapterLifecycleStatus, ChapterPresidentApplicationStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const OPERATING: ChapterLifecycleStatus[] = ["ACTIVE", "NEEDS_SUPPORT", "AT_RISK"];
const PRELAUNCH: ChapterLifecycleStatus[] = ["APPROVED", "LAUNCHING"];
const OPEN_APP_STATUSES: ChapterPresidentApplicationStatus[] = [
  "SUBMITTED",
  "INITIAL_REVIEW",
  "UNDER_REVIEW",
  "NEEDS_MORE_INFO",
  "INFO_REQUESTED",
  "INTERVIEW_NEEDED",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_COMPLETE",
  "INTERVIEW_COMPLETED",
  "DECISION_NEEDED",
  "RECOMMENDATION_SUBMITTED",
];

export async function loadPublicChapterStats() {
  const [activeChapters, launchingChapters, statefulChapters, studentsImpacted, applicationsInProgress] =
    await Promise.all([
      prisma.chapter.count({ where: { archivedAt: null, lifecycleStatus: { in: OPERATING } } }),
      prisma.chapter.count({ where: { archivedAt: null, lifecycleStatus: { in: PRELAUNCH } } }),
      prisma.chapter.findMany({
        where: { archivedAt: null, lifecycleStatus: { in: [...OPERATING, ...PRELAUNCH] } },
        select: { state: true },
      }),
      prisma.user.count({ where: { primaryRole: "STUDENT", chapter: { archivedAt: null } } }),
      prisma.chapterPresidentApplication.count({
        where: { archivedAt: null, status: { in: OPEN_APP_STATUSES } },
      }),
    ]);

  const statesRepresented = new Set(
    statefulChapters.map((c) => c.state).filter((s): s is string => !!s)
  ).size;

  return {
    activeChapters,
    launchingChapters,
    statesRepresented,
    studentsImpacted,
    applicationsInProgress,
  };
}
