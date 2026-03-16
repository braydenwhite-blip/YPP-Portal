import {
  MentorshipActionItemStatus,
  MentorshipRequestStatus,
  MentorshipRequestVisibility,
  MentorshipResourceType,
  SupportRole,
  type MentorshipType,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

const MENTOR_ROLES = ["MENTOR", "INSTRUCTOR", "CHAPTER_LEAD", "ADMIN", "STAFF"] as const;

export const SUPPORT_ROLE_META: Record<
  SupportRole,
  { label: string; description: string; tone: string }
> = {
  PRIMARY_MENTOR: {
    label: "Primary mentor",
    description: "Owns the main mentoring relationship and monthly cadence.",
    tone: "#1d4ed8",
  },
  CHAIR: {
    label: "Committee chair",
    description: "Approves reviews and handles escalation decisions.",
    tone: "#7c3aed",
  },
  SPECIALIST_MENTOR: {
    label: "Specialist mentor",
    description: "Helps with subject-specific coaching and projects.",
    tone: "#0f766e",
  },
  COLLEGE_ADVISOR: {
    label: "College advisor",
    description: "Supports college readiness and long-range planning.",
    tone: "#b45309",
  },
  ALUMNI_ADVISOR: {
    label: "Alumni advisor",
    description: "Brings lived experience and future-facing perspective.",
    tone: "#be185d",
  },
  PEER_SUPPORT: {
    label: "Peer support",
    description: "Adds accountability, check-ins, and encouragement.",
    tone: "#166534",
  },
};

export const MENTORSHIP_RESOURCE_TYPE_META: Record<
  MentorshipResourceType,
  { label: string }
> = {
  LINK: { label: "Link" },
  PLAYBOOK: { label: "Playbook" },
  TOOL: { label: "Tool" },
  VIDEO: { label: "Video" },
  TEMPLATE: { label: "Template" },
  ANSWER: { label: "Answer" },
};

export function getMentorshipRoleFlags(roles: string[]) {
  const isAdmin = roles.includes("ADMIN");
  const isChapterLead = roles.includes("CHAPTER_LEAD");
  const isStudent = roles.includes("STUDENT");
  const isMentor = roles.some((role) => MENTOR_ROLES.includes(role as (typeof MENTOR_ROLES)[number]));
  return {
    isAdmin,
    isChapterLead,
    isStudent,
    isMentor,
    canSupport: isAdmin || isMentor,
  };
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfNextMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function scoreSupportMatch(params: {
  supportRole: SupportRole;
  mentorInterests: string[];
  menteeInterests: string[];
  sameChapter: boolean;
  currentLoad: number;
  capacity: number | null;
  availability: string | null;
  hasProfile: boolean;
}) {
  const {
    supportRole,
    mentorInterests,
    menteeInterests,
    sameChapter,
    currentLoad,
    capacity,
    availability,
    hasProfile,
  } = params;

  let score = 0;
  const reasons: string[] = [];

  const sharedInterests = menteeInterests.filter((interest) =>
    mentorInterests.some((candidate) => normalizeText(candidate) === normalizeText(interest))
  );
  if (sharedInterests.length > 0) {
    const interestScore = Math.min(sharedInterests.length * 12, 36);
    score += interestScore;
    reasons.push(
      `${sharedInterests.length} shared interest${sharedInterests.length === 1 ? "" : "s"}`
    );
  }

  if (sameChapter && supportRole === "PRIMARY_MENTOR") {
    score += 20;
    reasons.push("Same chapter");
  } else if (sameChapter) {
    score += 10;
    reasons.push("Chapter affinity");
  }

  if (capacity != null) {
    const remaining = capacity - currentLoad;
    if (remaining > 0) {
      score += Math.min(remaining * 8, 24);
      reasons.push(`Capacity available (${remaining} slot${remaining === 1 ? "" : "s"})`);
    } else {
      score -= 15;
      reasons.push("At or above preferred capacity");
    }
  } else {
    score += Math.max(0, 18 - currentLoad * 6);
    reasons.push(currentLoad === 0 ? "No current support load" : `${currentLoad} current assignments`);
  }

  if (availability) {
    score += 10;
    reasons.push("Availability noted");
  }

  if (hasProfile) {
    score += 6;
    reasons.push("Complete mentor profile");
  }

  if (supportRole === "COLLEGE_ADVISOR" || supportRole === "ALUMNI_ADVISOR") {
    score += 8;
    reasons.push("Future-planning support role");
  }

  return { score, reasons };
}

async function getAccessibleMenteeIds(userId: string, roles: string[]) {
  const { isAdmin, isChapterLead } = getMentorshipRoleFlags(roles);
  if (isAdmin || isChapterLead) {
    return null;
  }

  const [pairings, memberships] = await Promise.all([
    prisma.mentorship.findMany({
      where: {
        status: "ACTIVE",
        OR: [{ mentorId: userId }, { chairId: userId }],
      },
      select: { menteeId: true },
    }),
    prisma.mentorshipCircleMember.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: { menteeId: true },
    }),
  ]);

  return Array.from(
    new Set([
      ...pairings.map((pairing) => pairing.menteeId),
      ...memberships.map((member) => member.menteeId),
    ])
  );
}

function buildParticipantLookup(
  circleMembers: Array<{
    user: { id: string; name: string; email: string; primaryRole: string };
    role: SupportRole;
    isPrimary: boolean;
  }>
) {
  return new Map(
    circleMembers.map((member) => [
      member.user.id,
      {
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
        primaryRole: member.user.primaryRole,
        role: member.role,
        isPrimary: member.isPrimary,
      },
    ])
  );
}

export async function getMentorshipHubData(params: {
  userId: string;
  roles: string[];
}) {
  const { userId, roles } = params;
  const flags = getMentorshipRoleFlags(roles);
  const currentMonth = startOfMonth();
  const nextMonth = startOfNextMonth();
  const accessibleMenteeIds = flags.isStudent
    ? [userId]
    : await getAccessibleMenteeIds(userId, roles);

  const mentorshipWhere =
    accessibleMenteeIds == null
      ? { status: "ACTIVE" as const }
      : {
          status: "ACTIVE" as const,
          menteeId: { in: accessibleMenteeIds.length === 0 ? ["__none__"] : accessibleMenteeIds },
        };

  const [mentorships, featuredResources, openRequests, pendingApprovals] =
    await Promise.all([
      prisma.mentorship.findMany({
        where: mentorshipWhere,
        include: {
          mentee: {
            select: {
              id: true,
              name: true,
              email: true,
              primaryRole: true,
              chapter: { select: { name: true } },
              profile: {
                select: {
                  interests: true,
                  bio: true,
                },
              },
              reflectionSubmissions: {
                where: {
                  month: {
                    gte: currentMonth,
                    lt: nextMonth,
                  },
                },
                orderBy: { submittedAt: "desc" },
                take: 1,
              },
              incubatorProjects: {
                select: {
                  id: true,
                  title: true,
                  currentPhase: true,
                },
                orderBy: { createdAt: "desc" },
                take: 2,
              },
            },
          },
          mentor: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          chair: {
            select: {
              id: true,
              name: true,
            },
          },
          track: {
            select: {
              id: true,
              name: true,
            },
          },
          circleMembers: {
            where: { isActive: true },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  primaryRole: true,
                },
              },
            },
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          },
          sessions: {
            orderBy: [{ completedAt: "desc" }, { scheduledAt: "asc" }],
            take: 4,
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
            orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
            take: 5,
          },
          supportRequests: {
            where: {
              status: {
                in: [MentorshipRequestStatus.OPEN, MentorshipRequestStatus.ANSWERED],
              },
            },
            include: {
              requester: {
                select: { id: true, name: true },
              },
              assignedTo: {
                select: { id: true, name: true },
              },
              responses: {
                include: {
                  responder: {
                    select: { id: true, name: true },
                  },
                },
                orderBy: { createdAt: "desc" },
                take: 2,
              },
            },
            orderBy: { requestedAt: "desc" },
            take: 5,
          },
          resources: {
            where: { isPublished: true },
            orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
            take: 4,
          },
          monthlyReviews: {
            where: {
              month: currentMonth,
            },
            select: {
              id: true,
              status: true,
              publishedAt: true,
              mentorSubmittedAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { startDate: "desc" },
        take: flags.isAdmin ? 30 : 12,
      }),
      prisma.mentorshipResource.findMany({
        where: {
          isPublished: true,
          OR:
            accessibleMenteeIds == null
              ? undefined
              : [{ menteeId: { in: accessibleMenteeIds } }, { menteeId: null }],
        },
        include: {
          createdBy: {
            select: { id: true, name: true },
          },
        },
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
        take: 6,
      }),
      prisma.mentorshipRequest.count({
        where: {
          status: MentorshipRequestStatus.OPEN,
          ...(accessibleMenteeIds == null
            ? {}
            : { menteeId: { in: accessibleMenteeIds.length === 0 ? ["__none__"] : accessibleMenteeIds } }),
        },
      }),
      prisma.monthlyGoalReview.count({
        where: {
          month: currentMonth,
          status: "PENDING_CHAIR_APPROVAL",
          ...(accessibleMenteeIds == null
            ? {}
            : { menteeId: { in: accessibleMenteeIds.length === 0 ? ["__none__"] : accessibleMenteeIds } }),
        },
      }),
    ]);

  const now = Date.now();
  const circles = mentorships.map((mentorship) => {
    const nextSession =
      mentorship.sessions.find(
        (session) => !session.completedAt && session.scheduledAt.getTime() >= now
      ) ?? null;
    const latestSession =
      mentorship.sessions.find((session) => session.completedAt != null) ?? null;
    const daysSinceContact = latestSession
      ? Math.floor((now - latestSession.completedAt!.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const overdueActions = mentorship.actionItems.filter(
      (item) => item.dueAt && item.dueAt.getTime() < now
    ).length;
    const needsReflection = mentorship.mentee.reflectionSubmissions.length === 0;
    const currentReview = mentorship.monthlyReviews[0] ?? null;
    const pendingRequests = mentorship.supportRequests.filter(
      (request) => request.status === MentorshipRequestStatus.OPEN
    ).length;

    return {
      mentorshipId: mentorship.id,
      menteeId: mentorship.mentee.id,
      menteeName: mentorship.mentee.name,
      menteeRole: mentorship.mentee.primaryRole,
      menteeEmail: mentorship.mentee.email,
      chapterName: mentorship.mentee.chapter?.name ?? null,
      mentorName: mentorship.mentor.name,
      chairName: mentorship.chair?.name ?? null,
      trackName: mentorship.track?.name ?? null,
      supportCount: mentorship.circleMembers.length,
      nextSession,
      latestSession,
      daysSinceContact,
      overdueActions,
      needsReflection,
      pendingRequests,
      reviewStatus: currentReview?.status ?? null,
      openActionItems: mentorship.actionItems.length,
      highlightedResources: mentorship.resources,
    };
  });

  const relationshipHealth = {
    circlesWithNoUpcomingSession: circles.filter((circle) => !circle.nextSession).length,
    staleCircles: circles.filter(
      (circle) => circle.daysSinceContact == null || circle.daysSinceContact > 21
    ).length,
    lowSupportCoverage: circles.filter((circle) => circle.supportCount < 2).length,
  };

  const menteeMomentum = {
    overdueActions: circles.reduce((sum, circle) => sum + circle.overdueActions, 0),
    dueReflections: circles.filter((circle) => circle.needsReflection).length,
    openRequests,
  };

  const programOutcomes = {
    activePairings: circles.length,
    pendingApprovals,
    featuredResources: featuredResources.length,
    publicKnowledgeCount: featuredResources.filter((resource) => resource.type === "ANSWER").length,
  };

  return {
    flags,
    circles,
    relationshipHealth,
    menteeMomentum,
    programOutcomes,
    featuredResources,
  };
}

export async function getSupportWorkspaceData(params: {
  viewerId: string;
  roles: string[];
  menteeId: string;
}) {
  const { viewerId, roles, menteeId } = params;
  const flags = getMentorshipRoleFlags(roles);
  const accessibleMenteeIds = flags.isStudent ? [viewerId] : await getAccessibleMenteeIds(viewerId, roles);
  const canAccess =
    flags.isAdmin ||
    flags.isChapterLead ||
    viewerId === menteeId ||
    accessibleMenteeIds == null ||
    accessibleMenteeIds.includes(menteeId);

  if (!canAccess) {
    return null;
  }

  const currentMonth = startOfMonth();

  const [mentee, mentorship, requests, resources] = await Promise.all([
    prisma.user.findUnique({
      where: { id: menteeId },
      include: {
        chapter: true,
        profile: true,
        roles: true,
        goals: {
          include: {
            template: true,
            progress: {
              orderBy: { createdAt: "desc" },
              take: 1,
              include: {
                submittedBy: {
                  select: { name: true },
                },
              },
            },
          },
          orderBy: {
            template: { sortOrder: "asc" },
          },
        },
        trainings: {
          include: {
            module: true,
          },
        },
        enrollments: {
          include: {
            course: {
              select: {
                id: true,
                title: true,
                interestArea: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        incubatorProjects: {
          select: {
            id: true,
            title: true,
            currentPhase: true,
            xpEarned: true,
          },
          orderBy: { createdAt: "desc" },
          take: 3,
        },
        reflectionSubmissions: {
          include: {
            form: true,
          },
          orderBy: { submittedAt: "desc" },
          take: 6,
        },
      },
    }),
    prisma.mentorship.findFirst({
      where: {
        menteeId,
        status: "ACTIVE",
      },
      include: {
        mentor: {
          select: { id: true, name: true, email: true, primaryRole: true },
        },
        chair: {
          select: { id: true, name: true, email: true, primaryRole: true },
        },
        track: {
          select: { id: true, name: true },
        },
        circleMembers: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                primaryRole: true,
                profile: {
                  select: {
                    bio: true,
                    interests: true,
                    mentorAvailability: true,
                  },
                },
              },
            },
          },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        },
        sessions: {
          orderBy: [{ scheduledAt: "desc" }],
          take: 8,
        },
        actionItems: {
          include: {
            owner: {
              select: { id: true, name: true },
            },
            createdBy: {
              select: { id: true, name: true },
            },
          },
          orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
          take: 12,
        },
        monthlyReviews: {
          include: {
            goalRatings: {
              include: {
                goal: {
                  include: {
                    template: true,
                  },
                },
              },
            },
          },
          orderBy: [{ month: "desc" }],
          take: 3,
        },
      },
    }),
    prisma.mentorshipRequest.findMany({
      where: { menteeId },
      include: {
        requester: {
          select: { id: true, name: true },
        },
        assignedTo: {
          select: { id: true, name: true },
        },
        responses: {
          include: {
            responder: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: [{ requestedAt: "desc" }],
      take: 10,
    }),
    prisma.mentorshipResource.findMany({
      where: {
        OR: [{ menteeId }, { mentorship: { menteeId } }],
      },
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      take: 10,
    }),
  ]);

  if (!mentee) {
    return null;
  }

  const circleMembers = mentorship?.circleMembers ?? [];
  const participantLookup = buildParticipantLookup(
    circleMembers.map((member) => ({
      user: {
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
        primaryRole: member.user.primaryRole,
      },
      role: member.role,
      isPrimary: member.isPrimary,
    }))
  );

  const sessions =
    mentorship?.sessions.map((session) => ({
      ...session,
      participants: session.participantIds
        .map((participantId) => participantLookup.get(participantId))
        .filter(Boolean),
      attendees: session.attendedIds
        .map((participantId) => participantLookup.get(participantId))
        .filter(Boolean),
    })) ?? [];

  const currentReview =
    mentorship?.monthlyReviews.find(
      (review) => review.month.getTime() === currentMonth.getTime()
    ) ?? null;

  return {
    flags,
    mentee,
    mentorship,
    circleMembers,
    sessions,
    actionItems: mentorship?.actionItems ?? [],
    requests,
    resources,
    currentReview,
  };
}

export async function getStudentSupportCircleData(userId: string) {
  return getSupportWorkspaceData({
    viewerId: userId,
    roles: ["STUDENT"],
    menteeId: userId,
  });
}

export async function getPrivateMentorshipRequests(params: {
  userId: string;
  roles: string[];
}) {
  const { userId, roles } = params;
  const flags = getMentorshipRoleFlags(roles);
  const accessibleMenteeIds = flags.isStudent ? [userId] : await getAccessibleMenteeIds(userId, roles);
  const where =
    flags.isStudent
      ? {
          visibility: MentorshipRequestVisibility.PRIVATE,
          menteeId: userId,
        }
      : {
          visibility: MentorshipRequestVisibility.PRIVATE,
          ...(accessibleMenteeIds == null
            ? {}
            : { menteeId: { in: accessibleMenteeIds.length === 0 ? ["__none__"] : accessibleMenteeIds } }),
        };

  return prisma.mentorshipRequest.findMany({
    where,
    include: {
      requester: {
        select: { id: true, name: true },
      },
      mentee: {
        select: { id: true, name: true, email: true },
      },
      assignedTo: {
        select: { id: true, name: true },
      },
      responses: {
        include: {
          responder: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      resources: {
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
    take: flags.isStudent ? 20 : 40,
  });
}

export async function getMentorshipCommonsData(params: {
  q?: string;
  passionId?: string;
}) {
  const { q, passionId } = params;
  return prisma.mentorshipRequest.findMany({
    where: {
      visibility: MentorshipRequestVisibility.PUBLIC,
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { details: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(passionId ? { passionId } : {}),
    },
    include: {
      requester: {
        select: { id: true, name: true },
      },
      responses: {
        include: {
          responder: {
            select: { id: true, name: true },
          },
        },
        orderBy: [{ createdAt: "desc" }],
      },
      resources: {
        where: { isPublished: true },
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      },
    },
    orderBy: [{ lastResponseAt: "desc" }, { requestedAt: "desc" }],
    take: 60,
  });
}

export async function getMentorshipResourceLibrary(params: {
  q?: string;
  passionId?: string;
}) {
  const { q, passionId } = params;
  return prisma.mentorshipResource.findMany({
    where: {
      isPublished: true,
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { body: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(passionId ? { passionId } : {}),
    },
    include: {
      createdBy: {
        select: { id: true, name: true },
      },
      request: {
        select: { id: true, title: true, kind: true },
      },
    },
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    take: 80,
  });
}

export async function getMentorshipGovernanceSnapshot() {
  const now = Date.now();
  const threeWeeksAgo = new Date(now - 21 * 24 * 60 * 60 * 1000);

  const [mentorships, openRequests, resources] = await Promise.all([
    prisma.mentorship.findMany({
      where: { status: "ACTIVE" },
      include: {
        mentee: {
          select: {
            id: true,
            name: true,
            primaryRole: true,
          },
        },
        mentor: {
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
        },
        sessions: {
          orderBy: { scheduledAt: "desc" },
          take: 3,
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
      },
      orderBy: { startDate: "desc" },
      take: 50,
    }),
    prisma.mentorshipRequest.count({
      where: { status: MentorshipRequestStatus.OPEN },
    }),
    prisma.mentorshipResource.count({
      where: { isPublished: true },
    }),
  ]);

  const staffingGaps = mentorships.flatMap((mentorship) => {
      const roles = new Set(mentorship.circleMembers.map((member) => member.role));
      const missing: string[] = [];
      if (!roles.has(SupportRole.CHAIR)) {
        missing.push("chair");
      }
      if (
        !roles.has(SupportRole.SPECIALIST_MENTOR) &&
        !roles.has(SupportRole.COLLEGE_ADVISOR) &&
        !roles.has(SupportRole.ALUMNI_ADVISOR)
      ) {
        missing.push("specialist or advisor");
      }

      return missing.length > 0
        ? [
            {
              mentorshipId: mentorship.id,
              menteeId: mentorship.mentee.id,
              menteeName: mentorship.mentee.name,
              menteeRole: mentorship.mentee.primaryRole,
              mentorName: mentorship.mentor.name,
              missing,
            },
          ]
        : [];
    });

  const cadenceRisks = mentorships.flatMap((mentorship) => {
      const latestSession = mentorship.sessions[0] ?? null;
      const hasUpcoming = mentorship.sessions.some(
        (session) => !session.completedAt && session.scheduledAt.getTime() > now
      );
      const stale =
        !latestSession ||
        (!hasUpcoming &&
          (latestSession.completedAt ?? latestSession.scheduledAt).getTime() < threeWeeksAgo.getTime());

      if (!stale) {
        return [];
      }

      return [
        {
          mentorshipId: mentorship.id,
          menteeId: mentorship.mentee.id,
          menteeName: mentorship.mentee.name,
          lastSessionAt:
            latestSession?.completedAt?.toISOString() ??
            latestSession?.scheduledAt.toISOString() ??
            null,
          overdueActions: mentorship.actionItems.filter(
            (item) => item.dueAt && item.dueAt.getTime() < now
          ).length,
        },
      ];
    });

  return {
    activePairings: mentorships.length,
    staffingGaps,
    cadenceRisks,
    openRequests,
    publishedResources: resources,
  };
}

export function deriveMentorshipTypeFromRole(primaryRole: string): MentorshipType {
  return primaryRole === "STUDENT" ? "STUDENT" : "INSTRUCTOR";
}
