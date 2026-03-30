
import { mentorshipRequiresMonthlyReflection } from "@/lib/mentorship-canonical";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import {
  isInterviewGateEnforced,
  isNativeInstructorGateEnabled,
} from "@/lib/instructor-readiness";

export const UNMAPPED_INTEREST_AREA = "Unmapped";

export const ADMIN_ANALYTICS_DATE_RANGE_OPTIONS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
] as const;

export type AdminAnalyticsDateRange =
  (typeof ADMIN_ANALYTICS_DATE_RANGE_OPTIONS)[number]["value"];

type RawAnalyticsFilters = {
  dateRange?: string | string[] | null;
  chapterId?: string | string[] | null;
  interestArea?: string | string[] | null;
};

export type AdminPortalAnalyticsFilters = {
  dateRange: AdminAnalyticsDateRange;
  chapterId: string | null;
  interestArea: string | null;
  dateFrom: Date | null;
};

export type AnalyticsBreakdownRow = {
  chapterName: string;
  interestArea: string;
  count: number;
};

type ApplicationAnalyticsInput = {
  status: string;
  submittedAt: Date;
  interviewRequired: boolean;
  interviewCompleted: boolean;
  decisionApprovedAt: Date | null;
};

function average(numbers: number[]) {
  if (numbers.length === 0) return null;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function daysBetween(start: Date, end: Date) {
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
}

function asSingleValue(
  value: string | string[] | null | undefined
): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function buildDateFrom(
  dateRange: AdminAnalyticsDateRange,
  now = new Date()
): Date | null {
  if (dateRange === "all") return null;

  const days =
    dateRange === "7d" ? 7 : dateRange === "90d" ? 90 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function normalizeInterestAreaBucket(
  value: string | null | undefined
): string {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : UNMAPPED_INTEREST_AREA;
}

export function buildAdminPortalAnalyticsFilters(
  rawFilters: RawAnalyticsFilters,
  now = new Date()
): AdminPortalAnalyticsFilters {
  const dateRangeRaw = asSingleValue(rawFilters.dateRange);
  const chapterIdRaw = asSingleValue(rawFilters.chapterId);
  const interestAreaRaw = asSingleValue(rawFilters.interestArea);

  const validDateRanges = new Set<AdminAnalyticsDateRange>(
    ADMIN_ANALYTICS_DATE_RANGE_OPTIONS.map((option) => option.value)
  );

  const dateRange = validDateRanges.has(dateRangeRaw as AdminAnalyticsDateRange)
    ? (dateRangeRaw as AdminAnalyticsDateRange)
    : "30d";

  const chapterId = chapterIdRaw?.trim() ? chapterIdRaw.trim() : null;
  const interestArea = interestAreaRaw?.trim()
    ? normalizeInterestAreaBucket(interestAreaRaw)
    : null;

  return {
    dateRange,
    chapterId,
    interestArea,
    dateFrom: buildDateFrom(dateRange, now),
  };
}

export function buildAnalyticsBreakdownRows(
  rows: Array<{
    chapterName: string | null | undefined;
    interestArea: string | null | undefined;
    count?: number;
  }>
): AnalyticsBreakdownRow[] {
  const breakdown = new Map<string, AnalyticsBreakdownRow>();

  for (const row of rows) {
    const chapterName = row.chapterName?.trim() || "Unmapped";
    const interestArea = normalizeInterestAreaBucket(row.interestArea);
    const count = row.count ?? 1;
    const key = `${chapterName}::${interestArea}`;
    const existing = breakdown.get(key);

    if (existing) {
      existing.count += count;
      continue;
    }

    breakdown.set(key, {
      chapterName,
      interestArea,
      count,
    });
  }

  return Array.from(breakdown.values()).sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }

    if (left.chapterName !== right.chapterName) {
      return left.chapterName.localeCompare(right.chapterName);
    }

    return left.interestArea.localeCompare(right.interestArea);
  });
}

export function summarizeApplicationAnalytics(
  applications: ApplicationAnalyticsInput[]
) {
  const interviewRequiredCount = applications.filter(
    (application) => application.interviewRequired
  ).length;
  const interviewCompletedCount = applications.filter(
    (application) => application.interviewRequired && application.interviewCompleted
  ).length;
  const approvedDecisions = applications.filter(
    (application) => application.decisionApprovedAt
  );
  const averageDaysToDecision = average(
    approvedDecisions.map((application) =>
      daysBetween(application.submittedAt, application.decisionApprovedAt as Date)
    )
  );

  return {
    submitted: applications.length,
    underReview: applications.filter((application) => application.status === "UNDER_REVIEW")
      .length,
    interviewScheduled: applications.filter(
      (application) => application.status === "INTERVIEW_SCHEDULED"
    ).length,
    interviewCompleted: applications.filter(
      (application) => application.status === "INTERVIEW_COMPLETED"
    ).length,
    accepted: applications.filter((application) => application.status === "ACCEPTED").length,
    rejected: applications.filter((application) => application.status === "REJECTED").length,
    withdrawn: applications.filter((application) => application.status === "WITHDRAWN").length,
    interviewRequiredCount,
    interviewCompletedCount,
    interviewConversionPct:
      interviewRequiredCount === 0
        ? null
        : (interviewCompletedCount / interviewRequiredCount) * 100,
    approvedDecisionCount: approvedDecisions.length,
    averageDaysToDecision,
  };
}

async function requireAdmin() {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    throw new Error("Unauthorized - Admin access required");
  }
}

function matchesChapterFilter(
  filters: AdminPortalAnalyticsFilters,
  chapterId: string | null | undefined
) {
  return !filters.chapterId || chapterId === filters.chapterId;
}

function matchesInterestAreaFilter(
  filters: AdminPortalAnalyticsFilters,
  interestArea: string | null | undefined
) {
  return (
    !filters.interestArea ||
    normalizeInterestAreaBucket(interestArea) === filters.interestArea
  );
}

function matchesDateFrom(dateFrom: Date | null, value: Date) {
  return !dateFrom || value >= dateFrom;
}

function getOpenApplicationCount(status: string) {
  return ["SUBMITTED", "UNDER_REVIEW", "INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED"].includes(
    status
  );
}

function hasCompletedInterview(
  interviewSlots: Array<{ status: string }>
) {
  return interviewSlots.some((slot) => slot.status === "COMPLETED");
}

function getCurrentMonthWindow(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

function isTrackableRequiredModule(input: {
  videoUrl: string | null;
  videoProvider: string | null;
  requiresQuiz: boolean;
  requiresEvidence: boolean;
  checkpointCount: number;
  quizQuestionCount: number;
}) {
  const hasActionablePath =
    Boolean(input.videoUrl) ||
    input.checkpointCount > 0 ||
    input.requiresQuiz ||
    input.requiresEvidence;

  if (!hasActionablePath) return false;
  if (input.requiresQuiz && input.quizQuestionCount === 0) return false;
  if (input.videoUrl && !input.videoProvider) return false;
  if (
    input.videoUrl &&
    input.videoProvider &&
    !["YOUTUBE", "VIMEO", "CUSTOM"].includes(input.videoProvider)
  ) {
    return false;
  }

  return true;
}

export async function getAdminPortalAnalytics(rawFilters: RawAnalyticsFilters) {
  await requireAdmin();

  const filters = buildAdminPortalAnalyticsFilters(rawFilters);
  const { start: currentMonthStart, end: nextMonthStart } =
    getCurrentMonthWindow();
  const threeWeeksAgo = new Date(
    Date.now() - 21 * 24 * 60 * 60 * 1000
  );

  const [chapters, courseInterestAreas, pathwayInterestAreas, draftInterestAreas] =
    await prisma.$transaction([
      prisma.chapter.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.course.findMany({
        distinct: ["interestArea"],
        select: { interestArea: true },
      }),
      prisma.pathway.findMany({
        distinct: ["interestArea"],
        select: { interestArea: true },
      }),
      prisma.curriculumDraft.findMany({
        distinct: ["interestArea"],
        select: { interestArea: true },
      }),
    ]);

  const interestAreas = Array.from(
    new Set(
      [
        ...courseInterestAreas.map((item) => item.interestArea),
        ...pathwayInterestAreas.map((item) => item.interestArea),
        ...draftInterestAreas.map((item) => item.interestArea),
        UNMAPPED_INTEREST_AREA,
      ].map((value) => normalizeInterestAreaBucket(value))
    )
  ).sort((left, right) => left.localeCompare(right));

  const allApplications = await prisma.application.findMany({
    include: {
      position: {
        select: {
          type: true,
          chapterId: true,
          interviewRequired: true,
          chapter: { select: { name: true } },
        },
      },
      interviewSlots: {
        select: { status: true },
      },
      decision: {
        select: {
          accepted: true,
          decidedAt: true,
          hiringChairStatus: true,
          hiringChairAt: true,
        },
      },
    },
    orderBy: { submittedAt: "desc" },
  });

  const allInstructors = await prisma.user.findMany({
    where: {
      roles: {
        some: {
          role: "INSTRUCTOR",
        },
      },
    },
    select: {
      id: true,
      chapterId: true,
      chapter: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });

  const instructorIds = allInstructors.map((instructor) => instructor.id);

  const [
    requiredModules,
    trainingAssignments,
    interviewGates,
    offeringApprovals,
    evidenceSubmissions,
    curriculumDrafts,
    enrollments,
    pathwayRegistrations,
    activeMentorships,
    openMentorshipRequests,
    goalReviews,
  ] = await prisma.$transaction([
    prisma.trainingModule.findMany({
      where: { required: true },
      select: {
        id: true,
        videoUrl: true,
        videoProvider: true,
        requiresQuiz: true,
        requiresEvidence: true,
        checkpoints: {
          where: { required: true },
          select: { id: true },
        },
        quizQuestions: {
          select: { id: true },
        },
      },
    }),
    prisma.trainingAssignment.findMany({
      where: {
        userId: { in: instructorIds.length > 0 ? instructorIds : ["__none__"] },
      },
      select: {
        userId: true,
        moduleId: true,
        status: true,
      },
    }),
    prisma.instructorInterviewGate.findMany({
      where: {
        instructorId: { in: instructorIds.length > 0 ? instructorIds : ["__none__"] },
      },
      select: {
        instructorId: true,
        status: true,
      },
    }),
    prisma.classOfferingApproval.findMany({
      where: {
        status: { in: ["REQUESTED", "UNDER_REVIEW", "CHANGES_REQUESTED"] },
        offering: {
          instructorId: { in: instructorIds.length > 0 ? instructorIds : ["__none__"] },
        },
      },
      select: {
        status: true,
        requestedAt: true,
        offering: {
          select: {
            instructorId: true,
            chapterId: true,
            instructor: {
              select: {
                chapterId: true,
                chapter: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
    prisma.trainingEvidenceSubmission.findMany({
      where: {
        status: { in: ["PENDING_REVIEW", "REVISION_REQUESTED"] },
      },
      select: {
        status: true,
        createdAt: true,
        moduleId: true,
        user: {
          select: {
            chapterId: true,
            chapter: { select: { name: true } },
          },
        },
      },
    }),
    prisma.curriculumDraft.findMany({
      select: {
        authorId: true,
        status: true,
        interestArea: true,
        createdAt: true,
        submittedAt: true,
        approvedAt: true,
        author: {
          select: {
            chapterId: true,
            chapter: { select: { name: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.enrollment.findMany({
      select: {
        createdAt: true,
        course: {
          select: {
            chapterId: true,
            chapter: { select: { name: true } },
            interestArea: true,
          },
        },
      },
    }),
    prisma.pathwayEventRegistration.findMany({
      select: {
        userId: true,
        registeredAt: true,
        event: {
          select: {
            pathway: {
              select: {
                interestArea: true,
              },
            },
          },
        },
      },
    }),
    prisma.mentorship.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        programGroup: true,
        governanceMode: true,
        menteeId: true,
        mentee: {
          select: {
            chapterId: true,
            chapter: { select: { name: true } },
          },
        },
        sessions: {
          orderBy: { scheduledAt: "desc" },
          take: 3,
          select: {
            scheduledAt: true,
            completedAt: true,
          },
        },
        selfReflections: {
          where: {
            cycleMonth: {
              gte: currentMonthStart,
              lt: nextMonthStart,
            },
          },
          select: { id: true },
        },
      },
    }),
    prisma.mentorshipRequest.findMany({
      where: { status: "OPEN" },
      select: {
        requestedAt: true,
        mentee: {
          select: {
            chapterId: true,
            chapter: { select: { name: true } },
          },
        },
      },
    }),
    prisma.mentorGoalReview.findMany({
      select: {
        status: true,
        createdAt: true,
        chairApprovedAt: true,
        mentee: {
          select: {
            chapterId: true,
            chapter: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const pathwayRegistrationUserIds = Array.from(
    new Set(pathwayRegistrations.map((registration) => registration.userId))
  );
  const pathwayRegistrationUsers = await prisma.user.findMany({
    where: {
      id: {
        in: pathwayRegistrationUserIds.length > 0
          ? pathwayRegistrationUserIds
          : ["__none__"],
      },
    },
    select: {
      id: true,
      chapterId: true,
      chapter: { select: { name: true } },
    },
  });

  const pathwayRegistrationUserMap = new Map(
    pathwayRegistrationUsers.map((user) => [user.id, user])
  );

  const relevantApplications = allApplications.filter((application) =>
    matchesChapterFilter(filters, application.position.chapterId)
  );
  const recentApplications = relevantApplications.filter((application) =>
    matchesDateFrom(filters.dateFrom, application.submittedAt)
  );
  const currentReviewBacklog = relevantApplications.filter((application) =>
    getOpenApplicationCount(application.status)
  ).length;
  const currentPendingChairDecisions = relevantApplications.filter(
    (application) => application.decision?.hiringChairStatus === "PENDING_CHAIR"
  ).length;

  const recentApplicationSummary = summarizeApplicationAnalytics(
    recentApplications.map((application) => ({
      status: application.status,
      submittedAt: application.submittedAt,
      interviewRequired: application.position.interviewRequired,
      interviewCompleted: hasCompletedInterview(application.interviewSlots),
      decisionApprovedAt:
        application.decision?.hiringChairStatus === "APPROVED"
          ? application.decision.hiringChairAt ?? application.decision.decidedAt
          : null,
    }))
  );

  const applicationStatusBreakdown = Object.entries(
    relevantApplications.reduce<Record<string, number>>((counts, application) => {
      counts[application.status] = (counts[application.status] ?? 0) + 1;
      return counts;
    }, {})
  )
    .map(([status, count]) => ({ status, count }))
    .sort((left, right) => right.count - left.count);

  const positionTypeBreakdown = Object.entries(
    relevantApplications.reduce<Record<string, number>>((counts, application) => {
      counts[application.position.type] =
        (counts[application.position.type] ?? 0) + 1;
      return counts;
    }, {})
  )
    .map(([type, count]) => ({ type, count }))
    .sort((left, right) => right.count - left.count);

  const filteredInstructors = allInstructors.filter((instructor) =>
    matchesChapterFilter(filters, instructor.chapterId)
  );
  const filteredInstructorIds = new Set(
    filteredInstructors.map((instructor) => instructor.id)
  );
  const eligibleRequiredModuleIds = new Set(
    requiredModules
      .filter((module) =>
        isTrackableRequiredModule({
          videoUrl: module.videoUrl,
          videoProvider: module.videoProvider,
          requiresQuiz: module.requiresQuiz,
          requiresEvidence: module.requiresEvidence,
          checkpointCount: module.checkpoints.length,
          quizQuestionCount: module.quizQuestions.length,
        })
      )
      .map((module) => module.id)
  );

  const completedRequiredModuleCounts = new Map<string, number>();
  for (const assignment of trainingAssignments) {
    if (!filteredInstructorIds.has(assignment.userId)) continue;
    if (!eligibleRequiredModuleIds.has(assignment.moduleId)) continue;
    if (assignment.status !== "COMPLETE") continue;

    completedRequiredModuleCounts.set(
      assignment.userId,
      (completedRequiredModuleCounts.get(assignment.userId) ?? 0) + 1
    );
  }

  const interviewGateStatusByInstructor = new Map(
    interviewGates.map((gate) => [gate.instructorId, gate.status])
  );
  const nativeGateEnabled = isNativeInstructorGateEnabled();
  const interviewGateRequired = isInterviewGateEnforced();

  const studioCapstoneCompleteByInstructor = new Set(
    curriculumDrafts
      .filter((draft) => draft.status === "SUBMITTED" || draft.status === "APPROVED")
      .map((draft) => draft.authorId)
  );

  const readinessSnapshot = filteredInstructors.map((instructor) => {
    const completedRequiredModules =
      completedRequiredModuleCounts.get(instructor.id) ?? 0;
    const academyModulesComplete =
      eligibleRequiredModuleIds.size === 0
        ? true
        : completedRequiredModules >= eligibleRequiredModuleIds.size;
    const studioCapstoneComplete =
      studioCapstoneCompleteByInstructor.has(instructor.id);
    const trainingComplete = academyModulesComplete && studioCapstoneComplete;
    const interviewStatus =
      interviewGateStatusByInstructor.get(instructor.id) ?? "REQUIRED";
    const interviewPassed =
      !interviewGateRequired ||
      interviewStatus === "PASSED" ||
      interviewStatus === "WAIVED";
    const approvalReady =
      !nativeGateEnabled || (trainingComplete && interviewPassed);

    return {
      trainingComplete,
      interviewPassed,
      approvalReady,
    };
  });

  const currentApprovalQueue = offeringApprovals.filter((request) => {
    const targetChapterId =
      request.offering.chapterId || request.offering.instructor.chapterId;
    return matchesChapterFilter(filters, targetChapterId);
  });
  const currentEvidenceBacklog = evidenceSubmissions.filter((submission) =>
    matchesChapterFilter(filters, submission.user.chapterId)
  );
  const recentCurriculumDrafts = curriculumDrafts.filter((draft) => {
    if (!matchesChapterFilter(filters, draft.author.chapterId)) return false;
    if (!matchesInterestAreaFilter(filters, draft.interestArea)) return false;
    return matchesDateFrom(filters.dateFrom, draft.createdAt);
  });
  const currentCurriculumDrafts = curriculumDrafts.filter((draft) => {
    if (!matchesChapterFilter(filters, draft.author.chapterId)) return false;
    return matchesInterestAreaFilter(filters, draft.interestArea);
  });

  const curriculumStatusBreakdown = Object.entries(
    currentCurriculumDrafts.reduce<Record<string, number>>((counts, draft) => {
      counts[draft.status] = (counts[draft.status] ?? 0) + 1;
      return counts;
    }, {})
  )
    .map(([status, count]) => ({ status, count }))
    .sort((left, right) => right.count - left.count);

  const recentCourseEnrollments = enrollments.filter((enrollment) => {
    if (!matchesDateFrom(filters.dateFrom, enrollment.createdAt)) return false;
    if (!matchesChapterFilter(filters, enrollment.course.chapterId)) return false;
    return matchesInterestAreaFilter(filters, enrollment.course.interestArea);
  });

  const recentPathwayRegistrations = pathwayRegistrations.filter((registration) => {
    if (!matchesDateFrom(filters.dateFrom, registration.registeredAt)) return false;
    if (
      !matchesInterestAreaFilter(
        filters,
        registration.event.pathway.interestArea
      )
    ) {
      return false;
    }

    const registrant = pathwayRegistrationUserMap.get(registration.userId);
    return matchesChapterFilter(filters, registrant?.chapterId);
  });

  const courseEnrollmentBreakdown = buildAnalyticsBreakdownRows(
    recentCourseEnrollments.map((enrollment) => ({
      chapterName: enrollment.course.chapter?.name ?? null,
      interestArea: enrollment.course.interestArea,
    }))
  );

  const pathwayRegistrationBreakdown = buildAnalyticsBreakdownRows(
    recentPathwayRegistrations.map((registration) => {
      const registrant = pathwayRegistrationUserMap.get(registration.userId);
      return {
        chapterName: registrant?.chapter?.name ?? null,
        interestArea: registration.event.pathway.interestArea,
      };
    })
  );

  const filteredMentorships = activeMentorships.filter((mentorship) =>
    matchesChapterFilter(filters, mentorship.mentee.chapterId)
  );
  const staleMentorshipCount = filteredMentorships.filter((mentorship) => {
    const latestSession = mentorship.sessions[0] ?? null;
    const hasUpcomingSession = mentorship.sessions.some(
      (session) =>
        !session.completedAt && session.scheduledAt.getTime() > Date.now()
    );

    if (!latestSession) return true;

    const lastActivityAt = latestSession.completedAt ?? latestSession.scheduledAt;
    return !hasUpcomingSession && lastActivityAt < threeWeeksAgo;
  }).length;

  const overdueReflectionCount = filteredMentorships.filter((mentorship) => {
    if (
      !mentorshipRequiresMonthlyReflection({
        governanceMode: mentorship.governanceMode,
        programGroup: mentorship.programGroup,
      })
    ) {
      return false;
    }

    return mentorship.selfReflections.length === 0;
  }).length;

  const filteredOpenMentorshipRequests = openMentorshipRequests.filter((request) =>
    matchesChapterFilter(filters, request.mentee.chapterId)
  );
  const filteredGoalReviews = goalReviews.filter((review) =>
    matchesChapterFilter(filters, review.mentee.chapterId)
  );
  const reviewStatusBreakdown = Object.entries(
    filteredGoalReviews.reduce<Record<string, number>>((counts, review) => {
      counts[review.status] = (counts[review.status] ?? 0) + 1;
      return counts;
    }, {})
  )
    .map(([status, count]) => ({ status, count }))
    .sort((left, right) => right.count - left.count);

  const recentApprovedReviews = filteredGoalReviews.filter((review) => {
    if (review.status !== "APPROVED" || !review.chairApprovedAt) return false;
    return matchesDateFrom(filters.dateFrom, review.chairApprovedAt);
  });
  const averageChairApprovalDays = average(
    recentApprovedReviews.map((review) =>
      daysBetween(review.createdAt, review.chairApprovedAt as Date)
    )
  );
  const currentPendingChairReviews = filteredGoalReviews.filter(
    (review) => review.status === "PENDING_CHAIR_APPROVAL"
  ).length;

  return {
    filters,
    filterOptions: {
      dateRanges: ADMIN_ANALYTICS_DATE_RANGE_OPTIONS,
      chapters,
      interestAreas,
    },
    summary: {
      recentApplications: recentApplications.length,
      currentReviewBacklog,
      recentCourseEnrollments: recentCourseEnrollments.length,
      activeMentorships: filteredMentorships.length,
    },
    applications: {
      recent: recentApplicationSummary,
      currentReviewBacklog,
      currentPendingChairDecisions,
      statusBreakdown: applicationStatusBreakdown,
      positionTypeBreakdown,
    },
    readinessAndTraining: {
      currentSnapshot: {
        instructorCount: filteredInstructors.length,
        trainingComplete: readinessSnapshot.filter((entry) => entry.trainingComplete).length,
        interviewPassed: readinessSnapshot.filter((entry) => entry.interviewPassed).length,
        approvalReadyInstructors: readinessSnapshot.filter(
          (entry) => entry.approvalReady
        ).length,
        readinessBlockedInstructors: readinessSnapshot.filter(
          (entry) => !entry.approvalReady
        ).length,
        openApprovalQueue: currentApprovalQueue.length,
        openEvidenceBacklog: currentEvidenceBacklog.length,
        averageApprovalQueueAgeDays: average(
          currentApprovalQueue
            .map((request) => request.requestedAt)
            .filter((requestedAt): requestedAt is Date => requestedAt instanceof Date)
            .map((requestedAt) => daysBetween(requestedAt, new Date()))
        ),
      },
      curriculum: {
        currentStatusBreakdown: curriculumStatusBreakdown,
        recentCreated: recentCurriculumDrafts.length,
        recentSubmitted: recentCurriculumDrafts.filter((draft) =>
          draft.submittedAt ? matchesDateFrom(filters.dateFrom, draft.submittedAt) : false
        ).length,
        recentApproved: recentCurriculumDrafts.filter((draft) =>
          draft.approvedAt ? matchesDateFrom(filters.dateFrom, draft.approvedAt) : false
        ).length,
      },
    },
    registrations: {
      recentCourseEnrollments: recentCourseEnrollments.length,
      recentPathwayRegistrations: recentPathwayRegistrations.length,
      courseEnrollmentBreakdown,
      pathwayRegistrationBreakdown,
    },
    mentorship: {
      currentSnapshot: {
        activePairings: filteredMentorships.length,
        staleCircles: staleMentorshipCount,
        overdueReflections: overdueReflectionCount,
        openSupportRequests: filteredOpenMentorshipRequests.length,
        pendingChairReviews: currentPendingChairReviews,
      },
      reviews: {
        averageChairApprovalDays,
        recentApprovedCount: recentApprovedReviews.length,
        statusBreakdown: reviewStatusBreakdown,
      },
    },
  };
}
