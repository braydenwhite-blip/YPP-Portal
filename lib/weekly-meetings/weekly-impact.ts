/**
 * Weekly Impact form loaders. One entry per person, per reporting week, per
 * scope (team or chapter). Entries are created on demand when the person opens
 * the form for a week.
 */
import "server-only";

import { prisma } from "@/lib/prisma";
import type { Viewer } from "./permissions";
import { isOfficer } from "./permissions";
import {
  matchImpactMeetingForEntry,
  type ImpactMeetingHint,
} from "./impact-link";
import type { MeetingStatus, MeetingType } from "./meeting-types";
import { weekKey, weekLabel, weekStartFor } from "./week";

export type ImpactRowDTO = {
  id: string;
  type: string | null;
  whatGoal: string | null;
  evidenceNext: string | null;
  due: string | null; // YYYY-MM-DD
  rowStatus: "NOT_STARTED" | "IN_PROGRESS" | "BLOCKED" | "DONE";
  sortOrder: number;
  presentToMeeting: boolean;
  decisionNeeded: boolean;
  sendToBoard: boolean;
};

export type ImpactEntryDTO = {
  id: string;
  scope: "team" | "chapter";
  scopeId: string;
  scopeName: string;
  weekKey: string;
  weekLabel: string;
  status: "DRAFT" | "SUBMITTED";
  submittedAt: string | null;
  inputNeeded: string | null;
  rows: ImpactRowDTO[];
  /** Rows flagged to present at the meeting (curation count). */
  presentingCount: number;
  /** The live impact meeting this entry's presented rows feed, if scheduled. */
  meeting: ImpactMeetingHint | null;
};

export type MyWeeklyImpact = {
  weekKey: string;
  weekLabel: string;
  entries: ImpactEntryDTO[];
};

function toRowDTO(r: {
  id: string;
  type: string | null;
  whatGoal: string | null;
  evidenceNext: string | null;
  due: Date | null;
  rowStatus: ImpactRowDTO["rowStatus"];
  sortOrder: number;
  presentToMeeting: boolean;
  decisionNeeded: boolean;
  sendToBoard: boolean;
}): ImpactRowDTO {
  return {
    id: r.id,
    type: r.type,
    whatGoal: r.whatGoal,
    evidenceNext: r.evidenceNext,
    due: r.due ? r.due.toISOString().slice(0, 10) : null,
    rowStatus: r.rowStatus,
    sortOrder: r.sortOrder,
    presentToMeeting: r.presentToMeeting,
    decisionNeeded: r.decisionNeeded,
    sendToBoard: r.sendToBoard,
  };
}

/**
 * Loads (creating as needed) the viewer's Weekly Impact entries for a week:
 * one per active team they belong to, plus a chapter-scoped entry if they are
 * a chapter president with a chapter.
 */
export async function loadMyWeeklyImpact(
  viewer: Viewer,
  weekStart: Date = weekStartFor(),
): Promise<MyWeeklyImpact> {
  const memberships = await prisma.teamMembership.findMany({
    where: { userId: viewer.id, team: { status: "ACTIVE" } },
    include: { team: { select: { id: true, name: true, sortOrder: true } } },
  });

  const user = await prisma.user.findUnique({
    where: { id: viewer.id },
    select: { chapterId: true, primaryRole: true, chapter: { select: { id: true, name: true } } },
  });
  const isChapterPresident =
    viewer.primaryRole === "CHAPTER_PRESIDENT" || viewer.roles.includes("CHAPTER_PRESIDENT");

  // Ensure a team entry exists for each team membership.
  for (const m of memberships) {
    await prisma.weeklyImpactEntry.upsert({
      where: { userId_teamId_weekStart: { userId: viewer.id, teamId: m.team.id, weekStart } },
      create: { userId: viewer.id, teamId: m.team.id, weekStart },
      update: {},
    });
  }

  // Ensure a chapter entry for chapter presidents.
  if (isChapterPresident && user?.chapter) {
    await prisma.weeklyImpactEntry.upsert({
      where: { userId_chapterId_weekStart: { userId: viewer.id, chapterId: user.chapter.id, weekStart } },
      create: { userId: viewer.id, chapterId: user.chapter.id, weekStart },
      update: {},
    });
  }

  const entries = await prisma.weeklyImpactEntry.findMany({
    where: { userId: viewer.id, weekStart },
    include: {
      team: { select: { id: true, name: true } },
      chapter: { select: { id: true, name: true } },
      rows: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });

  // The live impact meetings that read this week's submissions, so the form can
  // tell the contributor exactly where their flagged rows will be presented.
  const liveMeetings = await prisma.meeting.findMany({
    where: {
      weekStart,
      type: { in: ["WEEKLY_TEAM_IMPACT", "CHAPTER_IMPACT"] },
      status: { in: ["SCHEDULED", "IN_PROGRESS"] },
    },
    select: {
      id: true,
      title: true,
      type: true,
      teamId: true,
      chapterId: true,
      status: true,
      scheduledAt: true,
    },
  });
  const meetingCandidates = liveMeetings.map((m) => ({
    id: m.id,
    title: m.title,
    type: m.type as MeetingType,
    teamId: m.teamId,
    chapterId: m.chapterId,
    status: m.status as MeetingStatus,
    scheduledISO: m.scheduledAt.toISOString(),
  }));

  return {
    weekKey: weekKey(weekStart),
    weekLabel: weekLabel(weekStart),
    entries: entries
      .map((e): ImpactEntryDTO | null => {
        const scope = e.teamId ? ("team" as const) : e.chapterId ? ("chapter" as const) : null;
        if (!scope) return null;
        const scopeId = e.teamId ?? e.chapterId!;
        const scopeName = e.team?.name ?? e.chapter?.name ?? "—";
        return {
          id: e.id,
          scope,
          scopeId,
          scopeName,
          weekKey: weekKey(weekStart),
          weekLabel: weekLabel(weekStart),
          status: e.status,
          submittedAt: e.submittedAt ? e.submittedAt.toISOString() : null,
          inputNeeded: e.inputNeeded,
          rows: e.rows.map(toRowDTO),
          presentingCount: e.rows.filter((r) => r.presentToMeeting).length,
          meeting: matchImpactMeetingForEntry({ scope, scopeId }, meetingCandidates),
        };
      })
      .filter((e): e is ImpactEntryDTO => e !== null),
  };
}

/** True when a viewer may fill weekly impact at all (has a team or is a CP). */
export async function viewerHasImpactScope(viewer: Viewer): Promise<boolean> {
  if (isOfficer(viewer)) return true;
  const count = await prisma.teamMembership.count({ where: { userId: viewer.id } });
  return count > 0;
}
