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

  const [{ modules, sections }, unreadNotifications, unreadMessages] = await Promise.all([
    Promise.resolve(getDashboardModulesForRole(role, { hasAward })),
    prisma.notification.count({ where: { userId, isRead: false } }),
    getUnreadMessageCount(userId),
  ]);

  const moduleBadgeByHref: Record<string, number> = {
    "/notifications": unreadNotifications,
    "/messages": unreadMessages,
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
    ]);

    heroTitle = "Admin Operations Command Center";
    heroSubtitle = "Keep high-priority approvals and readiness queues moving daily.";

    kpis = [
      { id: "pending_parent_approvals", label: "Pending Parent Approvals", value: pendingParentApprovals },
      { id: "pending_app_decisions", label: "Pending Application Decisions", value: pendingAppDecisions },
      { id: "training_evidence_queue", label: "Training Evidence Queue", value: trainingEvidenceQueue },
      { id: "waitlist_waiting", label: "Waitlist Waiting", value: waitlistWaiting },
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
        href: "/admin/applications",
        status: queueStatus(pendingAppDecisions, 20),
        badgeKey: "pending_app_decisions",
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
    moduleBadgeByHref["/admin/instructor-readiness"] = trainingEvidenceQueue + readinessReviewQueue;
    moduleBadgeByHref["/admin/waitlist"] = waitlistWaiting;
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
          href: "/chapter/recruiting?tab=interviews",
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
        href: "/instructor-training",
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
    moduleBadgeByHref["/instructor/class-settings"] = classCount;
    moduleBadgeByHref["/attendance"] = classCount;
  } else if (role === "STUDENT") {
    const [enrollments, pathways, activeApplications] = await Promise.all([
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
    ]);

    const activeEnrollments = enrollments.filter((enrollment) => enrollment.status === "ENROLLED").length;
    const enrolledCourseIds = new Set(enrollments.map((enrollment) => enrollment.courseId));
    const nextPathwaySteps = pathways.filter((pathway) =>
      pathway.steps.some((step) => !enrolledCourseIds.has(step.courseId))
    ).length;

    heroTitle = "Student Command Center";
    heroSubtitle = "See your progress, pending actions, and opportunities in one place.";

    kpis = [
      { id: "student_active_enrollments", label: "Active Enrollments", value: activeEnrollments },
      { id: "student_next_steps", label: "Pathway Next Steps", value: nextPathwaySteps },
      { id: "student_active_applications", label: "Active Applications", value: activeApplications },
      { id: "student_unread_notifications", label: "Unread Notifications", value: unreadNotifications },
    ];

    queues = [
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
        href: "/applications",
        status: queueStatus(activeApplications, 5),
        badgeKey: "active_applications",
      },
    ];

    nextActions = [];

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
        href: "/applications",
      });
    }

    if (nextActions.length === 0) {
      nextActions.push({
        id: "student-explore",
        title: "Explore a new class",
        detail: "Browse classes and pick your next challenge.",
        href: "/classes/catalog",
      });
    }

    moduleBadgeByHref["/my-courses"] = activeEnrollments;
    moduleBadgeByHref["/pathways"] = nextPathwaySteps;
    moduleBadgeByHref["/applications"] = activeApplications;
  } else if (role === "MENTOR") {
    const staleThreshold = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const mentorships = await prisma.mentorship.findMany({
      where: {
        mentorId: userId,
        status: "ACTIVE",
      },
      select: {
        id: true,
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

    moduleBadgeByHref["/mentorship/mentees"] = activeMentees;
    moduleBadgeByHref["/messages"] = unreadMessages;
  } else if (role === "PARENT") {
    const [approvedLinks, pendingLinks] = await Promise.all([
      prisma.parentStudent.count({ where: { parentId: userId, approvalStatus: "APPROVED" } }),
      prisma.parentStudent.count({ where: { parentId: userId, approvalStatus: "PENDING" } }),
    ]);

    heroTitle = "Parent Command Center";
    heroSubtitle = "Monitor student connections, updates, and communication in one place.";

    kpis = [
      { id: "parent_linked_students", label: "Linked Students", value: approvedLinks },
      { id: "parent_pending_links", label: "Pending Links", value: pendingLinks },
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
    ];

    nextActions = [
      {
        id: "parent-portal",
        title: "Open parent portal",
        detail: "Review linked students and progress reports.",
        href: "/parent",
      },
    ];

    moduleBadgeByHref["/parent"] = approvedLinks;
    moduleBadgeByHref["/parent/connect"] = pendingLinks;
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
        href: "/applications",
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
  }

  for (const queue of queues) {
    if (queue.badgeKey) {
      moduleBadgeByHref[queue.href] = Math.max(moduleBadgeByHref[queue.href] ?? 0, queue.count);
    }
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
