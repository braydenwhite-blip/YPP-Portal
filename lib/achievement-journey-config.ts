// Shared constants and types for Achievement Journey (no "use server")

export const TIER_THRESHOLDS = [
  { tier: "LIFETIME" as const, min: 1800, label: "Lifetime" },
  { tier: "GOLD" as const, min: 700, label: "Gold" },
  { tier: "SILVER" as const, min: 350, label: "Silver" },
  { tier: "BRONZE" as const, min: 175, label: "Bronze" },
];

export interface AchievementJourneyData {
  totalPoints: number;
  currentTier: string | null;
  nextTier: { tier: string; min: number; label: string } | null;
  nextTierThreshold: number;
  progressPercent: number;
  pointsSinceLastTier: number;
  pointsToNextTier: number;
  pointLogs: Array<{
    id: string;
    points: number;
    reason: string | null;
    cycleMonth: string;
    cycleNumber: number;
    overallRating: string;
  }>;
  recentReviews: Array<{
    id: string;
    cycleNumber: number;
    cycleMonth: string;
    overallRating: string;
    pointsAwarded: number | null;
    bonusPoints: number;
    bonusReason: string | null;
    releasedToMenteeAt: string | null;
  }>;
  monthsToNextTier: number | null;
  milestoneMessage: string | null;
  earnedThisCycle: number;
}
