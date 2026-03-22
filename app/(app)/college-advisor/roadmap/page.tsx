import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getMyRoadmapData, STAGE_ORDER } from "@/lib/college-roadmap-actions";
import RoadmapClient from "./roadmap-client";
import Link from "next/link";

export const metadata = { title: "College Readiness Roadmap — YPP" };

export default async function CollegeRoadmapPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const data = await getMyRoadmapData();

  if (!data) {
    return (
      <div>
        <div className="topbar">
          <h1 className="page-title">College Readiness Roadmap</h1>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
          <p style={{ color: "var(--muted)" }}>Unable to load roadmap data.</p>
        </div>
      </div>
    );
  }

  const currentStageIdx = STAGE_ORDER.indexOf(data.currentStage);
  const isAtFinalStage = currentStageIdx >= STAGE_ORDER.length - 1;
  const currentStageTasks = data.tasks.filter((t) => t.stage === data.currentStage);
  const currentStageCompleted = currentStageTasks.filter((t) => t.completedAt !== null).length;
  const currentStagePercent =
    currentStageTasks.length > 0
      ? Math.round((currentStageCompleted / currentStageTasks.length) * 100)
      : 0;

  return (
    <div>
      <div className="topbar" style={{ marginBottom: "1.5rem" }}>
        <div>
          <p className="badge">College Advisor</p>
          <h1 className="page-title">College Readiness Roadmap</h1>
          <p className="page-subtitle">
            {data.currentStageConfig.emoji} Currently: {data.currentStageConfig.label} —{" "}
            {data.currentStageConfig.description}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <Link href="/college-advisor/activities" className="button secondary small">
            Activities Builder →
          </Link>
        </div>
      </div>

      {/* Stage Progress Bar */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <p style={{ fontWeight: 700, fontSize: "0.9rem" }}>Your Journey</p>
          <span className="pill" style={{ fontSize: "0.75rem" }}>
            {data.overallProgress}% complete
          </span>
        </div>

        {/* Stage pipeline */}
        <div style={{ display: "flex", gap: "0.25rem", overflowX: "auto", paddingBottom: "0.5rem" }}>
          {data.stageProgress.map((sp, i) => (
            <div
              key={sp.stage}
              style={{
                flex: 1,
                minWidth: "70px",
                textAlign: "center",
                opacity: sp.isUnlocked ? 1 : 0.4,
              }}
            >
              <div
                style={{
                  height: "6px",
                  background: sp.isCurrentStage
                    ? "var(--ypp-purple-500)"
                    : sp.percentComplete === 100
                    ? "#16a34a"
                    : sp.isUnlocked
                    ? "var(--surface-alt)"
                    : "var(--surface-alt)",
                  borderRadius: "3px",
                  marginBottom: "0.35rem",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {sp.percentComplete > 0 && sp.percentComplete < 100 && (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      height: "100%",
                      width: `${sp.percentComplete}%`,
                      background: "var(--ypp-purple-500)",
                    }}
                  />
                )}
              </div>
              <p style={{ fontSize: "0.62rem", color: sp.isCurrentStage ? "var(--ypp-purple-500)" : "var(--muted)", fontWeight: sp.isCurrentStage ? 700 : 400 }}>
                {sp.emoji}
              </p>
              <p style={{ fontSize: "0.62rem", color: sp.isCurrentStage ? "var(--text)" : "var(--muted)", fontWeight: sp.isCurrentStage ? 700 : 400, lineHeight: 1.2 }}>
                {sp.label}
              </p>
            </div>
          ))}
        </div>

        {/* Profile chips */}
        {(data.graduationYear || data.dreamColleges.length > 0 || data.intendedMajors.length > 0) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.75rem" }}>
            {data.graduationYear && (
              <span className="pill" style={{ fontSize: "0.72rem" }}>🎓 Class of {data.graduationYear}</span>
            )}
            {data.intendedMajors.slice(0, 2).map((m) => (
              <span key={m} className="pill" style={{ fontSize: "0.72rem" }}>📚 {m}</span>
            ))}
            {data.dreamColleges.slice(0, 2).map((c) => (
              <span key={c} className="pill" style={{ fontSize: "0.72rem", background: "#fef9c3", color: "#854d0e" }}>⭐ {c}</span>
            ))}
          </div>
        )}
      </div>

      {/* Current Stage Tasks */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "1.5rem", alignItems: "start" }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <p style={{ fontWeight: 700, fontSize: "1rem" }}>
              {data.currentStageConfig.emoji} {data.currentStageConfig.label} Tasks
            </p>
            <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
              {currentStageCompleted}/{currentStageTasks.length} · {currentStagePercent}%
            </span>
          </div>

          {currentStageTasks.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
              <p>No tasks for this stage yet.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {currentStageTasks.map((task) => (
                <div
                  key={task.id}
                  className="card"
                  style={{
                    padding: "0.75rem 1rem",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.75rem",
                    opacity: task.completedAt ? 0.7 : 1,
                  }}
                >
                  <RoadmapClient taskId={task.id} isCompleted={!!task.completedAt} mode="toggle" />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <p
                        style={{
                          fontWeight: 600,
                          fontSize: "0.88rem",
                          textDecoration: task.completedAt ? "line-through" : "none",
                        }}
                      >
                        {task.title}
                        {task.isRequired && (
                          <span style={{ marginLeft: "0.4rem", color: "#ef4444", fontSize: "0.72rem" }}>Required</span>
                        )}
                      </p>
                      <span
                        className="pill"
                        style={{ fontSize: "0.65rem", background: "var(--surface-alt)", color: "var(--muted)" }}
                      >
                        {task.category}
                      </span>
                    </div>
                    {task.description && (
                      <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "0.2rem" }}>
                        {task.description}
                      </p>
                    )}
                    {task.dueDate && (
                      <p style={{ fontSize: "0.72rem", color: "#d97706", marginTop: "0.15rem" }}>
                        Due: {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    )}
                    {task.notes && (
                      <p style={{ fontSize: "0.75rem", color: "var(--text)", marginTop: "0.2rem", fontStyle: "italic" }}>
                        💬 {task.notes}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Advance Stage */}
          {!isAtFinalStage && currentStagePercent >= 60 && (
            <div className="card" style={{ marginTop: "1rem", textAlign: "center", background: "#f0fdf4" }}>
              <p style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.3rem", color: "#166534" }}>
                Ready to advance? You&apos;re {currentStagePercent}% done with {data.currentStageConfig.label}!
              </p>
              <p style={{ fontSize: "0.8rem", color: "#15803d", marginBottom: "0.75rem" }}>
                Advancing will unlock the next stage&apos;s task templates.
              </p>
              <RoadmapClient mode="advance-stage" />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div>
          {/* Add Custom Task */}
          <div className="card" style={{ marginBottom: "1rem" }}>
            <p style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.75rem" }}>
              Add Custom Task
            </p>
            <RoadmapClient
              mode="add-task-form"
              currentStage={data.currentStage}
              availableStages={data.stageProgress.filter((s) => s.isUnlocked).map((s) => ({ stage: s.stage, label: s.label }))}
            />
          </div>

          {/* Profile Editor */}
          <div className="card">
            <p style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.75rem" }}>
              Your Goals
            </p>
            <RoadmapClient
              mode="profile-form"
              graduationYear={data.graduationYear ?? undefined}
              dreamColleges={data.dreamColleges}
              intendedMajors={data.intendedMajors}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
