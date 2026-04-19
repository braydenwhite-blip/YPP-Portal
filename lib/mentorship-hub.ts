import {
  MentorshipActionItemStatus,
  MentorshipRequestStatus,
  MentorshipRequestVisibility,
  MentorshipResourceType,
  SupportRole,
  type MentorshipType,
} from "@prisma/client";

import { getMentorshipAccessibleMenteeIds } from "@/lib/mentorship-access";
import { mentorshipRequiresMonthlyReflection } from "@/lib/mentorship-canonical";
import { prisma } from "@/lib/prisma";

const MENTOR_ROLES = ["MENTOR", "INSTRUCTOR", "CHAPTER_PRESIDENT", "ADMIN", "STAFF"] as const;

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
    tone: "#6b21c8",
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
  const isChapterLead = roles.includes("CHAPTER_PRESIDENT");
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

// Maximum possible raw score (for normalizing to compatibility %)
// Interest: 36 + Chapter: 20 + Capacity: 24 + Availability: 10 + Profile: 6 + Effectiveness: 15 = 111
const MAX_MATCH_SCORE = 111;

export function scoreSupportMatch(params: {
  supportRole: SupportRole;
  mentorInterests: string[];
  menteeInterests: string[];
  sameChapter: boolean;
  currentLoad: number;
  capacity: number | null;
  availability: string | null;
  hasProfile: boolean;
  effectivenessScore?: number | null; // 0–100, from MentorEffectivenessScore.totalScore
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
    effectivenessScore,
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

  // Effectiveness score bonus (0–15 pts based on 0–100 effectiveness score)
  if (effectivenessScore != null && effectivenessScore > 0) {
    const effectivenessBonus = Math.round((effectivenessScore / 100) * 15);
    score += effectivenessBonus;
    reasons.push(`Effectiveness score: ${effectivenessScore}/100`);
  }

  const compatibilityPercent = Math.min(100, Math.round(Math.max(0, score) / MAX_MATCH_SCORE * 100));

  return { score, reasons, compatibilityPercent };
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
    : await getMentorshipAccessibleMenteeIds(userId, roles);

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
        select: {
          id: true,
          programGroup: true,
          governanceMode: true,
          startDate: true,
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
                select: {
                  id: true,
                  month: true,
                  submittedAt: true,
                },
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
            select: {
              id: true,
              mentorshipId: true,
              menteeId: true,
              userId: true,
              role: true,
              source: true,
              isPrimary: true,
              isActive: true,
              notes: true,
              availabilityNotes: true,
              capacityOverride: true,
              createdAt: true,
              updatedAt: true,
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
            select: {
              id: true,
              mentorshipId: true,
              scheduleRequestId: true,
              menteeId: true,
              type: true,
              title: true,
              scheduledAt: true,
              completedAt: true,
              cancelledAt: true,
              durationMinutes: true,
              agenda: true,
              notes: true,
              meetingLink: true,
              cancellationReason: true,
              schedulingOverrideReason: true,
              reminder24SentAt: true,
              reminder2SentAt: true,
              participantIds: true,
              attendedIds: true,
              createdById: true,
              ledById: true,
              createdAt: true,
              updatedAt: true,
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
            orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
            take: 5,
            select: {
              id: true,
              mentorshipId: true,
              menteeId: true,
              sessionId: true,
              title: true,
              details: true,
              status: true,
              ownerId: true,
              createdById: true,
              dueAt: true,
              completedAt: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          supportRequests: {
            where: {
              status: {
                in: [MentorshipRequestStatus.OPEN, MentorshipRequestStatus.ANSWERED],
              },
            },
            orderBy: { requestedAt: "desc" },
            take: 5,
            select: {
              id: true,
              mentorshipId: true,
              menteeId: true,
              requesterId: true,
              assignedToId: true,
              trackId: true,
              kind: true,
              visibility: true,
              status: true,
              title: true,
              details: true,
              isAnonymous: true,
              passionId: true,
              projectId: true,
              requestedAt: true,
              resolvedAt: true,
              lastResponseAt: true,
              requester: {
                select: { id: true, name: true },
              },
              assignedTo: {
                select: { id: true, name: true },
              },
              responses: {
                orderBy: { createdAt: "desc" },
                take: 2,
                select: {
                  id: true,
                  requestId: true,
                  responderId: true,
                  body: true,
                  videoUrl: true,
                  resourceLinks: true,
                  isHelpful: true,
                  helpfulCount: true,
                  createdAt: true,
                  updatedAt: true,
                  responder: {
                    select: { id: true, name: true },
                  },
                },
              },
            },
          },
          resources: {
            where: { isPublished: true },
            orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
            take: 4,
            select: {
              id: true,
              mentorshipId: true,
              menteeId: true,
              requestId: true,
              responseId: true,
              trackId: true,
              createdById: true,
              type: true,
              title: true,
              description: true,
              url: true,
              body: true,
              passionId: true,
              isFeatured: true,
              isPublished: true,
              createdAt: true,
              updatedAt: true,
            },
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
          requiresChairApproval: true,
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
    const needsReflection =
      mentorshipRequiresMonthlyReflection({
        programGroup: mentorship.programGroup,
        governanceMode: mentorship.governanceMode,
      }) && mentorship.mentee.reflectionSubmissions.length === 0;
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
  const accessibleMenteeIds = flags.isStudent
    ? [viewerId]
    : await getMentorshipAccessibleMenteeIds(viewerId, roles);
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

  const [mentee, mentorship, requests, resources, preAssignmentActionItems, launchedIntakeCase] = await Promise.all([
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
      select: {
        id: true,
        programGroup: true,
        governanceMode: true,
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
          select: {
            id: true,
            mentorshipId: true,
            menteeId: true,
            userId: true,
            role: true,
            source: true,
            isPrimary: true,
            isActive: true,
            notes: true,
            availabilityNotes: true,
            capacityOverride: true,
            createdAt: true,
            updatedAt: true,
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
          select: {
            id: true,
            mentorshipId: true,
            scheduleRequestId: true,
            menteeId: true,
            type: true,
            title: true,
            scheduledAt: true,
            completedAt: true,
            cancelledAt: true,
            durationMinutes: true,
            agenda: true,
            notes: true,
            meetingLink: true,
            cancellationReason: true,
            schedulingOverrideReason: true,
            reminder24SentAt: true,
            reminder2SentAt: true,
            participantIds: true,
            attendedIds: true,
            createdById: true,
            ledById: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        actionItems: {
          orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
          take: 12,
          select: {
            id: true,
            mentorshipId: true,
            menteeId: true,
            sessionId: true,
            title: true,
            details: true,
            status: true,
            ownerId: true,
            owner: { select: { id: true, name: true } },
            createdById: true,
            createdBy: { select: { id: true, name: true } },
            dueAt: true,
            completedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        monthlyReviews: {
          orderBy: [{ month: "desc" }],
          take: 3,
          select: {
            id: true,
            mentorshipId: true,
            trackId: true,
            menteeId: true,
            mentorId: true,
            chairId: true,
            reflectionSubmissionId: true,
            month: true,
            requiresChairApproval: true,
            status: true,
            overallStatus: true,
            overallComments: true,
            strengths: true,
            focusAreas: true,
            collaborationNotes: true,
            promotionReadiness: true,
            nextMonthPlan: true,
            mentorInternalNotes: true,
            chairDecisionNotes: true,
            characterCulturePoints: true,
            baseAchievementPoints: true,
            totalAchievementPoints: true,
            mentorSubmittedAt: true,
            chairDecisionAt: true,
            publishedAt: true,
            createdAt: true,
            updatedAt: true,
            goalRatings: {
              select: {
                id: true,
                reviewId: true,
                goalId: true,
                status: true,
                comments: true,
                createdAt: true,
                updatedAt: true,
                goal: {
                  select: {
                    id: true,
                    templateId: true,
                    userId: true,
                    targetDate: true,
                    timetable: true,
                    createdAt: true,
                    updatedAt: true,
                    template: {
                      select: {
                        id: true,
                        title: true,
                        description: true,
                        roleType: true,
                        mentorshipProgramGroup: true,
                        chapterId: true,
                        isActive: true,
                        sortOrder: true,
                        createdAt: true,
                        updatedAt: true,
                      },
                    },
                  },
                },
              },
            },
          },
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
    prisma.mentorshipActionItem.findMany({
      where: {
        menteeId,
        mentorshipId: null,
      },
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
    }),
    prisma.studentIntakeCase.findFirst({
      where: {
        studentUserId: menteeId,
        status: "MENTOR_PLAN_LAUNCHED",
      },
      include: {
        chapter: {
          select: { id: true, name: true },
        },
        reviewOwner: {
          select: { id: true, name: true },
        },
      },
      orderBy: { mentorPlanLaunchedAt: "desc" },
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
    intakePlanLaunch: launchedIntakeCase,
    circleMembers,
    sessions,
    actionItems: [...(mentorship?.actionItems ?? []), ...preAssignmentActionItems],
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
  const accessibleMenteeIds = flags.isStudent
    ? [userId]
    : await getMentorshipAccessibleMenteeIds(userId, roles);
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
      select: {
        id: true,
        programGroup: true,
        governanceMode: true,
        startDate: true,
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
            id: true,
            role: true,
            user: {
              select: { id: true, name: true },
            },
          },
        },
        sessions: {
          orderBy: { scheduledAt: "desc" },
          take: 3,
          select: {
            id: true,
            mentorshipId: true,
            scheduleRequestId: true,
            menteeId: true,
            type: true,
            title: true,
            scheduledAt: true,
            completedAt: true,
            cancelledAt: true,
            durationMinutes: true,
            agenda: true,
            notes: true,
            meetingLink: true,
            cancellationReason: true,
            schedulingOverrideReason: true,
            reminder24SentAt: true,
            reminder2SentAt: true,
            participantIds: true,
            attendedIds: true,
            createdById: true,
            ledById: true,
            createdAt: true,
            updatedAt: true,
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
