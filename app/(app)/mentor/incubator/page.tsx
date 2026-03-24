import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getMentorIncubatorWorkspace } from "@/lib/incubator-actions";
import { normalizeRoleSet } from "@/lib/authorization";
import { INCUBATOR_PHASE_COLORS, INCUBATOR_PHASE_LABELS } from "@/lib/incubator-workflow";

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "No updates yet";
  return new Date(value).toLocaleDateString();
}

function phaseColorFor(phase: string | null | undefined) {
  if (!phase) return "#0f172a";
  return INCUBATOR_PHASE_COLORS[phase as keyof typeof INCUBATOR_PHASE_COLORS] || "#0f172a";
}

function phaseLabelFor(phase: string | null | undefined) {
  if (!phase) return "Unknown";
  return INCUBATOR_PHASE_LABELS[phase as keyof typeof INCUBATOR_PHASE_LABELS] || phase;
}

export default async function MentorIncubatorWorkspacePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const roleSet = normalizeRoleSet(
    (session.user as any).roles ?? [],
    (session.user as any).primaryRole ?? null
  );
  const canAccess =
    roleSet.has("MENTOR") || roleSet.has("ADMIN") || roleSet.has("INSTRUCTOR") || roleSet.has("CHAPTER_PRESIDENT");

  if (!canAccess) redirect("/incubator");

  const workspace = await getMentorIncubatorWorkspace();

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Mentor Incubator Workspace</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            Review milestone submissions, rescue stale projects, and move launches toward approval.
          </p>
        </div>
        <Link href="/incubator" className="button secondary">Back to Incubator</Link>
      </div>

      <div className="grid three" style={{ marginBottom: 24 }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#2563eb" }}>{workspace.projects.length}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Assigned Projects</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#d97706" }}>{workspace.pendingMilestones.length}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Milestones Awaiting Review</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#dc2626" }}>{workspace.staleProjects.length}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Stale Projects</div>
        </div>
      </div>

      {workspace.pendingMilestones.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Need Your Review</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {workspace.pendingMilestones.map((item) => (
              <Link
                key={`${item.projectId}-${item.milestone.id}`}
                href={`/incubator/project/${item.projectId}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="card" style={{ borderLeft: "4px solid #d97706" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.milestone.title}</div>
                      <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>
                        {item.projectTitle} · {item.studentName}
                      </div>
                    </div>
                    <span className="pill" style={{ background: "#fffbeb", color: "#b45309" }}>Submitted</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {workspace.launchQueue.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Submitted Launches</h2>
          <div className="grid two">
            {workspace.launchQueue.map((project) => (
              <Link
                key={project.id}
                href={`/incubator/project/${project.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="card" style={{ borderTop: "4px solid #2563eb" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                    <span className="pill" style={{ background: "#dbeafe", color: "#1d4ed8" }}>Launch submitted</span>
                    <span className="pill">{phaseLabelFor(project.currentPhase)}</span>
                  </div>
                  <h3 style={{ margin: "0 0 4px" }}>{project.launchTitle || project.title}</h3>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {project.student.name} · {project.cohort.name}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>All Assigned Projects</h2>
        {workspace.projects.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {workspace.projects.map((project) => {
              const color = phaseColorFor(project.currentPhase);
              const lastUpdate = project.updates[0]?.createdAt;
              return (
                <Link
                  key={project.id}
                  href={`/incubator/project/${project.id}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div className="card" style={{ borderLeft: `4px solid ${color}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                            <span className="pill" style={{ background: `${color}18`, color, fontWeight: 700 }}>
                            {phaseLabelFor(project.currentPhase)}
                          </span>
                          {project.mentorBlocked && (
                            <span className="pill" style={{ background: "#fef2f2", color: "#b91c1c" }}>Mentor blocked</span>
                          )}
                          {project.needsWeeklyCheckIn && (
                            <span className="pill" style={{ background: "#fff7ed", color: "#9a3412" }}>Needs check-in</span>
                          )}
                        </div>
                        <h3 style={{ margin: "0 0 4px" }}>{project.title}</h3>
                        <div style={{ fontSize: 13, color: "#475569" }}>
                          {project.student.name} · {project.cohort.name}
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>
                          Last update: {formatDate(lastUpdate)} · Next milestone: {project.nextMilestone?.title || "Current phase complete"}
                        </div>
                      </div>
                      <div style={{ minWidth: 180 }}>
                        <div style={{ fontSize: 28, fontWeight: 800, color }}>{project.currentPhaseProgress.percent}%</div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          {project.currentPhaseProgress.completed}/{project.currentPhaseProgress.total} milestones done
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="card">
            <p style={{ color: "var(--text-secondary)", margin: 0 }}>
              No incubator projects are assigned to this workspace yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
