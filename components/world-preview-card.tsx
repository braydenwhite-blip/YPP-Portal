import Link from "next/link";

// ═══════════════════════════════════════════════════════════════
// World Preview Card — Shows passion islands on the dashboard
// ═══════════════════════════════════════════════════════════════

const THEME: Record<string, { gradient: string; emoji: string }> = {
  ARTS: { gradient: "linear-gradient(135deg, #f472b6, #ec4899)", emoji: "\u{1F3A8}" },
  MUSIC: { gradient: "linear-gradient(135deg, #a78bfa, #8b5cf6)", emoji: "\u{1F3B5}" },
  SPORTS: { gradient: "linear-gradient(135deg, #34d399, #10b981)", emoji: "\u26BD" },
  STEM: { gradient: "linear-gradient(135deg, #60a5fa, #3b82f6)", emoji: "\u{1F52C}" },
  BUSINESS: { gradient: "linear-gradient(135deg, #fbbf24, #f59e0b)", emoji: "\u{1F4BC}" },
  SERVICE: { gradient: "linear-gradient(135deg, #f87171, #ef4444)", emoji: "\u{1F91D}" },
  HEALTH_WELLNESS: { gradient: "linear-gradient(135deg, #2dd4bf, #14b8a6)", emoji: "\u2764\uFE0F" },
  TRADES: { gradient: "linear-gradient(135deg, #fb923c, #f97316)", emoji: "\u{1F527}" },
  ENTERTAINMENT: { gradient: "linear-gradient(135deg, #e879f9, #d946ef)", emoji: "\u{1F3AD}" },
  WRITING: { gradient: "linear-gradient(135deg, #a3e635, #84cc16)", emoji: "\u270D\uFE0F" },
  OTHER: { gradient: "linear-gradient(135deg, #94a3b8, #64748b)", emoji: "\u2728" },
};

interface WorldIsland {
  id: string;
  name: string;
  category: string;
  level: string;
  xpPoints: number;
  isPrimary: boolean;
}

export function WorldPreviewCard({
  islands,
  totalXp,
  totalBadges,
}: {
  islands: WorldIsland[];
  totalXp: number;
  totalBadges: number;
}) {
  if (islands.length === 0) {
    return (
      <div className="card" style={{ borderTop: "3px solid #0ea5e9" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>{"\u{1F30D}"} Passion World</h3>
          <Link href="/world" className="button small outline">
            Explore
          </Link>
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 14, color: "var(--muted)" }}>
          Discover your passions and grow your own islands. Take the quiz to get started!
        </p>
        <Link
          href="/world"
          style={{
            display: "inline-block",
            marginTop: 12,
            padding: "8px 16px",
            background: "linear-gradient(135deg, #0ea5e9, #0369a1)",
            color: "white",
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 13,
            textDecoration: "none",
          }}
        >
          {"\u{1FA84}"} Take Discovery Quiz
        </Link>
      </div>
    );
  }

  const primary = islands.find((i) => i.isPrimary) ?? islands[0];

  return (
    <div className="card" style={{ borderTop: "3px solid #0ea5e9" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>{"\u{1F30D}"} Passion World</h3>
        <Link href="/world" className="button small outline">
          Open World
        </Link>
      </div>

      {/* Stats row */}
      <div className="stats-grid" style={{ marginTop: 12 }}>
        <div className="stat-card">
          <span className="stat-value">{islands.length}</span>
          <span className="stat-label">Islands</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{totalXp.toLocaleString()}</span>
          <span className="stat-label">Total XP</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{totalBadges}</span>
          <span className="stat-label">Badges</span>
        </div>
      </div>

      {/* Island pills */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
        {islands.slice(0, 5).map((island) => {
          const theme = THEME[island.category] ?? THEME.OTHER;
          return (
            <Link
              key={island.id}
              href="/world"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 10px",
                background: theme.gradient,
                color: "white",
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 600,
                textDecoration: "none",
                opacity: island.id === primary.id ? 1 : 0.8,
              }}
            >
              {theme.emoji} {island.name}
              <span style={{ opacity: 0.7, fontSize: 10 }}>Lv{island.xpPoints > 0 ? Math.floor(island.xpPoints / 100) + 1 : 1}</span>
            </Link>
          );
        })}
        {islands.length > 5 && (
          <span style={{ fontSize: 12, color: "var(--muted)", alignSelf: "center" }}>
            +{islands.length - 5} more
          </span>
        )}
      </div>
    </div>
  );
}
