// Batched chapter operating signals + health. One set of grouped queries powers
// both the single-chapter workspace and the multi-chapter leadership command, so
// there's no per-chapter N+1.

import { prisma } from "@/lib/prisma";
import {
  computeChapterHealth,
  type ChapterHealth,
} from "@/lib/chapters/health";

export type ChapterRawSignals = {
  memberCount: number;
  lastMeetingAt: Date | null;
  nextMeetingAt: Date | null;
  openActions: number;
  overdueActions: number;
  openSupportRequests: number;
  launchTotal: number;
  launchDone: number;
};

function emptySignals(): ChapterRawSignals {
  return {
    memberCount: 0,
    lastMeetingAt: null,
    nextMeetingAt: null,
    openActions: 0,
    overdueActions: 0,
    openSupportRequests: 0,
    launchTotal: 0,
    launchDone: 0,
  };
}

/** Gather operating signals for a set of chapters in a handful of grouped queries. */
export async function gatherChapterSignals(
  chapterIds: string[],
  now: Date
): Promise<Map<string, ChapterRawSignals>> {
  const out = new Map<string, ChapterRawSignals>();
  if (chapterIds.length === 0) return out;
  for (const id of chapterIds) out.set(id, emptySignals());

  const [members, meetings, actions, supports, launchTasks] = await Promise.all([
    prisma.user.groupBy({
      by: ["chapterId"],
      where: { chapterId: { in: chapterIds } },
      _count: { _all: true },
    }),
    prisma.meeting.findMany({
      where: { chapterId: { in: chapterIds } },
      select: { chapterId: true, scheduledAt: true, status: true },
    }),
    prisma.actionItem.findMany({
      where: { chapterId: { in: chapterIds } },
      select: { chapterId: true, status: true, deadlineStart: true, deadlineEnd: true },
    }),
    prisma.chapterSupportRequest.groupBy({
      by: ["chapterId"],
      where: { chapterId: { in: chapterIds }, status: { in: ["OPEN", "IN_PROGRESS"] } },
      _count: { _all: true },
    }),
    prisma.launchTask.findMany({
      where: { chapterId: { in: chapterIds }, scope: "CHAPTER" },
      select: { chapterId: true, status: true },
    }),
  ]);

  for (const m of members) {
    if (!m.chapterId) continue;
    const s = out.get(m.chapterId);
    if (s) s.memberCount = m._count._all;
  }
  for (const mt of meetings) {
    if (!mt.chapterId) continue;
    const s = out.get(mt.chapterId);
    if (!s) continue;
    const t = mt.scheduledAt;
    if (t.getTime() <= now.getTime()) {
      if (!s.lastMeetingAt || t > s.lastMeetingAt) s.lastMeetingAt = t;
    } else if (mt.status === "SCHEDULED" || mt.status === "IN_PROGRESS") {
      if (!s.nextMeetingAt || t < s.nextMeetingAt) s.nextMeetingAt = t;
    }
  }
  for (const a of actions) {
    if (!a.chapterId) continue;
    const s = out.get(a.chapterId);
    if (!s) continue;
    const open =
      a.status === "NOT_STARTED" ||
      a.status === "IN_PROGRESS" ||
      a.status === "BLOCKED" ||
      a.status === "OVERDUE";
    if (open) {
      s.openActions += 1;
      const due = a.deadlineEnd ?? a.deadlineStart;
      if (due && due.getTime() < now.getTime()) s.overdueActions += 1;
    }
  }
  for (const sr of supports) {
    if (!sr.chapterId) continue;
    const s = out.get(sr.chapterId);
    if (s) s.openSupportRequests = sr._count._all;
  }
  for (const lt of launchTasks) {
    if (!lt.chapterId) continue;
    const s = out.get(lt.chapterId);
    if (!s) continue;
    s.launchTotal += 1;
    if (lt.status === "COMPLETE") s.launchDone += 1;
  }

  return out;
}

/** Turn raw signals + lifecycle/launch-target into a computed health label. */
export function healthFromSignals(
  raw: ChapterRawSignals,
  lifecycleStatus: string,
  launchTargetDate: Date | null,
  now: Date
): ChapterHealth {
  return computeChapterHealth({
    lifecycleStatus,
    memberCount: raw.memberCount,
    lastMeetingAt: raw.lastMeetingAt,
    nextMeetingAt: raw.nextMeetingAt,
    openActions: raw.openActions,
    overdueActions: raw.overdueActions,
    programsCompleted: 0,
    openSupportRequests: raw.openSupportRequests,
    launchChecklistTotal: raw.launchTotal,
    launchChecklistDone: raw.launchDone,
    launchTargetDate,
    daysSinceCpActivity: null,
    now,
  });
}
