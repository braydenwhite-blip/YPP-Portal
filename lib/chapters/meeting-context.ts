/**
 * Chapter context for the meeting runner. When a Meeting is scoped to a chapter
 * (Meeting.chapterId), the existing runner becomes chapter-aware: it shows who
 * the Chapter President is, the chapter's active goals, and its open chapter
 * actions — so a chapter meeting is run with the chapter's operating picture in
 * front of you, not a generic blank meeting. Read-only; no parallel data model.
 */
import "server-only";

import { prisma } from "@/lib/prisma";
import { chapterLifecycleLabel, type ChapterLifecycle } from "./lifecycle";

export type ChapterMeetingContext = {
  id: string;
  name: string;
  lifecycleStatus: string;
  lifecycleLabel: string;
  president: { id: string; name: string } | null;
  memberCount: number;
  activeGoals: Array<{
    id: string;
    title: string;
    targetValue: number;
    currentValue: number;
    unit: string;
  }>;
  /** Open (not complete/dropped) chapter actions, soonest deadline first. */
  openActions: Array<{
    id: string;
    title: string;
    status: string;
    dueISO: string | null;
    owner: { id: string; name: string } | null;
  }>;
  openActionCount: number;
  detailHref: string;
};

const OPEN_ACTION_STATUSES = ["COMPLETE", "DROPPED"] as const;

/**
 * Load the chapter operating picture for a chapter-scoped meeting. Returns null
 * when the chapter no longer exists, so the runner simply omits the panel.
 */
export async function loadChapterMeetingContext(
  chapterId: string
): Promise<ChapterMeetingContext | null> {
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: {
      id: true,
      name: true,
      lifecycleStatus: true,
      president: { select: { id: true, name: true } },
      _count: { select: { users: true } },
      goals: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          title: true,
          targetValue: true,
          currentValue: true,
          unit: true,
        },
        orderBy: { createdAt: "asc" },
        take: 5,
      },
    },
  });
  if (!chapter) return null;

  const [openActions, openActionCount] = await Promise.all([
    prisma.actionItem.findMany({
      where: { chapterId, status: { notIn: [...OPEN_ACTION_STATUSES] } },
      select: {
        id: true,
        title: true,
        status: true,
        deadlineStart: true,
        deadlineEnd: true,
        lead: { select: { id: true, name: true } },
      },
      orderBy: { deadlineStart: "asc" },
      take: 8,
    }),
    prisma.actionItem.count({
      where: { chapterId, status: { notIn: [...OPEN_ACTION_STATUSES] } },
    }),
  ]);

  return {
    id: chapter.id,
    name: chapter.name,
    lifecycleStatus: chapter.lifecycleStatus,
    lifecycleLabel: chapterLifecycleLabel(chapter.lifecycleStatus as ChapterLifecycle),
    president: chapter.president
      ? { id: chapter.president.id, name: chapter.president.name }
      : null,
    memberCount: chapter._count.users,
    activeGoals: chapter.goals.map((g) => ({
      id: g.id,
      title: g.title,
      targetValue: g.targetValue,
      currentValue: g.currentValue,
      unit: g.unit,
    })),
    openActions: openActions.map((a) => ({
      id: a.id,
      title: a.title,
      status: a.status,
      dueISO: (a.deadlineEnd ?? a.deadlineStart)?.toISOString() ?? null,
      owner: a.lead ? { id: a.lead.id, name: a.lead.name } : null,
    })),
    openActionCount,
    detailHref: `/admin/chapters/${chapter.id}`,
  };
}
