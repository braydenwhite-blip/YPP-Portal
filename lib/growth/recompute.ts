/**
 * Student Operating System / Growth Engine (Phase N1) — recompute.
 *
 * The single idempotent "fold the world forward" step: read a user's events +
 * hierarchy, run the pure engine, and reconcile the derived state
 * (GrowthAchievement awards, GrowthOpportunity suggestions, GrowthProfile
 * counters/signals). Safe to run any number of times — awards are unique per
 * (user, key), and opportunities upsert on (user, key) while dismissed/accepted
 * rows are preserved. Called by emitGrowthEvent and by backfills.
 */

import { prisma } from "@/lib/prisma";
import { type AchievementCategory } from "./constants";
import { evaluateAchievements, achievementCategoryCounts } from "./achievements";
import { computeOpportunities, type StalledGoalSignal } from "./opportunities";
import { deriveProfileSignals } from "./profile";
import { pastDueGoals } from "./hierarchy";
import { loadGrowthHierarchy, loadGrowthEvents } from "./queries";

export interface RecomputeResult {
  earnedAchievementKeys: string[];
  opportunityKeys: string[];
}

/** Re-derive all Growth state for a user from their events + hierarchy. */
export async function recomputeGrowthForUser(userId: string): Promise<RecomputeResult> {
  const [events, hierarchy] = await Promise.all([
    loadGrowthEvents(userId),
    loadGrowthHierarchy(userId),
  ]);

  // 1) Achievements — award any newly earned, idempotently (snapshot stays).
  const earned = evaluateAchievements({ eventCounts: events.counts });
  for (const a of earned) {
    await prisma.growthAchievement.upsert({
      where: { userId_key: { userId, key: a.key } },
      create: {
        userId,
        key: a.key,
        title: a.title,
        category: a.category,
        description: a.description,
      },
      update: {},
    });
  }
  const earnedKeys = earned.map((a) => a.key);
  const earnedCategories = uniqueCategories(achievementCategoryCounts(earned));

  // 2) Profile — derive signals additively + refresh counters. Evolves over time.
  await recomputeProfile(userId, {
    earnedCategories,
    achievementCount: earned.length,
    completedExperiences: events.completedExperiences,
    lastEventAt: events.lastEventAt,
  });

  // 3) Opportunities — compute deterministically and reconcile against the DB.
  const opportunityKeys = await recomputeOpportunities(userId, {
    eventCounts: events.counts,
    earnedAchievementKeys: earnedKeys,
    stalledGoals: collectStalledGoals(hierarchy),
  });

  return { earnedAchievementKeys: earnedKeys, opportunityKeys };
}

function uniqueCategories(
  counts: Record<AchievementCategory, number>
): AchievementCategory[] {
  return (Object.keys(counts) as AchievementCategory[]).filter((c) => counts[c] > 0);
}

function collectStalledGoals(
  hierarchy: Awaited<ReturnType<typeof loadGrowthHierarchy>>
): StalledGoalSignal[] {
  const allGoals = [
    ...hierarchy.visions.flatMap((v) => v.goals),
    ...hierarchy.looseGoals,
  ];
  return pastDueGoals(allGoals).map(({ goal, ratio }) => ({
    id: goal.id,
    title: goal.title ?? "Goal",
    ratio,
    track: hierarchy.goalTrackById.get(goal.id),
  }));
}

async function recomputeProfile(
  userId: string,
  input: {
    earnedCategories: AchievementCategory[];
    achievementCount: number;
    completedExperiences: number;
    lastEventAt: Date | null;
  }
): Promise<void> {
  const existing = await prisma.growthProfile.findUnique({
    where: { userId },
    select: {
      careerInterests: true,
      leadershipInterests: true,
      impactInterests: true,
      skills: true,
      confidenceAreas: true,
      growthAreas: true,
    },
  });

  // Pull light signals from existing systems so the profile evolves over time.
  const [application, userProfile] = await Promise.all([
    prisma.mentorshipApplication.findFirst({
      where: { applicantId: userId },
      orderBy: { createdAt: "desc" },
      select: { interests: true },
    }),
    prisma.userProfile.findUnique({
      where: { userId },
      select: { careerGoal: true, leadershipGoal: true },
    }),
  ]);

  const signals = deriveProfileSignals({
    existing: existing ?? undefined,
    applicationInterests: application?.interests ?? [],
    careerGoal: userProfile?.careerGoal ?? null,
    leadershipGoal: userProfile?.leadershipGoal ?? null,
    earnedCategories: input.earnedCategories,
  });

  await prisma.growthProfile.upsert({
    where: { userId },
    create: {
      userId,
      careerInterests: signals.careerInterests,
      leadershipInterests: signals.leadershipInterests,
      impactInterests: signals.impactInterests,
      skills: signals.skills,
      confidenceAreas: signals.confidenceAreas,
      growthAreas: signals.growthAreas,
      achievementCount: input.achievementCount,
      completedExperiences: input.completedExperiences,
      lastEventAt: input.lastEventAt,
      lastRecomputedAt: new Date(),
    },
    update: {
      // Interests are additively merged (deriveProfileSignals preserves existing).
      careerInterests: signals.careerInterests,
      leadershipInterests: signals.leadershipInterests,
      impactInterests: signals.impactInterests,
      confidenceAreas: signals.confidenceAreas,
      growthAreas: signals.growthAreas,
      achievementCount: input.achievementCount,
      completedExperiences: input.completedExperiences,
      lastEventAt: input.lastEventAt,
      lastRecomputedAt: new Date(),
    },
  });
}

async function recomputeOpportunities(
  userId: string,
  input: {
    eventCounts: Parameters<typeof computeOpportunities>[0]["eventCounts"];
    earnedAchievementKeys: string[];
    stalledGoals: StalledGoalSignal[];
  }
): Promise<string[]> {
  const [profile, activeMentorship, openMentorshipActions, existingOpps] =
    await Promise.all([
      prisma.growthProfile.findUnique({
        where: { userId },
        select: {
          careerInterests: true,
          leadershipInterests: true,
          impactInterests: true,
        },
      }),
      prisma.mentorship.findFirst({
        where: { menteeId: userId, status: "ACTIVE" },
        select: { id: true },
      }),
      prisma.growthAction.findMany({
        where: { userId, source: "mentorship", status: { in: ["TODO", "IN_PROGRESS"] } },
        orderBy: { order: "asc" },
        select: { title: true },
      }),
      prisma.growthOpportunity.findMany({
        where: { userId },
        select: { key: true, status: true },
      }),
    ]);

  const dismissedKeys = existingOpps
    .filter((o) => o.status === "DISMISSED")
    .map((o) => o.key);
  // Preserve any non-SUGGESTED row (DISMISSED / ACCEPTED / COMPLETED).
  const preservedKeys = new Set(
    existingOpps.filter((o) => o.status !== "SUGGESTED").map((o) => o.key)
  );

  const opportunities = computeOpportunities({
    eventCounts: input.eventCounts,
    profile: {
      careerInterests: profile?.careerInterests ?? [],
      leadershipInterests: profile?.leadershipInterests ?? [],
      impactInterests: profile?.impactInterests ?? [],
    },
    earnedAchievementKeys: input.earnedAchievementKeys,
    hasActiveMentorship: Boolean(activeMentorship),
    openMentorshipActionTitles: openMentorshipActions.map((a) => a.title),
    stalledGoals: input.stalledGoals,
    dismissedKeys,
  });

  const computedKeys = new Set(opportunities.map((o) => o.key));

  // Upsert each freshly computed opportunity (status preserved on update).
  for (const opp of opportunities) {
    await prisma.growthOpportunity.upsert({
      where: { userId_key: { userId, key: opp.key } },
      create: {
        userId,
        key: opp.key,
        kind: opp.kind,
        title: opp.title,
        detail: opp.detail ?? null,
        href: opp.href ?? null,
        reason: opp.reason,
        score: opp.score,
        status: "SUGGESTED",
      },
      update: {
        kind: opp.kind,
        title: opp.title,
        detail: opp.detail ?? null,
        href: opp.href ?? null,
        reason: opp.reason,
        score: opp.score,
        computedAt: new Date(),
      },
    });
  }

  // Delete stale SUGGESTED rows that no longer apply (never touch preserved ones).
  const staleKeys = existingOpps
    .filter((o) => o.status === "SUGGESTED" && !computedKeys.has(o.key) && !preservedKeys.has(o.key))
    .map((o) => o.key);
  if (staleKeys.length > 0) {
    await prisma.growthOpportunity.deleteMany({
      where: { userId, key: { in: staleKeys }, status: "SUGGESTED" },
    });
  }

  return Array.from(computedKeys);
}
