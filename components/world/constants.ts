// ═══════════════════════════════════════════════════════════════
// Passion World — Shared Constants & Helpers
// ═══════════════════════════════════════════════════════════════

export const CATEGORY_THEMES: Record<
  string,
  {
    gradient: [string, string];
    accent: string;
    terrain: string;
    emoji: string;
  }
> = {
  ARTS: { gradient: ["#f472b6", "#ec4899"], accent: "#be185d", terrain: "#fce7f3", emoji: "\u{1F3A8}" },
  MUSIC: { gradient: ["#a78bfa", "#8b5cf6"], accent: "#6d28d9", terrain: "#ede9fe", emoji: "\u{1F3B5}" },
  SPORTS: { gradient: ["#34d399", "#10b981"], accent: "#047857", terrain: "#d1fae5", emoji: "\u26BD" },
  STEM: { gradient: ["#60a5fa", "#3b82f6"], accent: "#1d4ed8", terrain: "#dbeafe", emoji: "\u{1F52C}" },
  BUSINESS: { gradient: ["#fbbf24", "#f59e0b"], accent: "#b45309", terrain: "#fef3c7", emoji: "\u{1F4BC}" },
  SERVICE: { gradient: ["#f87171", "#ef4444"], accent: "#b91c1c", terrain: "#fee2e2", emoji: "\u{1F91D}" },
  HEALTH_WELLNESS: { gradient: ["#2dd4bf", "#14b8a6"], accent: "#0f766e", terrain: "#ccfbf1", emoji: "\u{1F49A}" },
  TRADES: { gradient: ["#fb923c", "#f97316"], accent: "#c2410c", terrain: "#ffedd5", emoji: "\u{1F527}" },
  ENTERTAINMENT: { gradient: ["#e879f9", "#d946ef"], accent: "#a21caf", terrain: "#fae8ff", emoji: "\u{1F3AC}" },
  WRITING: { gradient: ["#a3e635", "#84cc16"], accent: "#4d7c0f", terrain: "#ecfccb", emoji: "\u270D\uFE0F" },
  DANCE: { gradient: ["#fb7185", "#f43f5e"], accent: "#be123c", terrain: "#ffe4e6", emoji: "\u{1F483}" },
  CODING: { gradient: ["#38bdf8", "#0ea5e9"], accent: "#0369a1", terrain: "#e0f2fe", emoji: "\u{1F4BB}" },
  OTHER: { gradient: ["#94a3b8", "#64748b"], accent: "#334155", terrain: "#f1f5f9", emoji: "\u2728" },
};

export const LEVEL_LABELS: Record<
  string,
  { label: string; scale: number; trees: number }
> = {
  EXPLORING: { label: "Exploring", scale: 0.7, trees: 1 },
  DEVELOPING: { label: "Developing", scale: 0.85, trees: 3 },
  ADVANCING: { label: "Advancing", scale: 1.0, trees: 5 },
  MASTERING: { label: "Mastering", scale: 1.15, trees: 8 },
};

export function getTheme(category: string) {
  return CATEGORY_THEMES[category] ?? CATEGORY_THEMES.OTHER;
}

/** Deterministic PRNG seeded by an integer */
export function seedRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Deterministic tree positions for an island (used by SVG renderer) */
export function getTreeData(
  count: number,
  baseX: number,
  baseY: number,
  islandSeed: number,
) {
  const rng = seedRandom(islandSeed);
  const trees = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const radius = 18 + rng() * 12;
    const tx = baseX + Math.cos(angle) * radius;
    const ty = baseY + Math.sin(angle) * radius * 0.5 - 8;
    const h = 8 + rng() * 6;
    trees.push({ tx, ty, h });
  }
  return trees;
}
