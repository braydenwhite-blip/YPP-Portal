import { AchievementAwardTier } from "@prisma/client";

import { TIER_CONFIG } from "@/lib/award-tier-config";
import { getSupportWorkspaceData } from "@/lib/mentorship-hub";
import { getMentorshipProgramGroupForRole } from "@/lib/mentorship-canonical";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import { prisma } from "@/lib/prisma";

const PROGRAM_TIERS: AchievementAwardTier[] = ["BRONZE", "SILVER", "GOLD", "LIFETIME"];
const SUPPORT_OPERATOR_ROLES = new Set([
  "MENTOR",
  "CHAPTER_PRESIDENT",
  "ADMIN",
]);

function startOfCurrentMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function normalizeRoles(roles: string[] | null | undefined, primaryRole: string | null) {
  const roleSet = new Set(roles ?? []);
  if (primaryRole) {
    roleSet.add(primaryRole);
  }
  return Array.from(roleSet);
}

function isStudentOnlySupportUser(roles: string[], primaryRole: string | null) {
  return (
    (primaryRole === "STUDENT" || roles.includes("STUDENT")) &&
    !roles.some((role) => SUPPORT_OPERATOR_ROLES.has(role))
  );
}

function getProgramTierProgress(totalPoints: number, currentTier: AchievementAwardTier | null) {
  const nextTier = PROGRAM_TIERS.find((tier) => TIER_CONFIG[tier].min > totalPoints) ?? null;
  if (!nextTier) {
    return {
      currentTier,
      nextTier: null,
      pointsNeeded: 0,
      progressPct: 100,
    };
  }

  const currentIndex = PROGRAM_TIERS.indexOf(nextTier);
  const previousMinimum = currentIndex <= 0 ? 0 : TIER_CONFIG[PROGRAM_TIERS[currentIndex - 1]].min;
  const range = TIER_CONFIG[nextTier].min - previousMinimum;
  const earned = totalPoints - previousMinimum;

  return {
    currentTier,
    nextTier,
    pointsNeeded: TIER_CONFIG[nextTier].min - totalPoints,
    progressPct: Math.min(100, Math.max(0, Math.round((earned / range) * 100))),
  };
}

function getRoleLabel(primaryRole: string | null) {
  if (primaryRole === "INSTRUCTOR") return "Instructor";
  if (primaryRole === "CHAPTER_PRESIDENT") return "Chapter President";
  if (primaryRole === "ADMIN" || primaryRole === "STAFF") return "Global Leadership";
  if (primaryRole === "STUDENT") return "Student";
  return "Member";
}

async function getStudentReflectionSummary(userId: string, primaryRole: string | null) {
  if (primaryRole !== "STUDENT") {
    return null;
  }

  const currentMonth = startOfCurrentMonth();

  const [activeMentorship, forms, submissions] = await Promise.all([
    prisma.mentorship.findFirst({
      where: {
        menteeId: userId,
        status: "ACTIVE",
      },
      select: {
        programGroup: true,
      },
      orderBy: { startDate: "desc" },
    }),
    prisma.reflectionForm.findMany({
      where: {
        roleType: "STUDENT",
        isActive: true,
      },
      include: {
        questions: {
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.reflectionSubmission.findMany({
      where: { userId },
      include: {
        form: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { submittedAt: "desc" },
      take: 6,
    }),
  ]);

  const programGroup =
    activeMentorship?.programGroup ?? getMentorshipProgramGroupForRole(primaryRole);
  const activeForm =
    forms.find((form) => form.mentorshipProgramGroup === programGroup) ??
    forms.find((form) => form.mentorshipProgramGroup == null) ??
    forms[0] ??
    null;

  const latestSubmission = submissions[0] ?? null;
  const hasSubmittedCurrentMonth = submissions.some((submission) => {
    const submittedMonth = new Date(submission.month);
    return (
      submittedMonth.getMonth() === currentMonth.getMonth() &&
      submittedMonth.getFullYear() === currentMonth.getFullYear()
    );
  });

  return {
    available: Boolean(activeForm),
    formTitle: activeForm?.title ?? "Monthly Self-Reflection",
    hasSubmittedCurrentMonth,
    submissionsCount: submissions.length,
    latestSubmission: latestSubmission
      ? {
          id: latestSubmission.id,
          submittedAt: latestSubmission.submittedAt,
          title: latestSubmission.form.title,
        }
      : null,
    currentStateLabel: hasSubmittedCurrentMonth ? "Submitted this month" : "Ready to submit",
    primaryHref: hasSubmittedCurrentMonth ? "/reflection/history" : "/reflection",
    primaryLabel: hasSubmittedCurrentMonth ? "View Reflection History" : "Submit Reflection",
  };
}

async function getProgramReflectionSummary(userId: string, primaryRole: string | null) {
  const menteeRoleType = toMenteeRoleType(primaryRole ?? "");
  if (!menteeRoleType) {
    return null;
  }

  const [mentorship, goals, reflections] = await Promise.all([
    prisma.mentorship.findFirst({
      where: { menteeId: userId, status: "ACTIVE" },
      select: {
        mentor: { select: { id: true, name: true, email: true } },
        selfReflections: {
          orderBy: { cycleNumber: "desc" },
          take: 1,
          select: { cycleNumber: true },
        },
      },
    }),
    prisma.mentorshipProgramGoal.findMany({
      where: { roleType: menteeRoleType, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, title: true, description: true },
    }),
    prisma.monthlySelfReflection.findMany({
      where: { menteeId: userId },
      orderBy: { cycleNumber: "desc" },
      include: {
        goalReview: {
          where: { releasedToMenteeAt: { not: null } },
          select: {
            overallRating: true,
            pointsAwarded: true,
            releasedToMenteeAt: true,
          },
        },
      },
      take: 6,
    }),
  ]);

  const latestReflection = reflections[0] ?? null;
  const nextCycle = (mentorship?.selfReflections[0]?.cycleNumber ?? 0) + 1;

  return {
    available: Boolean(mentorship),
    roleLabel: getRoleLabel(primaryRole),
    mentorName: mentorship?.mentor.name ?? null,
    mentorEmail: mentorship?.mentor.email ?? null,
    goals,
    reflectionsCount: reflections.length,
    releasedReviewsCount: reflections.filter((reflection) => Boolean(reflection.goalReview)).length,
    latestReflection: latestReflection
      ? {
          id: latestReflection.id,
          cycleNumber: latestReflection.cycleNumber,
          cycleMonth: latestReflection.cycleMonth,
          submittedAt: latestReflection.submittedAt,
          reviewRating: latestReflection.goalReview?.overallRating ?? null,
          pointsAwarded: latestReflection.goalReview?.pointsAwarded ?? null,
          hasReleasedReview: Boolean(latestReflection.goalReview?.releasedToMenteeAt),
        }
      : null,
    nextCycle,
    isQuarterlyNext: nextCycle % 3 === 0,
    primaryHref: mentorship ? "/my-program/reflect" : "/my-program/schedule",
    primaryLabel: mentorship ? "Start Program Reflection" : "Request Program Support",
  };
}

async function getRecognitionSummary(userId: string) {
  const [latestBadge, badgeCount, latestAward, awardCount, latestCertificate, certificateCount, rewards, boxes, summary, nominations] =
    await Promise.all([
      prisma.skillBadge.findFirst({
        where: { userId },
        include: { skill: { select: { name: true } } },
        orderBy: { earnedAt: "desc" },
      }),
      prisma.skillBadge.count({ where: { userId } }),
      prisma.studentAward.findFirst({
        where: { studentId: userId },
        include: {
          award: {
            select: {
              name: true,
              category: true,
            },
          },
        },
        orderBy: { awardedAt: "desc" },
      }),
      prisma.studentAward.count({ where: { studentId: userId } }),
      prisma.certificate.findFirst({
        where: { recipientId: userId },
        include: {
          template: {
            select: {
              name: true,
              type: true,
            },
          },
        },
        orderBy: { issuedAt: "desc" },
      }),
      prisma.certificate.count({ where: { recipientId: userId } }),
      prisma.randomReward.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          isRedeemed: true,
          expiresAt: true,
          createdAt: true,
        },
      }),
      prisma.mysteryBox.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          rewardTitle: true,
          isOpened: true,
          expiresAt: true,
          createdAt: true,
        },
      }),
      prisma.achievementPointSummary.findUnique({
        where: { userId },
        select: {
          totalPoints: true,
          currentTier: true,
          volunteerHoursAwarded: true,
        },
      }),
      prisma.awardNomination.findMany({
        where: { nomineeId: userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          tier: true,
          status: true,
          createdAt: true,
        },
        take: 8,
      }),
    ]);

  const unopenedBoxes = boxes.filter((box) => !box.isOpened);
  const openedBoxes = boxes.filter((box) => box.isOpened);
  const pendingRewards = rewards.filter((reward) => !reward.isRedeemed);
  const redeemedRewards = rewards.filter((reward) => reward.isRedeemed);
  const totalPoints = summary?.totalPoints ?? 0;
  const currentTier = summary?.currentTier ?? null;
  const pendingProgramNominations = nominations.filter(
    (nomination) => nomination.status === "PENDING_CHAIR" || nomination.status === "PENDING_BOARD"
  );
  const approvedProgramNominations = nominations.filter(
    (nomination) => nomination.status === "APPROVED"
  );

  return {
    badges: {
      count: badgeCount,
      latest: latestBadge
        ? {
            name: latestBadge.skill.name,
            earnedAt: latestBadge.earnedAt,
          }
        : null,
    },
    awards: {
      count: awardCount,
      latest: latestAward
        ? {
            name: latestAward.award.name,
            category: latestAward.award.category,
            awardedAt: latestAward.awardedAt,
          }
        : null,
    },
    certificates: {
      count: certificateCount,
      latest: latestCertificate
        ? {
            title: latestCertificate.title,
            issuedAt: latestCertificate.issuedAt,
            templateName: latestCertificate.template.name,
          }
        : null,
    },
    rewards: {
      pendingCount: pendingRewards.length,
      collectedCount: redeemedRewards.length + openedBoxes.length,
      unopenedBoxesCount: unopenedBoxes.length,
      latestPendingLabel: pendingRewards[0]?.title ?? unopenedBoxes[0]?.rewardTitle ?? null,
    },
    program: {
      totalPoints,
      currentTier,
      volunteerHoursAwarded: summary?.volunteerHoursAwarded ?? 0,
      tierProgress: getProgramTierProgress(totalPoints, currentTier),
      nominationsCount: nominations.length,
      pendingNominationsCount: pendingProgramNominations.length,
      approvedNominationsCount: approvedProgramNominations.length,
      latestNomination: nominations[0] ?? null,
      certificateUnlocked: currentTier != null,
    },
  };
}

function choosePrimaryAction(input: {
  isStudent: boolean;
  studentReflection: Awaited<ReturnType<typeof getStudentReflectionSummary>>;
  programReflection: Awaited<ReturnType<typeof getProgramReflectionSummary>>;
  support: Awaited<ReturnType<typeof getSupportWorkspaceData>>;
  recognition: Awaited<ReturnType<typeof getRecognitionSummary>>;
}) {
  const { isStudent, studentReflection, programReflection, support, recognition } = input;

  if (studentReflection?.available && !studentReflection.hasSubmittedCurrentMonth) {
    return {
      label: studentReflection.primaryLabel,
      href: studentReflection.primaryHref,
      detail: "Complete this month’s reflection first so your support team has fresh context.",
    };
  }

  if (programReflection?.available) {
    const latestCycle = programReflection.latestReflection?.cycleNumber ?? 0;
    return {
      label: programReflection.primaryLabel,
      href: programReflection.primaryHref,
      detail:
        latestCycle > 0
          ? `Your next official program cycle is Cycle ${programReflection.nextCycle}.`
          : "Start the first program reflection cycle to begin the review loop.",
    };
  }

  const openActionItems = support?.actionItems.filter((item) => item.status !== "COMPLETE") ?? [];
  if (openActionItems.length > 0) {
    const overdueCount = openActionItems.filter((item) => item.dueAt && item.dueAt.getTime() < Date.now()).length;
    return {
      label: "Review Action Plan",
      href: "/my-program#action-plan",
      detail:
        overdueCount > 0
          ? `${overdueCount} action item${overdueCount === 1 ? "" : "s"} need attention right away.`
          : `${openActionItems.length} action item${openActionItems.length === 1 ? "" : "s"} are still open.`,
    };
  }

  if (support?.mentorship) {
    const nextSession = support.sessions.find(
      (session) => !session.completedAt && session.scheduledAt.getTime() >= Date.now()
    );
    if (nextSession) {
      return {
        label: "Prepare For Your Next Session",
        href: "/my-program#support",
        detail: `${nextSession.title} is the next support moment on your calendar.`,
      };
    }

    return {
      label: "Open Support Snapshot",
      href: "/my-program#support",
      detail: "Review your mentor, requests, and shared resources in one place.",
    };
  }

  if (recognition.rewards.pendingCount > 0 || recognition.rewards.unopenedBoxesCount > 0) {
    return {
      label: "Open Rewards",
      href: "/rewards",
      detail: "You have a reward or mystery box waiting to be opened.",
    };
  }

  if (isStudent) {
    return {
      label: "Ask A Mentor",
      href: "/mentor/ask",
      detail: "Use the commons to get unstuck and start a support thread.",
    };
  }

  return {
    label: "Schedule A Program Check-In",
    href: "/my-program/schedule",
    detail: "Use one clear meeting request to keep your support loop moving.",
  };
}

export function shouldRouteStudentToMyProgram(input: {
  primaryRole?: string | null;
  roles?: string[] | null;
}) {
  const roles = normalizeRoles(input.roles, input.primaryRole ?? null);
  return isStudentOnlySupportUser(roles, input.primaryRole ?? null);
}

export async function getMyProgramHubData(input: {
  userId: string;
  primaryRole: string | null;
  roles: string[];
}) {
  const normalizedRoles = normalizeRoles(input.roles, input.primaryRole);
  const isStudent = normalizedRoles.includes("STUDENT");
  const isProgramParticipant = Boolean(toMenteeRoleType(input.primaryRole ?? ""));
  const shouldUseMyProgram = isStudent || isProgramParticipant;

  if (!shouldUseMyProgram) {
    return null;
  }

  const [support, studentReflection, programReflection, recognition] = await Promise.all([
    getSupportWorkspaceData({
      viewerId: input.userId,
      roles: normalizedRoles,
      menteeId: input.userId,
    }),
    getStudentReflectionSummary(input.userId, input.primaryRole),
    getProgramReflectionSummary(input.userId, input.primaryRole),
    getRecognitionSummary(input.userId),
  ]);

  const primaryAction = choosePrimaryAction({
    isStudent,
    studentReflection,
    programReflection,
    support,
    recognition,
  });

  return {
    flags: {
      isStudent,
      isProgramParticipant,
      hasSupportCircle: Boolean(support?.mentorship),
      roleLabel: getRoleLabel(input.primaryRole),
    },
    support,
    studentReflection,
    programReflection,
    recognition,
    primaryAction,
  };
}

export async function getCompactRecognitionSnapshot(userId: string) {
  const recognition = await getRecognitionSummary(userId);

  return {
    badgeCount: recognition.badges.count,
    awardCount: recognition.awards.count,
    certificateCount: recognition.certificates.count,
    pendingRewardsCount: recognition.rewards.pendingCount,
    unopenedBoxesCount: recognition.rewards.unopenedBoxesCount,
    totalPoints: recognition.program.totalPoints,
    currentTier: recognition.program.currentTier,
    pendingProgramNominationsCount: recognition.program.pendingNominationsCount,
    latestBadgeName: recognition.badges.latest?.name ?? null,
    latestAwardName: recognition.awards.latest?.name ?? null,
    latestCertificateTitle: recognition.certificates.latest?.title ?? null,
  };
}
