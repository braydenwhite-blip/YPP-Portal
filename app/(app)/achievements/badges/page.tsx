import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getBadgesWithRarity } from "@/lib/challenge-gamification-actions";
import Link from "next/link";
import { PinBadgeButton } from "./client";

export default async function AchievementBadgesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { badges, rarityMap } = await getBadgesWithRarity();

  const rarityColors: Record<string, string> = {
    COMMON: "#6b7280",
    UNCOMMON: "#16a34a",
    RARE: "#3b82f6",
    EPIC: "#7c3aed",
    LEGENDARY: "#d97706",
    MYTHIC: "#ef4444",
  };

  const rarityGlow: Record<string, string> = {
    RARE: "0 0 8px rgba(59,130,246,0.3)",
    EPIC: "0 0 12px rgba(124,58,237,0.3)",
    LEGENDARY: "0 0 16px rgba(217,119,6,0.4)",
    MYTHIC: "0 0 20px rgba(239,68,68,0.4)",
  };

  const categories = ["DISCOVERY", "PERSISTENCE", "MASTERY", "SOCIAL"];
  const categoryLabels: Record<string, string> = {
    DISCOVERY: "Discovery",
    PERSISTENCE: "Persistence",
    MASTERY: "Mastery",
    SOCIAL: "Social",
  };
  const categoryDescriptions: Record<string, string> = {
    DISCOVERY: "Earned by exploring new passion areas and trying new things",
    PERSISTENCE: "Earned through consistent practice and dedication",
    MASTERY: "Earned by demonstrating deep skill in a passion area",
    SOCIAL: "Earned through collaboration, mentoring, and community",
  };

  const earned = badges.filter((b) => b.studentBadges.length > 0);
  const pinned = earned.filter((b) => b.studentBadges[0]?.isPinned);

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Achievement Gallery</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            {earned.length} of {badges.length} badges earned
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/challenges" className="button secondary">Challenges</Link>
          <Link href="/challenges/passport" className="button secondary">Passport</Link>
        </div>
      </div>

      {/* Overall Progress */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Collection Progress</h3>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ypp-purple)" }}>
            {Math.round((earned.length / Math.max(badges.length, 1)) * 100)}%
          </span>
        </div>
        <div style={{ width: "100%", height: 10, background: "var(--gray-200)", borderRadius: 5, marginBottom: 12 }}>
          <div style={{
            width: `${(earned.length / Math.max(badges.length, 1)) * 100}%`,
            height: "100%",
            background: "linear-gradient(90deg, var(--ypp-purple), var(--ypp-pink))",
            borderRadius: 5,
          }} />
        </div>
        {/* Rarity Breakdown */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {Object.entries(rarityColors).map(([tier, color]) => {
            const count = earned.filter((b) => {
              const r = rarityMap[b.id];
              return r?.rarityTier === tier;
            }).length;
            return (
              <div key={tier} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {tier.charAt(0) + tier.slice(1).toLowerCase()}: {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pinned Badges */}
      {pinned.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>Pinned Badges</h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {pinned.map((badge) => {
              const rarity = rarityMap[badge.id];
              const tier = rarity?.rarityTier || badge.rarity || "COMMON";
              const color = rarityColors[tier] || "#6b7280";
              return (
                <div
                  key={badge.id}
                  style={{
                    padding: "12px 16px",
                    background: `${color}10`,
                    border: `2px solid ${color}`,
                    borderRadius: "var(--radius-md)",
                    textAlign: "center",
                    boxShadow: rarityGlow[tier] || "none",
                    minWidth: 100,
                  }}
                >
                  <div style={{ fontSize: 28 }}>{badge.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color, marginTop: 4 }}>
                    {badge.name}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>
                    {tier}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Badges by Category */}
      {categories.map((cat) => {
        const catBadges = badges.filter((b) => b.category === cat);
        if (catBadges.length === 0) return null;

        return (
          <div key={cat} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, marginBottom: 4 }}>{categoryLabels[cat]}</h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
              {categoryDescriptions[cat]}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
              {catBadges.map((badge) => {
                const isEarned = badge.studentBadges.length > 0;
                const rarity = rarityMap[badge.id];
                const tier = rarity?.rarityTier || badge.rarity || "COMMON";
                const color = rarityColors[tier] || "#6b7280";
                const pct = rarity?.rarityPercentage;

                return (
                  <div
                    key={badge.id}
                    style={{
                      padding: 16,
                      borderRadius: "var(--radius-md)",
                      background: isEarned ? `${color}08` : "var(--surface-alt)",
                      border: isEarned ? `2px solid ${color}` : "2px dashed var(--gray-300)",
                      textAlign: "center",
                      opacity: isEarned ? 1 : 0.6,
                      boxShadow: isEarned ? (rarityGlow[tier] || "none") : "none",
                      position: "relative",
                    }}
                  >
                    {/* Rarity label */}
                    <div style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      fontSize: 9,
                      fontWeight: 700,
                      color,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}>
                      {tier}
                    </div>

                    <div style={{ fontSize: 32, marginBottom: 4, filter: isEarned ? "none" : "grayscale(1)" }}>
                      {badge.icon}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                      {badge.name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
                      {badge.description.length > 50
                        ? badge.description.slice(0, 50) + "..."
                        : badge.description}
                    </div>

                    {isEarned && (
                      <div style={{ marginTop: 4 }}>
                        <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>
                          Earned {new Date(badge.studentBadges[0].earnedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </div>
                        {badge.xpReward > 0 && (
                          <div style={{ fontSize: 10, color: "var(--ypp-purple)", fontWeight: 600 }}>
                            +{badge.xpReward} XP
                          </div>
                        )}
                        <PinBadgeButton
                          badgeId={badge.id}
                          isPinned={badge.studentBadges[0].isPinned}
                        />
                      </div>
                    )}

                    {!isEarned && pct != null && (
                      <div style={{ fontSize: 10, color, marginTop: 4 }}>
                        {pct < 5 ? "< 5%" : `${Math.round(pct)}%`} of students have this
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
