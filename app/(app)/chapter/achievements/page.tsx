import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getChapterMilestones } from "@/lib/chapter-gamification-actions";
import { AddMilestoneForm } from "./add-milestone-form";
import Link from "next/link";

export default async function ChapterAchievementsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { milestones, unlockedCount, totalCount, stats } = await getChapterMilestones();
  const roles = new Set(session.user.roles ?? []);
  const isLead = roles.has("CHAPTER_PRESIDENT") || roles.has("ADMIN");

  return (
    <main className="main-content">
      <div className="page-header">
        <div>
          <h1>Chapter Achievements</h1>
          <p className="subtitle">
            {unlockedCount} of {totalCount} milestones unlocked
          </p>
        </div>
        <Link href="/my-chapter" style={{ fontSize: 13, color: "var(--ypp-purple)" }}>
          ← Chapter Home
        </Link>
      </div>

      {/* Progress Overview */}
      <div className="card" style={{ marginBottom: 24, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>
          {unlockedCount === totalCount && totalCount > 0 ? "🏆" : "🎯"}
        </div>
        <div
          style={{
            height: 10,
            background: "var(--border)",
            borderRadius: 5,
            overflow: "hidden",
            maxWidth: 400,
            margin: "0 auto 12px",
          }}
        >
          <div
            style={{
              width: `${totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0}%`,
              height: "100%",
              borderRadius: 5,
              background: unlockedCount === totalCount
                ? "#22c55e"
                : "linear-gradient(90deg, var(--ypp-purple), var(--ypp-pink))",
              transition: "width 0.5s ease",
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 24, fontSize: 13, color: "var(--muted)" }}>
          <span>{stats.MEMBER_COUNT} members</span>
          <span>{stats.EVENT_COUNT} events</span>
          <span>{stats.COURSE_COUNT} courses</span>
        </div>
      </div>

      {/* Milestone Grid */}
      <div className="grid two" style={{ marginBottom: 24 }}>
        {milestones.map((milestone: {
          id: string;
          icon: string;
          title: string;
          description: string | null;
          isUnlocked: boolean;
          isNewlyUnlocked: boolean;
          currentValue: number;
          threshold: number;
          progress: number;
          type: string;
          unlockedAt: Date | null;
        }) => (
          <div
            key={milestone.id}
            className="card"
            style={{
              opacity: milestone.isUnlocked ? 1 : 0.7,
              border: milestone.isNewlyUnlocked
                ? "2px solid #22c55e"
                : milestone.isUnlocked
                ? "1px solid var(--ypp-purple)"
                : undefined,
              background: milestone.isNewlyUnlocked ? "rgba(34,197,94,0.03)" : undefined,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  background: milestone.isUnlocked
                    ? "linear-gradient(135deg, var(--ypp-purple), var(--ypp-pink))"
                    : "var(--bg)",
                  filter: milestone.isUnlocked ? "none" : "grayscale(1)",
                  flexShrink: 0,
                }}
              >
                {milestone.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <strong style={{ fontSize: 15 }}>{milestone.title}</strong>
                  {milestone.isUnlocked && (
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "#dcfce7",
                        color: "#166534",
                      }}
                    >
                      Unlocked
                    </span>
                  )}
                  {milestone.isNewlyUnlocked && (
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "#fef3c7",
                        color: "#92400e",
                      }}
                    >
                      NEW!
                    </span>
                  )}
                </div>
                {milestone.description && (
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
                    {milestone.description}
                  </p>
                )}
                {/* Progress */}
                {!milestone.isUnlocked && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: "var(--muted)" }}>
                        {milestone.currentValue} / {milestone.threshold}
                      </span>
                      <span style={{ color: "var(--ypp-purple)", fontWeight: 600 }}>
                        {Math.round(milestone.progress * 100)}%
                      </span>
                    </div>
                    <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${milestone.progress * 100}%`,
                          height: "100%",
                          borderRadius: 3,
                          background: "var(--ypp-purple)",
                        }}
                      />
                    </div>
                  </div>
                )}
                {milestone.isUnlocked && milestone.unlockedAt && (
                  <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--muted)" }}>
                    Unlocked {new Date(milestone.unlockedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Custom Milestone (lead only) */}
      {isLead && <AddMilestoneForm />}
    </main>
  );
}
