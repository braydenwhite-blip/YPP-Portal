"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { awardXp } from "@/lib/xp";

// ============================================
// HELPERS
// ============================================

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session;
}

// ============================================
// STUDENT CONTENT SHOWCASE (Feature #24)
// ============================================

/**
 * Get all approved/featured student content for the public showcase.
 */
export async function getStudentShowcase() {
  await requireAuth();

  const content = await prisma.studentContent.findMany({
    where: {
      status: { in: ["APPROVED", "FEATURED"] },
    },
    include: {
      student: { select: { id: true, name: true, level: true } },
      comments: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      _count: { select: { likes: true, comments: true } },
    },
    orderBy: [
      { isFeatured: "desc" },
      { featuredAt: "desc" },
      { likeCount: "desc" },
      { createdAt: "desc" },
    ],
  });

  return content;
}

/**
 * Get the current user's own content submissions.
 */
export async function getMyContent() {
  const session = await requireAuth();

  const content = await prisma.studentContent.findMany({
    where: { studentId: session.user.id },
    include: {
      comments: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      _count: { select: { likes: true, comments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return content;
}

/**
 * Submit new student content to the showcase. Status starts as SUBMITTED.
 * Awards 15 XP for submission.
 */
export async function submitContent(formData: FormData) {
  const session = await requireAuth();

  const title = formData.get("title") as string;
  const description = formData.get("description") as string | null;
  const contentType = formData.get("contentType") as string;
  const mediaUrl = formData.get("mediaUrl") as string | null;
  const passionArea = formData.get("passionArea") as string | null;

  if (!title || !contentType) {
    throw new Error("Title and content type are required");
  }

  const validTypes = ["VIDEO", "ARTICLE", "PROJECT", "TUTORIAL", "ART", "MUSIC", "CODE", "OTHER"];
  if (!validTypes.includes(contentType)) {
    throw new Error("Invalid content type");
  }

  const content = await prisma.studentContent.create({
    data: {
      studentId: session.user.id,
      title,
      description,
      contentType: contentType as any,
      mediaUrl,
      passionArea,
      status: "SUBMITTED",
      xpAwarded: 15,
    },
  });

  // Award 15 XP for submitting content
  await awardXp(session.user.id, 15, `Submitted content: ${title}`);

  revalidatePath("/showcase");
  return content;
}

/**
 * Toggle a like on student content. If already liked, removes the like.
 * Updates the likeCount on the StudentContent record.
 */
export async function toggleLikeContent(contentId: string) {
  const session = await requireAuth();

  const existing = await prisma.contentLike.findUnique({
    where: { contentId_userId: { contentId, userId: session.user.id } },
  });

  if (existing) {
    // Remove the like
    await prisma.contentLike.delete({
      where: { id: existing.id },
    });
    await prisma.studentContent.update({
      where: { id: contentId },
      data: { likeCount: { decrement: 1 } },
    });
  } else {
    // Add the like
    await prisma.contentLike.create({
      data: { contentId, userId: session.user.id },
    });
    await prisma.studentContent.update({
      where: { id: contentId },
      data: { likeCount: { increment: 1 } },
    });
  }

  revalidatePath("/showcase");
  return { liked: !existing };
}

/**
 * Add a comment to a piece of student content.
 */
export async function commentOnContent(contentId: string, text: string) {
  const session = await requireAuth();

  if (!text || text.trim().length === 0) {
    throw new Error("Comment text is required");
  }

  const content = await prisma.studentContent.findUnique({
    where: { id: contentId },
  });
  if (!content) throw new Error("Content not found");

  const comment = await prisma.contentComment.create({
    data: {
      contentId,
      authorId: session.user.id,
      text: text.trim(),
    },
    include: { author: { select: { id: true, name: true } } },
  });

  revalidatePath("/showcase");
  return comment;
}

/**
 * Admin/instructor action to approve student content.
 * Awards 25 XP to the content author.
 */
export async function approveContent(contentId: string) {
  const session = await requireAuth();

  const content = await prisma.studentContent.findUnique({
    where: { id: contentId },
  });
  if (!content) throw new Error("Content not found");
  if (content.status !== "SUBMITTED") {
    throw new Error("Content is not in SUBMITTED status");
  }

  await prisma.studentContent.update({
    where: { id: contentId },
    data: {
      status: "APPROVED",
      reviewedById: session.user.id,
    },
  });

  // Award 25 XP to the content author for approval
  await awardXp(content.studentId, 25, `Content approved: ${content.title}`);

  revalidatePath("/showcase");
  revalidatePath("/admin/content");
}

/**
 * Admin action to feature student content on the showcase.
 * Awards 50 XP bonus to the content author.
 */
export async function featureContent(contentId: string) {
  const session = await requireAuth();

  const content = await prisma.studentContent.findUnique({
    where: { id: contentId },
  });
  if (!content) throw new Error("Content not found");
  if (content.status !== "APPROVED" && content.status !== "FEATURED") {
    throw new Error("Content must be approved before featuring");
  }

  await prisma.studentContent.update({
    where: { id: contentId },
    data: {
      status: "FEATURED",
      isFeatured: true,
      featuredAt: new Date(),
      reviewedById: session.user.id,
    },
  });

  // Award 50 XP bonus for being featured
  await awardXp(content.studentId, 50, `Content featured: ${content.title}`);

  revalidatePath("/showcase");
  revalidatePath("/admin/content");
}

// ============================================
// RANDOM ACTS OF LEARNING (Feature #26)
// ============================================

const RANDOM_REWARD_TYPES = [
  { type: "BONUS_XP", title: "Bonus XP Drop!", weight: 60 },
  { type: "STREAK_SHIELD", title: "Streak Shield", weight: 20 },
  { type: "DOUBLE_XP", title: "Double XP Boost", weight: 20 },
] as const;

type RandomRewardType = (typeof RANDOM_REWARD_TYPES)[number];

/**
 * Called on page loads. 10% chance of generating a random reward.
 * Ensures user hasn't received a reward in the last 24 hours.
 * Returns the reward if created, or null.
 */
export async function checkRandomReward() {
  const session = await requireAuth();

  // Check if user already got a reward in the last 24 hours
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentReward = await prisma.randomReward.findFirst({
    where: {
      userId: session.user.id,
      createdAt: { gte: twentyFourHoursAgo },
    },
  });

  if (recentReward) return null;

  // 10% chance of generating a reward
  if (Math.random() > 0.1) return null;

  // Weighted random selection of reward type
  const totalWeight = RANDOM_REWARD_TYPES.reduce((sum, r) => sum + r.weight, 0);
  let roll = Math.random() * totalWeight;
  let selectedType: RandomRewardType = RANDOM_REWARD_TYPES[0];
  for (const rewardDef of RANDOM_REWARD_TYPES) {
    roll -= rewardDef.weight;
    if (roll <= 0) {
      selectedType = rewardDef;
      break;
    }
  }

  let xpAmount = 0;
  let description = "";

  switch (selectedType.type) {
    case "BONUS_XP":
      xpAmount = Math.floor(Math.random() * 41) + 10; // 10-50 XP
      description = `You found ${xpAmount} bonus XP! Redeem it now.`;
      break;
    case "STREAK_SHIELD":
      description = "A streak shield! This will protect your streak if you miss a day.";
      break;
    case "DOUBLE_XP":
      description = "Double XP boost! Your next XP earning will be doubled.";
      break;
  }

  const reward = await prisma.randomReward.create({
    data: {
      userId: session.user.id,
      rewardType: selectedType.type,
      title: selectedType.title,
      description,
      xpAmount,
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // Expires in 48 hours
    },
  });

  return reward;
}

/**
 * Redeem a random reward. Awards XP and marks it as redeemed.
 * Validates that the reward is not expired and not already redeemed.
 */
export async function redeemRandomReward(rewardId: string) {
  const session = await requireAuth();

  const reward = await prisma.randomReward.findFirst({
    where: { id: rewardId, userId: session.user.id },
  });

  if (!reward) throw new Error("Reward not found");
  if (reward.isRedeemed) throw new Error("Reward already redeemed");
  if (reward.expiresAt && new Date() > reward.expiresAt) {
    throw new Error("Reward has expired");
  }

  await prisma.randomReward.update({
    where: { id: rewardId },
    data: { isRedeemed: true, redeemedAt: new Date() },
  });

  // Award XP if applicable
  if (reward.xpAmount > 0) {
    await awardXp(
      session.user.id,
      reward.xpAmount,
      `Random reward redeemed: ${reward.title}`
    );
  }

  revalidatePath("/dashboard");
  return { rewardType: reward.rewardType, xpAmount: reward.xpAmount };
}

/**
 * Get the current user's random rewards.
 */
export async function getMyRewards() {
  const session = await requireAuth();

  const rewards = await prisma.randomReward.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return rewards;
}

// ============================================
// LEADERBOARDS (Feature #29)
// ============================================

/**
 * Get top 50 leaderboard entries for a given category and period.
 * Optionally filter by passion area. Includes user name and level.
 */
export async function getLeaderboard(
  category: string,
  period: string,
  passionArea?: string
) {
  await requireAuth();

  const entries = await prisma.leaderboardEntry.findMany({
    where: {
      category,
      period: period as any,
      ...(passionArea ? { passionArea } : { passionArea: null }),
    },
    include: {
      user: { select: { id: true, name: true, level: true } },
    },
    orderBy: { score: "desc" },
    take: 50,
  });

  return entries;
}

/**
 * Recalculate all leaderboard entries for a given user across all categories
 * and periods. Categories: XP, STREAKS, CHALLENGES, PRACTICE_HOURS.
 */
export async function updateLeaderboards(userId: string) {
  const now = new Date();

  // Calculate period start dates
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);

  // ALL_TIME uses a fixed epoch start
  const allTimeStart = new Date("2020-01-01T00:00:00Z");

  const periods: { period: "DAILY" | "WEEKLY" | "MONTHLY" | "ALL_TIME"; start: Date }[] = [
    { period: "DAILY", start: dayStart },
    { period: "WEEKLY", start: weekStart },
    { period: "MONTHLY", start: monthStart },
    { period: "ALL_TIME", start: allTimeStart },
  ];

  // Fetch user data for scoring
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { xp: true },
  });
  if (!user) throw new Error("User not found");

  // Get max streak from ChallengeParticipant
  const streakData = await prisma.challengeParticipant.aggregate({
    where: { studentId: userId },
    _max: { longestStreak: true },
  });
  const maxStreak = streakData._max.longestStreak || 0;

  // Count completed challenges
  const completedChallenges = await prisma.challengeParticipant.count({
    where: { studentId: userId, status: "COMPLETED" },
  });

  // Sum practice hours from PracticeLog (duration is in minutes)
  const practiceData = await prisma.practiceLog.aggregate({
    where: { studentId: userId },
    _sum: { duration: true },
  });
  const practiceHours = Math.round((practiceData._sum.duration || 0) / 60);

  const categories: { category: string; score: number }[] = [
    { category: "XP", score: user.xp },
    { category: "STREAKS", score: maxStreak },
    { category: "CHALLENGES", score: completedChallenges },
    { category: "PRACTICE_HOURS", score: practiceHours },
  ];

  // Upsert leaderboard entries for each category and period
  for (const { period, start } of periods) {
    for (const { category, score } of categories) {
      await prisma.leaderboardEntry.upsert({
        where: {
          userId_category_period_periodStart_passionArea: {
            userId,
            category,
            period,
            periodStart: start,
            passionArea: "",
          },
        },
        create: {
          userId,
          category,
          period,
          periodStart: start,
          score,
          passionArea: null,
        },
        update: { score },
      });
    }
  }

  // Recalculate ranks for all affected categories and periods
  for (const { period, start } of periods) {
    for (const { category } of categories) {
      const entries = await prisma.leaderboardEntry.findMany({
        where: { category, period, periodStart: start, passionArea: null },
        orderBy: { score: "desc" },
      });
      for (let i = 0; i < entries.length; i++) {
        await prisma.leaderboardEntry.update({
          where: { id: entries[i].id },
          data: { rank: i + 1 },
        });
      }
    }
  }
}

/**
 * Get the current user's rankings across all leaderboard categories.
 */
export async function getMyRankings() {
  const session = await requireAuth();

  const entries = await prisma.leaderboardEntry.findMany({
    where: { userId: session.user.id },
    orderBy: [{ category: "asc" }, { period: "asc" }],
  });

  return entries;
}

// ============================================
// MYSTERY REWARDS (Feature #30)
// ============================================

/**
 * Get the current user's mystery boxes, sorted with unopened first.
 */
export async function getMyMysteryBoxes() {
  const session = await requireAuth();

  const boxes = await prisma.mysteryBox.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isOpened: "asc" }, { createdAt: "desc" }],
  });

  return boxes;
}

/**
 * Open a mystery box: reveal reward, award XP, and mark as opened.
 */
export async function openMysteryBox(boxId: string) {
  const session = await requireAuth();

  const box = await prisma.mysteryBox.findFirst({
    where: { id: boxId, userId: session.user.id },
  });

  if (!box) throw new Error("Mystery box not found");
  if (box.isOpened) throw new Error("Mystery box already opened");
  if (box.expiresAt && new Date() > box.expiresAt) {
    throw new Error("Mystery box has expired");
  }

  await prisma.mysteryBox.update({
    where: { id: boxId },
    data: { isOpened: true, openedAt: new Date() },
  });

  // Award XP if the box contains XP
  if (box.xpAmount > 0) {
    await awardXp(
      session.user.id,
      box.xpAmount,
      `Mystery box opened: ${box.rewardTitle}`
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/rewards");
  return {
    rewardType: box.rewardType,
    rewardTitle: box.rewardTitle,
    rewardDescription: box.rewardDescription,
    xpAmount: box.xpAmount,
    badgeId: box.badgeId,
    metadata: box.metadata,
  };
}

/**
 * Internal function to create a mystery box with a random reward.
 * Reward weights: XP_BOOST (50%), TITLE (25%), STREAK_SHIELD (15%), RARE_BADGE (10%).
 */
export async function generateMysteryBox(
  userId: string,
  triggerType: string,
  triggerDetail?: string
) {
  const rewardOptions = [
    { type: "XP_BOOST", weight: 50 },
    { type: "TITLE", weight: 25 },
    { type: "STREAK_SHIELD", weight: 15 },
    { type: "RARE_BADGE", weight: 10 },
  ];

  // Weighted random selection
  const totalWeight = rewardOptions.reduce((sum, r) => sum + r.weight, 0);
  let roll = Math.random() * totalWeight;
  let selectedType = rewardOptions[0];
  for (const option of rewardOptions) {
    roll -= option.weight;
    if (roll <= 0) {
      selectedType = option;
      break;
    }
  }

  let rewardTitle = "";
  let rewardDescription = "";
  let xpAmount = 0;
  let badgeId: string | null = null;
  let metadata: Record<string, unknown> = {};

  switch (selectedType.type) {
    case "XP_BOOST":
      xpAmount = Math.floor(Math.random() * 76) + 25; // 25-100 XP
      rewardTitle = "XP Boost";
      rewardDescription = `You earned a ${xpAmount} XP boost!`;
      break;
    case "TITLE":
      const titles = [
        "Trailblazer",
        "Rising Star",
        "Creative Genius",
        "Passion Pioneer",
        "Knowledge Seeker",
      ];
      const selectedTitle = titles[Math.floor(Math.random() * titles.length)];
      rewardTitle = `Title: ${selectedTitle}`;
      rewardDescription = `You earned the "${selectedTitle}" title!`;
      metadata = { title: selectedTitle };
      break;
    case "STREAK_SHIELD":
      rewardTitle = "Streak Shield";
      rewardDescription = "This shield will protect your streak if you miss a day.";
      metadata = { shieldActive: true };
      break;
    case "RARE_BADGE":
      rewardTitle = "Rare Badge";
      rewardDescription = "You discovered a rare badge! Check your badge collection.";
      break;
  }

  const box = await prisma.mysteryBox.create({
    data: {
      userId,
      triggerType,
      triggerDetail: triggerDetail || null,
      rewardType: selectedType.type,
      rewardTitle,
      rewardDescription,
      xpAmount,
      badgeId,
      metadata: metadata as any,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Expires in 7 days
    },
  });

  return box;
}

// ============================================
// STUDENT-NOMINATED CHALLENGES (Feature #31)
// ============================================

/**
 * Get all nominated challenges sorted by upvotes descending.
 * Includes nominator name.
 */
export async function getNominatedChallenges() {
  await requireAuth();

  const nominations = await prisma.studentNominatedChallenge.findMany({
    include: {
      nominator: { select: { id: true, name: true } },
      _count: { select: { votes: true } },
    },
    orderBy: { upvotes: "desc" },
  });

  return nominations;
}

/**
 * Create a new challenge nomination. Awards 10 XP for nominating.
 */
export async function nominateChallenge(formData: FormData) {
  const session = await requireAuth();

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const category = formData.get("category") as string | null;
  const difficulty = formData.get("difficulty") as string || "MEDIUM";
  const suggestedXp = parseInt(formData.get("suggestedXp") as string) || 25;
  const suggestedDuration = formData.get("suggestedDuration") as string | null;

  if (!title || !description) {
    throw new Error("Title and description are required");
  }

  const nomination = await prisma.studentNominatedChallenge.create({
    data: {
      nominatorId: session.user.id,
      title,
      description,
      category,
      difficulty,
      suggestedXp,
      suggestedDuration,
    },
  });

  // Award 10 XP for nominating a challenge
  await awardXp(session.user.id, 10, `Nominated challenge: ${title}`);

  revalidatePath("/challenges/nominations");
  return nomination;
}

/**
 * Vote on a nominated challenge. Toggles vote if already voted.
 * Updates the upvotes/downvotes counts on the nomination.
 */
export async function voteOnNomination(nominationId: string, isUpvote: boolean) {
  const session = await requireAuth();

  const existing = await prisma.nominationVote.findUnique({
    where: { nominationId_userId: { nominationId, userId: session.user.id } },
  });

  if (existing) {
    if (existing.isUpvote === isUpvote) {
      // Same vote direction: remove the vote (toggle off)
      await prisma.nominationVote.delete({
        where: { id: existing.id },
      });

      // Decrement the relevant counter
      await prisma.studentNominatedChallenge.update({
        where: { id: nominationId },
        data: isUpvote
          ? { upvotes: { decrement: 1 } }
          : { downvotes: { decrement: 1 } },
      });
    } else {
      // Different vote direction: switch the vote
      await prisma.nominationVote.update({
        where: { id: existing.id },
        data: { isUpvote },
      });

      // Swap counts: decrement old, increment new
      await prisma.studentNominatedChallenge.update({
        where: { id: nominationId },
        data: isUpvote
          ? { upvotes: { increment: 1 }, downvotes: { decrement: 1 } }
          : { upvotes: { decrement: 1 }, downvotes: { increment: 1 } },
      });
    }
  } else {
    // New vote
    await prisma.nominationVote.create({
      data: {
        nominationId,
        userId: session.user.id,
        isUpvote,
      },
    });

    await prisma.studentNominatedChallenge.update({
      where: { id: nominationId },
      data: isUpvote
        ? { upvotes: { increment: 1 } }
        : { downvotes: { increment: 1 } },
    });
  }

  revalidatePath("/challenges/nominations");
}

/**
 * Admin action: promote a nomination to an official Challenge.
 * Creates a real Challenge from the nomination data and marks the nomination as PROMOTED.
 */
export async function promoteNomination(nominationId: string) {
  const session = await requireAuth();

  const nomination = await prisma.studentNominatedChallenge.findUnique({
    where: { id: nominationId },
  });
  if (!nomination) throw new Error("Nomination not found");
  if (nomination.status === "PROMOTED") {
    throw new Error("Nomination already promoted");
  }

  // Parse suggested duration into start/end dates
  const startDate = new Date();
  const endDate = new Date();
  if (nomination.suggestedDuration?.includes("week")) {
    endDate.setDate(endDate.getDate() + 7);
  } else if (nomination.suggestedDuration?.includes("month")) {
    endDate.setDate(endDate.getDate() + 30);
  } else {
    // Default: 1 day
    endDate.setDate(endDate.getDate() + 1);
  }

  const challenge = await prisma.challenge.create({
    data: {
      title: nomination.title,
      description: nomination.description,
      type: "DAILY",
      passionArea: nomination.category,
      startDate,
      endDate,
      xpReward: nomination.suggestedXp,
      status: "ACTIVE",
      createdById: session.user.id,
    },
  });

  await prisma.studentNominatedChallenge.update({
    where: { id: nominationId },
    data: {
      status: "PROMOTED",
      reviewedById: session.user.id,
      promotedChallengeId: challenge.id,
    },
  });

  revalidatePath("/challenges/nominations");
  revalidatePath("/challenges");
  return challenge;
}

// ============================================
// DAILY CHALLENGES (Feature #21) - Enhanced
// ============================================

/**
 * Get all active daily challenges.
 */
export async function getDailyChallenges() {
  const session = await requireAuth();
  const now = new Date();

  const challenges = await prisma.challenge.findMany({
    where: {
      type: "DAILY",
      status: "ACTIVE",
      endDate: { gte: now },
    },
    include: {
      participants: {
        where: { studentId: session.user.id },
        take: 1,
      },
      _count: { select: { participants: true, submissions: true } },
    },
    orderBy: { startDate: "desc" },
  });

  return challenges;
}

/**
 * Get the daily challenge for today. Returns the active daily challenge
 * whose date range includes today, or null if none exists.
 */
export async function getTodaysDailyChallenge() {
  const session = await requireAuth();
  const now = new Date();

  const challenge = await prisma.challenge.findFirst({
    where: {
      type: "DAILY",
      status: "ACTIVE",
      startDate: { lte: now },
      endDate: { gte: now },
    },
    include: {
      participants: {
        where: { studentId: session.user.id },
        take: 1,
      },
      _count: { select: { participants: true, submissions: true } },
    },
    orderBy: { startDate: "desc" },
  });

  return challenge || null;
}

// ============================================
// ACHIEVEMENT STREAKS (Feature #22)
// ============================================

const STREAK_MILESTONES = [7, 14, 30, 60, 90];

/**
 * Get the current user's streak data across all challenges.
 * Returns best streaks, current active streaks, and streak milestone progress.
 */
export async function getStreakData() {
  const session = await requireAuth();

  const participations = await prisma.challengeParticipant.findMany({
    where: { studentId: session.user.id },
    include: {
      challenge: {
        select: { id: true, title: true, type: true, endDate: true },
      },
    },
    orderBy: { longestStreak: "desc" },
  });

  // Best streaks across all challenges
  const bestStreaks = participations
    .filter((p) => p.longestStreak > 0)
    .map((p) => ({
      challengeId: p.challengeId,
      challengeTitle: p.challenge.title,
      challengeType: p.challenge.type,
      longestStreak: p.longestStreak,
      currentStreak: p.currentStreak,
      daysCompleted: p.daysCompleted,
    }));

  // Current active streaks (only from active participations)
  const activeStreaks = participations
    .filter((p) => p.status === "ACTIVE" && p.currentStreak > 0)
    .map((p) => ({
      challengeId: p.challengeId,
      challengeTitle: p.challenge.title,
      currentStreak: p.currentStreak,
      lastCheckIn: p.lastCheckIn,
    }));

  // Overall best streak
  const overallBestStreak = participations.reduce(
    (max, p) => Math.max(max, p.longestStreak),
    0
  );

  // Streak milestones with progress
  const milestones = STREAK_MILESTONES.map((threshold) => ({
    days: threshold,
    achieved: overallBestStreak >= threshold,
    progress: Math.min(overallBestStreak / threshold, 1),
  }));

  return {
    bestStreaks,
    activeStreaks,
    overallBestStreak,
    milestones,
  };
}

// ============================================
// LEARNING JOURNEY VISUALIZATION (Feature #27)
// ============================================

/**
 * Get the current user's timeline entries ordered by date descending.
 * Includes passion name from the associated PassionTimeline.
 */
export async function getMyTimeline() {
  const session = await requireAuth();

  const entries = await prisma.timelineEntry.findMany({
    where: { studentId: session.user.id },
    include: {
      timeline: {
        select: { id: true, title: true, passionId: true },
      },
    },
    orderBy: { date: "desc" },
  });

  return entries;
}

/**
 * Add a new entry to a passion timeline. Awards 10 XP.
 */
export async function addTimelineEntry(
  passionTimelineId: string,
  entryType: string,
  title: string,
  description?: string,
  mediaUrl?: string
) {
  const session = await requireAuth();

  if (!title) throw new Error("Title is required");

  // Verify ownership of the timeline
  const timeline = await prisma.passionTimeline.findFirst({
    where: { id: passionTimelineId, studentId: session.user.id },
  });
  if (!timeline) throw new Error("Timeline not found");

  const entry = await prisma.timelineEntry.create({
    data: {
      timelineId: passionTimelineId,
      studentId: session.user.id,
      passionId: timeline.passionId,
      entryType: entryType as any,
      title,
      description: description || null,
      mediaUrls: mediaUrl ? [mediaUrl] : [],
      xpAwarded: 10,
    },
  });

  // Award 10 XP for adding a timeline entry
  await awardXp(session.user.id, 10, `Timeline entry: ${title}`);

  revalidatePath("/journey");
  return entry;
}

// ============================================
// SEASONAL EVENTS (Feature #25)
// ============================================

/**
 * Get all seasonal competitions that are not completed.
 * Includes the entry count for each competition.
 */
export async function getSeasonalEvents() {
  await requireAuth();

  const events = await prisma.seasonalCompetition.findMany({
    where: {
      status: { not: "COMPLETED" },
    },
    include: {
      _count: { select: { entries: true } },
    },
    orderBy: { startDate: "asc" },
  });

  return events;
}

// ============================================
// PROGRESS PREDICTIONS (Feature #32)
// ============================================

/**
 * Get the current user's progress predictions, ordered by confidence descending.
 */
export async function getMyPredictions() {
  const session = await requireAuth();

  const predictions = await prisma.progressPrediction.findMany({
    where: { studentId: session.user.id },
    orderBy: { confidence: "desc" },
  });

  return predictions;
}
