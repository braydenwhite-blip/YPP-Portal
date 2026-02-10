import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getStudentLearningPaths } from "@/lib/ai-personalization-actions";
import Link from "next/link";
import { PathGeneratorClient } from "./client";

export default async function LearningPathGeneratorPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const paths = await getStudentLearningPaths(session.user.id);
  const activePaths = paths.filter((p) => p.status === "ACTIVE");
  const pausedPaths = paths.filter((p) => p.status === "PAUSED");
  const completedPaths = paths.filter((p) => p.status === "COMPLETED");

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">AI-Powered</p>
          <h1 className="page-title">Learning Path Generator</h1>
        </div>
        <Link href="/analytics" className="button secondary">
          My Analytics
        </Link>
      </div>

      {/* Intro */}
      <div className="card" style={{ marginBottom: 24, background: "linear-gradient(135deg, var(--ypp-purple-50), #ede9fe)", borderLeft: "4px solid var(--ypp-purple)" }}>
        <h3 style={{ color: "var(--ypp-purple)" }}>Your Personalized Roadmap</h3>
        <p style={{ marginTop: 4, fontSize: 14, color: "var(--text-secondary)" }}>
          Tell us your goals and available time, and we&apos;ll create a custom learning path
          with weekly milestones, recommended classes, and practice goals tailored just for you.
        </p>
      </div>

      {/* Active Paths */}
      {activePaths.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-title">Active Paths</div>
          <div className="grid two">
            {activePaths.map((path) => {
              const milestones = (path.milestones as Array<{ week: number; goal: string; isComplete: boolean }>) || [];
              const completed = milestones.filter((m) => m.isComplete).length;

              return (
                <div key={path.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div>
                      <h3>{path.passionArea}</h3>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                        Target: {path.targetSkillLevel} | {path.timeframeDays} days | {path.weeklyHoursAvailable} hrs/week
                      </div>
                    </div>
                    <span className="pill primary">Active</span>
                  </div>

                  {/* Progress Bar */}
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span>{completed} / {milestones.length} milestones</span>
                      <span style={{ fontWeight: 600, color: "var(--ypp-purple)" }}>{Math.round(path.completionPct)}%</span>
                    </div>
                    <div style={{ width: "100%", height: 8, background: "var(--gray-200)", borderRadius: 4, marginTop: 4, overflow: "hidden" }}>
                      <div style={{ width: `${path.completionPct}%`, height: "100%", background: "var(--ypp-purple)", borderRadius: 4, transition: "width 0.3s" }} />
                    </div>
                  </div>

                  {/* Next Milestone */}
                  {milestones.length > 0 && (
                    <div style={{ marginTop: 12, padding: "8px 12px", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", fontSize: 13 }}>
                      <strong>Next:</strong> {milestones.find((m) => !m.isComplete)?.goal || "All complete!"}
                    </div>
                  )}

                  {/* Practice Goals */}
                  {path.practiceGoals && Object.keys(path.practiceGoals as Record<string, string>).length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 13, color: "var(--text-secondary)" }}>
                      {Object.entries(path.practiceGoals as Record<string, string>).map(([area, goal]) => (
                        <span key={area}>Practice: {goal}</span>
                      ))}
                    </div>
                  )}

                  <PathGeneratorClient pathId={path.id} milestones={milestones} mode="progress" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Paused Paths */}
      {pausedPaths.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-title">Paused Paths</div>
          {pausedPaths.map((path) => (
            <div key={path.id} className="card" style={{ opacity: 0.7, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>{path.passionArea}</strong>
                  <span style={{ marginLeft: 8, fontSize: 13, color: "var(--text-secondary)" }}>
                    {Math.round(path.completionPct)}% complete
                  </span>
                </div>
                <PathGeneratorClient pathId={path.id} milestones={[]} mode="pause" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Completed Paths */}
      {completedPaths.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-title">Completed Paths</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {completedPaths.map((path) => (
              <div key={path.id} className="card" style={{ padding: "12px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>&#10003;</span>
                  <div>
                    <strong>{path.passionArea}</strong>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {path.targetSkillLevel} | Completed {path.completedAt ? new Date(path.completedAt).toLocaleDateString() : ""}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generate New Path */}
      <div style={{ marginBottom: 28 }}>
        <div className="section-title">Create a New Learning Path</div>
        <PathGeneratorClient pathId="" milestones={[]} mode="generate" />
      </div>
    </div>
  );
}
