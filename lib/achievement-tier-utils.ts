import { AchievementAwardTier } from "@prisma/client";

export const TIER_THRESHOLDS: { tier: AchievementAwardTier; min: number }[] = [
  { tier: "LIFETIME", min: 1800 },
  { tier: "GOLD", min: 700 },
  { tier: "SILVER", min: 350 },
  { tier: "BRONZE", min: 175 },
];

export function computeTier(totalPoints: number): AchievementAwardTier | null {
  for (const { tier, min } of TIER_THRESHOLDS) {
    if (totalPoints >= min) return tier;
  }
  return null;
}
