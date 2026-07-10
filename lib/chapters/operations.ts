import "server-only";

import { prisma } from "@/lib/prisma";
import { loadChapterOS } from "@/lib/chapters/chapter-os";
import type { ChapterOSModel } from "@/lib/chapters/chapter-os";

const DAY = 86_400_000;
const OPEN_ACTIONS = ["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "OVERDUE"] as const;

export type OperationsMetric = { key: string; label: string; value: number; target: number; href: string };
export type OperationsDeadline = { id: string; dueAtISO: string; label: string; type: string; owner: string; status: string; href: string };

export function reportingPeriod(now: Date, type: "WEEKLY" | "MONTHLY") {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  if (type === "WEEKLY") start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  else start.setUTCDate(1);
  const end = new Date(type === "WEEKLY" ? start.getTime() + 7 * DAY : Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return { start, end };
}

function weekBuckets(now: Date) {
  const current = reportingPeriod(now, "WEEKLY").start;
  return Array.from({ length: 8 }, (_, index) => {
    const start = new Date(current.getTime() - (7 - index) * 7 * DAY);
    return { start, end: new Date(start.getTime() + 7 * DAY), label: start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) };
  });
}

export async function loadChapterOperations(chapterId: string, now = new Date(), existingModel?: ChapterOSModel) {
  const model = existingModel ?? await loadChapterOS(chapterId);
  if (!model) return null;
  const weekly = reportingPeriod(now, "WEEKLY");
  const monthly = reportingPeriod(now, "MONTHLY");
  const weeks = weekBuckets(now);
  const trendStart = weeks[0].start;

  const [targets, sessions, outreach, meetings, actions, partnerFollowUps, meetingFollowUps, reportHistory, classRows] = await Promise.all([
    prisma.chapterOperationsTarget.findUnique({ where: { chapterId } }),
    prisma.classSession.findMany({
      where: { offering: { chapterId }, date: { gte: trendStart, lt: weekly.end }, isCancelled: false },
      select: { id: true, date: true, offeringId: true, offering: { select: { title: true } }, attendance: { select: { status: true } } },
      orderBy: { date: "asc" },
    }),
    prisma.partnerNote.findMany({ where: { partner: { chapterId }, createdAt: { gte: trendStart, lt: weekly.end } }, select: { id: true, createdAt: true, partnerId: true } }),
    prisma.meeting.findMany({
      where: { chapterId, scheduledAt: { gte: trendStart, lt: weekly.end }, status: { not: "CANCELLED" } },
      select: { id: true, scheduledAt: true, title: true, type: true, status: true, facilitator: { select: { name: true } }, partnerId: true },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.actionItem.findMany({
      where: { chapterId },
      select: { id: true, title: true, status: true, deadlineStart: true, createdAt: true, completedAt: true, blockedReason: true, lead: { select: { name: true } } },
      orderBy: { deadlineStart: "asc" },
      take: 1000,
    }),
    prisma.partner.findMany({
      where: { chapterId, archivedAt: null, nextFollowUpAt: { not: null } },
      select: { id: true, name: true, nextFollowUpAt: true, relationshipLead: { select: { name: true } } },
      orderBy: { nextFollowUpAt: "asc" }, take: 100,
    }),
    prisma.meetingFollowUp.findMany({
      where: { meeting: { chapterId }, status: { not: "COMPLETED" }, dueDate: { not: null } },
      select: { id: true, title: true, status: true, dueDate: true, owner: { select: { name: true } }, meetingId: true },
      orderBy: { dueDate: "asc" }, take: 100,
    }),
    prisma.chapterOperationsReport.findMany({ where: { chapterId }, orderBy: { periodStart: "desc" }, take: 24 }),
    prisma.classOffering.findMany({
      where: { chapterId, status: { not: "CANCELLED" } },
      select: { id: true, title: true, capacity: true, status: true, enrollments: { where: { status: { in: ["ENROLLED", "COMPLETED"] } }, select: { id: true } }, sessions: { where: { isCancelled: false }, select: { attendance: { select: { status: true } } } } },
      orderBy: { startDate: "asc" },
    }),
  ]);

  const targetValues = targets ?? { activeStudentsTarget: 80, activeInstructorsTarget: 15, instructorPipelineTarget: 30, activePartnersTarget: 8, classesRunningTarget: 8 };
  const values = model.growth.current.values;
  const metrics: OperationsMetric[] = [
    { key: "students", label: "Active students", value: values.studentsEnrolled, target: targetValues.activeStudentsTarget, href: "/chapter?lane=students" },
    { key: "instructors", label: "Active instructors", value: values.instructorsHired, target: targetValues.activeInstructorsTarget, href: "/chapter?lane=instructors" },
    { key: "pipeline", label: "Instructor pipeline", value: values.instructorApplicants, target: targetValues.instructorPipelineTarget, href: "/chapter?lane=instructors" },
    { key: "partners", label: "Active partners", value: values.confirmedPartners, target: targetValues.activePartnersTarget, href: "/chapter?lane=partners" },
    { key: "classes", label: "Classes running", value: model.metrics.classesRunning, target: targetValues.classesRunningTarget, href: "/chapter?lane=instructors" },
  ];

  const weeklySessions = sessions.filter((s) => s.date >= weekly.start);
  const monthlySessions = sessions.filter((s) => s.date >= monthly.start);
  const attendanceRows = weeklySessions.flatMap((s) => s.attendance);
  const attended = attendanceRows.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;
  const attendanceRate = attendanceRows.length ? Math.round((attended / attendanceRows.length) * 100) : 0;
  const openActions = actions.filter((a) => OPEN_ACTIONS.includes(a.status as (typeof OPEN_ACTIONS)[number]));
  const overdueActions = openActions.filter((a) => a.deadlineStart < now);
  const blockedActions = openActions.filter((a) => a.status === "BLOCKED");
  const outreachThisWeek = outreach.filter((o) => o.createdAt >= weekly.start);
  const meetingsThisWeek = meetings.filter((m) => m.scheduledAt >= weekly.start);
  const nextMeeting = meetings.find((m) => m.scheduledAt >= now) ?? null;

  const deadlines: OperationsDeadline[] = [
    ...openActions.map((a) => ({ id: a.id, dueAtISO: a.deadlineStart.toISOString(), label: a.title, type: "Task", owner: a.lead.name, status: a.status, href: `/actions/${a.id}` })),
    ...partnerFollowUps.filter((p) => p.nextFollowUpAt).map((p) => ({ id: p.id, dueAtISO: p.nextFollowUpAt!.toISOString(), label: p.name, type: "Partner follow-up", owner: p.relationshipLead?.name ?? "Unassigned", status: p.nextFollowUpAt! < now ? "OVERDUE" : "OPEN", href: `/admin/partners/${p.id}` })),
    ...meetingFollowUps.filter((f) => f.dueDate).map((f) => ({ id: f.id, dueAtISO: f.dueDate!.toISOString(), label: f.title, type: "Meeting follow-up", owner: f.owner?.name ?? "Unassigned", status: f.status, href: `/meetings/${f.meetingId}` })),
  ].filter((d) => new Date(d.dueAtISO) >= new Date(now.getTime() - 90 * DAY)).sort((a, b) => a.dueAtISO.localeCompare(b.dueAtISO)).slice(0, 5);

  const activityTrend = weeks.map((w) => ({
    week: w.label,
    outreach: outreach.filter((o) => o.createdAt >= w.start && o.createdAt < w.end).length,
    sessions: sessions.filter((s) => s.date >= w.start && s.date < w.end).length,
    tasksCreated: actions.filter((a) => a.createdAt >= w.start && a.createdAt < w.end).length,
    tasksCompleted: actions.filter((a) => a.completedAt && a.completedAt >= w.start && a.completedAt < w.end).length,
  }));
  const attendanceDistribution = [0, 20, 40, 60, 80].map((lower) => ({
    range: lower === 80 ? "80–100%" : `${lower}–${lower + 19}%`,
    sessions: sessions.filter((s) => {
      const total = s.attendance.length;
      const rate = total ? (s.attendance.filter((a) => a.status === "PRESENT" || a.status === "LATE").length / total) * 100 : -1;
      return rate >= lower && (lower === 80 ? rate <= 100 : rate < lower + 20);
    }).length,
  }));
  const classes = classRows.map((c) => {
    const marks = c.sessions.flatMap((s) => s.attendance);
    const present = marks.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;
    return { id: c.id, name: c.title, capacity: c.capacity, enrolled: c.enrollments.length, attendance: marks.length ? Math.round((present / marks.length) * 100) : 0, href: `/admin/classes/${c.id}` };
  });

  const snapshot = {
    activeStudents: values.studentsEnrolled,
    newStudents: model.studentCommunity.metrics.enrolledCount,
    activeInstructors: values.instructorsHired,
    instructorPipeline: values.instructorApplicants,
    activePartners: values.confirmedPartners,
    classesRunning: model.metrics.classesRunning,
    sessionsHeld: weeklySessions.length,
    attendanceRate,
    outreachAttempts: outreachThisWeek.length,
    partnerMeetings: meetingsThisWeek.filter((m) => m.partnerId).length,
    meetings: meetingsThisWeek.length,
    openTasks: openActions.length,
    overdueTasks: overdueActions.length,
    blockedTasks: blockedActions.length,
    followUpsDue: partnerFollowUps.filter((p) => p.nextFollowUpAt && p.nextFollowUpAt <= weekly.end).length + meetingFollowUps.filter((f) => f.dueDate && f.dueDate <= weekly.end).length,
  };

  return { model, metrics, weeklyActivity: snapshot, deadlines, nextMeeting, activityTrend, attendanceDistribution, classes, reportHistory, periods: { weekly, monthly }, monthlySessions: monthlySessions.length };
}
