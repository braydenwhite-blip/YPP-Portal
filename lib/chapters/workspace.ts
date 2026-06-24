// Single-chapter read model: everything the Chapter President workspace and the
// leadership chapter detail need in one call — lifecycle, setup, launch checklist
// (merged with the canonical template), meetings, chapter-scoped actions, support
// requests, leadership notes, members (with attendance), and programs/classes.

import { prisma } from "@/lib/prisma";
import { gatherChapterSignals, healthFromSignals } from "@/lib/chapters/signals";
import { readChecklistMeta } from "@/lib/chapters/provisioning";
import {
  LAUNCH_CHECKLIST_BY_KEY,
  summarizeLaunchProgress,
} from "@/lib/chapters/launch-checklist";
import { isLaunchingStatus } from "@/lib/chapters/lifecycle";

export type ChapterWorkspace = Awaited<ReturnType<typeof loadChapterWorkspace>>;

export async function loadChapterWorkspace(chapterId: string) {
  const now = new Date();

  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      state: true,
      region: true,
      partnerSchool: true,
      schoolType: true,
      lifecycleStatus: true,
      lifecycleNote: true,
      lifecycleUpdatedAt: true,
      facultyAdvisorName: true,
      facultyAdvisorEmail: true,
      foundingTeamNotes: true,
      recruitmentGoal: true,
      supportNeeded: true,
      launchTargetDate: true,
      expectedFirstMeetingAt: true,
      launchPlanText: true,
      launchPlanSubmittedAt: true,
      launchPlanApprovedAt: true,
      launchedAt: true,
      presidentId: true,
      president: { select: { id: true, name: true, email: true } },
    },
  });
  if (!chapter) return null;

  const [signalsMap, launchTasks, meetings, actions, supportRequests, notes, members, attendance, courses, events] =
    await Promise.all([
      gatherChapterSignals([chapterId], now),
      prisma.launchTask.findMany({
        where: { chapterId, scope: "CHAPTER" },
        orderBy: { sortOrder: "asc" },
        select: { id: true, title: true, status: true, dueDate: true, ownerLabel: true, metadata: true },
      }),
      prisma.meeting.findMany({
        where: { chapterId },
        orderBy: { scheduledAt: "desc" },
        take: 30,
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          scheduledAt: true,
          facilitator: { select: { id: true, name: true } },
          _count: { select: { attendees: true, decisions: true, followUps: true } },
        },
      }),
      prisma.actionItem.findMany({
        where: { chapterId },
        orderBy: [{ status: "asc" }, { deadlineStart: "asc" }],
        take: 50,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          deadlineStart: true,
          deadlineEnd: true,
          lead: { select: { id: true, name: true } },
        },
      }),
      prisma.chapterSupportRequest.findMany({
        where: { chapterId },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 30,
        select: {
          id: true,
          category: true,
          title: true,
          details: true,
          status: true,
          priority: true,
          createdAt: true,
          resolvedAt: true,
          requestedBy: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      }),
      prisma.chapterNote.findMany({
        where: { chapterId },
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        take: 30,
        select: {
          id: true,
          body: true,
          audience: true,
          pinned: true,
          createdAt: true,
          author: { select: { id: true, name: true } },
          aboutUserId: true,
        },
      }),
      prisma.user.findMany({
        where: { chapterId },
        orderBy: { name: "asc" },
        take: 500,
        select: {
          id: true,
          name: true,
          email: true,
          primaryRole: true,
          createdAt: true,
          roles: { select: { role: true } },
        },
      }),
      prisma.meetingAttendee.groupBy({
        by: ["userId"],
        where: { present: true, meeting: { chapterId } },
        _count: { _all: true },
      }),
      prisma.course.findMany({
        where: { chapterId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          title: true,
          format: true,
          leadInstructor: { select: { id: true, name: true } },
          _count: { select: { enrollments: true } },
        },
      }),
      prisma.event.findMany({
        where: { chapterId },
        orderBy: { startDate: "desc" },
        take: 20,
        select: { id: true, title: true, startDate: true, location: true },
      }),
    ]);

  const raw = signalsMap.get(chapterId)!;
  const health = healthFromSignals(raw, chapter.lifecycleStatus, chapter.launchTargetDate, now);

  // Merge LaunchTask rows with the canonical checklist definition.
  const launchItems = launchTasks.map((task) => {
    const meta = readChecklistMeta(task.metadata);
    const def = meta.key ? LAUNCH_CHECKLIST_BY_KEY[meta.key as keyof typeof LAUNCH_CHECKLIST_BY_KEY] : undefined;
    return {
      id: task.id,
      key: meta.key,
      actionItemId: meta.actionItemId,
      title: task.title,
      description: def?.description ?? null,
      owner: def?.owner ?? "cp",
      leadershipOnly: meta.key === "approve_launch_plan" || meta.key === "mark_active",
      ownerLabel: task.ownerLabel,
      dueDate: task.dueDate,
      done: task.status === "COMPLETE",
    };
  });
  const launchProgress = summarizeLaunchProgress(
    launchItems.filter((i) => i.done && i.key).map((i) => i.key as string)
  );

  const attendanceByUser = new Map<string, number>();
  for (const a of attendance) attendanceByUser.set(a.userId, a._count._all);

  const memberRows = members.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.primaryRole,
    roles: m.roles.map((r) => r.role),
    joinedAt: m.createdAt,
    meetingsAttended: attendanceByUser.get(m.id) ?? 0,
    isPresident: m.id === chapter.presidentId,
  }));

  const upcomingMeetings = meetings
    .filter((m) => m.scheduledAt.getTime() >= now.getTime())
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  const pastMeetings = meetings.filter((m) => m.scheduledAt.getTime() < now.getTime());

  const openActions = actions.filter(
    (a) => a.status === "NOT_STARTED" || a.status === "IN_PROGRESS" || a.status === "BLOCKED" || a.status === "OVERDUE"
  );

  // The chapter's single most important next step.
  let nextStep: string;
  if (isLaunchingStatus(chapter.lifecycleStatus) && launchProgress.nextItem) {
    nextStep = launchProgress.nextItem.title;
  } else if (raw.overdueActions > 0) {
    nextStep = `Clear ${raw.overdueActions} overdue action${raw.overdueActions === 1 ? "" : "s"}`;
  } else if (!raw.nextMeetingAt) {
    nextStep = "Schedule the next chapter meeting";
  } else {
    nextStep = "Keep momentum: run your next meeting";
  }

  return {
    chapter,
    health,
    nextStep,
    signals: raw,
    launch: { items: launchItems, progress: launchProgress },
    meetings: { upcoming: upcomingMeetings, past: pastMeetings },
    actions: { open: openActions, all: actions, overdueCount: raw.overdueActions },
    supportRequests,
    notes,
    members: memberRows,
    programs: {
      courses,
      events: {
        upcoming: events.filter((e) => e.startDate.getTime() >= now.getTime()),
        past: events.filter((e) => e.startDate.getTime() < now.getTime()),
      },
    },
  };
}
