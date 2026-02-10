import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function BadgesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Get user's badges
  const userBadges = await prisma.skillBadge.findMany({
    where: { userId: session.user.id },
    include: { skill: true },
    orderBy: { earnedAt: "desc" }
  });

  // Get all available skills
  const allSkills = await prisma.skill.findMany({
    orderBy: { name: "asc" }
  });

  // Group badges by level
  const badgesByLevel = {
    EXPERT: userBadges.filter(b => b.level === "EXPERT"),
    ADVANCED: userBadges.filter(b => b.level === "ADVANCED"),
    INTERMEDIATE: userBadges.filter(b => b.level === "INTERMEDIATE"),
    BEGINNER: userBadges.filter(b => b.level === "BEGINNER")
  };

  const earnedSkillIds = new Set(userBadges.map(b => b.skillId));
  const unearnedSkills = allSkills.filter(s => !earnedSkillIds.has(s.id));

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">My Progress</p>
          <h1 className="page-title">Skill Badges</h1>
        </div>
        <Link href="/badges/all" className="button secondary">
          Browse All Skills
        </Link>
      </div>

      <div className="grid two" style={{ marginBottom: 28 }}>
        <div className="card">
          <h3>Your Badge Collection</h3>
          <p>
            Earn badges to showcase your skills and competencies. Badges are awarded by instructors
            based on your performance and achievements in courses and projects.
          </p>
        </div>
        <div className="card">
          <div className="grid two">
            <div>
              <div className="kpi">{userBadges.length}</div>
              <div className="kpi-label">Badges Earned</div>
            </div>
            <div>
              <div className="kpi">{badgesByLevel.EXPERT.length + badgesByLevel.ADVANCED.length}</div>
              <div className="kpi-label">Advanced+</div>
            </div>
          </div>
        </div>
      </div>

      {userBadges.length === 0 ? (
        <div className="card">
          <h3>No Badges Yet</h3>
          <p>
            Complete courses and projects to earn your first skill badge! Instructors award badges
            based on your work and progress.
          </p>
          <Link href="/courses" className="button primary" style={{ marginTop: 12 }}>
            Browse Courses
          </Link>
        </div>
      ) : (
        <div>
          {/* Expert badges */}
          {badgesByLevel.EXPERT.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <div className="section-title">🏆 Expert Level</div>
              <div className="grid three">
                {badgesByLevel.EXPERT.map(badge => (
                  <Link
                    key={badge.id}
                    href={`/badges/${badge.id}`}
                    className="card"
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      background: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)"
                    }}
                  >
                    <div style={{ fontSize: 48, textAlign: "center", marginBottom: 8 }}>
                      {badge.skill.iconUrl || "🏆"}
                    </div>
                    <h3 style={{ textAlign: "center", marginBottom: 4 }}>{badge.skill.name}</h3>
                    <div style={{ textAlign: "center", fontSize: 12, opacity: 0.8 }}>
                      Earned {new Date(badge.earnedAt).toLocaleDateString()}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Advanced badges */}
          {badgesByLevel.ADVANCED.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <div className="section-title">⭐ Advanced Level</div>
              <div className="grid three">
                {badgesByLevel.ADVANCED.map(badge => (
                  <Link
                    key={badge.id}
                    href={`/badges/${badge.id}`}
                    className="card"
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      background: "linear-gradient(135deg, #C0C0C0 0%, #808080 100%)"
                    }}
                  >
                    <div style={{ fontSize: 48, textAlign: "center", marginBottom: 8 }}>
                      {badge.skill.iconUrl || "⭐"}
                    </div>
                    <h3 style={{ textAlign: "center", marginBottom: 4 }}>{badge.skill.name}</h3>
                    <div style={{ textAlign: "center", fontSize: 12, opacity: 0.8 }}>
                      Earned {new Date(badge.earnedAt).toLocaleDateString()}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Intermediate badges */}
          {badgesByLevel.INTERMEDIATE.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <div className="section-title">🥉 Intermediate Level</div>
              <div className="grid three">
                {badgesByLevel.INTERMEDIATE.map(badge => (
                  <Link
                    key={badge.id}
                    href={`/badges/${badge.id}`}
                    className="card"
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      background: "linear-gradient(135deg, #CD7F32 0%, #8B4513 100%)"
                    }}
                  >
                    <div style={{ fontSize: 48, textAlign: "center", marginBottom: 8 }}>
                      {badge.skill.iconUrl || "🥉"}
                    </div>
                    <h3 style={{ textAlign: "center", marginBottom: 4 }}>{badge.skill.name}</h3>
                    <div style={{ textAlign: "center", fontSize: 12, opacity: 0.8 }}>
                      Earned {new Date(badge.earnedAt).toLocaleDateString()}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Beginner badges */}
          {badgesByLevel.BEGINNER.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <div className="section-title">🌟 Beginner Level</div>
              <div className="grid three">
                {badgesByLevel.BEGINNER.map(badge => (
                  <Link
                    key={badge.id}
                    href={`/badges/${badge.id}`}
                    className="card"
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <div style={{ fontSize: 48, textAlign: "center", marginBottom: 8 }}>
                      {badge.skill.iconUrl || "🌟"}
                    </div>
                    <h3 style={{ textAlign: "center", marginBottom: 4 }}>{badge.skill.name}</h3>
                    <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-secondary)" }}>
                      Earned {new Date(badge.earnedAt).toLocaleDateString()}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Skills to earn */}
          {unearnedSkills.length > 0 && (
            <div>
              <div className="section-title">Skills to Earn</div>
              <div className="grid three">
                {unearnedSkills.slice(0, 6).map(skill => (
                  <div
                    key={skill.id}
                    className="card"
                    style={{ opacity: 0.5 }}
                  >
                    <div style={{ fontSize: 48, textAlign: "center", marginBottom: 8 }}>
                      {skill.iconUrl || "❓"}
                    </div>
                    <h3 style={{ textAlign: "center", marginBottom: 4 }}>{skill.name}</h3>
                    {skill.description && (
                      <p style={{ fontSize: 12, textAlign: "center", color: "var(--text-secondary)" }}>
                        {skill.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {unearnedSkills.length > 6 && (
                <div style={{ textAlign: "center", marginTop: 16 }}>
                  <Link href="/badges/all" className="button secondary">
                    View All {unearnedSkills.length} Available Skills
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
