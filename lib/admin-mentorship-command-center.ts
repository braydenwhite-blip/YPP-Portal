import {
  MentorshipActionItemStatus,
  MentorshipRequestStatus,
  MentorshipReviewStatus,
  type SupportRole,
} from "@prisma/client";

import { REVIEW_STATUS_META } from "@/lib/mentorship-review-helpers";
import {
  ADMIN_MENTORSHIP_LANES,
  getAdminMentorshipLaneForUser,
  getSupportRoleGapLabels,
  getSupportRoleLabel,
  getSupportRolesPresent,
  type AdminMentorshipLane,
} from "@/lib/mentorship-admin-helpers";
import { prisma } from "@/lib/prisma";
import { MENTORSHIP_LEGACY_ROOT_SELECT } from "@/lib/mentorship-read-fragments";

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfNextMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function getToneClass(
  tone: "neutral" | "warning" | "success" | "danger"
) {
  if (tone === "warning") return "pill-pending";
  if (tone === "success") return "pill-success";
  if (tone === "danger") return "pill-declined";
  return "";
}

export type CommandCenterFocus =
  | "queue"
  | "matching"
  | "staffing"
  | "governance";

export interface CommandCenterLaneSummary {
  lane: AdminMentorshipLane;
  activeCircles: number;
  peopleNeedingPrimaryMentor: number;
  staffingGaps: number;
  cadenceRisks: number;
  pendingReviews: number;
  openRequests: number;
}

export interface CommandCenterWatchlistItem {
  id: string;
  lane: AdminMentorshipLane;
  kind:
    | "PRIMARY_MENTOR_GAP"
    | "STAFFING_GAP"
    | "CADENCE_RISK"
    | "OPEN_REQUEST";
  title: string;
  description: string;
  emphasis: string;
  actionLabel: string;
  actionHref: string;
  priority: number;
}

export interface CommandCenterCircleSummary {
  mentorshipId: string;
  menteeId: string;
  menteeName: string;
  menteeEmail: string;
  menteeRole: string;
  lane: AdminMentorshipLane;
  chapterName: string | null;
  mentorName: string;
  mentorEmail: string;
  chairName: string | null;
  trackName: string | null;
  startDate: Date;
  latestSessionAt: string | null;
  latestReviewStatus: string | null;
  latestReviewLabel: string | null;
  latestReviewToneClass: string | null;
  openActionItems: number;
  overdueActionItems: number;
  currentRoles: string[];
  missingRoles: string[];
}

export interface CommandCenterRequestSummary {
  id: string;
  lane: AdminMentorshipLane;
  menteeId: string;
  menteeName: string;
  menteeRole: string;
  title: string;
  kind: string;
  trackName: string | null;
  requestedAt: string;
  actionHref: string;
}

export async function getAdminMentorshipCommandCenterData() {
  const now = new Date();
  const currentMonth = startOfMonth(now);
  const nextMonth = startOfNextMonth(now);
  const threeWeeksAgo = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);

  const [
    mentorships,
    potentialMentees,
    goals,
    chairs,
    governanceUsers,
    tracks,
    committees,
    openRequests,
    reviewCounts,
    approvedThisMonth,
    publishedResources,
  ] = await Promise.all([
    prisma.mentorship.findMany({
      where: { status: "ACTIVE" },
      select: {
        ...MENTORSHIP_LEGACY_ROOT_SELECT,
        mentor: {
          select: { id: true, name: true, email: true },
        },
        mentee: {
          select: {
            id: true,
            name: true,
            email: true,
            primaryRole: true,
            roles: { select: { role: true } },
            chapter: { select: { name: true } },
          },
        },
        chair: {
          select: { id: true, name: true },
        },
        track: {
          select: { id: true, name: true },
        },
        circleMembers: {
          where: { isActive: true },
          select: {
            role: true,
            user: {
              select: { id: true, name: true },
            },
          },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        },
        sessions: {
          orderBy: [{ completedAt: "desc" }, { scheduledAt: "desc" }],
          take: 4,
          select: {
            scheduledAt: true,
            completedAt: true,
          },
        },
        actionItems: {
          where: {
            status: {
              in: [
                MentorshipActionItemStatus.OPEN,
                MentorshipActionItemStatus.IN_PROGRESS,
                MentorshipActionItemStatus.BLOCKED,
              ],
            },
          },
          select: { id: true, dueAt: true },
        },
        monthlyReviews: {
          orderBy: { month: "desc" },
          take: 1,
          select: {
            status: true,
            month: true,
          },
        },
      },
      orderBy: { startDate: "desc" },
    }),
    prisma.user.findMany({
      where: {
        OR: [
          { roles: { some: { role: "STUDENT" } } },
          { primaryRole: { in: ["INSTRUCTOR", "CHAPTER_PRESIDENT", "ADMIN", "STAFF"] } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        primaryRole: true,
        roles: { select: { role: true } },
        chapter: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.mentorshipProgramGoal.findMany({
      orderBy: [{ roleType: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.mentorCommitteeChair.findMany({
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: {
              in: ["MENTOR", "INSTRUCTOR", "CHAPTER_PRESIDENT", "ADMIN", "STAFF"],
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        roles: { select: { role: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.mentorshipTrack.findMany({
      include: {
        committees: {
          include: {
            chairUser: { select: { id: true, name: true } },
            members: {
              include: {
                user: { select: { id: true, name: true } },
              },
            },
          },
        },
        _count: { select: { mentorships: true } },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
    prisma.mentorCommittee.findMany({
      include: {
        track: true,
        chairUser: { select: { id: true, name: true } },
      },
      orderBy: [{ track: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.mentorshipRequest.findMany({
      where: { status: MentorshipRequestStatus.OPEN },
      include: {
        mentee: {
          select: {
            id: true,
            name: true,
            primaryRole: true,
            roles: { select: { role: true } },
          },
        },
        track: { select: { name: true } },
      },
      orderBy: { requestedAt: "desc" },
      take: 20,
    }),
    prisma.monthlyGoalReview.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
    prisma.monthlyGoalReview.count({
      where: {
        status: MentorshipReviewStatus.APPROVED,
        chairDecisionAt: {
          gte: currentMonth,
          lt: nextMonth,
        },
      },
    }),
    prisma.mentorshipResource.count({
      where: { isPublished: true },
    }),
  ]);

  const activeMentorshipByMenteeId = new Map(
    mentorships.map((mentorship) => [mentorship.menteeId, mentorship])
  );

  const reviewCountByStatus = new Map(
    reviewCounts.map((item) => [item.status, item._count.id])
  );

  const unassignedMentees = potentialMentees
    .filter((user) => !activeMentorshipByMenteeId.has(user.id))
    .map((user) => {
      const lane = getAdminMentorshipLaneForUser({
        primaryRole: user.primaryRole,
        roles: user.roles.map((role) => role.role),
      });

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        primaryRole: user.primaryRole,
        lane,
        chapterName: user.chapter?.name ?? null,
      };
    });

  const circleSummaries: CommandCenterCircleSummary[] = mentorships.map(
    (mentorship) => {
      const lane = getAdminMentorshipLaneForUser({
        primaryRole: mentorship.mentee.primaryRole,
        roles: mentorship.mentee.roles.map((role) => role.role),
      });
      const rolesPresent = getSupportRolesPresent({
        mentorAssigned: Boolean(mentorship.mentorId),
        chairAssigned: Boolean(mentorship.chairId),
        circleRoles: mentorship.circleMembers.map(
          (member) => member.role
        ) as SupportRole[],
      });
      const latestReview = mentorship.monthlyReviews[0] ?? null;
      const latestReviewMeta = latestReview
        ? REVIEW_STATUS_META[latestReview.status]
        : null;
      const latestSession = mentorship.sessions[0] ?? null;
      const latestSessionAt =
        latestSession?.completedAt?.toISOString() ??
        latestSession?.scheduledAt.toISOString() ??
        null;
      const overdueActionItems = mentorship.actionItems.filter(
        (item) => item.dueAt && item.dueAt < now
      ).length;

      return {
        mentorshipId: mentorship.id,
        menteeId: mentorship.menteeId,
        menteeName: mentorship.mentee.name,
        menteeEmail: mentorship.mentee.email,
        menteeRole: mentorship.mentee.primaryRole,
        lane,
        chapterName: mentorship.mentee.chapter?.name ?? null,
        mentorName: mentorship.mentor.name,
        mentorEmail: mentorship.mentor.email,
        chairName: mentorship.chair?.name ?? null,
        trackName: mentorship.track?.name ?? null,
        startDate: mentorship.startDate,
        latestSessionAt,
        latestReviewStatus: latestReview?.status ?? null,
        latestReviewLabel: latestReviewMeta?.label ?? null,
        latestReviewToneClass: latestReviewMeta
          ? getToneClass(latestReviewMeta.tone)
          : null,
        openActionItems: mentorship.actionItems.length,
        overdueActionItems,
        currentRoles: rolesPresent.map((role) => getSupportRoleLabel(role)),
        missingRoles: getSupportRoleGapLabels(rolesPresent),
      };
    }
  );

  const staffingGapItems = circleSummaries
    .filter((circle) => circle.missingRoles.length > 0)
    .map((circle) => {
      const hasChairGap = circle.missingRoles.includes("Committee chair");
      const actionFocus: CommandCenterFocus = hasChairGap
        ? "staffing"
        : "matching";
      const actionLabel = hasChairGap ? "Add support role" : "Find match";
      const supportRole = hasChairGap ? "CHAIR" : "SPECIALIST_MENTOR";
      const laneQuery =
        circle.lane === "STUDENTS"
          ? "students"
          : circle.lane === "INSTRUCTORS"
            ? "instructors"
            : "leadership";

      return {
        id: `staffing-${circle.mentorshipId}`,
        lane: circle.lane,
        kind: "STAFFING_GAP" as const,
        title: `${circle.menteeName} still needs circle coverage`,
        description: `Current mentor: ${circle.mentorName}. Missing ${circle.missingRoles.join(", ")}.`,
        emphasis: circle.missingRoles.join(" · "),
        actionLabel,
        actionHref: `/admin/mentorship-program?lane=${laneQuery}&focus=${actionFocus}&menteeId=${circle.menteeId}&supportRole=${supportRole}`,
        priority: hasChairGap ? 2 : 3,
      };
    });

  const cadenceRiskItems = mentorships.flatMap((mentorship) => {
    const lane = getAdminMentorshipLaneForUser({
      primaryRole: mentorship.mentee.primaryRole,
      roles: mentorship.mentee.roles.map((role) => role.role),
    });
    const latestSession = mentorship.sessions[0] ?? null;
    const hasUpcoming = mentorship.sessions.some(
      (session) =>
        !session.completedAt && session.scheduledAt.getTime() > now.getTime()
    );
    const stale =
      !latestSession ||
      (!hasUpcoming &&
        (latestSession.completedAt ?? latestSession.scheduledAt) < threeWeeksAgo);

    if (!stale) {
      return [];
    }

    const overdueActions = mentorship.actionItems.filter(
      (item) => item.dueAt && item.dueAt < now
    ).length;
    const lastSessionLabel = latestSession
      ? (latestSession.completedAt ?? latestSession.scheduledAt).toLocaleDateString()
      : "No session logged yet";

    return [
      {
        id: `cadence-${mentorship.id}`,
        lane,
        kind: "CADENCE_RISK" as const,
        title: `${mentorship.mentee.name} needs a rhythm reset`,
        description: `${lastSessionLabel}${overdueActions > 0 ? ` · ${overdueActions} overdue action item${overdueActions === 1 ? "" : "s"}` : ""}.`,
        emphasis: overdueActions > 0 ? `${overdueActions} overdue actions` : "Session cadence risk",
        actionLabel: "Open circle",
        actionHref: `/mentorship/mentees/${mentorship.menteeId}`,
        priority: latestSession ? 4 : 1,
      },
    ];
  });

  const requestSummaries: CommandCenterRequestSummary[] = openRequests.map(
    (request) => {
      const lane = getAdminMentorshipLaneForUser({
        primaryRole: request.mentee.primaryRole,
        roles: request.mentee.roles.map((role) => role.role),
      });

      return {
        id: request.id,
        lane,
        menteeId: request.menteeId,
        menteeName: request.mentee.name,
        menteeRole: request.mentee.primaryRole,
        title: request.title,
        kind: request.kind.replace(/_/g, " "),
        trackName: request.track?.name ?? null,
        requestedAt: request.requestedAt.toISOString(),
        actionHref: `/mentorship/mentees/${request.menteeId}`,
      };
    }
  );

  const requestWatchlistItems: CommandCenterWatchlistItem[] =
    requestSummaries.map((request) => ({
      id: `request-${request.id}`,
      lane: request.lane,
      kind: "OPEN_REQUEST",
      title: `${request.menteeName} has an open support request`,
      description: `${request.kind.toLowerCase()} request: ${request.title}`,
      emphasis: request.trackName ?? "Open mentorship request",
      actionLabel: "Review queue",
      actionHref: `${request.actionHref}#requests`,
      priority: 5,
    }));

  const primaryMentorGapItems: CommandCenterWatchlistItem[] =
    unassignedMentees.map((mentee) => ({
      id: `primary-${mentee.id}`,
      lane: mentee.lane,
      kind: "PRIMARY_MENTOR_GAP",
      title: `${mentee.name} does not have a primary mentor`,
      description: `${mentee.primaryRole.replace(/_/g, " ")}${mentee.chapterName ? ` · ${mentee.chapterName}` : ""}.`,
      emphasis: "Primary mentor needed",
      actionLabel: "Find match",
      actionHref: `/admin/mentorship-program?lane=${laneToQueryValue(mentee.lane)}&focus=matching&menteeId=${mentee.id}&supportRole=PRIMARY_MENTOR`,
      priority: 0,
    }));

  const watchlist = [
    ...primaryMentorGapItems,
    ...staffingGapItems,
    ...cadenceRiskItems,
    ...requestWatchlistItems,
  ].sort((left, right) => left.priority - right.priority);

  const laneSummaries: CommandCenterLaneSummary[] = ADMIN_MENTORSHIP_LANES.map(
    (lane) => ({
      lane,
      activeCircles: circleSummaries.filter((circle) => circle.lane === lane)
        .length,
      peopleNeedingPrimaryMentor: unassignedMentees.filter(
        (mentee) => mentee.lane === lane
      ).length,
      staffingGaps: staffingGapItems.filter((item) => item.lane === lane).length,
      cadenceRisks: cadenceRiskItems.filter((item) => item.lane === lane).length,
      pendingReviews: circleSummaries.filter(
        (circle) =>
          circle.lane === lane &&
          circle.latestReviewStatus ===
            MentorshipReviewStatus.PENDING_CHAIR_APPROVAL
      ).length,
      openRequests: requestSummaries.filter((request) => request.lane === lane)
        .length,
    })
  );

  return {
    analytics: {
      activeCircles: mentorships.length,
      pendingChairReviews:
        reviewCountByStatus.get(MentorshipReviewStatus.PENDING_CHAIR_APPROVAL) ??
        0,
      returnedReviews:
        reviewCountByStatus.get(MentorshipReviewStatus.RETURNED) ?? 0,
      approvedThisMonth,
      openRequests: requestSummaries.length,
      publishedResources,
    },
    laneSummaries,
    watchlist,
    circleSummaries,
    requestSummaries,
    unassignedMentees,
    mentorships,
    tracks,
    committees,
    chairs: chairs.map((chair) => ({
      id: chair.id,
      userId: chair.userId,
      userName: chair.user.name,
      userEmail: chair.user.email,
      roleType: chair.roleType,
      isActive: chair.isActive,
    })),
    goals: goals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      description: goal.description,
      roleType: goal.roleType,
      isActive: goal.isActive,
      sortOrder: goal.sortOrder,
    })),
    governanceUsers,
  };
}

function laneToQueryValue(lane: AdminMentorshipLane) {
  if (lane === "STUDENTS") return "students";
  if (lane === "INSTRUCTORS") return "instructors";
  return "leadership";
}
