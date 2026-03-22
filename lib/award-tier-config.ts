import { AchievementAwardTier } from "@prisma/client";

export const TIER_CONFIG: Record<
  AchievementAwardTier,
  { label: string; color: string; bg: string; min: number; requiresBoard: boolean; emoji: string; volunteerHours: number }
> = {
  BRONZE: { label: "Bronze", color: "#cd7f32", bg: "#fdf6ec", min: 175, requiresBoard: false, emoji: "🥉", volunteerHours: 100 },
  SILVER: { label: "Silver", color: "#a8a9ad", bg: "#f5f5f5", min: 350, requiresBoard: false, emoji: "🥈", volunteerHours: 200 },
  GOLD: { label: "Gold", color: "#d4af37", bg: "#fffbeb", min: 700, requiresBoard: true, emoji: "🥇", volunteerHours: 400 },
  LIFETIME: { label: "Lifetime", color: "#7c3aed", bg: "#faf5ff", min: 1800, requiresBoard: true, emoji: "👑", volunteerHours: 1000 },
};
