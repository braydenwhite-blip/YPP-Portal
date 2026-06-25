// Person 360 ↔ chapter involvement. Surfaces, for any person: chapters they lead
// (as Chapter President), their chapter membership, their Chapter President
// application, and concrete chapter contribution metrics.

import { prisma } from "@/lib/prisma";

export type PersonChapterInvolvement = Awaited<
  ReturnType<typeof loadPersonChapterInvolvement>
>;

export async function loadPersonChapterInvolvement(userId: string) {
  const [ledChapters, membership, application, chapterActionsOwned, chapterMeetingsLed, meetingsAttended] =
    await Promise.all([
      prisma.chapter.findMany({
        where: { presidentId: userId, archivedAt: null },
        select: {
          id: true,
          name: true,
          slug: true,
          lifecycleStatus: true,
          city: true,
          state: true,
          launchedAt: true,
          _count: { select: { users: true } },
        },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          chapterId: true,
          chapter: { select: { id: true, name: true, lifecycleStatus: true } },
        },
      }),
      prisma.chapterPresidentApplication.findFirst({
        where: { OR: [{ applicantId: userId }, { linkedPersonId: userId }] },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, createdAt: true },
      }),
      prisma.actionItem.count({
        where: {
          chapterId: { not: null },
          OR: [{ leadId: userId }, { assignments: { some: { userId } } }],
        },
      }),
      prisma.meeting.count({ where: { chapterId: { not: null }, facilitatorId: userId } }),
      prisma.meetingAttendee.count({
        where: { userId, present: true, meeting: { chapterId: { not: null } } },
      }),
    ]);

  const memberChapter =
    membership?.chapter && !ledChapters.some((c) => c.id === membership.chapter?.id)
      ? membership.chapter
      : null;

  if (ledChapters.length === 0 && !memberChapter && !application) {
    return null;
  }

  return {
    ledChapters,
    memberChapter,
    application,
    metrics: {
      chapterActionsOwned,
      chapterMeetingsLed,
      meetingsAttended,
    },
  };
}
