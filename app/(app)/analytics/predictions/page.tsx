import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getStudentAnalytics } from "@/lib/ai-personalization-actions";
import { LEVELS } from "@/lib/xp-config";
import Link from "next/link";

export default async function PredictionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { snapshot, predictions } = await getStudentAnalytics(session.user.id);

  const currentLevel = LEVELS.find((l) => l.level === (snapshot?.level || 1));
  const nextLevel = LEVELS.find((l) => l.level === (snapshot?.level || 1) + 1);

  const typeLabels: Record<string, string> = {
    LEVEL_UP: "Level Up",
    SKILL_MASTERY: "Skill Mastery",
    COURSE_COMPLETION: "Course Completion",
    STREAK_MILESTONE: "Streak Goal",
  };

  const typeColors: Record<string, string> = {
    LEVEL_UP: "#7c3aed",
    SKILL_MASTERY: "#3b82f6",
    COURSE_COMPLETION: "#16a34a",
    STREAK_MILESTONE: "#d97706",
  };

  const confidenceLabel = (c: number) => {
    if (c >= 0.8) return "Very Likely";
    if (c >= 0.6) return "Likely";
    if (c >= 0.4) return "Possible";
    return "Uncertain";
  };

  const confidenceColor = (c: number) => {
    if (c >= 0.8) return "#16a34a";
    if (c >= 0.6) return "#3b82f6";
    if (c >= 0.4) return "#d97706";
    return "#ef4444";
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href="/analytics" style={{ fontSize: 13, color: "var(--ypp-purple)" }}>
            &larr; Analytics Dashboard
          </Link>
          <h1 className="page-title" style={{ marginTop: 4 }}>Progress Predictions</h1>
        </div>
      </div>

      {/* Explanation Banner */}
      <div className="card" style={{ marginBottom: 24, background: "var(--ypp-purple-50)", borderLeft: "4px solid var(--ypp-purple)" }}>
        <div style={{ fontWeight: 600, color: "var(--ypp-purple)" }}>How Predictions Work</div>
        <p style={{ marginTop: 4, fontSize: 14, color: "var(--text-secondary)" }}>
          Predictions are based on your recent activity, practice frequency, and XP earning rate.
          Keep up consistent practice to improve prediction confidence!
        </p>
      </div>

      {/* Current Standing */}
      <div className="grid three" style={{ marginBottom: 24 }}>
        <div className="card">
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Current Level</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ypp-purple)" }}>
            {currentLevel?.title || "Explorer"}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Level {snapshot?.level || 1}
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Total XP</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ypp-purple)" }}>
            {snapshot?.totalXP || 0}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {nextLevel ? `${nextLevel.xpRequired - (snapshot?.totalXP || 0)} to next level` : "Max level!"}
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Active Predictions</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ypp-purple)" }}>
            {predictions.length}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            milestones tracked
          </div>
        </div>
      </div>

      {/* Predictions List */}
      {predictions.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
          {predictions.map((pred) => {
            const color = typeColors[pred.predictionType] || "var(--ypp-purple)";
            const daysUntil = Math.ceil(
              (new Date(pred.predictedDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            );
            const weeksUntil = Math.ceil(daysUntil / 7);

            return (
              <div key={pred.id} className="card" style={{ borderLeft: `4px solid ${color}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span
                        className="pill"
                        style={{
                          background: `${color}15`,
                          color,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {typeLabels[pred.predictionType] || pred.predictionType}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: confidenceColor(pred.confidence),
                        }}
                      >
                        {confidenceLabel(pred.confidence)} ({Math.round(pred.confidence * 100)}%)
                      </span>
                    </div>
                    <h4 style={{ margin: "4px 0" }}>{pred.title}</h4>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
                      {pred.description}
                    </p>
                  </div>

                  <div style={{ textAlign: "right", minWidth: 120 }}>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      Predicted
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {new Date(pred.predictedDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                      {daysUntil <= 0
                        ? "Any day now!"
                        : daysUntil <= 7
                          ? `${daysUntil} day${daysUntil !== 1 ? "s" : ""} away`
                          : `~${weeksUntil} week${weeksUntil !== 1 ? "s" : ""} away`}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: "var(--text-secondary)" }}>
                      {Math.round(pred.currentValue)} / {Math.round(pred.targetValue)}
                    </span>
                    <span style={{ fontWeight: 600, color }}>{Math.round(pred.progressPct)}%</span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: 8,
                      background: "var(--gray-200)",
                      borderRadius: 4,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(pred.progressPct, 100)}%`,
                        height: "100%",
                        background: color,
                        borderRadius: 4,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                </div>

                {/* Passion area tag */}
                {pred.passionArea && (
                  <div style={{ marginTop: 8 }}>
                    <span
                      className="pill"
                      style={{ fontSize: 11, background: "var(--surface-alt)" }}
                    >
                      {pred.passionArea}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3>No Predictions Yet</h3>
          <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>
            Start practicing and earning XP to generate progress predictions.
            The system needs at least a few days of activity data to make meaningful predictions.
          </p>
          <Link href="/pathways" className="button primary" style={{ marginTop: 12 }}>
            Explore Pathways
          </Link>
        </div>
      )}

      {/* "What If" Scenarios */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3>What If Scenarios</h3>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
          See how changing your habits could impact your progress.
        </p>
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <div style={{ padding: 16, background: "var(--surface-alt)", borderRadius: "var(--radius-md)", textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#16a34a" }}>Double Your Practice</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
              Practicing twice as much could help you level up{" "}
              <strong style={{ color: "#16a34a" }}>2x faster</strong>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)" }}>
              {nextLevel
                ? `Reach ${nextLevel.title} in ~${Math.max(1, Math.round(
                    (nextLevel.xpRequired - (snapshot?.totalXP || 0)) /
                      Math.max(1, (snapshot?.xpGainedThisWeek || 1) * 2)
                  ))} weeks`
                : "You're at max level!"}
            </div>
          </div>

          <div style={{ padding: 16, background: "var(--surface-alt)", borderRadius: "var(--radius-md)", textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#3b82f6" }}>Daily Practice</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
              Practicing every day builds a streak and earns{" "}
              <strong style={{ color: "#3b82f6" }}>bonus XP</strong>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)" }}>
              Current streak: {snapshot?.currentStreak || 0} days | Best: {snapshot?.longestStreak || 0} days
            </div>
          </div>

          <div style={{ padding: 16, background: "var(--surface-alt)", borderRadius: "var(--radius-md)", textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#d97706" }}>New Passion Area</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
              Exploring a new area earns{" "}
              <strong style={{ color: "#d97706" }}>discovery XP</strong>
            </div>
            <div style={{ marginTop: 8 }}>
              <Link href="/learn/path-generator" style={{ fontSize: 12, color: "var(--ypp-purple)", fontWeight: 600 }}>
                Generate a Learning Path &rarr;
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="card">
        <h3>Tips to Improve Predictions</h3>
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "start", padding: "8px 0", borderBottom: "1px solid var(--border-light)" }}>
            <span style={{ fontSize: 18 }}>1</span>
            <div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>Log practice consistently</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Regular practice logs help the system understand your pace and patterns.
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "start", padding: "8px 0", borderBottom: "1px solid var(--border-light)" }}>
            <span style={{ fontSize: 18 }}>2</span>
            <div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>Complete assignments on time</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Finishing class assignments boosts your XP rate and improves prediction confidence.
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "start", padding: "8px 0" }}>
            <span style={{ fontSize: 18 }}>3</span>
            <div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>Set a realistic weekly goal</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Use your learning path to set a weekly practice hours target that works for you.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
