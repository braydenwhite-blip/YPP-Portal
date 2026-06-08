/**
 * Student Operating System / Growth Engine (Phase N1) — admin / leadership view.
 *
 * Foundation analytics (infrastructure, not "giant analytics yet"): simple,
 * deterministic aggregates over the Growth* tables that answer "how is the whole
 * population growing?" with room to grow. Read-only (plain async).
 */

import { prisma } from "@/lib/prisma";
import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_CATEGORY_LABELS,
  GROWTH_TRACK_LABELS,
  GROWTH_TRACKS,
  isGrowthTrack,
  type AchievementCategory,
  type GrowthTrackId,
} from "./constants";

export interface CategoryCount {
  category: AchievementCategory;
  label: string;
  count: number;
}

export interface TrackCount {
  track: GrowthTrackId;
  label: string;
  count: number;
}

export interface OpportunityDemand {
  key: string;
  count: number;
}

export interface GrowthAdminOverview {
  totals: {
    profiles: number;
    visions: number;
    goals: number;
    actions: number;
    achievements: number;
    events: number;
    openOpportunities: number;
  };
  achievementsByCategory: CategoryCount[];
  eventsByTrack: TrackCount[];
  topOpportunities: OpportunityDemand[];
  /** Students who have earned at least one achievement (engagement proxy). */
  activeLearners: number;
}

export async function getGrowthAdminOverview(): Promise<GrowthAdminOverview> {
  const [
    profiles,
    visions,
    goals,
    actions,
    achievements,
    events,
    openOpportunities,
    achievementGroups,
    eventGroups,
    opportunityGroups,
    distinctAchievers,
  ] = await Promise.all([
    prisma.growthProfile.count(),
    prisma.growthVision.count(),
    prisma.growthGoal.count(),
    prisma.growthAction.count(),
    prisma.growthAchievement.count(),
    prisma.growthProgressEvent.count(),
    prisma.growthOpportunity.count({ where: { status: "SUGGESTED" } }),
    prisma.growthAchievement.groupBy({ by: ["category"], _count: { _all: true } }),
    prisma.growthProgressEvent.groupBy({ by: ["track"], _count: { _all: true } }),
    prisma.growthOpportunity.groupBy({
      by: ["key"],
      where: { status: "SUGGESTED" },
      _count: { _all: true },
    }),
    prisma.growthAchievement.findMany({ distinct: ["userId"], select: { userId: true } }),
  ]);

  const achievementCountByCategory = new Map<string, number>();
  for (const g of achievementGroups) {
    achievementCountByCategory.set(g.category, g._count._all);
  }
  const achievementsByCategory: CategoryCount[] = ACHIEVEMENT_CATEGORIES.map(
    (category) => ({
      category,
      label: ACHIEVEMENT_CATEGORY_LABELS[category],
      count: achievementCountByCategory.get(category) ?? 0,
    })
  ).sort((a, b) => b.count - a.count);

  const eventCountByTrack = new Map<string, number>();
  for (const g of eventGroups) {
    if (isGrowthTrack(g.track)) eventCountByTrack.set(g.track, g._count._all);
  }
  const eventsByTrack: TrackCount[] = GROWTH_TRACKS.map((track) => ({
    track,
    label: GROWTH_TRACK_LABELS[track],
    count: eventCountByTrack.get(track) ?? 0,
  })).sort((a, b) => b.count - a.count);

  const topOpportunities: OpportunityDemand[] = opportunityGroups
    .map((g) => ({ key: g.key, count: g._count._all }))
    .sort((a, b) => b.count - a.count || (a.key < b.key ? -1 : 1))
    .slice(0, 8);

  return {
    totals: {
      profiles,
      visions,
      goals,
      actions,
      achievements,
      events,
      openOpportunities,
    },
    achievementsByCategory,
    eventsByTrack,
    topOpportunities,
    activeLearners: distinctAchievers.length,
  };
}
