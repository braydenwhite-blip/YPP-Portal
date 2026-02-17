import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getDashboardModulesForRole } from "@/lib/dashboard/catalog";
import { resolveDashboardRole } from "@/lib/dashboard/resolve-dashboard";
import type {
  DashboardData,
  DashboardKpi,
  DashboardNextAction,
  DashboardQueueCard,
  DashboardQueueStatus,
  DashboardRole,
} from "@/lib/dashboard/types";
import { getNextRequiredAction, isInterviewGateEnforced } from "@/lib/instructor-readiness";
import { getRecommendedActivitiesForUser } from "@/lib/activity-hub/actions";

const FINAL_APPLICATION_STATUSES = ["ACCEPTED", "REJECTED", "WITHDRAWN"] as const;

function queueStatus(count: number, overdueThreshold = 10): DashboardQueueStatus {
  if (count <= 0) return "healthy";
  if (count >= overdueThreshold) return "overdue";
  return "needs_action";
}

function roleLabel(role: DashboardRole): string {
  return role.replace(/_/g, " ");
}

async function getUnreadMessageCount(userId: string): Promise<number> {
  const participations = await prisma.conversationParticipant.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              createdAt: true,
              senderId: true,
            },
          },
        },
      },
    },
  });

  return participations.filter((entry) => {
    const latest = entry.conversation.messages[0];
    if (!latest) return false;
    if (latest.senderId === userId) return false;
    return latest.createdAt > entry.lastReadAt;
  }).length;
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

  const [{ modules, sections }, unreadNotifications, unreadMessages, myOpenChapterProposals] = await Promise.all([
    Promise.resolve(getDashboardModulesForRole(role, { hasAward })),
    prisma.notification.count({ where: { userId, isRead: false } }),
    getUnreadMessageCount(userId),
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

  if (role === "ADMIN") {
    const [
      pendingParentApprovals,
      pendingAppDecisions,
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
      prisma.trainingEvidenceSubmission.count({
        where: {
          status: { in: ["PENDING_REVIEW", "REVISION_REQUESTED"] },
        },
      }),
      prisma.readinessReviewRequest.count({
        where: {
          status: { in: ["REQUESTED", "UNDER_REVIEW", "REVISION_REQUESTED"] },
        },
      }),
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
        description: "Finalize unresolved hiring applications.",
        count: pendingAppDecisions,
        href: "/interviews?scope=hiring&view=team&state=needs_action",
        status: queueStatus(pendingAppDecisions, 20),
        badgeKey: "pending_app_decisions",
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
      .slice(0, 3)
      .map((queue) => ({
        id: `action-${queue.id}`,
        title: `Work ${queue.title}`,
        detail: `${queue.count} item(s) waiting action.`,
        href: queue.href,
      }));

    if (nextActions.length === 0) {
      nextActions.push({
        id: "admin-steady-state",
        title: "Queues are healthy",
        detail: "No urgent admin blockers right now.",
        href: "/admin/analytics",
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
  } else if (role === "CHAPTER_LEAD") {
    const hasChapterLeadAccess = roleTypes.includes("CHAPTER_LEAD") || roleTypes.includes("ADMIN");

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
        prisma.trainingModule.findMany({ where: { required: true }, select: { id: true } }),
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
      ]);

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

        const trainingComplete = Array.from(requiredSet).every((moduleId) => completedRequired.has(moduleId));
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
        .slice(0, 3)
        .map((queue) => ({
          id: `action-${queue.id}`,
          title: `Work ${queue.title}`,
          detail: `${queue.count} item(s) currently waiting action.`,
          href: queue.href,
        }));

      if (nextActions.length === 0) {
        nextActions.push({
          id: "chapter-steady-state",
          title: "No urgent chapter blockers",
          detail: "Chapter recruiting and readiness queues are healthy.",
          href: "/chapter/recruiting",
        });
      }

      moduleBadgeByHref["/chapter/recruiting"] = interviewQueueCount + decisionReadyCount;
      moduleBadgeByHref["/interviews"] = interviewQueueCount + readinessBlockerCount;
      moduleBadgeByHref["/chapter-lead/instructor-readiness"] = readinessBlockerCount;
    }
  } else if (role === "INSTRUCTOR") {
    const [requiredModules, assignments, interviewGate, courses] = await Promise.all([
      prisma.trainingModule.findMany({ where: { required: true }, select: { id: true } }),
      prisma.trainingAssignment.findMany({
        where: {
          userId,
          module: { required: true },
        },
        select: {
          moduleId: true,
          status: true,
        },
      }),
      prisma.instructorInterviewGate.findUnique({
        where: { instructorId: userId },
        select: { status: true },
      }),
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

    const requiredSet = new Set(requiredModules.map((module) => module.id));
    const completedRequired = new Set(
      assignments
        .filter((assignment) => assignment.status === "COMPLETE")
        .map((assignment) => assignment.moduleId)
    );

    const trainingIncomplete = Math.max(
      0,
      Array.from(requiredSet).filter((moduleId) => !completedRequired.has(moduleId)).length
    );

    const interviewRequired = isInterviewGateEnforced();
    const interviewStatus = interviewGate?.status ?? "REQUIRED";
    const interviewBlocked =
      interviewRequired && !(interviewStatus === "PASSED" || interviewStatus === "WAIVED");

    const classCount = courses.length;
    const learnerCount = courses.reduce((sum, course) => sum + course._count.enrollments, 0);
    const urgentAction = await getNextRequiredAction(userId);

    heroTitle = "Instructor Command Center";
    heroSubtitle = "Keep classes moving while clearing readiness blockers quickly.";

    kpis = [
      { id: "instructor_classes", label: "Classes", value: classCount },
      { id: "instructor_learners", label: "Learners", value: learnerCount },
      { id: "instructor_training_incomplete", label: "Training Remaining", value: trainingIncomplete },
      { id: "instructor_interview_blocked", label: "Interview Blocker", value: interviewBlocked ? 1 : 0 },
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

    nextActions = [
      {
        id: "instructor-urgent",
        title: urgentAction.title,
        detail: urgentAction.detail,
        href: urgentAction.href,
      },
      {
        id: "instructor-classes",
        title: "Review class settings",
        detail: "Confirm schedule, capacity, and publish status.",
        href: "/instructor/class-settings",
      },
    ];

    moduleBadgeByHref["/instructor-training"] = trainingIncomplete + (interviewBlocked ? 1 : 0);
    moduleBadgeByHref["/interviews"] = interviewBlocked ? 1 : 0;
    moduleBadgeByHref["/instructor/class-settings"] = classCount;
    moduleBadgeByHref["/attendance"] = classCount;
  } else if (role === "STUDENT") {
    const [
      enrollments,
      pathways,
      activeApplications,
      studentTrainingDue,
      challengeParticipations,
      activeIncubatorProject,
      recommendedActivities,
    ] = await Promise.all([
      prisma.enrollment.findMany({
        where: { userId },
        select: {
          courseId: true,
          status: true,
        },
      }),
      prisma.pathway.findMany({
        select: {
          id: true,
          steps: {
            select: {
              courseId: true,
              stepOrder: true,
            },
            orderBy: { stepOrder: "asc" },
          },
        },
      }),
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
    const enrolledCourseIds = new Set(enrollments.map((enrollment) => enrollment.courseId));
    const nextPathwaySteps = pathways.filter((pathway) =>
      pathway.steps.some((step) => !enrolledCourseIds.has(step.courseId))
    ).length;
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

    heroTitle = "Student Command Center";
    heroSubtitle = "See your progress, pending actions, and opportunities in one place.";

    kpis = [
      { id: "student_active_enrollments", label: "Active Enrollments", value: activeEnrollments },
      { id: "student_next_steps", label: "Pathway Next Steps", value: nextPathwaySteps },
      { id: "student_active_challenges", label: "Active Challenges", value: activeChallengeCount },
      { id: "student_best_streak", label: "Best Challenge Streak", value: bestChallengeStreak },
      { id: "student_active_applications", label: "Active Applications", value: activeApplications },
      { id: "student_training_due", label: "Training Modules Due", value: studentTrainingDue },
      { id: "student_recommended_activities", label: "Recommended Activities", value: recommendedActivities.length },
    ];

    queues = [
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
        href: "/pathways",
        status: queueStatus(nextPathwaySteps, 6),
        badgeKey: "student_next_steps",
      },
      {
        id: "student_active_applications",
        title: "Active Applications",
        description: "Track interviews and status updates for your applications.",
        count: activeApplications,
        href: "/interviews?scope=hiring&view=mine&state=needs_action",
        status: queueStatus(activeApplications, 5),
        badgeKey: "active_applications",
      },
    ];

    nextActions = [];

    if (studentTrainingDue > 0) {
      nextActions.push({
        id: "student-training",
        title: "Complete training academy modules",
        detail: `${studentTrainingDue} training module(s) are waiting completion.`,
        href: "/student-training",
      });
    }

    if (nextPathwaySteps > 0) {
      nextActions.push({
        id: "student-pathway",
        title: "Complete your next pathway step",
        detail: `${nextPathwaySteps} pathway step(s) are available now.`,
        href: "/pathways",
      });
    }

    if (activeApplications > 0) {
      nextActions.push({
        id: "student-applications",
        title: "Check application updates",
        detail: `${activeApplications} active application(s) in progress.`,
        href: "/interviews?scope=hiring&view=mine&state=needs_action",
      });
    }

    if (activeChallengeCount > 0) {
      nextActions.push({
        id: "student-challenge",
        title: "Complete today's challenge check-in",
        detail: `${activeChallengeCount} challenge(s) currently active.`,
        href: "/challenges",
      });
    }

    if (activeIncubatorProject) {
      nextActions.push({
        id: "student-incubator",
        title: "Post an incubator project update",
        detail: `${activeIncubatorProject.title} is in ${incubatorPhaseLabel}.`,
        href: `/incubator/project/${activeIncubatorProject.id}`,
      });
    }

    if (recommendedActivities.length > 0) {
      nextActions.push({
        id: "student-activities",
        title: "Open your recommended activities",
        detail: `${recommendedActivities.length} activity recommendation(s) available.`,
        href: "/activities",
      });
    }

    if (activeApplications === 0) {
      nextActions.push({
        id: "student-positions",
        title: "Browse open positions",
        detail: "Explore leadership, instructor, and mentor roles you can apply for.",
        href: "/positions",
      });
    }

    if (nextActions.length === 0) {
      nextActions.push({
        id: "student-explore",
        title: "Explore a new class",
        detail: "Browse classes and pick your next challenge.",
        href: "/curriculum",
      });
    }

    moduleBadgeByHref["/my-courses"] = activeEnrollments;
    moduleBadgeByHref["/pathways"] = nextPathwaySteps;
    moduleBadgeByHref["/applications"] = activeApplications;
    moduleBadgeByHref["/interviews"] = activeApplications;
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
  };
}

const getDashboardDataCached = unstable_cache(
  async (userId: string, requestedPrimaryRole: string | null) =>
    buildDashboardData(userId, requestedPrimaryRole),
  ["dashboard-data-v1"],
  { revalidate: 45 }
);

export async function getDashboardData(userId: string, primaryRole: string | null): Promise<DashboardData> {
  return getDashboardDataCached(userId, primaryRole);
}
