"use server";

import {
  AuditAction,
  MenteeRoleType,
  MentorshipStatus,
  MentorshipReviewStatus,
  MentorshipType,
  NotificationType,
  ProgressStatus,
} from "@prisma/client";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit-log-actions";
import {
  calculateOverallProgress,
  getAchievementPointsForCategory,
  getDefaultPointCategory,
  normalizeMonthlyReviewMonth,
} from "@/lib/mentorship-review-helpers";
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

async function requireSession() {
  const session = await getServerSession(authOptions);
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
      select: { id: true, name: true, primaryRole: true },
    }),
  ]);

  const existing = await prisma.mentorship.findFirst({
    where: { menteeId, status: "ACTIVE" },
  });

  if (existing) {
    throw new Error(`${mentee.name} already has an active program mentor`);
  }

  const programType: MentorshipType =
    mentee.primaryRole === "STUDENT"
      ? MentorshipType.STUDENT
      : MentorshipType.INSTRUCTOR;

  const mentorship = await prisma.mentorship.create({
    data: {
      mentorId: mentor.id,
      menteeId: mentee.id,
      type: programType,
      status: MentorshipStatus.ACTIVE,
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
  const isAdmin = hasRole(roles, "ADMIN");
  const isChapterLead = hasRole(roles, "CHAPTER_LEAD");

  return prisma.mentorship.findFirst({
    where: {
      menteeId,
      status: "ACTIVE",
      ...(isAdmin || isChapterLead
        ? {}
        : {
            OR: [
              { mentorId: currentUserId },
              { chairId: currentUserId },
              { menteeId: currentUserId },
            ],
          }),
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

function canApproveReview(args: {
  roles: string[];
  currentUserId: string;
  review: {
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
  if (hasRole(roles, "ADMIN") || hasRole(roles, "CHAPTER_LEAD")) {
    return true;
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

async function createMentorshipNotification(params: {
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
  const isChapterLead = hasRole(roles, "CHAPTER_LEAD");

  return prisma.monthlyGoalReview.findMany({
    where: {
      status: MentorshipReviewStatus.PENDING_CHAIR_APPROVAL,
      ...(isAdmin || isChapterLead
        ? {}
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

  const review = await prisma.$transaction(async (tx) => {
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
            status: MentorshipReviewStatus.PENDING_CHAIR_APPROVAL,
            overallStatus,
            overallComments,
            strengths: strengths || null,
            focusAreas: focusAreas || null,
            collaborationNotes: collaborationNotes || null,
            promotionReadiness: promotionReadiness || null,
            nextMonthPlan,
            mentorInternalNotes: mentorInternalNotes || null,
            characterCulturePoints,
            mentorSubmittedAt: new Date(),
            chairDecisionAt: null,
            chairDecisionNotes: null,
            publishedAt: null,
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
            status: MentorshipReviewStatus.PENDING_CHAIR_APPROVAL,
            overallStatus,
            overallComments,
            strengths: strengths || null,
            focusAreas: focusAreas || null,
            collaborationNotes: collaborationNotes || null,
            promotionReadiness: promotionReadiness || null,
            nextMonthPlan,
            mentorInternalNotes: mentorInternalNotes || null,
            characterCulturePoints,
            mentorSubmittedAt: new Date(),
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

  if (mentorship.chairId) {
    await createMentorshipNotification({
      userId: mentorship.chairId,
      title: "Monthly Goal Review Needs Approval",
      body: `${mentorship.mentor.name} submitted ${mentorship.mentee.name}'s monthly goal review.`,
      link: "/mentorship/reviews",
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

  if (
    !canApproveReview({
      roles,
      currentUserId,
      review: {
        chairId: review.chairId,
        mentorship: {
          chairId: review.mentorship.chairId,
          track: review.mentorship.track,
        },
      },
    })
  ) {
    throw new Error("You are not allowed to approve this review");
  }

  const pointCategory =
    review.mentorship.track?.pointCategory ??
    getDefaultPointCategory(review.mentee.primaryRole);
  const baseAchievementPoints = getAchievementPointsForCategory(
    pointCategory,
    review.overallStatus
  );
  const totalAchievementPoints =
    baseAchievementPoints + review.characterCulturePoints;

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

    if (totalAchievementPoints > 0) {
      const existingLedger = await tx.achievementPointLedger.findFirst({
        where: { reviewId: review.id },
      });

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

  if (
    !canApproveReview({
      roles,
      currentUserId,
      review: {
        chairId: review.chairId,
        mentorship: {
          chairId: review.mentorship.chairId,
          track: review.mentorship.track,
        },
      },
    })
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

  await prisma.mentorshipTrack.create({
    data: {
      name,
      slug,
      description: description || null,
      scope,
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
  if (!hasRole(roles, "ADMIN") && !hasRole(roles, "CHAPTER_LEAD")) {
    throw new Error("Unauthorized");
  }

  const mentorshipId = getString(formData, "mentorshipId");
  const trackId = getString(formData, "trackId", false);
  const chairId = getString(formData, "chairId", false);
  const kickoffScheduledAt = getOptionalDate(formData.get("kickoffScheduledAt"));
  const kickoffCompletedAt = getOptionalDate(formData.get("kickoffCompletedAt"));
  const notes = getString(formData, "notes", false);

  await prisma.mentorship.update({
    where: { id: mentorshipId },
    data: {
      trackId: trackId || null,
      chairId: chairId || null,
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
