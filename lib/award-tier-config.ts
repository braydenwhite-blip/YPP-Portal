import { AchievementAwardTier } from "@prisma/client";

export const TIER_CONFIG: Record<
  AchievementAwardTier,
  { label: string; color: string; bg: string; min: number; requiresBoard: boolean; emoji: string; volunteerHours: number; collegeMeetings: number }
> = {
  BRONZE: { label: "Bronze", color: "#cd7f32", bg: "#fdf6ec", min: 175, requiresBoard: false, emoji: "🥉", volunteerHours: 100, collegeMeetings: 0 },
  SILVER: { label: "Silver", color: "#a8a9ad", bg: "#f5f5f5", min: 350, requiresBoard: false, emoji: "🥈", volunteerHours: 200, collegeMeetings: 1 },
  GOLD: { label: "Gold", color: "#d4af37", bg: "#fffbeb", min: 700, requiresBoard: true, emoji: "🥇", volunteerHours: 400, collegeMeetings: 2 },
  LIFETIME: { label: "Lifetime", color: "#6b21c8", bg: "#faf5ff", min: 1800, requiresBoard: true, emoji: "👑", volunteerHours: 1000, collegeMeetings: -1 },
};
