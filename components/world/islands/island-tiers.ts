// ═══════════════════════════════════════════════════════════════
// Island Tier Geometry Configs
// ═══════════════════════════════════════════════════════════════

export interface TierConfig {
  radius: number;
  height: number;
  topColor: string;
  sideColor: string;
  trees: number;
  structures: ("seed" | "flag" | "campfire" | "dock" | "cottage" | "boat" | "path" | "castle" | "lighthouse" | "aura")[];
}

export const TIER_CONFIGS: Record<string, TierConfig> = {
  EXPLORING: {
    radius: 3,
    height: 1,
    topColor: "#d2b48c",
    sideColor: "#8B7355",
    trees: 1,
    structures: ["seed", "flag"],
  },
  DEVELOPING: {
    radius: 4,
    height: 1.5,
    topColor: "#4ade80",
    sideColor: "#8B6914",
    trees: 3,
    structures: ["campfire", "dock"],
  },
  ADVANCING: {
    radius: 5.5,
    height: 2,
    topColor: "#22c55e",
    sideColor: "#6b4226",
    trees: 5,
    structures: ["cottage", "boat", "path"],
  },
  MASTERING: {
    radius: 7,
    height: 3,
    topColor: "#16a34a",
    sideColor: "#5c3317",
    trees: 8,
    structures: ["castle", "lighthouse", "aura"],
  },
};

export function getTierConfig(level: string): TierConfig {
  return TIER_CONFIGS[level] ?? TIER_CONFIGS.EXPLORING;
}
