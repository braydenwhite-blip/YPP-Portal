import "server-only";

import { prisma } from "@/lib/prisma";
import { loadChapterOS } from "@/lib/chapters/chapter-os";
import type { ChapterOSModel } from "@/lib/chapters/chapter-os";
import { eightWeekBuckets, reportingPeriod } from "@/lib/chapters/operations-model";

const DAY = 86_400_000;
const OPEN_ACTIONS = ["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "OVERDUE"] as const;

export type OperationsMetric = { key: string; label: string; value: number; target: number; href: string };
export type OperationsDeadline = { id: string; dueAtISO: string; label: string; type: string; owner: string; status: string; href: string };

export async function loadChapterInstructorOperations(chapterId: string, now = new Date()) {
  const applications = await prisma.instructorApplication.findMany({
    where: { applicant: { chapterId } },
    select: { id: true, status: true, applicantId: true, applicant: { select: { name: true, instructorProfile: { select: { maxConcurrent: true } } } } },
    orderBy: { createdAt: "desc" }, take: 5000,
  });
  const activeIds = Array.from(new Set(applications.filter((a) => a.status === "APPROVED").map((a) => a.applicantId)));
  const [assignments, leadClasses, sessions, followUps] = await Promise.all([
    prisma.regularInstructorAssignment.findMany({ where: { chapterId, instructorId: { in: activeIds }, status: { notIn: ["DECLINED", "REMOVED"] } }, select: { instructorId: true, offeringId: true } }),
    prisma.classOffering.findMany({ where: { chapterId, instructorId: { in: activeIds }, status: { not: "CANCELLED" } }, select: { id: true, instructorId: true } }),
    prisma.classSession.findMany({ where: { offering: { chapterId, instructorId: { in: activeIds } }, isCancelled: false }, select: { date: true, offering: { select: { instructorId: true } } }, take: 10000 }),
    prisma.actionItem.findMany({ where: { chapterId, status: { in: [...OPEN_ACTIONS] } }, select: { leadId: true, relatedEntityType: true, relatedEntityId: true } }),
  ]);
  const pipelineOrder = ["SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED", "PRE_APPROVED", "INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED", "CHAIR_REVIEW", "APPROVED", "ON_HOLD", "WAITLISTED", "REJECTED", "WITHDRAWN"];
  const pipeline = pipelineOrder.map((status) => ({ status, label: status.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()), count: applications.filter((a) => a.status === status).length, href: "/chapter/recruiting?tab=candidates" })).filter((stage) => stage.count > 0 || !["REJECTED", "WITHDRAWN"].includes(stage.status));
  const workload = activeIds.map((id) => {
    const app = applications.find((a) => a.applicantId === id)!;
    const classIds = new Set([...leadClasses.filter((c) => c.instructorId === id).map((c) => c.id), ...assignments.filter((a) => a.instructorId === id).map((a) => a.offeringId)]);
    return {
      id,
      name: app.applicant.name,
      assignedClasses: classIds.size,
      maxConcurrent: app.applicant.instructorProfile?.maxConcurrent ?? 2,
      sessionsLed: sessions.filter((s) => s.offering.instructorId === id && s.date < now).length,
      upcomingSessions: sessions.filter((s) => s.offering.instructorId === id && s.date >= now).length,
      openFollowUps: followUps.filter((a) => a.leadId === id || (a.relatedEntityType === "USER" && a.relatedEntityId === id)).length,
      href: `/chapter/instructors/${id}`,
    };
  }).sort((a, b) => b.assignedClasses - a.assignedClasses || a.name.localeCompare(b.name));
  return { pipeline, workload };
}

export async function loadChapterPartnerOperations(chapterId: string) {
  const partners = await prisma.partner.findMany({ where: { chapterId, archivedAt: null }, select: { id: true, stage: true, agreements: { select: { status: true } } } });
  const stageOrder = ["NOT_STARTED", "RESEARCHING", "REACHED_OUT", "RESPONDED", "MEETING_SCHEDULED", "NEEDS_PROPOSAL", "PROPOSAL_SENT", "NEGOTIATING", "ACTIVE_PARTNERSHIP", "COMPLETED", "PAUSED", "NOT_A_FIT"];
  const pipeline = stageOrder.map((stage) => ({ stage, label: stage.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()), count: partners.filter((p) => (p.stage ?? "NOT_STARTED") === stage).length, href: "/partners" })).filter((row) => row.count > 0 || ["NOT_STARTED", "REACHED_OUT", "MEETING_SCHEDULED", "ACTIVE_PARTNERSHIP"].includes(row.stage));
  const agreementStages = [
    { stage: "NOT_STARTED", label: "Not started", count: partners.filter((p) => p.agreements.length === 0).length },
    { stage: "DRAFT", label: "Draft", count: partners.filter((p) => p.agreements.some((a) => a.status === "DRAFT")).length },
    { stage: "SENT", label: "Sent", count: partners.filter((p) => p.agreements.some((a) => a.status === "SENT")).length },
    { stage: "SIGNED", label: "Signed", count: partners.filter((p) => p.agreements.some((a) => a.status === "SIGNED")).length },
    { stage: "CLOSED", label: "Expired / terminated", count: partners.filter((p) => p.agreements.some((a) => a.status === "EXPIRED" || a.status === "TERMINATED")).length },
  ];
  return { pipeline, agreementStages };
}

export async function loadChapterStudentOperations(chapterId: string, now = new Date()) {
  const rows = await prisma.classEnrollment.findMany({ where: { offering: { chapterId } }, select: { studentId: true, enrolledAt: true, status: true, droppedAt: true }, take: 10000 });
  const totalIds = new Set(rows.map((r) => r.studentId));
  const activeIds = new Set(rows.filter((r) => r.status === "ENROLLED" || r.status === "COMPLETED").map((r) => r.studentId));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const cohorts = Array.from({ length: 6 }, (_, index) => {
    const start = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() - 5 + index, 1));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    const cohortIds = new Set(rows.filter((r) => r.enrolledAt >= start && r.enrolledAt < end).map((r) => r.studentId));
    return { month: start.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }), studentsAdded: cohortIds.size, currentlyActive: Array.from(cohortIds).filter((id) => activeIds.has(id)).length };
  });
  return { totalStudents: totalIds.size, activeStudents: activeIds.size, activeRateProxy: totalIds.size ? Math.round((activeIds.size / totalIds.size) * 100) : 0, cohorts };
}

export async function loadChapterOperations(chapterId: string, now = new Date(), existingModel?: ChapterOSModel) {
  const model = existingModel ?? await loadChapterOS(chapterId);
  if (!model) return null;
  const weekly = reportingPeriod(now, "WEEKLY");
  const monthly = reportingPeriod(now, "MONTHLY");
  const trendMonthStart = new Date(Date.UTC(monthly.start.getUTCFullYear(), monthly.start.getUTCMonth() - 11, 1));
  const weeks = eightWeekBuckets(now);
  const trendStart = weeks[0].start;

  const [targets, sessions, outreach, meetings, actions, partnerFollowUps, meetingFollowUps, reportHistory, classRows, monthlyNewInstructors, monthlyNewPartners, monthlyClassesStarted, monthlyGrowthRows, allPartners, instructorApplications, supportRequests] = await Promise.all([
    prisma.chapterOperationsTarget.findUnique({ where: { chapterId } }),
    prisma.classSession.findMany({
      where: { offering: { chapterId }, date: { gte: trendStart, lt: weekly.end }, isCancelled: false },
      select: { id: true, date: true, offeringId: true, topic: true, offering: { select: { title: true, instructor: { select: { id: true, name: true } }, enrollments: { where: { status: { in: ["ENROLLED", "COMPLETED"] } }, select: { id: true } } } }, attendance: { select: { status: true } }, reflection: { select: { needsCpHelp: true, logisticsIssue: true, wentWell: true, struggled: true } } },
      orderBy: { date: "asc" },
    }),
    prisma.partnerNote.findMany({ where: { partner: { chapterId }, createdAt: { gte: trendStart, lt: weekly.end } }, select: { id: true, createdAt: true, partnerId: true, kind: true, body: true, partner: { select: { name: true, nextFollowUpAt: true, relationshipLead: { select: { name: true } } } } }, orderBy: { createdAt: "desc" }, take: 1000 }),
    prisma.meeting.findMany({
      where: { chapterId, scheduledAt: { gte: trendStart, lt: new Date(now.getTime() + 90 * DAY) }, status: { not: "CANCELLED" } },
      select: { id: true, scheduledAt: true, title: true, type: true, status: true, purpose: true, agenda: true, proposal: true, sourceType: true, sourceId: true, facilitator: { select: { name: true } }, partnerId: true, partner: { select: { name: true } } },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.actionItem.findMany({
      where: { chapterId },
      select: { id: true, title: true, status: true, deadlineStart: true, nextFollowUpAt: true, actionType: true, relatedEntityType: true, createdAt: true, completedAt: true, blockedReason: true, lead: { select: { name: true } } },
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
      select: { id: true, title: true, capacity: true, status: true, startDate: true, instructorId: true, enrollments: { where: { status: { in: ["ENROLLED", "COMPLETED"] } }, select: { id: true, studentId: true, enrolledAt: true } }, sessions: { where: { isCancelled: false }, select: { attendance: { select: { status: true } } } } },
      orderBy: { startDate: "asc" },
    }),
    prisma.instructorApplication.count({ where: { applicant: { chapterId }, createdAt: { gte: monthly.start, lt: monthly.end }, status: { notIn: ["REJECTED", "WITHDRAWN"] } } }),
    prisma.partner.count({ where: { chapterId, archivedAt: null, createdAt: { gte: monthly.start, lt: monthly.end } } }),
    prisma.classOffering.count({ where: { chapterId, status: { not: "CANCELLED" }, startDate: { gte: monthly.start, lt: monthly.end } } }),
    Promise.all([
      prisma.classEnrollment.findMany({ where: { offering: { chapterId }, enrolledAt: { gte: trendMonthStart } }, select: { enrolledAt: true }, take: 5000 }),
      prisma.instructorApplication.findMany({ where: { applicant: { chapterId }, createdAt: { gte: trendMonthStart }, status: { notIn: ["REJECTED", "WITHDRAWN"] } }, select: { createdAt: true }, take: 5000 }),
      prisma.partner.findMany({ where: { chapterId, archivedAt: null, createdAt: { gte: trendMonthStart } }, select: { createdAt: true }, take: 5000 }),
      prisma.classOffering.findMany({ where: { chapterId, status: { not: "CANCELLED" }, startDate: { gte: trendMonthStart } }, select: { startDate: true }, take: 5000 }),
    ]),
    prisma.partner.findMany({ where: { chapterId, archivedAt: null }, select: { id: true, stage: true, createdAt: true } }),
    prisma.instructorApplication.findMany({ where: { applicant: { chapterId } }, select: { id: true, applicantId: true, status: true, approvedAt: true, createdAt: true }, take: 5000 }),
    prisma.chapterSupportRequest.findMany({ where: { chapterId, status: { in: ["OPEN", "IN_PROGRESS"] } }, select: { id: true, title: true, status: true, createdAt: true, assignedTo: { select: { name: true } } }, orderBy: { createdAt: "asc" }, take: 50 }),
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
  const meetingsThisWeek = meetings.filter((m) => m.scheduledAt >= weekly.start && m.scheduledAt < weekly.end);
  const nextSevenDays = new Date(now.getTime() + 7 * DAY);
  const meetingsNextSevenDays = meetings.filter((m) => m.scheduledAt >= now && m.scheduledAt < nextSevenDays);
  const nextMeetingRecord = meetings.find((m) => m.scheduledAt >= now) ?? null;
  const nextMeeting = nextMeetingRecord ? {
    ...nextMeetingRecord,
    relatedLabel: nextMeetingRecord.partner?.name ?? (nextMeetingRecord.sourceType ? `${nextMeetingRecord.sourceType.replaceAll("_", " ")} record` : null),
    preparationStatus: nextMeetingRecord.agenda || nextMeetingRecord.proposal ? "Preparation recorded" : "Preparation not recorded",
  } : null;

  const actionFollowUps = openActions.filter((a) => a.nextFollowUpAt);
  const actionFollowUpType = (action: (typeof actionFollowUps)[number]) => {
    if (action.relatedEntityType === "INSTRUCTOR_APPLICATION" || action.actionType === "INSTRUCTOR_RECRUITING" || action.actionType === "INSTRUCTOR_ONBOARDING") return "Instructor follow-up";
    if (action.relatedEntityType === "USER") return "Student / person follow-up";
    return "Task follow-up";
  };

  const deadlines: OperationsDeadline[] = [
    ...openActions.map((a) => ({ id: a.id, dueAtISO: a.deadlineStart.toISOString(), label: a.title, type: "Task", owner: a.lead.name, status: a.status, href: `/actions/${a.id}` })),
    ...actionFollowUps.map((a) => ({ id: a.id, dueAtISO: a.nextFollowUpAt!.toISOString(), label: a.title, type: actionFollowUpType(a), owner: a.lead.name, status: a.nextFollowUpAt! < now ? "OVERDUE" : "OPEN", href: `/actions/${a.id}` })),
    ...partnerFollowUps.filter((p) => p.nextFollowUpAt).map((p) => ({ id: p.id, dueAtISO: p.nextFollowUpAt!.toISOString(), label: p.name, type: "Partner follow-up", owner: p.relationshipLead?.name ?? "Unassigned", status: p.nextFollowUpAt! < now ? "OVERDUE" : "OPEN", href: `/admin/partners/${p.id}` })),
    ...meetingFollowUps.filter((f) => f.dueDate).map((f) => ({ id: f.id, dueAtISO: f.dueDate!.toISOString(), label: f.title, type: "Meeting follow-up", owner: f.owner?.name ?? "Unassigned", status: f.status, href: `/meetings/${f.meetingId}` })),
    ...meetingsNextSevenDays.map((m) => ({ id: m.id, dueAtISO: m.scheduledAt.toISOString(), label: m.title, type: "Meeting", owner: m.facilitator?.name ?? "Unassigned", status: m.status, href: `/meetings/${m.id}` })),
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
  const sessionLog = sessions.slice().sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 50).map((s) => {
    const attended = s.attendance.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;
    return { id: s.id, dateISO: s.date.toISOString(), classId: s.offeringId, className: s.offering.title, instructorId: s.offering.instructor.id, instructorName: s.offering.instructor.name, enrolled: s.offering.enrollments.length, attended, attendanceRate: s.attendance.length ? Math.round((attended / s.attendance.length) * 100) : 0, topic: s.topic, needsFollowUp: Boolean(s.reflection?.needsCpHelp || s.reflection?.logisticsIssue), followUpReason: s.reflection?.logisticsIssue ?? (s.reflection?.needsCpHelp ? "Instructor requested chapter support" : null), href: `/admin/classes/${s.offeringId}` };
  });
  const outreachLog = outreach.slice(0, 50).map((o) => ({ id: o.id, dateISO: o.createdAt.toISOString(), partnerId: o.partnerId, partnerName: o.partner.name, kind: o.kind, result: o.body, nextFollowUpISO: o.partner.nextFollowUpAt?.toISOString() ?? null, owner: o.partner.relationshipLead?.name ?? "Unassigned", href: `/admin/partners/${o.partnerId}` }));
  const discussionItems = [
    ...overdueActions.map((a) => ({ id: `overdue-${a.id}`, label: a.title, why: `Task is overdue${a.blockedReason ? ` and blocked: ${a.blockedReason}` : ""}.`, owner: a.lead.name, dueISO: a.deadlineStart.toISOString(), href: `/actions/${a.id}` })),
    ...blockedActions.filter((a) => !overdueActions.some((o) => o.id === a.id)).map((a) => ({ id: `blocked-${a.id}`, label: a.title, why: a.blockedReason ? `Blocked: ${a.blockedReason}` : "Task is marked blocked; no blocker explanation is recorded.", owner: a.lead.name, dueISO: a.deadlineStart.toISOString(), href: `/actions/${a.id}` })),
    ...sessionLog.filter((s) => s.needsFollowUp).map((s) => ({ id: `session-${s.id}`, label: `${s.className}: ${s.topic}`, why: s.followUpReason ?? "Session reflection requires chapter follow-up.", owner: s.instructorName, dueISO: null, href: s.href })),
    ...supportRequests.map((r) => ({ id: `support-${r.id}`, label: r.title, why: r.status === "IN_PROGRESS" ? "Support request is in progress and should be reviewed." : "Support request is waiting for leadership.", owner: r.assignedTo?.name ?? "Leadership unassigned", dueISO: null, href: "/chapter/settings" })),
  ].slice(0, 8);

  const newStudentsThisWeek = classRows.reduce((sum, c) => sum + c.enrollments.filter((e) => e.enrolledAt >= weekly.start && e.enrolledAt < weekly.end).length, 0);
  const newStudentsThisMonth = classRows.reduce((sum, c) => sum + c.enrollments.filter((e) => e.enrolledAt >= monthly.start && e.enrolledAt < monthly.end).length, 0);
  const snapshot = {
    activeStudents: values.studentsEnrolled,
    newStudents: newStudentsThisWeek,
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
    followUpsDue: actionFollowUps.filter((a) => a.nextFollowUpAt && a.nextFollowUpAt <= weekly.end).length + partnerFollowUps.filter((p) => p.nextFollowUpAt && p.nextFollowUpAt <= weekly.end).length + meetingFollowUps.filter((f) => f.dueDate && f.dueDate <= weekly.end).length,
    meetingsNextSevenDays: meetingsNextSevenDays.length,
    meetingFollowUpsDue: meetingFollowUps.filter((f) => f.dueDate && f.dueDate <= weekly.end).length,
  };

  const monthlyAttendanceRows = monthlySessions.flatMap((s) => s.attendance);
  const monthlyAttended = monthlyAttendanceRows.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;
  const monthlyActivity = {
    activeStudents: values.studentsEnrolled,
    newStudents: newStudentsThisMonth,
    activeInstructors: values.instructorsHired,
    newInstructors: monthlyNewInstructors,
    activePartners: values.confirmedPartners,
    newPartners: monthlyNewPartners,
    classesRunning: model.metrics.classesRunning,
    classesStarted: monthlyClassesStarted,
    sessionsHeld: monthlySessions.length,
    attendanceRate: monthlyAttendanceRows.length ? Math.round((monthlyAttended / monthlyAttendanceRows.length) * 100) : 0,
    outreachAttempts: outreach.filter((o) => o.createdAt >= monthly.start && o.createdAt < monthly.end).length,
    meetings: meetings.filter((m) => m.scheduledAt >= monthly.start && m.scheduledAt < monthly.end).length,
  };

  const [studentGrowth, instructorGrowth, partnerGrowth, classGrowth] = monthlyGrowthRows;
  const monthlyTrend = Array.from({ length: 12 }, (_, index) => {
    const start = new Date(Date.UTC(trendMonthStart.getUTCFullYear(), trendMonthStart.getUTCMonth() + index, 1));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    return {
      month: start.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }),
      students: studentGrowth.filter((r) => r.enrolledAt >= start && r.enrolledAt < end).length,
      instructors: instructorGrowth.filter((r) => r.createdAt >= start && r.createdAt < end).length,
      partners: partnerGrowth.filter((r) => r.createdAt >= start && r.createdAt < end).length,
      classes: classGrowth.filter((r) => r.startDate >= start && r.startDate < end).length,
    };
  });

  const recordRefs = {
    activeStudents: Array.from(new Set(classRows.flatMap((c) => c.enrollments.map((e) => e.studentId)))).map((id) => ({ id, href: `/chapter/students?studentId=${id}` })),
    activeInstructors: Array.from(new Set(instructorApplications.filter((a) => a.approvedAt).map((a) => a.applicantId))).map((id) => ({ id, href: `/chapter/instructors/${id}` })),
    instructorPipeline: instructorApplications.filter((a) => !["REJECTED", "WITHDRAWN"].includes(a.status)).map((a) => ({ id: a.id, href: `/admin/instructor-applicants/${a.id}` })),
    activePartners: allPartners.filter((p) => p.stage === "ACTIVE_PARTNERSHIP").map((p) => ({ id: p.id, href: `/admin/partners/${p.id}` })),
    classesRunning: classRows.filter((c) => c.status === "IN_PROGRESS").map((c) => ({ id: c.id, href: `/admin/classes/${c.id}` })),
    weeklySessions: weeklySessions.map((s) => ({ id: s.id, href: `/admin/classes/${s.offeringId}` })),
    monthlySessions: monthlySessions.map((s) => ({ id: s.id, href: `/admin/classes/${s.offeringId}` })),
    weeklyNewStudents: classRows.flatMap((c) => c.enrollments.filter((e) => e.enrolledAt >= weekly.start && e.enrolledAt < weekly.end).map((e) => ({ id: e.id, href: `/chapter/students?studentId=${e.studentId}` }))),
    monthlyNewStudents: classRows.flatMap((c) => c.enrollments.filter((e) => e.enrolledAt >= monthly.start && e.enrolledAt < monthly.end).map((e) => ({ id: e.id, href: `/chapter/students?studentId=${e.studentId}` }))),
    monthlyNewInstructors: instructorApplications.filter((a) => a.createdAt >= monthly.start && a.createdAt < monthly.end && !["REJECTED", "WITHDRAWN"].includes(a.status)).map((a) => ({ id: a.id, href: `/admin/instructor-applicants/${a.id}` })),
    monthlyNewPartners: allPartners.filter((p) => p.createdAt >= monthly.start && p.createdAt < monthly.end).map((p) => ({ id: p.id, href: `/admin/partners/${p.id}` })),
    monthlyClassesStarted: classRows.filter((c) => c.startDate >= monthly.start && c.startDate < monthly.end).map((c) => ({ id: c.id, href: `/admin/classes/${c.id}` })),
    weeklyOutreach: outreachThisWeek.map((o) => ({ id: o.id, href: `/admin/partners/${o.partnerId}` })),
    monthlyOutreach: outreach.filter((o) => o.createdAt >= monthly.start && o.createdAt < monthly.end).map((o) => ({ id: o.id, href: `/admin/partners/${o.partnerId}` })),
    weeklyMeetings: meetingsThisWeek.map((m) => ({ id: m.id, href: `/meetings/${m.id}` })),
    monthlyMeetings: meetings.filter((m) => m.scheduledAt >= monthly.start && m.scheduledAt < monthly.end).map((m) => ({ id: m.id, href: `/meetings/${m.id}` })),
    weeklyPartnerMeetings: meetingsThisWeek.filter((m) => m.partnerId).map((m) => ({ id: m.id, href: `/meetings/${m.id}` })),
    openTasks: openActions.map((a) => ({ id: a.id, href: `/actions/${a.id}` })),
    overdueTasks: overdueActions.map((a) => ({ id: a.id, href: `/actions/${a.id}` })),
    blockedTasks: blockedActions.map((a) => ({ id: a.id, href: `/actions/${a.id}` })),
    followUpsDue: [
      ...actionFollowUps.filter((a) => a.nextFollowUpAt && a.nextFollowUpAt <= weekly.end).map((a) => ({ id: a.id, href: `/actions/${a.id}` })),
      ...partnerFollowUps.filter((p) => p.nextFollowUpAt && p.nextFollowUpAt <= weekly.end).map((p) => ({ id: p.id, href: `/admin/partners/${p.id}` })),
      ...meetingFollowUps.filter((f) => f.dueDate && f.dueDate <= weekly.end).map((f) => ({ id: f.id, href: `/meetings/${f.meetingId}` })),
    ],
  };

  return { model, metrics, weeklyActivity: snapshot, monthlyActivity, monthlyTrend, deadlines, nextMeeting, discussionItems, activityTrend, attendanceDistribution, classes, sessionLog, outreachLog, recordRefs, reportHistory, periods: { weekly, monthly } };
}
