import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function BadgeDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const badge = await prisma.skillBadge.findUnique({
    where: { id: params.id },
    include: {
      skill: true,
      user: {
        include: {
          profile: true
        }
      }
    }
  });

  if (!badge) {
    redirect("/badges");
  }

  // Only allow viewing own badges or if admin/instructor
  const canView =
    badge.userId === session.user.id ||
    session.user.primaryRole === "ADMIN" ||
    session.user.primaryRole === "INSTRUCTOR";

  if (!canView) {
    redirect("/badges");
  }

  const levelColors = {
    EXPERT: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
    ADVANCED: "linear-gradient(135deg, #C0C0C0 0%, #808080 100%)",
    INTERMEDIATE: "linear-gradient(135deg, #CD7F32 0%, #8B4513 100%)",
    BEGINNER: "var(--accent-bg)"
  };

  const levelEmojis = {
    EXPERT: "🏆",
    ADVANCED: "⭐",
    INTERMEDIATE: "🥉",
    BEGINNER: "🌟"
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">
            <Link href="/badges" style={{ color: "inherit", textDecoration: "none" }}>
              Skill Badges
            </Link>
          </p>
          <h1 className="page-title">{badge.skill.name}</h1>
        </div>
        <form action="/api/badges/toggle-visibility" method="POST">
          <input type="hidden" name="badgeId" value={badge.id} />
          <input type="hidden" name="isVisible" value={badge.isVisible ? "false" : "true"} />
          {badge.userId === session.user.id && (
            <button type="submit" className="button secondary">
              {badge.isVisible ? "Hide from Profile" : "Show on Profile"}
            </button>
          )}
        </form>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div className="card" style={{ background: levelColors[badge.level], color: "#000" }}>
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 120, marginBottom: 20 }}>
              {badge.skill.iconUrl || levelEmojis[badge.level]}
            </div>
            <h1 style={{ fontSize: 36, marginBottom: 8 }}>{badge.skill.name}</h1>
            <div style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>
              {levelEmojis[badge.level]} {badge.level} LEVEL
            </div>
            <div style={{ fontSize: 18, opacity: 0.8 }}>
              Earned by {badge.user.name} on {new Date(badge.earnedAt).toLocaleDateString()}
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 24 }}>
          <h3>About This Skill</h3>
          {badge.skill.description ? (
            <p style={{ marginTop: 12 }}>{badge.skill.description}</p>
          ) : (
            <p style={{ marginTop: 12, color: "var(--text-secondary)" }}>
              No description provided for this skill.
            </p>
          )}

          {badge.skill.category && (
            <div style={{ marginTop: 16 }}>
              <span className="pill">{badge.skill.category}</span>
            </div>
          )}
        </div>

        {badge.evidence && (
          <div className="card" style={{ marginTop: 24 }}>
            <h3>Evidence</h3>
            <p style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>{badge.evidence}</p>
          </div>
        )}

        <div className="card" style={{ marginTop: 24 }}>
          <h3>Badge Details</h3>
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>
                Badge Holder
              </div>
              <div style={{ fontWeight: 600 }}>{badge.user.name}</div>
            </div>
            <div>
              <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>
                Earned Date
              </div>
              <div style={{ fontWeight: 600 }}>
                {new Date(badge.earnedAt).toLocaleDateString()}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>
                Skill Level
              </div>
              <div style={{ fontWeight: 600 }}>{badge.level}</div>
            </div>
            <div>
              <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>
                Visibility
              </div>
              <div style={{ fontWeight: 600 }}>
                {badge.isVisible ? "Public" : "Private"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
