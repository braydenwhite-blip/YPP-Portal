/**
 * @deprecated LEGACY MODULE — do not add new server actions here.
 * This module operates against the legacy MonthlyGoalReview / ReflectionForm /
 * MentorshipAwardRecommendation models which are frozen pending Phase 1 migration.
 * New code should use lib/goal-review-actions.ts and lib/self-reflection-actions.ts
 * instead.
 */
"use server";

import { getSession } from "@/lib/auth-supabase";
import {
  AuditAction,
  MenteeRoleType,
  MentorshipAwardPolicy,
  MentorshipAwardLevel,
  MentorshipCommitteeScope,
  MentorshipGovernanceMode,
  MentorshipProgramGroup,
  MentorshipSessionType,
  MentorshipStatus,
  MentorshipReviewStatus,
  MentorshipType,
  NotificationType,
  ProgressStatus,
  RoleType,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import { logAuditEvent } from "@/lib/audit-log-actions";
import {
  ensureCanonicalTrack,
  enforceFullProgramMentorCapacity,
  getAchievementAwardLevelForPoints,
  getAwardPolicyForProgramGroup,
  getCommitteeScopeForProgramGroup,
  getDefaultMentorCapForProgramGroup,
  getGovernanceModeForProgramGroup,
  getLegacyMenteeRoleTypeForRole,
  getMentorshipProgramGroupForRole,
  getMentorshipTypeForProgramGroup,
  mentorshipRequiresChairApproval,
  mentorshipRequiresKickoff,
  mentorshipRequiresMonthlyReflection,
} from "@/lib/mentorship-canonical";
import {
  calculateOverallProgress,
  getAchievementPointsForCategory,
  getDefaultPointCategory,
  normalizeMonthlyReviewMonth,
} from "@/lib/mentorship-review-helpers";
import {
  getMentorshipAccessibleMenteeIds,
  hasMentorshipMenteeAccess,
} from "@/lib/mentorship-access";
import { ensureMentorshipSupportCircle } from "@/lib/mentorship-hub-actions";
import { prisma } from "@/lib/prisma";

function getString(formData: FormData, key: string, required = true) {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing ${key}`);
  }
  return value ? String(value).trim() : "";
}

function getOptionalDate(value: FormDataEntryValue | null) {
  if (!value || String(value).trim() === "") {
    return null;
  }
  return new Date(String(value));
}

function getOptionalNumber(value: FormDataEntryValue | null) {
  if (!value || String(value).trim() === "") {
    return 0;
  }
  return Number(String(value)) || 0;
}

function getBoolean(formData: FormData, key: string) {
  const value = formData.get(key);
  return value === "true" || value === "on";
}

async function requireSession() {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

async function requireAdmin() {
  const session = await requireSession();
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    throw new Error("Unauthorized");
  }
  return session;
}

function hasRole(roles: string[], role: string) {
  return roles.includes(role);
}

function parseProgramGroup(
  value: string | null | undefined,
  fallbackRole?: RoleType | string | null
) {
  if (value && Object.values(MentorshipProgramGroup).includes(value as MentorshipProgramGroup)) {
    return value as MentorshipProgramGroup;
  }
  return getMentorshipProgramGroupForRole(fallbackRole);
}

function parseGovernanceMode(
  value: string | null | undefined,
  programGroup: MentorshipProgramGroup
) {
  if (
    value &&
    Object.values(MentorshipGovernanceMode).includes(
      value as MentorshipGovernanceMode
    )
  ) {
    return value as MentorshipGovernanceMode;
  }
  return getGovernanceModeForProgramGroup(programGroup);
}

function parseCommitteeScope(
  value: string | null | undefined,
  programGroup: MentorshipProgramGroup
) {
  if (
    value &&
    Object.values(MentorshipCommitteeScope).includes(
      value as MentorshipCommitteeScope
    )
  ) {
    return value as MentorshipCommitteeScope;
  }
  return getCommitteeScopeForProgramGroup(programGroup);
}

function parseAwardPolicy(
  value: string | null | undefined,
  programGroup: MentorshipProgramGroup
) {
  if (
    value &&
    Object.values(MentorshipAwardPolicy).includes(value as MentorshipAwardPolicy)
  ) {
    return value as MentorshipAwardPolicy;
  }
  return getAwardPolicyForProgramGroup(programGroup);
}

async function resolveMentorshipChairId(params: {
  trackId?: string | null;
  primaryRole?: RoleType | string | null;
  existingChairId?: string | null;
}) {
  const { trackId = null, primaryRole, existingChairId = null } = params;
  if (existingChairId) {
    return existingChairId;
  }

  if (trackId) {
    const track = await prisma.mentorshipTrack.findUnique({
      where: { id: trackId },
      select: {
        committees: {
          where: {
            chairUserId: {
              not: null,
            },
          },
          orderBy: { createdAt: "asc" },
          select: { chairUserId: true },
        },
      },
    });

    const committeeChairId = track?.committees[0]?.chairUserId ?? null;
    if (committeeChairId) {
      return committeeChairId;
    }
  }

  const legacyRoleType = getLegacyMenteeRoleTypeForRole(primaryRole);
  const legacyChair = await prisma.mentorCommitteeChair.findFirst({
    where: {
      roleType: legacyRoleType,
      isActive: true,
    },
    orderBy: { updatedAt: "desc" },
    select: { userId: true },
  });

  return legacyChair?.userId ?? null;
}

async function resolveCanonicalTrackForMentee(params: {
  trackId?: string | null;
  primaryRole?: RoleType | string | null;
  chapterId?: string | null;
  chapterName?: string | null;
}) {
  const { trackId = null, primaryRole, chapterId = null, chapterName = null } = params;

  if (trackId) {
    return prisma.mentorshipTrack.findUniqueOrThrow({
      where: { id: trackId },
    });
  }

  const programGroup = getMentorshipProgramGroupForRole(primaryRole);
  const scopedChapterId =
    programGroup === MentorshipProgramGroup.INSTRUCTOR ||
    programGroup === MentorshipProgramGroup.STUDENT
      ? chapterId
      : null;

  return ensureCanonicalTrack({
    group: programGroup,
    chapterId: scopedChapterId,
    chapterName,
  });
}

export async function assignProgramMentor(formData: FormData) {
  const session = await requireAdmin();
  const mentorId = getString(formData, "mentorId");
  const menteeId = getString(formData, "menteeId");
  const notes = getString(formData, "notes", false);

  if (mentorId === menteeId) {
    throw new Error("Mentor and mentee cannot be the same person");
  }

  const [mentor, mentee] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: mentorId },
      select: { id: true, name: true },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: menteeId },
      select: {
        id: true,
        name: true,
        primaryRole: true,
        chapterId: true,
        chapter: { select: { name: true } },
      },
    }),
  ]);

  const existing = await prisma.mentorship.findFirst({
    where: { menteeId, status: "ACTIVE" },
  });

  if (existing) {
    throw new Error(`${mentee.name} already has an active program mentor`);
  }

  const programGroup = getMentorshipProgramGroupForRole(mentee.primaryRole);
  const governanceMode = getGovernanceModeForProgramGroup(programGroup);
  const track = await resolveCanonicalTrackForMentee({
    primaryRole: mentee.primaryRole,
    chapterId: mentee.chapterId,
    chapterName: mentee.chapter?.name ?? null,
  });
  const chairId = await resolveMentorshipChairId({
    trackId: track.id,
    primaryRole: mentee.primaryRole,
  });

  await enforceFullProgramMentorCapacity({
    mentorId: mentor.id,
    programGroup,
    governanceMode,
  });

  // Seed the mentorship record with the first kickoff target date so the
  // governance view and review workflow stay aligned with the session plan.
  const kickoffDate = new Date();
  kickoffDate.setDate(kickoffDate.getDate() + 7); // Schedule 1 week out

  const mentorship = await prisma.mentorship.create({
    data: {
      mentorId: mentor.id,
      menteeId: mentee.id,
      type: getMentorshipTypeForProgramGroup(programGroup),
      programGroup,
      governanceMode,
      status: MentorshipStatus.ACTIVE,
      trackId: track.id,
      chairId,
      kickoffScheduledAt: kickoffDate,
      notes: notes || null,
    },
  });

  await logAuditEvent({
    action: AuditAction.MENTORSHIP_CREATED,
    actorId: session.user.id,
    targetType: "Mentorship",
    targetId: mentorship.id,
    description: `Program mentor assigned: ${mentor.name} -> ${mentee.name}`,
  });

  await ensureMentorshipSupportCircle(mentorship.id);

  // Auto-create kickoff meeting session
  await prisma.mentorshipSession.create({
    data: {
      mentorshipId: mentorship.id,
      menteeId: mentee.id,
      type: MentorshipSessionType.KICKOFF,
      title: `Kickoff Meeting: ${mentor.name} & ${mentee.name}`,
      scheduledAt: kickoffDate,
      agenda: [
        "1. Introductions and get to know each other",
        "2. Discuss mentee's goals and expectations",
        "3. Review the mentorship program process and timeline",
        "4. Set communication preferences and meeting cadence",
        "5. Exchange contact information",
        "6. Q&A and next steps",
      ].join("\n"),
      createdById: session.user.id,
      ledById: mentor.id,
      participantIds: [mentor.id, mentee.id],
    },
  });

  revalidatePath("/admin/mentorship-program");
}

export async function endProgramMentorship(formData: FormData) {
  const session = await requireAdmin();
  const mentorshipId = getString(formData, "mentorshipId");
  const newStatus = (getString(formData, "status", false) ||
    "COMPLETE") as MentorshipStatus;

  const mentorship = await prisma.mentorship.findUniqueOrThrow({
    where: { id: mentorshipId },
    include: {
      mentor: { select: { name: true } },
      mentee: { select: { name: true } },
    },
  });

  await prisma.mentorship.update({
    where: { id: mentorshipId },
    data: { status: newStatus, endDate: new Date() },
  });

  await prisma.mentorshipCircleMember.updateMany({
    where: { mentorshipId },
    data: { isActive: false },
  });

  await logAuditEvent({
    action: AuditAction.MENTORSHIP_UPDATED,
    actorId: session.user.id,
    targetType: "Mentorship",
    targetId: mentorshipId,
    description: `Program mentorship ended (${newStatus}): ${mentorship.mentor.name} -> ${mentorship.mentee.name}`,
  });

  revalidatePath("/admin/mentorship-program");
}

export async function assignCommitteeChair(formData: FormData) {
  const session = await requireAdmin();
  const userId = getString(formData, "userId");
  const roleTypeRaw = getString(formData, "roleType");
  const roleType = roleTypeRaw as MenteeRoleType;

  if (!Object.values(MenteeRoleType).includes(roleType)) {
    throw new Error("Invalid roleType");
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true },
  });

  await prisma.mentorCommitteeChair.updateMany({
    where: { roleType, isActive: true },
    data: { isActive: false },
  });

  await prisma.mentorCommitteeChair.upsert({
    where: { userId_roleType: { userId, roleType } },
    create: { userId, roleType, isActive: true },
    update: { isActive: true },
  });

  await logAuditEvent({
    action: AuditAction.SETTINGS_CHANGED,
    actorId: session.user.id,
    targetType: "MentorCommitteeChair",
    targetId: userId,
    description: `Mentor Committee Chair assigned: ${user.name} -> ${roleType}`,
  });

  revalidatePath("/admin/mentorship-program");
}

export async function removeCommitteeChair(formData: FormData) {
  const session = await requireAdmin();
  const chairId = getString(formData, "chairId");

  const chair = await prisma.mentorCommitteeChair.findUniqueOrThrow({
    where: { id: chairId },
    include: { user: { select: { name: true } } },
  });

  await prisma.mentorCommitteeChair.update({
    where: { id: chairId },
    data: { isActive: false },
  });

  await logAuditEvent({
    action: AuditAction.SETTINGS_CHANGED,
    actorId: session.user.id,
    targetType: "MentorCommitteeChair",
    targetId: chairId,
    description: `Mentor Committee Chair removed: ${chair.user.name} (${chair.roleType})`,
  });

  revalidatePath("/admin/mentorship-program");
}

export async function createProgramGoal(formData: FormData) {
  const session = await requireAdmin();
  const title = getString(formData, "title");
  const description = getString(formData, "description", false);
  const roleTypeRaw = getString(formData, "roleType");
  const roleType = roleTypeRaw as MenteeRoleType;

  if (!Object.values(MenteeRoleType).includes(roleType)) {
    throw new Error("Invalid roleType");
  }

  const sortOrderRaw = getString(formData, "sortOrder", false);
  const sortOrder = sortOrderRaw ? parseInt(sortOrderRaw, 10) : 0;

  await prisma.mentorshipProgramGoal.create({
    data: {
      title,
      description: description || null,
      roleType,
      sortOrder,
      createdById: session.user.id,
    },
  });

  revalidatePath("/admin/mentorship-program");
}

export async function toggleProgramGoal(formData: FormData) {
  await requireAdmin();
  const goalId = getString(formData, "goalId");
  const isActive = getString(formData, "isActive") === "true";

  await prisma.mentorshipProgramGoal.update({
    where: { id: goalId },
    data: { isActive: !isActive },
  });

  revalidatePath("/admin/mentorship-program");
}

export async function updateProgramGoal(formData: FormData) {
  await requireAdmin();
  const goalId = getString(formData, "goalId");
  const title = getString(formData, "title");
  const description = getString(formData, "description", false);
  const sortOrderRaw = getString(formData, "sortOrder", false);
  const sortOrder = sortOrderRaw ? parseInt(sortOrderRaw, 10) : 0;

  await prisma.mentorshipProgramGoal.update({
    where: { id: goalId },
    data: { title, description: description || null, sortOrder },
  });

  revalidatePath("/admin/mentorship-program");
}

async function getAccessibleMentorship(params: {
  menteeId: string;
  currentUserId: string;
  roles: string[];
}) {
  const { menteeId, currentUserId, roles } = params;
  const canAccess = await hasMentorshipMenteeAccess(
    currentUserId,
    roles,
    menteeId
  );

  if (!canAccess) {
    return null;
  }

  return prisma.mentorship.findFirst({
    where: {
      menteeId,
      status: "ACTIVE",
    },
    include: {
      mentor: { select: { id: true, name: true, email: true } },
      mentee: {
        select: {
          id: true,
          name: true,
          email: true,
          primaryRole: true,
          chapterId: true,
        },
      },
      track: {
        include: {
          committees: {
            include: {
              chairUser: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });
}

async function getMentorshipKickoffCompletedAt(params: {
  mentorshipId: string;
  storedKickoffCompletedAt?: Date | null;
}) {
  const { mentorshipId, storedKickoffCompletedAt = null } = params;

  if (storedKickoffCompletedAt) {
    return storedKickoffCompletedAt;
  }

  const completedKickoffSession = await prisma.mentorshipSession.findFirst({
    where: {
      mentorshipId,
      type: MentorshipSessionType.KICKOFF,
      completedAt: { not: null },
    },
    orderBy: [{ completedAt: "desc" }, { scheduledAt: "desc" }],
    select: { completedAt: true },
  });

  return completedKickoffSession?.completedAt ?? null;
}

async function canApproveReview(args: {
  roles: string[];
  currentUserId: string;
  review: {
    menteeId: string;
    chairId: string | null;
    mentorship: {
      chairId: string | null;
      track: {
        committees: Array<{ chairUserId: string | null }>;
      } | null;
    };
  };
}) {
  const { roles, currentUserId, review } = args;
  if (hasRole(roles, "ADMIN")) {
    return true;
  }

  if (hasRole(roles, "CHAPTER_PRESIDENT")) {
    return hasMentorshipMenteeAccess(currentUserId, roles, review.menteeId);
  }

  if (review.chairId === currentUserId || review.mentorship.chairId === currentUserId) {
    return true;
  }

  return (
    review.mentorship.track?.committees.some(
      (committee) => committee.chairUserId === currentUserId
    ) ?? false
  );
}

export async function createMentorshipNotification(params: {
  userId: string;
  title: string;
  body: string;
  link: string;
}) {
  await prisma.notification.create({
    data: {
      userId: params.userId,
      type: NotificationType.MENTOR_FEEDBACK,
      title: params.title,
      body: params.body,
      link: params.link,
    },
  });
}

async function syncAwardRecommendationFromPoints(params: {
  tx: Omit<
    typeof prisma,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
  >;
  userId: string;
  reviewId: string;
  trackId?: string | null;
  recommendedById: string;
  totalPoints: number;
}) {
  const { tx, userId, reviewId, trackId = null, recommendedById, totalPoints } = params;
  const level = getAchievementAwardLevelForPoints(totalPoints);
  if (!level) {
    return null;
  }

  const existing = await tx.mentorshipAwardRecommendation.findFirst({
    where: {
      userId,
      level,
    },
  });

  if (existing) {
    return existing;
  }

  const requiresBoard =
    level === MentorshipAwardLevel.GOLD ||
    level === MentorshipAwardLevel.LIFETIME;

  return tx.mentorshipAwardRecommendation.create({
    data: {
      userId,
      reviewId,
      trackId,
      level,
      recommendedById,
      approvedById: requiresBoard ? null : recommendedById,
      status: requiresBoard
        ? "PENDING_BOARD_APPROVAL"
        : "APPROVED",
      notes: `Automatically created after cumulative achievement points reached the ${level.toLowerCase()} threshold.`,
    },
  });
}

export async function getCurrentMonthlyGoalReview(menteeId: string, month?: string) {
  const session = await requireSession();
  const roles = session.user.roles ?? [];
  const normalizedMonth = normalizeMonthlyReviewMonth(month);
  const mentorship = await getAccessibleMentorship({
    menteeId,
    currentUserId: session.user.id,
    roles,
  });

  if (!mentorship) {
    throw new Error("You do not have access to this mentorship");
  }

  return prisma.monthlyGoalReview.findFirst({
    where: {
      mentorshipId: mentorship.id,
      month: normalizedMonth,
    },
    include: {
      goalRatings: {
        include: {
          goal: {
            include: { template: true },
          },
        },
        orderBy: { goal: { template: { sortOrder: "asc" } } },
      },
      reflectionSubmission: {
        include: {
          responses: {
            include: { question: true },
            orderBy: { question: { sortOrder: "asc" } },
          },
        },
      },
    },
  });
}

export async function getPendingChairReviews() {
  const session = await requireSession();
  const roles = session.user.roles ?? [];
  const currentUserId = session.user.id;
  const isAdmin = hasRole(roles, "ADMIN");
  const isChapterLead = hasRole(roles, "CHAPTER_PRESIDENT");
  const accessibleMenteeIds =
    isAdmin || !isChapterLead
      ? null
      : await getMentorshipAccessibleMenteeIds(currentUserId, roles);

  return prisma.monthlyGoalReview.findMany({
    where: {
      status: MentorshipReviewStatus.PENDING_CHAIR_APPROVAL,
      requiresChairApproval: true,
      ...(isAdmin
        ? {}
        : isChapterLead
          ? {
              menteeId: {
                in:
                  accessibleMenteeIds && accessibleMenteeIds.length > 0
                    ? accessibleMenteeIds
                    : ["__none__"],
              },
            }
        : {
            OR: [
              { chairId: currentUserId },
              { mentorship: { chairId: currentUserId } },
              {
                mentorship: {
                  track: {
                    committees: {
                      some: { chairUserId: currentUserId },
                    },
                  },
                },
              },
            ],
          }),
    },
    include: {
      mentee: {
        select: {
          id: true,
          name: true,
          email: true,
          primaryRole: true,
        },
      },
      mentor: {
        select: { id: true, name: true, email: true },
      },
      mentorship: {
        include: {
          track: {
            include: {
              committees: {
                include: {
                  chairUser: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
      goalRatings: {
        include: {
          goal: { include: { template: true } },
        },
        orderBy: { goal: { template: { sortOrder: "asc" } } },
      },
      reflectionSubmission: {
        include: {
          responses: {
            include: { question: true },
            orderBy: { question: { sortOrder: "asc" } },
          },
        },
      },
    },
    orderBy: [{ mentorSubmittedAt: "asc" }, { createdAt: "asc" }],
  });
}

export async function submitMonthlyGoalReview(formData: FormData) {
  const session = await requireSession();
  const roles = session.user.roles ?? [];
  const currentUserId = session.user.id;
  const menteeId = getString(formData, "forUserId");
  const month = normalizeMonthlyReviewMonth(formData.get("month") as string | null);
  const escalateToChair = getBoolean(formData, "escalateToChair");

  const mentorship = await getAccessibleMentorship({
    menteeId,
    currentUserId,
    roles,
  });

  if (!mentorship) {
    throw new Error("You do not have access to this mentee");
  }

  if (!hasRole(roles, "ADMIN") && mentorship.mentorId !== currentUserId) {
    throw new Error("Only the assigned mentor can submit the monthly goal review");
  }

  const programGroup =
    mentorship.programGroup ??
    mentorship.track?.programGroup ??
    getMentorshipProgramGroupForRole(mentorship.mentee.primaryRole);
  const governanceMode =
    mentorship.governanceMode ??
    mentorship.track?.governanceMode ??
    getGovernanceModeForProgramGroup(programGroup);
  const requiresKickoff = mentorshipRequiresKickoff({ programGroup, governanceMode });
  const requiresReflection = mentorshipRequiresMonthlyReflection({
    programGroup,
    governanceMode,
  });
  const requiresChairApproval = mentorshipRequiresChairApproval({
    programGroup,
    governanceMode,
    escalateToChair,
  });
  const kickoffCompletedAt = requiresKickoff
    ? await getMentorshipKickoffCompletedAt({
        mentorshipId: mentorship.id,
        storedKickoffCompletedAt: mentorship.kickoffCompletedAt,
      })
    : null;

  if (requiresKickoff && !kickoffCompletedAt) {
    throw new Error(
      "Complete the mentorship kickoff before submitting the monthly goal review."
    );
  }

  const goals = await prisma.goal.findMany({
    where: { userId: menteeId },
    include: { template: true },
    orderBy: { template: { sortOrder: "asc" } },
  });

  if (goals.length === 0) {
    throw new Error("This mentee has no goals assigned");
  }

  const goalRatings = goals.map((goal) => {
    const status = getString(formData, `goal_${goal.id}_status`) as ProgressStatus;
    const comments = getString(formData, `goal_${goal.id}_comments`, false);

    if (!Object.keys(ProgressStatus).includes(status)) {
      throw new Error(`Invalid status for goal ${goal.template.title}`);
    }

    return {
      goalId: goal.id,
      status,
      comments: comments || null,
    };
  });

  const overallStatus =
    (getString(formData, "overallStatus", false) as ProgressStatus | "") ||
    calculateOverallProgress(goalRatings.map((rating) => rating.status));

  if (!overallStatus) {
    throw new Error("Missing overallStatus");
  }

  const overallComments = getString(formData, "overallComments");
  const strengths = getString(formData, "strengths", false);
  const focusAreas = getString(formData, "focusAreas", false);
  const collaborationNotes = getString(formData, "collaborationNotes", false);
  const promotionReadiness = getString(formData, "promotionReadiness", false);
  const nextMonthPlan = getString(formData, "nextMonthPlan");
  const mentorInternalNotes = getString(formData, "mentorInternalNotes", false);
  const characterCulturePoints = getOptionalNumber(
    formData.get("characterCulturePoints")
  );

  const reflectionSubmission = await prisma.reflectionSubmission.findFirst({
    where: {
      userId: menteeId,
      month: {
        gte: month,
        lt: new Date(month.getFullYear(), month.getMonth() + 1, 1),
      },
    },
    orderBy: { submittedAt: "desc" },
  });

  if (requiresReflection && !reflectionSubmission) {
    throw new Error(
      "This mentorship track requires a monthly self-reflection before the mentor review can be submitted."
    );
  }

  const submittedAt = new Date();
  const publishedAt = requiresChairApproval ? null : submittedAt;

  const review = await prisma.$transaction(async (tx) => {
    if (kickoffCompletedAt && !mentorship.kickoffCompletedAt) {
      await tx.mentorship.update({
        where: { id: mentorship.id },
        data: { kickoffCompletedAt },
      });
    }

    const existingReview = await tx.monthlyGoalReview.findFirst({
      where: {
        mentorshipId: mentorship.id,
        month,
      },
    });

    const savedReview = existingReview
      ? await tx.monthlyGoalReview.update({
          where: { id: existingReview.id },
          data: {
            trackId: mentorship.trackId,
            mentorId: mentorship.mentorId,
            menteeId,
            reflectionSubmissionId: reflectionSubmission?.id ?? null,
            requiresChairApproval,
            status: requiresChairApproval
              ? MentorshipReviewStatus.PENDING_CHAIR_APPROVAL
              : MentorshipReviewStatus.APPROVED,
            overallStatus,
            overallComments,
            strengths: strengths || null,
            focusAreas: focusAreas || null,
            collaborationNotes: collaborationNotes || null,
            promotionReadiness: promotionReadiness || null,
            nextMonthPlan,
            mentorInternalNotes: mentorInternalNotes || null,
            characterCulturePoints,
            mentorSubmittedAt: submittedAt,
            chairId: null,
            chairDecisionAt: null,
            chairDecisionNotes: null,
            publishedAt,
          },
        })
      : await tx.monthlyGoalReview.create({
          data: {
            mentorshipId: mentorship.id,
            trackId: mentorship.trackId,
            menteeId,
            mentorId: mentorship.mentorId,
            reflectionSubmissionId: reflectionSubmission?.id ?? null,
            month,
            requiresChairApproval,
            status: requiresChairApproval
              ? MentorshipReviewStatus.PENDING_CHAIR_APPROVAL
              : MentorshipReviewStatus.APPROVED,
            overallStatus,
            overallComments,
            strengths: strengths || null,
            focusAreas: focusAreas || null,
            collaborationNotes: collaborationNotes || null,
            promotionReadiness: promotionReadiness || null,
            nextMonthPlan,
            mentorInternalNotes: mentorInternalNotes || null,
            characterCulturePoints,
            mentorSubmittedAt: submittedAt,
            publishedAt,
          },
        });

    await tx.monthlyGoalRating.deleteMany({
      where: { reviewId: savedReview.id },
    });

    await tx.monthlyGoalRating.createMany({
      data: goalRatings.map((rating) => ({
        reviewId: savedReview.id,
        goalId: rating.goalId,
        status: rating.status,
        comments: rating.comments,
      })),
    });

    await tx.progressUpdate.deleteMany({
      where: { monthlyReviewId: savedReview.id },
    });

    await tx.progressUpdate.createMany({
      data: goalRatings.map((rating) => ({
        goalId: rating.goalId,
        monthlyReviewId: savedReview.id,
        submittedById: currentUserId,
        forUserId: menteeId,
        status: rating.status,
        comments: rating.comments,
      })),
    });

    return savedReview;
  });

  if (requiresChairApproval && mentorship.chairId) {
    await createMentorshipNotification({
      userId: mentorship.chairId,
      title: "Monthly Goal Review Needs Approval",
      body: `${mentorship.mentor.name} submitted ${mentorship.mentee.name}'s monthly goal review.`,
      link: "/mentorship/reviews",
    });
  } else {
    await createMentorshipNotification({
      userId: menteeId,
      title: "Your Monthly Goal Review Is Ready",
      body: "Your mentor published this month's goal review directly to the mentorship workspace.",
      link: "/goals",
    });
  }

  await logAuditEvent({
    action: AuditAction.MENTORSHIP_UPDATED,
    actorId: currentUserId,
    targetType: "MonthlyGoalReview",
    targetId: review.id,
    description: `Submitted monthly goal review for ${mentorship.mentee.name}.`,
    metadata: {
      menteeId,
      month: month.toISOString(),
      overallStatus,
      characterCulturePoints,
      programGroup,
      governanceMode,
      requiresChairApproval,
      escalateToChair,
    },
  });

  revalidatePath("/mentorship");
  revalidatePath("/mentorship/mentees");
  revalidatePath(`/mentorship/mentees/${menteeId}`);
  revalidatePath(`/mentorship/feedback/${menteeId}`);
  revalidatePath(`/mentorship/reviews/${menteeId}`);
  revalidatePath("/mentorship/reviews");
  revalidatePath("/goals");
}

export async function approveMonthlyGoalReview(formData: FormData) {
  const session = await requireSession();
  const roles = session.user.roles ?? [];
  const currentUserId = session.user.id;
  const reviewId = getString(formData, "reviewId");
  const chairDecisionNotes = getString(formData, "chairDecisionNotes", false);

  const review = await prisma.monthlyGoalReview.findUnique({
    where: { id: reviewId },
    include: {
      mentee: {
        select: {
          id: true,
          name: true,
          email: true,
          primaryRole: true,
        },
      },
      mentorship: {
        include: {
          track: {
            include: {
              committees: true,
            },
          },
        },
      },
      mentor: {
        select: { id: true, name: true },
      },
      achievementPoints: true,
    },
  });

  if (!review) {
    throw new Error("Monthly goal review not found");
  }

  if (!review.requiresChairApproval) {
    throw new Error("This review does not require chair approval.");
  }

  if (review.status !== MentorshipReviewStatus.PENDING_CHAIR_APPROVAL) {
    throw new Error("Only reviews waiting on chair approval can be approved.");
  }

  if (
    !(await canApproveReview({
      roles,
      currentUserId,
      review: {
        menteeId: review.menteeId,
        chairId: review.chairId,
        mentorship: {
          chairId: review.mentorship.chairId,
          track: review.mentorship.track,
        },
      },
    }))
  ) {
    throw new Error("You are not allowed to approve this review");
  }

  const programGroup =
    review.mentorship.programGroup ??
    review.mentorship.track?.programGroup ??
    getMentorshipProgramGroupForRole(review.mentee.primaryRole);
  const awardPolicy =
    review.mentorship.track?.awardPolicy ?? getAwardPolicyForProgramGroup(programGroup);
  const pointCategory =
    review.mentorship.track?.pointCategory ??
    getDefaultPointCategory(review.mentee.primaryRole);
  const baseAchievementPoints =
    awardPolicy === MentorshipAwardPolicy.ACHIEVEMENT_LADDER && review.overallStatus
      ? getAchievementPointsForCategory(pointCategory, review.overallStatus)
      : 0;
  const totalAchievementPoints =
    awardPolicy === MentorshipAwardPolicy.ACHIEVEMENT_LADDER
      ? baseAchievementPoints + review.characterCulturePoints
      : 0;

  await prisma.$transaction(async (tx) => {
    await tx.monthlyGoalReview.update({
      where: { id: review.id },
      data: {
        chairId: currentUserId,
        status: MentorshipReviewStatus.APPROVED,
        chairDecisionNotes: chairDecisionNotes || null,
        chairDecisionAt: new Date(),
        publishedAt: new Date(),
        baseAchievementPoints,
        totalAchievementPoints,
      },
    });

    const existingLedger = await tx.achievementPointLedger.findFirst({
      where: { reviewId: review.id },
    });

    if (
      awardPolicy === MentorshipAwardPolicy.ACHIEVEMENT_LADDER &&
      totalAchievementPoints > 0
    ) {
      if (existingLedger) {
        await tx.achievementPointLedger.update({
          where: { id: existingLedger.id },
          data: {
            points: totalAchievementPoints,
            category: pointCategory,
            reason: `Approved monthly goal review for ${review.month.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}`,
            approvedById: currentUserId,
          },
        });
      } else {
        await tx.achievementPointLedger.create({
          data: {
            userId: review.menteeId,
            reviewId: review.id,
            points: totalAchievementPoints,
            category: pointCategory,
            reason: `Approved monthly goal review for ${review.month.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}`,
            approvedById: currentUserId,
          },
        });
      }
    } else if (existingLedger) {
      await tx.achievementPointLedger.delete({
        where: { id: existingLedger.id },
      });
    }

    if (awardPolicy === MentorshipAwardPolicy.ACHIEVEMENT_LADDER) {
      const totals = await tx.achievementPointLedger.aggregate({
        where: { userId: review.menteeId },
        _sum: { points: true },
      });

      await syncAwardRecommendationFromPoints({
        tx,
        userId: review.menteeId,
        reviewId: review.id,
        trackId: review.trackId,
        recommendedById: currentUserId,
        totalPoints: totals._sum.points ?? 0,
      });
    }
  });

  await createMentorshipNotification({
    userId: review.mentorId,
    title: "Monthly Goal Review Approved",
    body: `${review.mentee.name}'s monthly goal review was approved.`,
    link: `/mentorship/mentees/${review.menteeId}`,
  });

  await createMentorshipNotification({
    userId: review.menteeId,
    title: "Your Monthly Goal Review Is Ready",
    body: `Your monthly goal review was approved and is now visible in the portal.`,
    link: "/goals",
  });

  await logAuditEvent({
    action: AuditAction.MENTORSHIP_UPDATED,
    actorId: currentUserId,
    targetType: "MonthlyGoalReview",
    targetId: review.id,
    description: `Approved monthly goal review for ${review.mentee.name}.`,
    metadata: {
      totalAchievementPoints,
      baseAchievementPoints,
      pointCategory,
      awardPolicy,
    },
  });

  revalidatePath("/mentorship");
  revalidatePath("/mentorship/reviews");
  revalidatePath(`/mentorship/mentees/${review.menteeId}`);
  revalidatePath("/goals");
}

export async function returnMonthlyGoalReview(formData: FormData) {
  const session = await requireSession();
  const roles = session.user.roles ?? [];
  const currentUserId = session.user.id;
  const reviewId = getString(formData, "reviewId");
  const chairDecisionNotes = getString(formData, "chairDecisionNotes");

  const review = await prisma.monthlyGoalReview.findUnique({
    where: { id: reviewId },
    include: {
      mentee: { select: { id: true, name: true } },
      mentor: { select: { id: true, name: true } },
      mentorship: {
        include: {
          track: { include: { committees: true } },
        },
      },
    },
  });

  if (!review) {
    throw new Error("Monthly goal review not found");
  }

  if (!review.requiresChairApproval) {
    throw new Error("This review does not require chair approval.");
  }

  if (review.status !== MentorshipReviewStatus.PENDING_CHAIR_APPROVAL) {
    throw new Error("Only reviews waiting on chair approval can be returned.");
  }

  if (
    !(await canApproveReview({
      roles,
      currentUserId,
      review: {
        menteeId: review.menteeId,
        chairId: review.chairId,
        mentorship: {
          chairId: review.mentorship.chairId,
          track: review.mentorship.track,
        },
      },
    }))
  ) {
    throw new Error("You are not allowed to return this review");
  }

  await prisma.monthlyGoalReview.update({
    where: { id: review.id },
    data: {
      chairId: currentUserId,
      status: MentorshipReviewStatus.RETURNED,
      chairDecisionNotes,
      chairDecisionAt: new Date(),
      publishedAt: null,
    },
  });

  await createMentorshipNotification({
    userId: review.mentorId,
    title: "Monthly Goal Review Returned",
    body: `${review.mentee.name}'s monthly goal review needs revisions before approval.`,
    link: `/mentorship/reviews/${review.menteeId}`,
  });

  await logAuditEvent({
    action: AuditAction.MENTORSHIP_UPDATED,
    actorId: currentUserId,
    targetType: "MonthlyGoalReview",
    targetId: review.id,
    description: `Returned monthly goal review for ${review.mentee.name}.`,
    metadata: { chairDecisionNotes },
  });

  revalidatePath("/mentorship/reviews");
  revalidatePath(`/mentorship/feedback/${review.menteeId}`);
  revalidatePath(`/mentorship/reviews/${review.menteeId}`);
  revalidatePath(`/mentorship/mentees/${review.menteeId}`);
}

export async function createMentorshipTrack(formData: FormData) {
  const session = await requireSession();
  const roles = session.user.roles ?? [];
  if (!hasRole(roles, "ADMIN")) {
    throw new Error("Unauthorized");
  }

  const name = getString(formData, "name");
  const slug = getString(formData, "slug").toLowerCase();
  const description = getString(formData, "description", false);
  const scope = getString(formData, "scope", false) || "GLOBAL";
  const pointCategory = getString(formData, "pointCategory", false) || "CUSTOM";
  const chapterId = getString(formData, "chapterId", false);
  const requestedProgramGroup = getString(formData, "programGroup", false);
  const programGroup = parseProgramGroup(
    requestedProgramGroup || null,
    pointCategory === "STUDENT"
      ? "STUDENT"
      : pointCategory === "INSTRUCTOR"
      ? "INSTRUCTOR"
      : "CHAPTER_PRESIDENT"
  );
  const governanceMode = parseGovernanceMode(
    getString(formData, "governanceMode", false) || null,
    programGroup
  );
  const committeeScope = parseCommitteeScope(
    getString(formData, "committeeScope", false) || null,
    programGroup
  );
  const mentorCapRaw = getString(formData, "mentorCap", false);
  const mentorCap = mentorCapRaw
    ? Number.parseInt(mentorCapRaw, 10)
    : getDefaultMentorCapForProgramGroup(programGroup);
  const awardPolicy = parseAwardPolicy(
    getString(formData, "awardPolicy", false) || null,
    programGroup
  );
  const requiresQuarterlyReview = getString(
    formData,
    "requiresQuarterlyReview",
    false
  );

  await prisma.mentorshipTrack.create({
    data: {
      name,
      slug,
      description: description || null,
      scope,
      chapterId: chapterId || null,
      programGroup,
      governanceMode,
      committeeScope,
      mentorCap: Number.isFinite(mentorCap)
        ? mentorCap
        : getDefaultMentorCapForProgramGroup(programGroup),
      awardPolicy,
      requiresQuarterlyReview:
        requiresQuarterlyReview === ""
          ? programGroup !== MentorshipProgramGroup.STUDENT
          : requiresQuarterlyReview === "true",
      pointCategory: pointCategory as any,
    },
  });

  revalidatePath("/admin/mentorship-program");
}

export async function createMentorCommittee(formData: FormData) {
  const session = await requireSession();
  const roles = session.user.roles ?? [];
  if (!hasRole(roles, "ADMIN")) {
    throw new Error("Unauthorized");
  }

  const trackId = getString(formData, "trackId");
  const name = getString(formData, "name");
  const description = getString(formData, "description", false);
  const chairUserId = getString(formData, "chairUserId", false);

  await prisma.mentorCommittee.create({
    data: {
      trackId,
      name,
      description: description || null,
      chairUserId: chairUserId || null,
    },
  });

  revalidatePath("/admin/mentorship-program");
}

export async function addMentorCommitteeMember(formData: FormData) {
  const session = await requireSession();
  const roles = session.user.roles ?? [];
  if (!hasRole(roles, "ADMIN")) {
    throw new Error("Unauthorized");
  }

  const committeeId = getString(formData, "committeeId");
  const userId = getString(formData, "userId");
  const role = getString(formData, "role", false) || "MEMBER";

  await prisma.mentorCommitteeMember.upsert({
    where: {
      committeeId_userId: {
        committeeId,
        userId,
      },
    },
    update: {
      role: role as any,
    },
    create: {
      committeeId,
      userId,
      role: role as any,
    },
  });

  revalidatePath("/admin/mentorship-program");
}

export async function updateMentorshipGovernance(formData: FormData) {
  const session = await requireSession();
  const roles = session.user.roles ?? [];
  if (!hasRole(roles, "ADMIN") && !hasRole(roles, "CHAPTER_PRESIDENT")) {
    throw new Error("Unauthorized");
  }

  const mentorshipId = getString(formData, "mentorshipId");
  const trackId = getString(formData, "trackId", false);
  const chairId = getString(formData, "chairId", false);
  const kickoffScheduledAt = getOptionalDate(formData.get("kickoffScheduledAt"));
  const kickoffCompletedAt = getOptionalDate(formData.get("kickoffCompletedAt"));
  const notes = getString(formData, "notes", false);

  const mentorship = await prisma.mentorship.findUniqueOrThrow({
    where: { id: mentorshipId },
    include: {
      mentee: {
        select: {
          primaryRole: true,
          chapterId: true,
          chapter: { select: { name: true } },
        },
      },
    },
  });

  const track = await resolveCanonicalTrackForMentee({
    trackId: trackId || mentorship.trackId,
    primaryRole: mentorship.mentee.primaryRole,
    chapterId: mentorship.mentee.chapterId,
    chapterName: mentorship.mentee.chapter?.name ?? null,
  });
  const programGroup =
    track.programGroup ??
    getMentorshipProgramGroupForRole(mentorship.mentee.primaryRole);
  const governanceMode =
    track.governanceMode ?? getGovernanceModeForProgramGroup(programGroup);
  const resolvedChairId = await resolveMentorshipChairId({
    trackId: track.id,
    primaryRole: mentorship.mentee.primaryRole,
    existingChairId: chairId || mentorship.chairId,
  });

  await enforceFullProgramMentorCapacity({
    mentorId: mentorship.mentorId,
    programGroup,
    governanceMode,
    excludeMentorshipId: mentorship.id,
  });

  await prisma.mentorship.update({
    where: { id: mentorshipId },
    data: {
      trackId: track.id,
      chairId: resolvedChairId,
      programGroup,
      governanceMode,
      kickoffScheduledAt,
      kickoffCompletedAt,
      notes: notes || null,
    },
  });

  await ensureMentorshipSupportCircle(mentorshipId);

  revalidatePath("/admin/mentorship-program");
  revalidatePath("/admin/mentor-match");
  revalidatePath("/mentorship");
  revalidatePath("/mentorship/mentees");
}
