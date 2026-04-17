import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  getEnabledFeatureKeysForUserCached,
  rolesToSortedCsv,
} from "@/lib/feature-gates-request-cache";
import { getDashboardModulesForRole } from "@/lib/dashboard/catalog";
import { resolveDashboardRole } from "@/lib/dashboard/resolve-dashboard";
import type {
  ChecklistItemData,
  DashboardData,
  DashboardKpi,
  DashboardNextAction,
  DashboardQueueCard,
  DashboardQueueStatus,
  DashboardRole,
  InstructorReadinessSummary,
  JourneyMilestoneData,
  NudgeItemData,
} from "@/lib/dashboard/types";
import { getActiveNudges, generateContextualNudges } from "@/lib/nudge-engine";
import {
  getUnreadDirectMessageCountCached,
  getUnreadNotificationCountCached,
} from "@/lib/server-request-cache";
import { ensureAutoUnlockAndGetSections } from "@/lib/unlock-request-cache";
import { getInstructorReadiness, buildFallbackInstructorReadiness, isInterviewGateEnforced } from "@/lib/instructor-readiness";
import { getRecommendedActivitiesForUser } from "@/lib/activity-hub/actions";
import { getStudentChapterJourneyData } from "@/lib/chapter-pathway-journey";
import { withPrismaFallback } from "@/lib/prisma-guard";
import {
  isStudentFullPortalExplorerEnabled,
  STUDENT_V1_ALLOWLIST_VERSION,
} from "@/lib/navigation/student-v1-allowlist";

const FINAL_APPLICATION_STATUSES = ["ACCEPTED", "REJECTED", "WITHDRAWN"] as const;

function formatStudentActionDateLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function queueStatus(count: number, overdueThreshold = 10): DashboardQueueStatus {
  if (count <= 0) return "healthy";
  if (count >= overdueThreshold) return "overdue";
  return "needs_action";
}

function urgencyFromQueueStatus(status: DashboardQueueStatus): "high" | "medium" | "low" {
  if (status === "overdue") return "high";
  if (status === "needs_action") return "medium";
  return "low";
}

function roleLabel(role: DashboardRole): string {
  return role.replace(/_/g, " ");
}

function buildMessagesNextAction(unreadMessages: number): DashboardNextAction {
  return {
    id: "shared-messages",
    title: unreadMessages > 0 ? "Review your unread messages" : "Open your message hub",
    detail:
      unreadMessages > 0
        ? `${unreadMessages} conversation${unreadMessages === 1 ? "" : "s"} need your attention.`
        : "Keep direct, parent, and interview conversations easy to find in one inbox.",
    href: "/messages",
  };
}

function ensureMessagesNextAction(
  nextActions: DashboardNextAction[],
  unreadMessages: number
): DashboardNextAction[] {
  const filtered = nextActions.filter((action) => action.href !== "/messages");
  return [buildMessagesNextAction(unreadMessages), ...filtered];
}

async function buildDashboardData(userId: string, requestedPrimaryRole: string | null): Promise<DashboardData> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      primaryRole: true,
      chapterId: true,
      roles: {
        select: {
          role: true,
        },
      },
      awards: {
        select: {
          type: true,
        },
        take: 1,
      },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const roleTypes = user.roles.map((entry) => entry.role);
  const role = resolveDashboardRole({
    primaryRole: requestedPrimaryRole ?? user.primaryRole,
    roles: roleTypes,
  });
  const hasAward = user.awards.length > 0;
  const needsUnlockedSections = role === "STUDENT" || role === "PARENT";

  const [enabledFeatureKeys, unlockedSections] = await Promise.all([
    getEnabledFeatureKeysForUserCached(
      userId,
      user.chapterId,
      rolesToSortedCsv(roleTypes),
      role,
    ).catch(() => []),
    needsUnlockedSections
      ? ensureAutoUnlockAndGetSections(userId).catch(() => undefined)
      : Promise.resolve(undefined),
  ]);

  const [{ modules, sections }, unreadNotifications, unreadMessages, myOpenChapterProposals] = await Promise.all([
    Promise.resolve(
      getDashboardModulesForRole(role, {
        hasAward,
        unlockedSections,
        enabledFeatureKeys: new Set(enabledFeatureKeys),
        studentFullPortalExplorer: isStudentFullPortalExplorerEnabled(),
      })
    ),
    getUnreadNotificationCountCached(userId),
    getUnreadDirectMessageCountCached(userId),
    prisma.application.count({
      where: {
        applicantId: userId,
        position: {
          type: "CHAPTER_PRESIDENT",
          chapterId: null,
        },
        status: { notIn: [...FINAL_APPLICATION_STATUSES] },
      },
    }),
  ]);

  const moduleBadgeByHref: Record<string, number> = {
    "/notifications": unreadNotifications,
    "/messages": unreadMessages,
    "/chapters/propose": myOpenChapterProposals,
    chapter_proposals: myOpenChapterProposals,
  };

  let heroTitle = `${roleLabel(role)} Command Center`;
  let heroSubtitle = "Everything for your primary role, with live queues and direct actions.";
  let kpis: DashboardKpi[] = [];
  let queues: DashboardQueueCard[] = [];
  let nextActions: DashboardNextAction[] = [];
  let dashboardActivePathways: import("@/lib/dashboard/types").ActivePathwaySummary[] | undefined = undefined;
  let instructorReadiness: InstructorReadinessSummary | undefined = undefined;

  if (role === "ADMIN") {
    const [
      pendingParentApprovals,
      pendingAppDecisions,
      pendingHiringDecisions,
      trainingEvidenceQueue,
      readinessReviewQueue,
      waitlistWaiting,
      chapterProposalQueue,
      pendingIncubatorApplications,
      draftChallenges,
      scheduledChallenges,
    ] = await Promise.all([
      prisma.parentStudent.count({ where: { approvalStatus: "PENDING" } }),
      prisma.application.count({
        where: {
          decision: null,
          status: { notIn: [...FINAL_APPLICATION_STATUSES] },
        },
      }),
      prisma.decision.count({
        where: {
          hiringChairStatus: "PENDING_CHAIR",
        },
      }),
      withPrismaFallback(
        "dashboard:admin:training-evidence-queue",
        () =>
          prisma.trainingEvidenceSubmission.count({
            where: {
              status: { in: ["PENDING_REVIEW", "REVISION_REQUESTED"] },
            },
          }),
        0
      ),
      withPrismaFallback(
        "dashboard:admin:readiness-review-queue",
        () =>
          prisma.readinessReviewRequest.count({
            where: {
              status: { in: ["REQUESTED", "UNDER_REVIEW", "REVISION_REQUESTED"] },
            },
          }),
        0
      ),
      prisma.waitlistEntry.count({ where: { status: "WAITING" } }),
      prisma.application.count({
        where: {
          decision: null,
          status: { notIn: [...FINAL_APPLICATION_STATUSES] },
          position: {
            type: "CHAPTER_PRESIDENT",
            chapterId: null,
          },
        },
      }),
      prisma.incubatorApplication.count({
        where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
      }).catch(() => 0),
      prisma.challenge.count({ where: { status: "DRAFT" } }).catch(() => 0),
      prisma.challenge.count({
        where: {
          status: "DRAFT",
          startDate: { gt: new Date() },
        },
      }).catch(() => 0),
    ]);

    heroTitle = "Admin Operations Command Center";
    heroSubtitle = "Keep high-priority approvals and readiness queues moving daily.";

    kpis = [
      { id: "pending_parent_approvals", label: "Pending Parent Approvals", value: pendingParentApprovals },
      { id: "pending_app_decisions", label: "Pending Application Decisions", value: pendingAppDecisions },
      { id: "pending_hiring_decisions", label: "Chair Hiring Reviews", value: pendingHiringDecisions },
      { id: "pending_incubator_applications", label: "Incubator Reviews", value: pendingIncubatorApplications },
      { id: "chapter_proposal_queue", label: "Chapter Proposals", value: chapterProposalQueue },
      { id: "training_evidence_queue", label: "Training Evidence Queue", value: trainingEvidenceQueue },
      { id: "waitlist_waiting", label: "Waitlist Waiting", value: waitlistWaiting },
      { id: "draft_challenges", label: "Draft Challenges", value: draftChallenges },
      { id: "scheduled_challenges", label: "Scheduled Challenges", value: scheduledChallenges },
    ];

    queues = [
      {
        id: "pending_parent_approvals",
        title: "Parent Approval Queue",
        description: "Review parent-student link requests.",
        count: pendingParentApprovals,
        href: "/admin/parent-approvals",
        status: queueStatus(pendingParentApprovals, 12),
        badgeKey: "pending_parent_approvals",
      },
      {
        id: "pending_app_decisions",
        title: "Application Decision Queue",
        description: "Prepare interview-complete applications for recommendation submission.",
        count: pendingAppDecisions,
        href: "/interviews?scope=hiring&view=team&state=needs_action",
        status: queueStatus(pendingAppDecisions, 20),
        badgeKey: "pending_app_decisions",
      },
      {
        id: "pending_hiring_decisions",
        title: "Hiring Chair Queue",
        description: "Approve or return submitted hiring recommendations.",
        count: pendingHiringDecisions,
        href: "/admin/hiring-committee",
        status: queueStatus(pendingHiringDecisions, 12),
        badgeKey: "pending_hiring_decisions",
      },
      {
        id: "chapter_proposal_queue",
        title: "Chapter Proposal Queue",
        description: "Review proposals for new chapters and chapter president founders.",
        count: chapterProposalQueue,
        href: "/interviews?scope=hiring&view=team&state=needs_action",
        status: queueStatus(chapterProposalQueue, 8),
        badgeKey: "chapter_proposal_queue",
      },
      {
        id: "training_evidence_queue",
        title: "Training Evidence Review",
        description: "Review submitted evidence and request revisions.",
        count: trainingEvidenceQueue,
        href: "/admin/instructor-readiness",
        status: queueStatus(trainingEvidenceQueue, 15),
        badgeKey: "training_evidence_queue",
      },
      {
        id: "readiness_review_queue",
        title: "Readiness Review Queue",
        description: "Clear readiness requests to unblock first publish.",
        count: readinessReviewQueue,
        href: "/admin/instructor-readiness",
        status: queueStatus(readinessReviewQueue, 10),
        badgeKey: "readiness_review_queue",
      },
      {
        id: "waitlist_waiting",
        title: "Waitlist Queue",
        description: "Process waiting students into open seats.",
        count: waitlistWaiting,
        href: "/admin/waitlist",
        status: queueStatus(waitlistWaiting, 30),
        badgeKey: "waitlist_waiting",
      },
      {
        id: "pending_incubator_applications",
        title: "Incubator Application Reviews",
        description: "Applications waiting review decisions.",
        count: pendingIncubatorApplications,
        href: "/admin/incubator",
        status: queueStatus(pendingIncubatorApplications, 10),
        badgeKey: "pending_incubator_applications",
      },
      {
        id: "draft_challenges",
        title: "Challenge Publish Queue",
        description: "Draft or scheduled challenges still unpublished.",
        count: draftChallenges,
        href: "/admin/challenges",
        status: queueStatus(draftChallenges, 12),
        badgeKey: "draft_challenges",
      },
    ];

    nextActions = queues
      .filter((queue) => queue.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((queue) => ({
        id: `action-${queue.id}`,
        title: queue.title,
        detail: `${queue.count} pending — review now`,
        href: queue.href,
        urgency: urgencyFromQueueStatus(queue.status),
        ctaLabel: "Review",
      }));

    if (nextActions.length === 0) {
      nextActions.push({
        id: "admin-steady-state",
        title: "All queues are clear",
        detail: "No urgent admin actions right now.",
        href: "/admin/analytics",
        urgency: "low" as const,
      });
    }

    moduleBadgeByHref["/admin/parent-approvals"] = pendingParentApprovals;
    moduleBadgeByHref["/admin/applications"] = pendingAppDecisions;
    moduleBadgeByHref["/admin/recruiting"] = pendingAppDecisions;
    moduleBadgeByHref["/admin/applications?type=CHAPTER_PRESIDENT&chapterProposal=true"] = chapterProposalQueue;
    moduleBadgeByHref["/interviews"] = pendingAppDecisions;
    moduleBadgeByHref["/admin/instructor-readiness"] = trainingEvidenceQueue + readinessReviewQueue;
    moduleBadgeByHref["/admin/waitlist"] = waitlistWaiting;
    moduleBadgeByHref["/admin/incubator"] = pendingIncubatorApplications;
    moduleBadgeByHref["/admin/challenges"] = draftChallenges;
  } else if (role === "CHAPTER_PRESIDENT") {
    const hasChapterLeadAccess = roleTypes.includes("CHAPTER_PRESIDENT") || roleTypes.includes("ADMIN");

    if (!hasChapterLeadAccess || !user.chapterId) {
      heroTitle = "Chapter Command Center";
      heroSubtitle = "Chapter assignment is required before chapter operations can load.";

      kpis = [
        { id: "chapter_open_positions", label: "Open Positions", value: 0 },
        { id: "chapter_interview_queue", label: "Interview Queue", value: 0 },
        { id: "chapter_decision_ready", label: "Decision Ready", value: 0 },
        { id: "chapter_readiness_blockers", label: "Readiness Blockers", value: 0 },
      ];

      queues = [
        {
          id: "chapter_assignment_required",
          title: "Chapter assignment required",
          description: "Ask admin to assign your account to a chapter.",
          count: 1,
          href: "/chapter",
          status: "overdue",
        },
      ];

      nextActions = [
        {
          id: "chapter-assignment",
          title: "Resolve chapter assignment",
          detail: "You need a chapter assignment before chapter queues can load.",
          href: "/chapter",
        },
      ];
    } else {
      const chapterId = user.chapterId;

      const [
        openPositions,
        interviewQueueCount,
        unresolvedApplications,
        requiredModuleIds,
        chapterInstructors,
      ] = await Promise.all([
        prisma.position.count({ where: { chapterId, isOpen: true } }),
        prisma.interviewSlot.count({
          where: {
            application: {
              position: {
                chapterId,
              },
            },
            status: { in: ["POSTED", "CONFIRMED"] },
          },
        }),
        prisma.application.findMany({
          where: {
            position: { chapterId },
            decision: null,
            status: { not: "WITHDRAWN" },
          },
          select: {
            id: true,
            position: { select: { interviewRequired: true } },
            interviewSlots: { select: { status: true } },
            interviewNotes: { select: { recommendation: true } },
          },
        }),
        withPrismaFallback(
          "dashboard:chapter:required-modules",
          () =>
            prisma.trainingModule.findMany({
              where: { required: true },
              select: { id: true },
            }),
          []
        ),
        withPrismaFallback(
          "dashboard:chapter:instructors",
          () =>
            prisma.user.findMany({
              where: {
                chapterId,
                roles: { some: { role: "INSTRUCTOR" } },
              },
              select: {
                id: true,
                trainings: {
                  where: { module: { required: true } },
                  select: {
                    moduleId: true,
                    status: true,
                  },
                },
                interviewGate: {
                  select: { status: true },
                },
              },
            }),
          []
        ),
      ]);

      const chapterInstructorIds = chapterInstructors.map((instructor) => instructor.id);

      const decisionReadyCount = unresolvedApplications.filter((application) => {
        if (!application.position.interviewRequired) return true;
        const hasCompletedInterview = application.interviewSlots.some((slot) => slot.status === "COMPLETED");
        const hasRecommendation = application.interviewNotes.some((note) => note.recommendation !== null);
        return hasCompletedInterview && hasRecommendation;
      }).length;

      const requiredSet = new Set(requiredModuleIds.map((module) => module.id));
      const interviewEnforced = isInterviewGateEnforced();
      const readinessBlockerCount = chapterInstructors.filter((instructor) => {
        const completedRequired = new Set(
          instructor.trainings
            .filter((assignment) => assignment.status === "COMPLETE")
            .map((assignment) => assignment.moduleId)
        );

        const academyModulesComplete = Array.from(requiredSet).every((moduleId) =>
          completedRequired.has(moduleId)
        );
        const trainingComplete = academyModulesComplete;
        const interviewStatus = instructor.interviewGate?.status ?? "REQUIRED";
        const interviewPassed =
          !interviewEnforced || interviewStatus === "PASSED" || interviewStatus === "WAIVED";

        return !trainingComplete || !interviewPassed;
      }).length;

      heroTitle = "Chapter Operations Command Center";
      heroSubtitle = "Run openings, interviews, decisions, and instructor readiness from one place.";

      kpis = [
        { id: "chapter_open_positions", label: "Open Positions", value: openPositions },
        { id: "chapter_interview_queue", label: "Interview Queue", value: interviewQueueCount },
        { id: "chapter_decision_ready", label: "Decision Ready", value: decisionReadyCount },
        { id: "chapter_readiness_blockers", label: "Readiness Blockers", value: readinessBlockerCount },
      ];

      queues = [
        {
          id: "chapter_interview_queue",
          title: "Interview Queue",
          description: "Posted and confirmed interviews waiting reviewer action.",
          count: interviewQueueCount,
          href: "/interviews?scope=hiring&view=team&state=needs_action",
          status: queueStatus(interviewQueueCount, 10),
          badgeKey: "chapter_interview_queue",
        },
        {
          id: "chapter_decision_ready",
          title: "Decision Queue",
          description: "Candidates ready for final hiring decisions.",
          count: decisionReadyCount,
          href: "/chapter/recruiting?tab=decisions",
          status: queueStatus(decisionReadyCount, 8),
          badgeKey: "chapter_decision_ready",
        },
        {
          id: "chapter_open_positions",
          title: "Openings",
          description: "Manage open chapter positions and visibility.",
          count: openPositions,
          href: "/chapter/recruiting?tab=positions",
          status: queueStatus(openPositions, 99),
          badgeKey: "chapter_open_positions",
        },
        {
          id: "chapter_readiness_blockers",
          title: "Instructor Readiness Blockers",
          description: "Instructors blocked by training/interview requirements.",
          count: readinessBlockerCount,
          href: "/chapter-lead/instructor-readiness",
          status: queueStatus(readinessBlockerCount, 12),
          badgeKey: "instructor_readiness_blockers",
        },
      ];

      nextActions = queues
        .filter((queue) => queue.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 4)
        .map((queue) => ({
          id: `action-${queue.id}`,
          title: queue.title,
          detail: `${queue.count} pending — review now`,
          href: queue.href,
          urgency: urgencyFromQueueStatus(queue.status),
          ctaLabel: "Review",
        }));

      if (nextActions.length === 0) {
        nextActions.push({
          id: "chapter-steady-state",
          title: "All chapter queues are clear",
          detail: "Recruiting and readiness queues are healthy.",
          href: "/chapter/recruiting",
          urgency: "low" as const,
        });
      }

      moduleBadgeByHref["/chapter/recruiting"] = interviewQueueCount + decisionReadyCount;
      moduleBadgeByHref["/interviews"] = interviewQueueCount + readinessBlockerCount;
      moduleBadgeByHref["/chapter-lead/instructor-readiness"] = readinessBlockerCount;
    }
  } else if (role === "INSTRUCTOR") {
    const [readiness, courses] = await Promise.all([
      getInstructorReadiness(userId).catch(() => buildFallbackInstructorReadiness(userId)),
      prisma.course.findMany({
        where: { leadInstructorId: userId },
        select: {
          id: true,
          _count: {
            select: {
              enrollments: true,
            },
          },
        },
      }),
    ]);

    const classCount = courses.length;
    const learnerCount = courses.reduce((sum, course) => sum + course._count.enrollments, 0);
    const trainingPercent =
      readiness.requiredModulesCount === 0
        ? 100
        : Math.round((readiness.completedRequiredModules / readiness.requiredModulesCount) * 100);
    const trainingIncomplete =
      Math.max(0, readiness.requiredModulesCount - readiness.completedRequiredModules);
    const interviewBlocked = isInterviewGateEnforced() && !readiness.interviewPassed;

    heroTitle = "Instructor Command Center";
    heroSubtitle = "Keep classes moving while clearing readiness blockers quickly.";

    kpis = [
      {
        id: "instructor_approval_readiness",
        label: "Approval Readiness",
        value: readiness.baseReadinessComplete ? "Ready" : "Blocked",
      },
      {
        id: "instructor_training",
        label: "Training",
        value: `${readiness.completedRequiredModules}/${readiness.requiredModulesCount}`,
        note: `${trainingPercent}% complete`,
      },
      { id: "instructor_classes", label: "Classes", value: classCount },
      { id: "instructor_learners", label: "Learners", value: learnerCount },
    ];

    queues = [
      {
        id: "instructor_training_queue",
        title: "Training Queue",
        description: "Required training modules still incomplete.",
        count: trainingIncomplete,
        href: "/instructor-training",
        status: queueStatus(trainingIncomplete, 4),
        badgeKey: "training_incomplete",
      },
      {
        id: "instructor_interview_queue",
        title: "Interview Readiness",
        description: "Interview gate status before first class publish.",
        count: interviewBlocked ? 1 : 0,
        href: "/interviews?scope=readiness&view=mine&state=needs_action",
        status: interviewBlocked ? "needs_action" : "healthy",
        badgeKey: "interview_gate_blocked",
      },
    ];

    nextActions = [];
    nextActions.push({
      id: "instructor-primary",
      title: readiness.nextAction.title,
      detail: readiness.nextAction.detail,
      href: readiness.nextAction.href,
      urgency: readiness.baseReadinessComplete ? ("low" as const) : ("high" as const),
      ctaLabel: readiness.baseReadinessComplete ? "Open" : "Complete",
    });
    if (readiness.trainingComplete && !readiness.interviewPassed) {
      nextActions.push({
        id: "instructor-interview",
        title: "Schedule your readiness interview",
        detail: "Training complete — book your interview to unlock publishing",
        href: "/interviews?scope=readiness&view=mine&state=needs_action",
        urgency: "high" as const,
        ctaLabel: "Schedule",
      });
    }
    if (classCount > 0) {
      nextActions.push({
        id: "instructor-classes",
        title: "Review class settings",
        detail: `${classCount} class${classCount === 1 ? "" : "es"} — confirm schedule, capacity, and publish status`,
        href: "/instructor/class-settings",
        urgency: "medium" as const,
        ctaLabel: "Review",
      });
    }
    nextActions.push({
      id: "instructor-pathway",
      title: "View my publish workflow",
      detail: "Readiness blockers, offering approval, and teaching specialties",
      href: "/instructor/workspace?tab=my-pathway",
      urgency: "low" as const,
      ctaLabel: "Open",
    });

    moduleBadgeByHref["/instructor-training"] = trainingIncomplete + (interviewBlocked ? 1 : 0);
    moduleBadgeByHref["/interviews"] = interviewBlocked ? 1 : 0;
    moduleBadgeByHref["/instructor/class-settings"] = classCount;
    moduleBadgeByHref["/attendance"] = classCount;

    instructorReadiness = {
      trainingComplete: readiness.trainingComplete,
      academyModulesComplete: readiness.academyModulesComplete,
      studioCapstoneComplete: readiness.studioCapstoneComplete,
      completedRequiredModules: readiness.completedRequiredModules,
      requiredModulesCount: readiness.requiredModulesCount,
      trainingPercent,
      interviewStatus: readiness.interviewStatus,
      interviewPassed: readiness.interviewPassed,
      baseReadinessComplete: readiness.baseReadinessComplete,
      canRequestOfferingApproval: readiness.canRequestOfferingApproval,
      legacyExemptOfferingCount: readiness.legacyExemptOfferingCount,
      missingRequirementsCount: readiness.missingRequirements.length,
      featureEnabled: readiness.featureEnabled,
    };
  } else if (role === "STUDENT") {
    const [
      enrollments,
      chapterJourney,
      activeApplications,
      studentTrainingDue,
      challengeParticipations,
      activeIncubatorProject,
      recommendedActivities,
    ] = await Promise.all([
      prisma.classEnrollment.findMany({
        where: { studentId: userId },
        select: {
          status: true,
        },
      }),
      getStudentChapterJourneyData(userId),
      prisma.application.count({
        where: {
          applicantId: userId,
          status: { notIn: [...FINAL_APPLICATION_STATUSES] },
        },
      }),
      prisma.trainingAssignment.count({
        where: {
          userId,
          status: { not: "COMPLETE" },
        },
      }),
      prisma.challengeParticipant.findMany({
        where: { studentId: userId },
        select: {
          status: true,
          currentStreak: true,
          longestStreak: true,
          challenge: {
            select: {
              id: true,
              title: true,
              status: true,
              endDate: true,
            },
          },
        },
      }),
      prisma.incubatorProject.findFirst({
        where: { studentId: userId },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          currentPhase: true,
          updatedAt: true,
        },
      }).catch(() => null),
      getRecommendedActivitiesForUser(userId, 3),
    ]);

    const activeEnrollments = enrollments.filter((enrollment) => enrollment.status === "ENROLLED").length;
    const nextPathwaySteps = chapterJourney.visiblePathways.filter(
      (pathway) => pathway.nextRecommendedStep && !pathway.isComplete
    ).length;

    // Build active pathway summaries for the dashboard widget
    dashboardActivePathways = chapterJourney.visiblePathways
      .filter((pathway) => pathway.isEnrolled)
      .map((pathway) => {
        return {
          id: pathway.id,
          name: pathway.name,
          interestArea: pathway.interestArea,
          progressPercent: pathway.progressPercent,
          completedCount: pathway.completedCount,
          totalCount: pathway.totalCount,
          nextStepTitle: pathway.nextRecommendedStep?.title ?? null,
        };
      });
    const activeChallengeCount = challengeParticipations.filter(
      (entry) =>
        entry.status === "ACTIVE" &&
        entry.challenge.status === "ACTIVE" &&
        entry.challenge.endDate >= new Date()
    ).length;
    const bestChallengeStreak = challengeParticipations.reduce(
      (max, entry) => Math.max(max, entry.longestStreak),
      0
    );
    const incubatorPhaseLabel = activeIncubatorProject
      ? activeIncubatorProject.currentPhase.replace(/_/g, " ")
      : "Not Started";

    const studentFullExplorer = isStudentFullPortalExplorerEnabled();

    heroTitle = "Student Chapter Command Center";
    heroSubtitle = studentFullExplorer
      ? chapterJourney.chapterName
        ? `Track your ${chapterJourney.chapterName} pathway journey, local classes, and fallback options in one place.`
        : "Track your pathway journey, local classes, and fallback options in one place."
      : chapterJourney.chapterName
        ? `Classes, pathways, and mentorship for ${chapterJourney.chapterName} — prioritized for launch.`
        : "Classes, pathways, and mentorship — prioritized for launch.";

    kpis = studentFullExplorer
      ? [
          { id: "student_active_enrollments", label: "Active Enrollments", value: activeEnrollments },
          { id: "student_next_steps", label: "Pathway Next Steps", value: nextPathwaySteps },
          { id: "student_active_challenges", label: "Active Challenges", value: activeChallengeCount },
          { id: "student_best_streak", label: "Best Challenge Streak", value: bestChallengeStreak },
          { id: "student_active_applications", label: "Active Applications", value: activeApplications },
          { id: "student_training_due", label: "Training Modules Due", value: studentTrainingDue },
          {
            id: "student_recommended_activities",
            label: "Recommended Activities",
            value: recommendedActivities.length,
          },
        ]
      : [
          { id: "student_active_enrollments", label: "Active Enrollments", value: activeEnrollments },
          { id: "student_next_steps", label: "Pathway Next Steps", value: nextPathwaySteps },
          { id: "student_active_applications", label: "Active Applications", value: activeApplications },
          { id: "student_training_due", label: "Training Modules Due", value: studentTrainingDue },
        ];

    queues = studentFullExplorer
      ? [
          {
            id: "student_activity_hub",
            title: "Recommended Activities",
            description: "Activity recommendations across challenge, incubator, and projects.",
            count: recommendedActivities.length,
            href: "/activities",
            status: queueStatus(recommendedActivities.length, 5),
            badgeKey: "student_recommended_activities",
          },
          {
            id: "student_active_challenges",
            title: "Challenge Momentum",
            description: "Stay consistent with your active challenge check-ins.",
            count: activeChallengeCount,
            href: "/challenges",
            status: queueStatus(activeChallengeCount, 7),
            badgeKey: "student_active_challenges",
          },
          {
            id: "student_incubator",
            title: "Incubator Progress",
            description: activeIncubatorProject
              ? `Current phase: ${incubatorPhaseLabel}.`
              : "No incubator project yet.",
            count: activeIncubatorProject ? 1 : 0,
            href: "/incubator",
            status: activeIncubatorProject ? "needs_action" : "healthy",
            badgeKey: "student_incubator",
          },
          {
            id: "student_training_due",
            title: "Training Academy",
            description: "Finish assigned training modules, quizzes, checkpoints, and evidence submissions.",
            count: studentTrainingDue,
            href: "/student-training",
            status: queueStatus(studentTrainingDue, 4),
            badgeKey: "student_training_due",
          },
          {
            id: "student_next_steps",
            title: "Pathway Next Steps",
            description: "Complete one next step this week to stay on track.",
            count: nextPathwaySteps,
            href: "/my-chapter",
            status: queueStatus(nextPathwaySteps, 6),
            badgeKey: "student_next_steps",
          },
          {
            id: "student_active_applications",
            title: "Active Applications",
            description: "Track status and updates for your applications.",
            count: activeApplications,
            href: "/applications",
            status: queueStatus(activeApplications, 5),
            badgeKey: "active_applications",
          },
        ]
      : [
          {
            id: "student_next_steps",
            title: "Pathway Next Steps",
            description: "Complete one next step this week to stay on track.",
            count: nextPathwaySteps,
            href: "/my-chapter",
            status: queueStatus(nextPathwaySteps, 6),
            badgeKey: "student_next_steps",
          },
          {
            id: "student_active_applications",
            title: "Active Applications",
            description: "Track status and updates for your applications.",
            count: activeApplications,
            href: "/applications",
            status: queueStatus(activeApplications, 5),
            badgeKey: "active_applications",
          },
          {
            id: "student_training_due",
            title: "Training Academy",
            description: "Finish assigned training modules, quizzes, checkpoints, and evidence submissions.",
            count: studentTrainingDue,
            href: "/student-training",
            status: queueStatus(studentTrainingDue, 4),
            badgeKey: "student_training_due",
          },
        ];

    nextActions = [];

    if (studentTrainingDue > 0) {
      nextActions.push({
        id: "student-training",
        title: "Complete training modules",
        detail: `${studentTrainingDue} module${studentTrainingDue === 1 ? "" : "s"} waiting completion`,
        href: "/student-training",
        urgency: "high" as const,
        ctaLabel: "Continue",
      });
    }

    if (nextPathwaySteps > 0) {
      nextActions.push({
        id: "student-pathway",
        title: "Continue your pathway",
        detail: `${nextPathwaySteps} step${nextPathwaySteps === 1 ? "" : "s"} available now`,
        href: "/my-chapter",
        urgency: "medium" as const,
        ctaLabel: "View",
      });
    }

    if (activeApplications > 0) {
      nextActions.push({
        id: "student-applications",
        title: "Check application status",
        detail: `${activeApplications} active application${activeApplications === 1 ? "" : "s"} in progress`,
        href: "/applications",
        urgency: "medium" as const,
        ctaLabel: "Check",
      });
    }

    if (studentFullExplorer && activeChallengeCount > 0) {
      nextActions.push({
        id: "student-challenge",
        title: "Complete today's challenge",
        detail: `${activeChallengeCount} active challenge${activeChallengeCount === 1 ? "" : "s"} — keep your streak going`,
        href: "/challenges",
        urgency: "medium" as const,
        ctaLabel: "Check In",
      });
    }

    if (studentFullExplorer && activeIncubatorProject) {
      nextActions.push({
        id: "student-incubator",
        title: "Post a project update",
        detail: `${activeIncubatorProject.title} · ${incubatorPhaseLabel}`,
        href: `/incubator/project/${activeIncubatorProject.id}`,
        urgency: "low" as const,
        ctaLabel: "Update",
      });
    }

    if (studentFullExplorer && recommendedActivities.length > 0) {
      nextActions.push({
        id: "student-activities",
        title: "Explore recommended activities",
        detail: `${recommendedActivities.length} recommendation${recommendedActivities.length === 1 ? "" : "s"} waiting`,
        href: "/activities",
        urgency: "low" as const,
        ctaLabel: "Explore",
      });
    }

    if (nextActions.length === 0) {
      nextActions.push({
        id: "student-explore",
        title: "Explore a new class",
        detail: "Browse classes and pick your next challenge",
        href: "/curriculum",
        urgency: "low" as const,
        ctaLabel: "Browse",
      });
    }

    moduleBadgeByHref["/my-classes"] = activeEnrollments;
    moduleBadgeByHref["/my-chapter"] = nextPathwaySteps;
    moduleBadgeByHref["/pathways"] = nextPathwaySteps;
    moduleBadgeByHref["/applications"] = activeApplications;
    moduleBadgeByHref["/student-training"] = studentTrainingDue;
    moduleBadgeByHref["/activities"] = recommendedActivities.length;
    moduleBadgeByHref["/challenges"] = activeChallengeCount;
    moduleBadgeByHref["/incubator"] = activeIncubatorProject ? 1 : 0;
  } else if (role === "MENTOR") {
    const staleThreshold = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const mentorships = await prisma.mentorship.findMany({
      where: {
        mentorId: userId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        menteeId: true,
        checkIns: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            createdAt: true,
          },
        },
      },
    });

    const activeMentees = mentorships.length;
    const menteeIdList = mentorships.map((entry) => entry.menteeId);

    const [menteeActiveChallenges, incubatorAssignments] = await Promise.all([
      menteeIdList.length > 0
        ? prisma.challengeParticipant.count({
            where: {
              studentId: { in: menteeIdList },
              status: "ACTIVE",
            },
          })
        : Promise.resolve(0),
      prisma.incubatorMentor
        .findMany({
          where: {
            mentorId: userId,
            isActive: true,
          },
          include: {
            project: {
              select: {
                id: true,
                title: true,
                updatedAt: true,
                currentPhase: true,
              },
            },
          },
        })
        .catch(() => []),
    ]);

    const staleIncubatorProjects = incubatorAssignments.filter(
      (assignment) => assignment.project.updatedAt < staleThreshold
    ).length;
    const overdueCheckIns = mentorships.filter((mentorship) => {
      const latest = mentorship.checkIns[0];
      if (!latest) return true;
      return latest.createdAt < staleThreshold;
    }).length;

    heroTitle = "Mentor Command Center";
    heroSubtitle = "Track mentee momentum and clear overdue check-ins quickly.";

    kpis = [
      { id: "mentor_active_mentees", label: "Active Mentees", value: activeMentees },
      { id: "mentor_overdue_checkins", label: "Overdue Check-Ins", value: overdueCheckIns },
      { id: "mentor_incubator_projects", label: "Incubator Projects", value: incubatorAssignments.length },
      { id: "mentor_mentee_challenges", label: "Mentee Active Challenges", value: menteeActiveChallenges },
      { id: "mentor_unread_messages", label: "Unread Messages", value: unreadMessages },
      { id: "mentor_unread_notifications", label: "Unread Notifications", value: unreadNotifications },
    ];

    queues = [
      {
        id: "mentor_overdue_checkins",
        title: "Overdue Check-Ins",
        description: "Mentees with stale or missing mentor check-ins.",
        count: overdueCheckIns,
        href: "/mentorship/mentees",
        status: queueStatus(overdueCheckIns, 6),
        badgeKey: "mentor_overdue_checkins",
      },
      {
        id: "mentor_incubator_stale_updates",
        title: "Incubator Follow-Ups",
        description: "Assigned incubator projects with stale updates.",
        count: staleIncubatorProjects,
        href: "/incubator",
        status: queueStatus(staleIncubatorProjects, 4),
        badgeKey: "mentor_incubator_projects",
      },
      {
        id: "mentor_active_mentees",
        title: "Active Mentees",
        description: "Open mentee roster and progress snapshots.",
        count: activeMentees,
        href: "/mentorship/mentees",
        status: queueStatus(activeMentees, 99),
        badgeKey: "active_mentees",
      },
    ];

    nextActions = [
      {
        id: "mentor-roster",
        title: "Review mentee roster",
        detail: `${activeMentees} active mentee(s) currently assigned.`,
        href: "/mentorship/mentees",
      },
    ];

    if (overdueCheckIns > 0) {
      nextActions.unshift({
        id: "mentor-overdue",
        title: "Clear overdue check-ins",
        detail: `${overdueCheckIns} mentee check-in(s) need attention.`,
        href: "/mentorship/mentees",
      });
    }

    if (staleIncubatorProjects > 0) {
      nextActions.unshift({
        id: "mentor-incubator",
        title: "Review stale incubator projects",
        detail: `${staleIncubatorProjects} incubator project(s) need mentor follow-up.`,
        href: "/incubator",
      });
    }

    moduleBadgeByHref["/mentorship/mentees"] = activeMentees;
    moduleBadgeByHref["/incubator"] = staleIncubatorProjects;
    moduleBadgeByHref["/challenges"] = menteeActiveChallenges;
    moduleBadgeByHref["/messages"] = unreadMessages;
  } else if (role === "PARENT") {
    const [approvedLinkRecords, pendingLinks] = await Promise.all([
      prisma.parentStudent.findMany({
        where: { parentId: userId, approvalStatus: "APPROVED" },
        select: { studentId: true },
      }),
      prisma.parentStudent.count({ where: { parentId: userId, approvalStatus: "PENDING" } }),
    ]);
    const linkedStudentIds = approvedLinkRecords.map((entry) => entry.studentId);
    const [linkedChallenges, linkedIncubatorProjects, recentIncubatorUpdates] = await Promise.all([
      linkedStudentIds.length > 0
        ? prisma.challengeParticipant.count({
            where: {
              studentId: { in: linkedStudentIds },
              status: "ACTIVE",
            },
          })
        : Promise.resolve(0),
      linkedStudentIds.length > 0
        ? prisma.incubatorProject.count({
            where: { studentId: { in: linkedStudentIds } },
          }).catch(() => 0)
        : Promise.resolve(0),
      linkedStudentIds.length > 0
        ? prisma.incubatorUpdate.count({
            where: {
              project: {
                studentId: { in: linkedStudentIds },
              },
              createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
            },
          }).catch(() => 0)
        : Promise.resolve(0),
    ]);
    const approvedLinks = approvedLinkRecords.length;

    heroTitle = "Parent Command Center";
    heroSubtitle = "Monitor student connections, updates, and communication in one place.";

    kpis = [
      { id: "parent_linked_students", label: "Linked Students", value: approvedLinks },
      { id: "parent_pending_links", label: "Pending Links", value: pendingLinks },
      { id: "parent_active_challenges", label: "Active Challenges", value: linkedChallenges },
      { id: "parent_incubator_projects", label: "Incubator Projects", value: linkedIncubatorProjects },
      { id: "parent_incubator_updates", label: "Recent Incubator Updates", value: recentIncubatorUpdates },
      { id: "parent_unread_messages", label: "Unread Messages", value: unreadMessages },
      { id: "parent_unread_notifications", label: "Unread Notifications", value: unreadNotifications },
    ];

    queues = [
      {
        id: "parent_pending_links",
        title: "Pending Student Links",
        description: "Requests awaiting admin approval.",
        count: pendingLinks,
        href: "/parent/connect",
        status: queueStatus(pendingLinks, 3),
        badgeKey: "parent_pending_links",
      },
      {
        id: "parent_active_challenges",
        title: "Student Challenge Momentum",
        description: "Active challenge participation across linked students.",
        count: linkedChallenges,
        href: "/parent/dashboard",
        status: queueStatus(linkedChallenges, 8),
        badgeKey: "parent_active_challenges",
      },
      {
        id: "parent_incubator_updates",
        title: "Recent Incubator Updates",
        description: "Incubator project updates posted in the last two weeks.",
        count: recentIncubatorUpdates,
        href: "/parent/dashboard",
        status: queueStatus(recentIncubatorUpdates, 6),
        badgeKey: "parent_incubator_updates",
      },
    ];

    nextActions = [
      {
        id: "parent-portal",
        title: "Open parent portal",
        detail: "Review linked students and progress reports.",
        href: "/parent",
      },
    ];

    if (linkedChallenges > 0 || linkedIncubatorProjects > 0) {
      nextActions.unshift({
        id: "parent-progress",
        title: "Review challenge and incubator progress",
        detail: `${linkedChallenges} active challenge(s) and ${linkedIncubatorProjects} incubator project(s) linked.`,
        href: "/parent/dashboard",
      });
    }

    moduleBadgeByHref["/parent"] = approvedLinks;
    moduleBadgeByHref["/parent/connect"] = pendingLinks;
    moduleBadgeByHref["/parent/dashboard"] = linkedChallenges + linkedIncubatorProjects;
  } else {
    const [openPositions, activeApplications] = await Promise.all([
      prisma.position.count({ where: { isOpen: true } }),
      prisma.application.count({
        where: {
          applicantId: userId,
          status: { notIn: [...FINAL_APPLICATION_STATUSES] },
        },
      }),
    ]);

    heroTitle = "Staff Command Center";
    heroSubtitle = "Track communication and operational opportunities from one dashboard.";

    kpis = [
      { id: "staff_open_positions", label: "Open Positions", value: openPositions },
      { id: "staff_active_applications", label: "Active Applications", value: activeApplications },
      { id: "staff_unread_messages", label: "Unread Messages", value: unreadMessages },
      { id: "staff_unread_notifications", label: "Unread Notifications", value: unreadNotifications },
    ];

    queues = [
      {
        id: "staff_active_applications",
        title: "Active Applications",
        description: "Follow up on your in-progress applications.",
        count: activeApplications,
        href: "/interviews?scope=hiring&view=mine&state=needs_action",
        status: queueStatus(activeApplications, 5),
      },
    ];

    nextActions = [
      {
        id: "staff-opportunities",
        title: "Review open opportunities",
        detail: `${openPositions} opening(s) currently available.`,
        href: "/positions",
      },
    ];

    moduleBadgeByHref["/positions"] = openPositions;
    moduleBadgeByHref["/applications"] = activeApplications;
    moduleBadgeByHref["/interviews"] = activeApplications;
  }

  for (const queue of queues) {
    if (queue.badgeKey) {
      moduleBadgeByHref[queue.href] = Math.max(moduleBadgeByHref[queue.href] ?? 0, queue.count);
    }
  }

  if (typeof moduleBadgeByHref["/interviews"] === "number") {
    moduleBadgeByHref["interview_queue"] = moduleBadgeByHref["/interviews"];
  }

  nextActions = ensureMessagesNextAction(nextActions, unreadMessages);

  if (role === "STUDENT") {
    const todayLabel = formatStudentActionDateLabel(new Date());
    nextActions = nextActions.slice(0, 8).map((action) => ({
      ...action,
      dateLabel: action.dateLabel ?? todayLabel,
    }));
  }

  // Fetch interconnection data (best-effort — don't block dashboard)
  const [checklist, nudges, journeyMilestones] = await Promise.all([
    buildChecklist(userId, role, nextActions).catch(() => [] as ChecklistItemData[]),
    fetchNudges(userId, role).catch(() => [] as NudgeItemData[]),
    fetchJourneyMilestones(userId).catch(() => [] as JourneyMilestoneData[]),
  ]);

  return {
    role,
    roleLabel: roleLabel(role),
    heroTitle,
    heroSubtitle,
    kpis,
    queues,
    sections,
    nextActions,
    moduleBadgeByHref,
    generatedAt: new Date().toISOString(),
    activePathways: dashboardActivePathways,
    instructorReadiness,
    checklist,
    nudges,
    journeyMilestones,
  };
}

// ============================================
// INTERCONNECTION HELPERS
// ============================================

async function buildChecklist(
  userId: string,
  role: DashboardRole,
  nextActions: DashboardNextAction[]
): Promise<ChecklistItemData[]> {
  const items: ChecklistItemData[] = [];

  // Convert existing next actions into checklist items (real tasks)
  for (const action of nextActions.slice(0, 3)) {
    items.push({
      id: `action-${action.id}`,
      title: action.title,
      detail: action.detail,
      href: action.href,
      priority: "today",
      category: "task",
    });
  }

  // Add role-specific real tasks
  if (role === "STUDENT" || role === "APPLICANT") {
    const [unreadMessages, activeGoals] = await Promise.all([
      prisma.conversationParticipant
        .findMany({
          where: {
            userId,
            conversation: {
              isGroup: false,
            },
          },
          include: {
            conversation: {
              include: {
                messages: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true, senderId: true } },
              },
            },
          },
        })
        .then((parts) =>
          parts.filter((p) => {
            const latest = p.conversation.messages[0];
            return latest && latest.senderId !== userId && latest.createdAt > p.lastReadAt;
          }).length
        )
        .catch(() => 0),
      prisma.goal.count({ where: { userId } }).catch(() => 0),
    ]);

    if (unreadMessages > 0) {
      items.push({
        id: "unread-messages",
        title: `${unreadMessages} unread message${unreadMessages === 1 ? "" : "s"}`,
        href: "/messages",
        priority: "today",
        category: "task",
        icon: "💬",
      });
    }

    if (activeGoals === 0) {
      items.push({
        id: "set-goals",
        title: "Set your first goal",
        detail: "Goals help you track what matters to you",
        href: "/goals",
        priority: "today",
        category: "task",
        icon: "🎯",
      });
    }
  }

  // If we have fewer than 3 real tasks, add encouraging suggestions
  if (items.length < 3) {
    const studentV1Minimal = role === "STUDENT" && !isStudentFullPortalExplorerEnabled();
    const suggestions: ChecklistItemData[] = studentV1Minimal
      ? [
          {
            id: "sug-chapter",
            title: "Open your chapter hub",
            detail: "Pathways, announcements, and your next step",
            href: "/my-chapter",
            priority: "anytime",
            category: "suggestion",
            icon: "📚",
          },
          {
            id: "sug-curriculum",
            title: "Browse classes",
            detail: "Enroll in instructor-led offerings",
            href: "/curriculum",
            priority: "anytime",
            category: "suggestion",
            icon: "📖",
          },
          {
            id: "sug-announcements",
            title: "Read announcements",
            detail: "Chapter and platform updates",
            href: "/announcements",
            priority: "anytime",
            category: "suggestion",
            icon: "📢",
          },
          {
            id: "sug-program",
            title: "Open My Program",
            detail: "Mentorship, reflections, and action items",
            href: "/my-program",
            priority: "anytime",
            category: "suggestion",
            icon: "🎯",
          },
          {
            id: "sug-events",
            title: "See upcoming events",
            detail: "RSVP and add sessions to your calendar",
            href: "/events",
            priority: "anytime",
            category: "suggestion",
            icon: "📅",
          },
        ]
      : [
          {
            id: "sug-pathways",
            title: "Open your chapter hub",
            detail: "See what your chapter is running and what step is next",
            href: "/my-chapter",
            priority: "anytime",
            category: "suggestion",
            icon: "📚",
          },
          {
            id: "sug-challenges",
            title: "Try a challenge",
            detail: "Test your skills and earn badges",
            href: "/challenges",
            priority: "anytime",
            category: "suggestion",
            icon: "🏆",
          },
          {
            id: "sug-badges",
            title: "Check your badge progress",
            detail: "See how close you are to earning a new badge",
            href: "/badges",
            priority: "anytime",
            category: "suggestion",
            icon: "🏅",
          },
          {
            id: "sug-showcase",
            title: "Browse the project showcase",
            detail: "See what others have been working on",
            href: "/showcase",
            priority: "anytime",
            category: "suggestion",
            icon: "🌟",
          },
        ];

    const needed = 5 - items.length;
    items.push(...suggestions.slice(0, needed));
  }

  return items.slice(0, 5);
}

async function fetchNudges(
  userId: string,
  role: DashboardRole
): Promise<NudgeItemData[]> {
  // Generate smart nudges (best-effort, won't create duplicates)
  await generateContextualNudges(userId, role).catch(() => {});

  // Fetch active nudges
  return getActiveNudges(userId, 3);
}

async function fetchJourneyMilestones(
  userId: string
): Promise<JourneyMilestoneData[]> {
  const milestones = await prisma.journeyMilestone
    .findMany({
      where: { userId },
      select: { milestoneKey: true, label: true, reachedAt: true },
    })
    .catch(() => []);

  return milestones.map((m) => ({
    key: m.milestoneKey,
    label: m.label,
    reached: true,
    reachedAt: m.reachedAt,
  }));
}

const getDashboardDataCached = unstable_cache(
  async (userId: string, requestedPrimaryRole: string | null, _cachePartition: string) =>
    buildDashboardData(userId, requestedPrimaryRole),
  ["dashboard-data-v1"],
  { revalidate: 45 }
);

export async function getDashboardData(userId: string, primaryRole: string | null): Promise<DashboardData> {
  const cachePartition = `${STUDENT_V1_ALLOWLIST_VERSION}-${
    process.env.STUDENT_FULL_PORTAL_EXPLORER === "true" ? "full" : "minimal"
  }`;
  return getDashboardDataCached(userId, primaryRole, cachePartition);
}
