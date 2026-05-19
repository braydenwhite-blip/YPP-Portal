import Link from "next/link";
import { requirePageRoles } from "@/lib/page-guards";
import { getChapterInstructors } from "@/lib/chapter-actions";

export const dynamic = "force-dynamic";

const GOAL_STATUS_COLORS: Record<string, string> = {
  ON_TRACK: "#16a34a",
  AT_RISK: "#ca8a04",
  BEHIND: "#dc2626",
  COMPLETED: "#2563eb",
};

export default async function ChapterInstructorsPage() {
  await requirePageRoles(["CHAPTER_PRESIDENT", "ADMIN"]);

  const instructors = await getChapterInstructors();

  const trainingComplete = instructors.filter(
    (i) => i.trainings.length > 0 && i.trainings.every((t) => t.status === "COMPLETE"),
  ).length;
  const teaching = instructors.filter((i) => i.courses.length > 0).length;

  return (
    <main className="main-content">
      <div className="page-header">
        <div>
          <Link href="/chapter" className="back-link">
            ← Command Center
          </Link>
          <h1>Chapter Instructors</h1>
          <p className="page-subtitle">
            Monitor training progress, course load, and goals for your teaching team.
          </p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-value">{instructors.length}</span>
          <span className="stat-label">Total Instructors</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{trainingComplete}</span>
          <span className="stat-label">Training Complete</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{teaching}</span>
          <span className="stat-label">Teaching a Course</span>
        </div>
      </div>

      {instructors.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>No instructors yet</h2>
          <p style={{ color: "var(--muted)", marginBottom: 16 }}>
            Open recruiting to bring instructors onto your chapter team.
          </p>
          <Link href="/chapter/recruiting" className="button" style={{ textDecoration: "none" }}>
            Open Recruiting
          </Link>
        </div>
      ) : (
        <div className="grid three">
          {instructors.map((instructor) => {
            const completed = instructor.trainings.filter((t) => t.status === "COMPLETE").length;
            const total = instructor.trainings.length;
            const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
            const goalStatus = instructor.goals[0]?.progress[0]?.status ?? null;
            const lastReflection = instructor.reflectionSubmissions[0];
            const initial = (instructor.name || instructor.email || "?").charAt(0).toUpperCase();

            return (
              <Link
                key={instructor.id}
                href={`/chapter/instructors/${instructor.id}`}
                className="card"
                style={{ display: "block", textDecoration: "none", color: "inherit" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: "var(--ypp-purple)",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: 18,
                      flexShrink: 0,
                    }}
                  >
                    {initial}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ margin: 0, fontSize: 15 }}>{instructor.name || "Unnamed"}</h3>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--muted)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {instructor.email}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12,
                      color: "var(--muted)",
                      marginBottom: 4,
                    }}
                  >
                    <span>Training</span>
                    <span style={{ fontWeight: 600, color: "var(--text)" }}>{progress}%</span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 999,
                      background: "var(--surface-alt, #eee)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${progress}%`,
                        height: "100%",
                        background: progress === 100 ? "#16a34a" : "var(--ypp-purple)",
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 13 }}>
                  <span>
                    <strong>{instructor.courses.length}</strong>{" "}
                    <span style={{ color: "var(--muted)" }}>courses</span>
                  </span>
                  <span>
                    <strong>{instructor.goals.length}</strong>{" "}
                    <span style={{ color: "var(--muted)" }}>goals</span>
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  {goalStatus ? (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 999,
                        color: "white",
                        background: GOAL_STATUS_COLORS[goalStatus] ?? "#64748b",
                      }}
                    >
                      {goalStatus.replace(/_/g, " ")}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>No goal progress</span>
                  )}
                  <span style={{ fontSize: 12, color: "var(--ypp-purple)", fontWeight: 600 }}>
                    View details →
                  </span>
                </div>

                {lastReflection && (
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
                    Last reflection {new Date(lastReflection.submittedAt).toLocaleDateString()}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
