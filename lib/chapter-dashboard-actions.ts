"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { isRecoverablePrismaError, withPrismaFallback } from "@/lib/prisma-guard";
import {
  ACTIVE_INTERVIEW_REQUEST_STATUSES,
  getInterviewRequestAgeBase,
  isInterviewRequestAtRisk,
} from "@/lib/interview-scheduling-shared";

const FINAL_APPLICATION_STATUSES = ["ACCEPTED", "REJECTED", "WITHDRAWN"] as const;
const CLOSED_GATE_STATUSES = ["PASSED", "WAIVED", "COMPLETED", "FAILED"] as const;

type OpsCard = {
  id: string;
  queue:
    | "stale_interview_scheduling"
    | "today_next_interviews"
    | "student_intake_cases"
    | "join_requests"
    | "new_applications"
    | "inactive_members"
    | "upcoming_deadlines";
  title: string;
  subtitle: string;
  href: string;
  chapterName: string;
  ownerName: string;
  ageHours: number;
  status: string;
  nextAction: string;
  escalationState: string;
  scheduledAt: string | null;
};

function ageHoursFrom(date: Date, now: Date) {
  return Math.max(0, Math.round(((now.getTime() - date.getTime()) / 36e5) * 10) / 10);
}

async function requireChapterOperator() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true, chapter: { select: { id: true, name: true } } },
  });

  const isAdmin = user?.roles.some((role) => role.role === "ADMIN");
  const isChapterLead = user?.roles.some((role) => role.role === "CHAPTER_PRESIDENT");

  if (!user || (!isAdmin && !isChapterLead)) {
    throw new Error("Only Chapter Presidents and Admins can access this");
  }

  const scopeChapters = isAdmin
    ? await prisma.chapter.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : user.chapterId
    ? [{ id: user.chapterId, name: user.chapter?.name ?? "Chapter" }]
    : [];

  if (!isAdmin && scopeChapters.length === 0) {
    throw new Error("User is not assigned to a chapter");
  }

  return {
    user,
    isAdmin: !!isAdmin,
    primaryChapterId: user.chapterId ?? null,
    scopeChapters,
  };
}

export async function getCommandCenterData() {
  const { user, isAdmin, primaryChapterId, scopeChapters } = await requireChapterOperator();
  const scopeChapterIds = scopeChapters.map((chapter) => chapter.id);
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const staleThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const upcomingWindow = new Date(now.getTime() + 72 * 60 * 60 * 1000);
  const deadlineWindow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const primaryChapter = primaryChapterId
    ? await (async () => {
        try {
          return await prisma.chapter.findUnique({
            where: { id: primaryChapterId },
            select: {
              id: true,
              name: true,
              slug: true,
              tagline: true,
              logoUrl: true,
              bannerUrl: true,
            },
          });
        } catch (error) {
          if (!isRecoverablePrismaError(error)) {
            throw error;
          }

          const basicChapter = await prisma.chapter.findUnique({
            where: { id: primaryChapterId },
            select: { id: true, name: true, slug: true },
          });

          return basicChapter
            ? {
                ...basicChapter,
                tagline: null,
                logoUrl: null,
                bannerUrl: null,
              }
            : null;
        }
      })()
    : null;

  const [
    pendingJoinRequests,
    pendingApplications,
    pendingStudentIntakeCases,
    recentEnrollments,
    activeGoals,
    kpiSnapshots,
    allMembers,
    applicationsWithoutSchedule,
    gatesWithoutSchedule,
    staleRequests,
    bookedRequests,
    fallbackHiringBookings,
    fallbackReadinessBookings,
    upcomingEvents,
    upcomingPositionDeadlines,
    openPositionsCount,
    totalApplications,
    totalCourses,
  ] = await Promise.all([
    withPrismaFallback(
      "getCommandCenterData.pendingJoinRequests",
      async () =>
        prisma.chapterJoinRequest.findMany({
          where: {
            chapterId: { in: scopeChapterIds.length ? scopeChapterIds : ["__none__"] },
            status: "PENDING",
          },
          include: {
            user: { select: { id: true, name: true, email: true, primaryRole: true } },
            chapter: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "asc" },
          take: 12,
        }),
      () => [],
    ),
    prisma.application.findMany({
      where: {
        position: {
          chapterId: { in: scopeChapterIds.length ? scopeChapterIds : ["__none__"] },
          isOpen: true,
        },
        status: "SUBMITTED",
      },
      include: {
        applicant: { select: { id: true, name: true } },
        position: {
          select: { id: true, title: true, chapterId: true, chapter: { select: { name: true } } },
        },
      },
      orderBy: { submittedAt: "asc" },
      take: 12,
    }),
    prisma.studentIntakeCase.findMany({
      where: {
        chapterId: { in: scopeChapterIds.length ? scopeChapterIds : ["__none__"] },
        status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
      },
      include: {
        parent: { select: { id: true, name: true, email: true } },
        chapter: { select: { id: true, name: true } },
        reviewOwner: { select: { id: true, name: true } },
      },
      orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
      take: 12,
    }),
    prisma.enrollment.findMany({
      where: {
        course: { chapterId: { in: scopeChapterIds.length ? scopeChapterIds : ["__none__"] } },
        createdAt: { gte: thirtyDaysAgo },
      },
      include: {
        user: { select: { id: true, name: true } },
        course: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    primaryChapterId
      ? withPrismaFallback(
          "getCommandCenterData.activeGoals",
          async () =>
            prisma.chapterGoal.findMany({
              where: { chapterId: primaryChapterId, status: "ACTIVE" },
              orderBy: { createdAt: "desc" },
            }),
          () => [],
        )
      : [],
    primaryChapterId
      ? withPrismaFallback(
          "getCommandCenterData.kpiSnapshots",
          async () =>
            prisma.chapterKpiSnapshot.findMany({
              where: {
                chapterId: primaryChapterId,
                snapshotDate: { gte: new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000) },
              },
              orderBy: { snapshotDate: "asc" },
              select: {
                snapshotDate: true,
                activeStudents: true,
                activeInstructors: true,
                classesRunningCount: true,
                enrollmentFillPercent: true,
                retentionRate: true,
                newMembersThisWeek: true,
              },
            }),
          () => [],
        )
      : [],
    prisma.user.findMany({
      where: { chapterId: { in: scopeChapterIds.length ? scopeChapterIds : ["__none__"] } },
      select: {
        id: true,
        name: true,
        email: true,
        primaryRole: true,
        createdAt: true,
        updatedAt: true,
        chapter: { select: { name: true } },
      },
    }),
    prisma.application.findMany({
      where: {
        submittedAt: { lte: staleThreshold },
        status: { notIn: [...FINAL_APPLICATION_STATUSES] },
        position: {
          chapterId: { in: scopeChapterIds.length ? scopeChapterIds : ["__none__"] },
          interviewRequired: true,
        },
        interviewSlots: {
          none: { status: { in: ["CONFIRMED", "COMPLETED"] } },
        },
        schedulingRequests: {
          none: { status: { in: ACTIVE_INTERVIEW_REQUEST_STATUSES } },
        },
      },
      include: {
        applicant: { select: { id: true, name: true } },
        position: {
          select: {
            id: true,
            title: true,
            chapterId: true,
            chapter: { select: { name: true } },
          },
        },
      },
      orderBy: { submittedAt: "asc" },
      take: 12,
    }),
    prisma.instructorInterviewGate.findMany({
      where: {
        createdAt: { lte: staleThreshold },
        status: { notIn: [...CLOSED_GATE_STATUSES] },
        instructor: { chapterId: { in: scopeChapterIds.length ? scopeChapterIds : ["__none__"] } },
        slots: {
          none: { status: { in: ["CONFIRMED", "COMPLETED"] } },
        },
        schedulingRequests: {
          none: { status: { in: ACTIVE_INTERVIEW_REQUEST_STATUSES } },
        },
      },
      include: {
        instructor: {
          select: {
            id: true,
            name: true,
            chapterId: true,
            chapter: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 12,
    }),
    prisma.interviewSchedulingRequest.findMany({
      where: {
        chapterId: { in: scopeChapterIds.length ? scopeChapterIds : ["__none__"] },
        status: { in: ["REQUESTED", "RESCHEDULE_REQUESTED"] },
      },
      include: {
        interviewee: { select: { name: true } },
        interviewer: { select: { name: true } },
        application: {
          select: {
            id: true,
            position: { select: { title: true, chapter: { select: { name: true } } } },
          },
        },
        gate: {
          select: {
            id: true,
            instructor: { select: { name: true, chapter: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 20,
    }),
    prisma.interviewSchedulingRequest.findMany({
      where: {
        chapterId: { in: scopeChapterIds.length ? scopeChapterIds : ["__none__"] },
        status: "BOOKED",
        scheduledAt: { gte: now, lte: upcomingWindow },
      },
      include: {
        interviewee: { select: { name: true } },
        interviewer: { select: { name: true } },
        application: {
          select: {
            id: true,
            position: { select: { title: true, chapter: { select: { name: true } } } },
          },
        },
        gate: {
          select: {
            id: true,
            instructor: { select: { name: true, chapter: { select: { name: true } } } },
          },
        },
      },
      orderBy: { scheduledAt: "asc" },
      take: 20,
    }),
    prisma.interviewSlot.findMany({
      where: {
        status: "CONFIRMED",
        scheduledAt: { gte: now, lte: upcomingWindow },
        application: {
          position: { chapterId: { in: scopeChapterIds.length ? scopeChapterIds : ["__none__"] } },
          schedulingRequests: {
            none: { status: { in: ACTIVE_INTERVIEW_REQUEST_STATUSES } },
          },
        },
      },
      include: {
        interviewer: { select: { name: true } },
        application: {
          select: {
            id: true,
            applicant: { select: { name: true } },
            position: { select: { title: true, chapter: { select: { name: true } } } },
          },
        },
      },
      orderBy: { scheduledAt: "asc" },
      take: 12,
    }),
    prisma.instructorInterviewSlot.findMany({
      where: {
        status: "CONFIRMED",
        scheduledAt: { gte: now, lte: upcomingWindow },
        gate: {
          instructor: { chapterId: { in: scopeChapterIds.length ? scopeChapterIds : ["__none__"] } },
          schedulingRequests: {
            none: { status: { in: ACTIVE_INTERVIEW_REQUEST_STATUSES } },
          },
        },
      },
      include: {
        createdBy: { select: { name: true } },
        gate: {
          select: {
            id: true,
            instructor: { select: { name: true, chapter: { select: { name: true } } } },
          },
        },
      },
      orderBy: { scheduledAt: "asc" },
      take: 12,
    }),
    prisma.event.findMany({
      where: {
        chapterId: { in: scopeChapterIds.length ? scopeChapterIds : ["__none__"] },
        startDate: { gte: now, lte: deadlineWindow },
      },
      select: {
        id: true,
        title: true,
        startDate: true,
        chapter: { select: { name: true } },
      },
      orderBy: { startDate: "asc" },
      take: 12,
    }),
    prisma.position.findMany({
      where: {
        chapterId: { in: scopeChapterIds.length ? scopeChapterIds : ["__none__"] },
        isOpen: true,
        applicationDeadline: { not: null, gte: now, lte: deadlineWindow },
      },
      select: {
        id: true,
        title: true,
        applicationDeadline: true,
        chapter: { select: { name: true } },
      },
      orderBy: { applicationDeadline: "asc" },
      take: 12,
    }),
    prisma.position.count({
      where: {
        chapterId: { in: scopeChapterIds.length ? scopeChapterIds : ["__none__"] },
        isOpen: true,
      },
    }),
    prisma.application.count({
      where: {
        position: { chapterId: { in: scopeChapterIds.length ? scopeChapterIds : ["__none__"] } },
      },
    }),
    prisma.course.count({
      where: { chapterId: { in: scopeChapterIds.length ? scopeChapterIds : ["__none__"] } },
    }),
  ]);

  const instructors = allMembers.filter((member) => member.primaryRole === "INSTRUCTOR");
  const students = allMembers.filter((member) => member.primaryRole === "STUDENT");
  const mentors = allMembers.filter((member) => member.primaryRole === "MENTOR");
  const activeThisWeek = allMembers.filter((member) => new Date(member.updatedAt) >= sevenDaysAgo).length;
  const newMembers30d = allMembers.filter((member) => new Date(member.createdAt) >= thirtyDaysAgo).length;
  const inactiveMembers = allMembers
    .filter((member) => new Date(member.updatedAt) < fourteenDaysAgo)
    .sort((left, right) => left.updatedAt.getTime() - right.updatedAt.getTime());

  const staleInterviewScheduling: OpsCard[] = [
    ...applicationsWithoutSchedule.map((application) => ({
      id: `application:${application.id}`,
      queue: "stale_interview_scheduling" as const,
      title: `${application.position.title} interview still unscheduled`,
      subtitle: `${application.applicant.name} has been waiting for a first booking.`,
      href: `/interviews/schedule?domain=HIRING`,
      chapterName: application.position.chapter?.name ?? "Global",
      ownerName: application.position.chapter?.name ?? "Chapter team",
      ageHours: ageHoursFrom(application.submittedAt, now),
      status: "Unscheduled",
      nextAction: "Pick a live interviewer slot",
      escalationState: "Chapter queue",
      scheduledAt: null,
    })),
    ...gatesWithoutSchedule.map((gate) => ({
      id: `gate:${gate.id}`,
      queue: "stale_interview_scheduling" as const,
      title: "Instructor readiness interview still unscheduled",
      subtitle: `${gate.instructor.name} needs a readiness booking.`,
      href: `/interviews/schedule?domain=READINESS`,
      chapterName: gate.instructor.chapter?.name ?? "No chapter",
      ownerName: gate.instructor.chapter?.name ?? "Chapter team",
      ageHours: ageHoursFrom(gate.createdAt, now),
      status: "Unscheduled",
      nextAction: "Pick a live interviewer slot",
      escalationState: "Chapter queue",
      scheduledAt: null,
    })),
    ...staleRequests
      .filter((request) =>
        isInterviewRequestAtRisk({
          createdAt: request.createdAt,
          rescheduleRequestedAt: request.rescheduleRequestedAt,
          status: request.status,
          now,
        })
      )
      .map((request) => ({
        id: `request:${request.id}`,
        queue: "stale_interview_scheduling" as const,
        title:
          request.domain === "HIRING"
            ? `${request.application?.position.title ?? "Hiring"} scheduling is waiting`
            : "Readiness reschedule is waiting",
        subtitle: `${request.interviewee.name} and ${request.interviewer.name} need scheduling attention.`,
        href: `/interviews/schedule?domain=${request.domain}`,
        chapterName:
          request.application?.position.chapter?.name ??
          request.gate?.instructor.chapter?.name ??
          "Global",
        ownerName: request.interviewer.name,
        ageHours: ageHoursFrom(
          getInterviewRequestAgeBase({
            createdAt: request.createdAt,
            rescheduleRequestedAt: request.rescheduleRequestedAt,
          }),
          now
        ),
        status: request.status === "RESCHEDULE_REQUESTED" ? "Reschedule requested" : "Awaiting response",
        nextAction: request.status === "RESCHEDULE_REQUESTED" ? "Confirm a replacement slot" : "Close the booking loop",
        escalationState: request.adminEscalatedAt
          ? "Admin escalated"
          : request.chapterEscalatedAt
          ? "Chapter escalated"
          : "Within chapter queue",
        scheduledAt: request.scheduledAt?.toISOString() ?? null,
      })),
  ]
    .sort((left, right) => right.ageHours - left.ageHours)
    .slice(0, 12);

  const todayNextInterviewBookings: OpsCard[] = [
    ...bookedRequests.map((request) => ({
      id: `booking-request:${request.id}`,
      queue: "today_next_interviews" as const,
      title:
        request.domain === "HIRING"
          ? request.application?.position.title ?? "Hiring interview"
          : "Instructor readiness interview",
      subtitle: `${request.interviewee.name} with ${request.interviewer.name}`,
      href: `/interviews/schedule?domain=${request.domain}`,
      chapterName:
        request.application?.position.chapter?.name ??
        request.gate?.instructor.chapter?.name ??
        "Global",
      ownerName: request.interviewer.name,
      ageHours: request.scheduledAt ? Math.max(0, Math.round(((request.scheduledAt.getTime() - now.getTime()) / 36e5) * 10) / 10) : 0,
      status: "Booked",
      nextAction: "Run reminder cadence and keep thread warm",
      escalationState: "On track",
      scheduledAt: request.scheduledAt?.toISOString() ?? null,
    })),
    ...fallbackHiringBookings.map((slot) => ({
      id: `booking-hiring:${slot.id}`,
      queue: "today_next_interviews" as const,
      title: slot.application.position.title,
      subtitle: `${slot.application.applicant.name} with ${slot.interviewer?.name ?? "Assigned interviewer"}`,
      href: `/interviews/schedule?domain=HIRING`,
      chapterName: slot.application.position.chapter?.name ?? "Global",
      ownerName: slot.interviewer?.name ?? "Interviewer",
      ageHours: Math.max(0, Math.round(((slot.scheduledAt.getTime() - now.getTime()) / 36e5) * 10) / 10),
      status: "Booked",
      nextAction: "Run reminder cadence and keep thread warm",
      escalationState: "Legacy booking",
      scheduledAt: slot.scheduledAt.toISOString(),
    })),
    ...fallbackReadinessBookings.map((slot) => ({
      id: `booking-readiness:${slot.id}`,
      queue: "today_next_interviews" as const,
      title: "Instructor readiness interview",
      subtitle: `${slot.gate.instructor.name} with ${slot.createdBy.name}`,
      href: `/interviews/schedule?domain=READINESS`,
      chapterName: slot.gate.instructor.chapter?.name ?? "No chapter",
      ownerName: slot.createdBy.name,
      ageHours: Math.max(0, Math.round(((slot.scheduledAt.getTime() - now.getTime()) / 36e5) * 10) / 10),
      status: "Booked",
      nextAction: "Run reminder cadence and keep thread warm",
      escalationState: "Legacy booking",
      scheduledAt: slot.scheduledAt.toISOString(),
    })),
  ]
    .sort((left, right) => {
      if (!left.scheduledAt || !right.scheduledAt) return 0;
      return new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime();
    })
    .slice(0, 12);

  const joinRequestCards: OpsCard[] = pendingJoinRequests.map((request) => ({
    id: `join:${request.id}`,
    queue: "join_requests",
    title: `${request.user.name} wants to join`,
    subtitle: `${request.user.email} · ${request.user.primaryRole}`,
    href: "/chapter/settings",
    chapterName: request.chapter?.name ?? "Chapter",
    ownerName: request.chapter?.name ?? "Chapter team",
    ageHours: ageHoursFrom(request.createdAt, now),
    status: "Pending",
    nextAction: "Review the join request",
    escalationState: "In queue",
    scheduledAt: null,
  }));

  const studentIntakeCards: OpsCard[] = pendingStudentIntakeCases.map((intakeCase) => ({
    id: `student-intake:${intakeCase.id}`,
    queue: "student_intake_cases",
    title: `${intakeCase.studentName} student journey`,
    subtitle: `${intakeCase.parent.name} · ${intakeCase.studentEmail}`,
    href: `/chapter/student-intake#case-${intakeCase.id}`,
    chapterName: intakeCase.chapter.name,
    ownerName: intakeCase.reviewOwner?.name ?? "Needs owner",
    ageHours: ageHoursFrom(intakeCase.submittedAt ?? intakeCase.createdAt, now),
    status: intakeCase.status === "UNDER_REVIEW" ? "In review" : "Submitted",
    nextAction:
      intakeCase.nextAction ??
      (intakeCase.status === "UNDER_REVIEW" ? "Continue review" : "Open intake case"),
    escalationState: intakeCase.blockerNote
      ? "Blocked"
      : intakeCase.reviewOwner
      ? "Owned"
      : "Needs owner",
    scheduledAt: null,
  }));

  const applicationCards: OpsCard[] = pendingApplications.map((application) => ({
    id: `application-new:${application.id}`,
    queue: "new_applications",
    title: application.position.title,
    subtitle: `${application.applicant.name} submitted a new application.`,
    href: `/applications/${application.id}`,
    chapterName: application.position.chapter?.name ?? "Global",
    ownerName: application.position.chapter?.name ?? "Chapter team",
    ageHours: ageHoursFrom(application.submittedAt, now),
    status: "Submitted",
    nextAction: "Open the application workspace",
    escalationState: "Fresh intake",
    scheduledAt: null,
  }));

  const inactiveMemberCards: OpsCard[] = inactiveMembers.slice(0, 12).map((member) => ({
    id: `inactive:${member.id}`,
    queue: "inactive_members",
    title: member.name,
    subtitle: `${member.email} · ${member.primaryRole.replace(/_/g, " ")}`,
    href: "/chapter/students",
    chapterName: member.chapter?.name ?? "Chapter",
    ownerName: member.chapter?.name ?? "Chapter team",
    ageHours: ageHoursFrom(member.updatedAt, now),
    status: "Inactive",
    nextAction: "Follow up or re-engage",
    escalationState: "Member pulse",
    scheduledAt: null,
  }));

  const deadlineCards: OpsCard[] = [
    ...upcomingEvents.map((event) => ({
      id: `event:${event.id}`,
      queue: "upcoming_deadlines" as const,
      title: event.title,
      subtitle: "Upcoming chapter event",
      href: "/chapter/calendar",
      chapterName: event.chapter?.name ?? "Chapter",
      ownerName: event.chapter?.name ?? "Chapter team",
      ageHours: Math.max(0, Math.round(((event.startDate.getTime() - now.getTime()) / 36e5) * 10) / 10),
      status: "Upcoming",
      nextAction: "Review prep and staffing",
      escalationState: "Calendar",
      scheduledAt: event.startDate.toISOString(),
    })),
    ...upcomingPositionDeadlines
      .filter((position) => position.applicationDeadline)
      .map((position) => ({
        id: `deadline:${position.id}`,
        queue: "upcoming_deadlines" as const,
        title: `${position.title} application deadline`,
        subtitle: "Open recruiting deadline",
        href: "/chapter/recruiting",
        chapterName: position.chapter?.name ?? "Chapter",
        ownerName: position.chapter?.name ?? "Chapter team",
        ageHours: position.applicationDeadline
          ? Math.max(0, Math.round(((position.applicationDeadline.getTime() - now.getTime()) / 36e5) * 10) / 10)
          : 0,
        status: "Upcoming",
        nextAction: "Check pipeline and outreach",
        escalationState: "Recruiting",
        scheduledAt: position.applicationDeadline?.toISOString() ?? null,
      })),
  ]
    .sort((left, right) => {
      if (!left.scheduledAt || !right.scheduledAt) return 0;
      return new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime();
    })
    .slice(0, 12);

  const actionItems = [
    {
      type: "stale_interview_scheduling",
      label: "Stale interview scheduling",
      count: staleInterviewScheduling.length,
      href: "/interviews/schedule",
      priority: 1,
    },
    {
      type: "today_next_interviews",
      label: "Today and next interviews",
      count: todayNextInterviewBookings.length,
      href: "/interviews/schedule",
      priority: 2,
    },
    {
      type: "student_intake_cases",
      label: "Student intake cases",
      count: studentIntakeCards.length,
      href: "/chapter/student-intake",
      priority: 3,
    },
    {
      type: "join_requests",
      label: "Join requests",
      count: joinRequestCards.length,
      href: "/chapter/settings",
      priority: 4,
    },
    {
      type: "new_applications",
      label: "New applications",
      count: applicationCards.length,
      href: "/chapter/recruiting",
      priority: 5,
    },
    {
      type: "inactive_members",
      label: "Inactive members",
      count: inactiveMemberCards.length,
      href: "/chapter/students",
      priority: 6,
    },
    {
      type: "upcoming_deadlines",
      label: "Upcoming deadlines and events",
      count: deadlineCards.length,
      href: "/chapter/calendar",
      priority: 7,
    },
  ].filter((item) => item.count > 0);

  return {
    scope: {
      isAdmin,
      label: isAdmin ? "Admin Oversight" : user.chapter?.name ?? "Chapter OS",
      chapterCount: scopeChapters.length,
      primaryChapterId,
    },
    chapter: primaryChapter,
    stats: {
      totalMembers: allMembers.length,
      totalInstructors: instructors.length,
      totalStudents: students.length,
      totalMentors: mentors.length,
      totalCourses,
      upcomingEvents: upcomingEvents.length,
      openPositions: openPositionsCount,
      totalApplications,
      activeThisWeek,
      newMembers30d,
      inactiveMemberCount: inactiveMembers.length,
      staleInterviewScheduling: staleInterviewScheduling.length,
      nextInterviewBookings: todayNextInterviewBookings.length,
      pendingStudentIntakeCases: studentIntakeCards.length,
    },
    actionItems,
    pendingJoinRequests,
    pendingApplications,
    recentEnrollments,
    activeGoals,
    kpiSnapshots,
    members: allMembers,
    inactiveMembers: inactiveMembers.slice(0, 5),
    upcomingEvents,
    opsQueues: {
      staleInterviewScheduling,
      todayNextInterviewBookings,
      studentIntakeCases: studentIntakeCards,
      joinRequests: joinRequestCards,
      newApplications: applicationCards,
      inactiveMembers: inactiveMemberCards,
      upcomingDeadlines: deadlineCards,
    },
  };
}
