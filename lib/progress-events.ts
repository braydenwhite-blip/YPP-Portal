"use server";

import { prisma } from "@/lib/prisma";
import { createNudge } from "@/lib/nudge-engine";
import { checkAndAutoUnlock, unlockSection } from "@/lib/unlock-manager";

// ============================================
// TYPES
// ============================================

export type ProgressEventType =
  | "PATHWAY_STEP_COMPLETED"
  | "COURSE_ENROLLED"
  | "COURSE_COMPLETED"
  | "GOAL_UPDATED"
  | "CHALLENGE_COMPLETED"
  | "TRAINING_MODULE_COMPLETED"
  | "BADGE_EARNED";

export type ProgressEvent = {
  type: ProgressEventType;
  userId: string;
  metadata?: Record<string, unknown>;
};

// ============================================
// MILESTONE DEFINITIONS
// ============================================

type MilestoneDef = {
  key: string;
  label: string;
  check: (userId: string) => Promise<boolean>;
};

const MILESTONE_DEFS: MilestoneDef[] = [
  {
    key: "FIRST_PATHWAY_STEP",
    label: "Completed first pathway step",
    check: async (userId) => {
      const count = await prisma.pathwayStepUnlock.count({ where: { userId } });
      return count >= 1;
    },
  },
  {
    key: "FIRST_BADGE",
    label: "Earned first badge",
    check: async (userId) => {
      const count = await prisma.studentBadge.count({ where: { studentId: userId } });
      return count >= 1;
    },
  },
  {
    key: "FIRST_GOAL_SET",
    label: "Set first goal",
    check: async (userId) => {
      const count = await prisma.goal.count({ where: { userId } });
      return count >= 1;
    },
  },
  {
    key: "FIVE_PATHWAY_STEPS",
    label: "Completed 5 pathway steps",
    check: async (userId) => {
      const count = await prisma.pathwayStepUnlock.count({ where: { userId } });
      return count >= 5;
    },
  },
  {
    key: "THREE_BADGES",
    label: "Earned 3 badges",
    check: async (userId) => {
      const count = await prisma.studentBadge.count({ where: { studentId: userId } });
      return count >= 3;
    },
  },
  {
    key: "FIRST_CHALLENGE",
    label: "Completed first challenge",
    check: async (userId) => {
      const count = await prisma.challengeCompletion.count({ where: { studentId: userId } });
      return count >= 1;
    },
  },
  {
    key: "TEN_PATHWAY_STEPS",
    label: "Completed 10 pathway steps",
    check: async (userId) => {
      const count = await prisma.pathwayStepUnlock.count({ where: { userId } });
      return count >= 10;
    },
  },
  {
    key: "FIVE_BADGES",
    label: "Earned 5 badges",
    check: async (userId) => {
      const count = await prisma.studentBadge.count({ where: { studentId: userId } });
      return count >= 5;
    },
  },
];

// ============================================
// MAIN EVENT DISPATCHER
// ============================================

export async function onProgressEvent(event: ProgressEvent): Promise<void> {
  try {
    // Run all side effects — don't let one failure block others
    await Promise.allSettled([
      checkMilestones(event.userId),
      checkAndAutoUnlock(event.userId).then((newUnlocks) =>
        notifyNewUnlocks(event.userId, newUnlocks)
      ),
      checkBadgeCriteria(event.userId),
      notifyMentor(event),
      createProgressNudge(event),
    ]);
  } catch (error) {
    // Log but don't throw — progress events are best-effort
    console.error("[onProgressEvent] Error:", error);
  }
}

// ============================================
// SIDE EFFECTS
// ============================================

async function checkMilestones(userId: string) {
  const existing = await prisma.journeyMilestone.findMany({
    where: { userId },
    select: { milestoneKey: true },
  });
  const existingKeys = new Set(existing.map((m) => m.milestoneKey));

  for (const def of MILESTONE_DEFS) {
    if (existingKeys.has(def.key)) continue;

    const met = await def.check(userId);
    if (met) {
      await prisma.journeyMilestone.create({
        data: {
          userId,
          milestoneKey: def.key,
          label: def.label,
        },
      });

      await createNudge(
        userId,
        "MILESTONE",
        "Milestone reached!",
        def.label,
        "/"
      );
    }
  }
}

async function notifyNewUnlocks(userId: string, newUnlocks: string[]) {
  const sectionLabels: Record<string, string> = {
    challenges: "Challenges",
    projects: "Projects",
    opportunities: "Opportunities",
    people_support: "People & Support",
  };

  for (const sectionKey of newUnlocks) {
    const label = sectionLabels[sectionKey] ?? sectionKey;
    await createNudge(
      userId,
      "SECTION_UNLOCKED",
      `New section unlocked: ${label}!`,
      `You just unlocked the ${label} section. Check it out!`,
      `/${sectionKey.replace("_", "-")}`,
      { sectionKey }
    );
  }
}

async function checkBadgeCriteria(userId: string) {
  // Get all active badges the user hasn't earned yet
  const earnedBadgeIds = new Set(
    (
      await prisma.studentBadge.findMany({
        where: { studentId: userId },
        select: { badgeId: true },
      })
    ).map((b) => b.badgeId)
  );

  const activeBadges = await prisma.badge.findMany({
    where: { isActive: true },
    select: { id: true, name: true, criteria: true, icon: true, xpReward: true },
  });

  for (const badge of activeBadges) {
    if (earnedBadgeIds.has(badge.id)) continue;

    const criteria = badge.criteria as Record<string, unknown> | null;
    if (!criteria) continue;

    const met = await evaluateBadgeCriteria(userId, criteria);
    if (met) {
      await awardBadge(userId, badge.id, badge.name, badge.xpReward);
    }
  }
}

async function evaluateBadgeCriteria(
  userId: string,
  criteria: Record<string, unknown>
): Promise<boolean> {
  const type = criteria.type as string | undefined;

  switch (type) {
    case "pathway_steps_count": {
      const required = (criteria.count as number) ?? 1;
      const count = await prisma.pathwayStepUnlock.count({ where: { userId } });
      return count >= required;
    }
    case "badges_count": {
      const required = (criteria.count as number) ?? 1;
      const count = await prisma.studentBadge.count({ where: { studentId: userId } });
      return count >= required;
    }
    case "goals_count": {
      const required = (criteria.count as number) ?? 1;
      const count = await prisma.goal.count({
        where: { userId },
      });
      return count >= required;
    }
    case "challenges_count": {
      const required = (criteria.count as number) ?? 1;
      const count = await prisma.challengeCompletion.count({
        where: { studentId: userId },
      });
      return count >= required;
    }
    case "enrollment_count": {
      const required = (criteria.count as number) ?? 1;
      const count = await prisma.enrollment.count({
        where: { userId, status: "ENROLLED" },
      });
      return count >= required;
    }
    default:
      return false;
  }
}

async function awardBadge(
  userId: string,
  badgeId: string,
  badgeName: string,
  xpReward: number
) {
  // Award the badge
  await prisma.studentBadge.create({
    data: { studentId: userId, badgeId },
  });

  // Award XP if applicable
  if (xpReward > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: { xp: { increment: xpReward } },
    });
  }

  // Create notification
  await prisma.notification.create({
    data: {
      userId,
      type: "SYSTEM",
      title: `Badge earned: ${badgeName}!`,
      body: `Congratulations! You earned the ${badgeName} badge.`,
      link: "/badges",
    },
  });

  // Create nudge
  await createNudge(
    userId,
    "MILESTONE",
    `You earned ${badgeName}!`,
    "Check out your new badge on your profile.",
    "/badges",
    { badgeId, badgeName }
  );
}

async function notifyMentor(event: ProgressEvent) {
  // Find the user's active mentors
  const mentorships = await prisma.mentorship.findMany({
    where: { menteeId: event.userId, status: "ACTIVE" },
    select: {
      mentorId: true,
      mentee: { select: { name: true } },
    },
  });

  if (mentorships.length === 0) return;

  const menteeName = mentorships[0].mentee.name;

  const messageMap: Partial<Record<ProgressEventType, string>> = {
    PATHWAY_STEP_COMPLETED: `${menteeName} completed a pathway step!`,
    BADGE_EARNED: `${menteeName} earned a new badge!`,
    CHALLENGE_COMPLETED: `${menteeName} completed a challenge!`,
    GOAL_UPDATED: `${menteeName} updated their goals.`,
  };

  const message = messageMap[event.type];
  if (!message) return;

  for (const m of mentorships) {
    await createNudge(
      m.mentorId,
      "MENTEE_UPDATE",
      message,
      `Check in with ${menteeName} to see their progress.`,
      "/mentorship"
    );
  }
}

async function createProgressNudge(event: ProgressEvent) {
  const nudgeMap: Partial<
    Record<ProgressEventType, { title: string; body: string; link: string }>
  > = {
    PATHWAY_STEP_COMPLETED: {
      title: "Nice work!",
      body: "You completed a pathway step. Keep the momentum going!",
      link: "/pathways",
    },
    COURSE_ENROLLED: {
      title: "New course started!",
      body: "You enrolled in a new course. Exciting things ahead!",
      link: "/courses",
    },
    CHALLENGE_COMPLETED: {
      title: "Challenge conquered!",
      body: "Great job finishing that challenge!",
      link: "/challenges",
    },
  };

  const nudge = nudgeMap[event.type];
  if (!nudge) return;

  await createNudge(
    event.userId,
    "ENCOURAGEMENT",
    nudge.title,
    nudge.body,
    nudge.link
  );
}
