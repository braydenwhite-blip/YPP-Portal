import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getActiveCohort,
  getMyIncubatorProjects,
  getMyApplications,
  getIncubatorStats,
  getAllIncubatorProjects,
} from "@/lib/incubator-actions";
import Link from "next/link";
import { isFeatureEnabledForUser } from "@/lib/feature-gates";
import { normalizeRoleSet } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import {
  INCUBATOR_PHASE_COLORS,
  INCUBATOR_PHASE_LABELS,
} from "@/lib/incubator-workflow";

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "TBD";
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

export default async function IncubatorPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const featureEnabled = await isFeatureEnabledForUser("INCUBATOR", {
    userId: session.user.id,
  });

  if (!featureEnabled) {
    return (
      <div>
        <div className="topbar">
          <div>
            <h1 className="page-title">Passion Project Incubator</h1>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
              This section is not enabled for your chapter yet.
            </p>
          </div>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Pilot rollout in progress</h3>
          <p style={{ color: "var(--text-secondary)", marginBottom: 12 }}>
            You can still track progress from Activity Hub and core student tools while incubator access rolls out.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/activities" className="button secondary">Activity Hub</Link>
            <Link href="/projects/tracker" className="button secondary">Project Tracker</Link>
            <Link href="/world" className="button secondary">Passion World</Link>
          </div>
        </div>
      </div>
    );
  }

  const roleSet = normalizeRoleSet(
    (session.user as any).roles ?? [],
    (session.user as any).primaryRole ?? null
  );
  const canManage = roleSet.has("ADMIN") || roleSet.has("INSTRUCTOR") || roleSet.has("CHAPTER_PRESIDENT");

  const [activeCohort, myProjects, myApps, stats, allProjects, passionAreas] = await Promise.all([
    getActiveCohort(),
    getMyIncubatorProjects(),
    getMyApplications(),
    getIncubatorStats(),
    getAllIncubatorProjects(),
    prisma.passionArea
      .findMany({
        where: { isActive: true },
        select: { id: true, name: true },
      })
      .catch(() => []),
  ]);

  const passionNameById = new Map(passionAreas.map((passion) => [passion.id, passion.name]));
  const resolvePassionLabel = (value: string | null | undefined, fallback?: string | null) => {
    if (!value) return fallback ?? "General";
    return passionNameById.get(value) ?? fallback ?? value;
  };

  const pendingApp = (myApps as any[]).find(
    (application) => application.status === "SUBMITTED" || application.status === "UNDER_REVIEW"
  );

  return (
    <div>
      <div
        className="card"
        style={{
          marginBottom: 24,
          background:
            "linear-gradient(140deg, rgba(255,247,237,1) 0%, rgba(239,246,255,1) 45%, rgba(240,253,244,1) 100%)",
          border: "1px solid rgba(15, 23, 42, 0.08)",
          overflow: "hidden",
        }}
      >
        <div className="topbar" style={{ marginBottom: 0 }}>
          <div style={{ maxWidth: 760 }}>
            <span
              className="pill"
              style={{
                background: "#0f172a",
                color: "#fff",
                fontWeight: 700,
                letterSpacing: 0.3,
              }}
            >
              Youth Launchpad
            </span>
            <h1 className="page-title" style={{ marginTop: 12, marginBottom: 8 }}>
              Build your project like it is going somewhere real.
            </h1>
            <p style={{ fontSize: 15, color: "#334155", maxWidth: 700, lineHeight: 1.6, margin: 0 }}>
              The incubator now runs like a guided studio. Every accepted project gets a mentor, a milestone map,
              a launch story, and a real finish line.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "start" }}>
            <Link href="/incubator/launches" className="button secondary">Public Launches</Link>
            {activeCohort && (activeCohort as any).status === "ACCEPTING_APPLICATIONS" && !pendingApp && (
              <Link href="/incubator/apply" className="button primary">Apply Now</Link>
            )}
            {canManage && <Link href="/admin/incubator" className="button secondary">Manage</Link>}
          </div>
        </div>
      </div>

      <div
        className="grid"
        style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 24 }}
      >
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#f97316" }}>{stats.totalProjects}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Projects launched into the studio</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#2563eb" }}>{stats.activeProjects}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Projects still building</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#0f766e" }}>{stats.totalUpdates}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Progress updates posted</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#15803d" }}>{stats.showcaseReady}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Approved public launches</div>
        </div>
      </div>

      {activeCohort && (
        <div
          className="card"
          style={{
            marginBottom: 24,
            borderLeft: "4px solid #2563eb",
            background: "linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                <span
                  className="pill"
                  style={{
                    background: (activeCohort as any).status === "ACCEPTING_APPLICATIONS" ? "#dbeafe" : "#dcfce7",
                    color: (activeCohort as any).status === "ACCEPTING_APPLICATIONS" ? "#1d4ed8" : "#15803d",
                    fontWeight: 700,
                  }}
                >
                  {(activeCohort as any).status === "ACCEPTING_APPLICATIONS" ? "Applications open" : "Cohort live"}
                </span>
                <span className="pill">Starts {formatDate((activeCohort as any).startDate)}</span>
                <span className="pill">Showcase {formatDate((activeCohort as any).showcaseDate)}</span>
              </div>
              <h2 style={{ margin: "0 0 6px" }}>{(activeCohort as any).name}</h2>
              {(activeCohort as any).description && (
                <p style={{ fontSize: 14, color: "#475569", margin: "0 0 10px", lineHeight: 1.6 }}>
                  {(activeCohort as any).description}
                </p>
              )}
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: "#475569" }}>
                <span>{(activeCohort as any)._count.projects} active projects</span>
                <span>{(activeCohort as any)._count.applications} applications</span>
                <span>{(activeCohort as any).milestoneTemplates?.length ?? 0} structured milestones</span>
              </div>
            </div>

            <div
              style={{
                minWidth: 260,
                padding: 16,
                borderRadius: 16,
                background: "rgba(255,255,255,0.86)",
                border: "1px solid rgba(37, 99, 235, 0.15)",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase" }}>
                What changed
              </div>
              <ul style={{ margin: "10px 0 0", paddingLeft: 18, color: "#334155", lineHeight: 1.7, fontSize: 13 }}>
                <li>Every project now gets a mentor</li>
                <li>Milestones replace manual phase skipping</li>
                <li>Launch pages can go public after approval</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {pendingApp && (
        <div className="card" style={{ marginBottom: 24, borderLeft: "4px solid #d97706", background: "#fffbeb" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#92400e" }}>Application in motion</div>
          <div style={{ fontSize: 13, color: "#a16207", marginTop: 6, lineHeight: 1.6 }}>
            Your project <strong>{pendingApp.projectTitle}</strong> is currently{" "}
            {pendingApp.status.toLowerCase().replace(/_/g, " ")} for {pendingApp.cohort.name}.
          </div>
        </div>
      )}

      {(myProjects as any[]).length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <div className="topbar" style={{ marginBottom: 10 }}>
            <div>
              <h2 style={{ fontSize: 20, margin: 0 }}>My Studio</h2>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 0" }}>
                Your next milestone, your mentor status, and your launch path all live here.
              </p>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {(myProjects as any[]).map((project) => {
              const color = phaseColorFor(project.currentPhase);
              return (
                <Link
                  key={project.id}
                  href={`/incubator/project/${project.id}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div className="card" style={{ borderLeft: `5px solid ${color}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 260 }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                          <span
                            className="pill"
                            style={{ background: `${color}15`, color, fontWeight: 700 }}
                          >
                            {phaseLabelFor(project.currentPhase)}
                          </span>
                          <span className="pill">
                            {resolvePassionLabel(project.passionId, project.passionArea)}
                          </span>
                          <span className="pill">{project.cohort.name}</span>
                          {project.launchStatus === "APPROVED" && (
                            <span className="pill" style={{ background: "#dcfce7", color: "#15803d" }}>
                              Public launch live
                            </span>
                          )}
                        </div>
                        <h3 style={{ margin: "0 0 8px" }}>{project.title}</h3>
                        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: "#475569" }}>
                          <span>{project._count.updates} updates</span>
                          <span>{project.activeMentorCount} mentor(s)</span>
                          <span>{project.currentPhaseProgress.completed}/{project.currentPhaseProgress.total} phase milestones</span>
                        </div>
                        <div style={{ marginTop: 12, fontSize: 13, color: "#334155", lineHeight: 1.6 }}>
                          <strong>Next step:</strong>{" "}
                          {project.nextMilestone
                            ? `${project.nextMilestone.title}${project.nextMilestone.dueDate ? ` by ${formatDate(project.nextMilestone.dueDate)}` : ""}`
                            : "Everything in this phase is complete."}
                        </div>
                      </div>

                      <div
                        style={{
                          minWidth: 240,
                          maxWidth: 280,
                          display: "grid",
                          gap: 8,
                          alignSelf: "stretch",
                        }}
                      >
                        <div
                          style={{
                            padding: 12,
                            borderRadius: 14,
                            background: project.mentorBlocked ? "#fef2f2" : "#f0fdf4",
                            border: `1px solid ${project.mentorBlocked ? "#fecaca" : "#bbf7d0"}`,
                          }}
                        >
                          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>
                            Mentor status
                          </div>
                          <div style={{ fontSize: 13, color: project.mentorBlocked ? "#991b1b" : "#166534" }}>
                            {project.mentorBlocked
                              ? "Blocked until a mentor is assigned"
                              : project.activeMentorCount > 0
                                ? "Mentor assigned and studio-ready"
                                : "Mentor support is available"}
                          </div>
                        </div>

                        <div
                          style={{
                            padding: 12,
                            borderRadius: 14,
                            background: project.needsWeeklyCheckIn ? "#fff7ed" : "#eff6ff",
                            border: `1px solid ${project.needsWeeklyCheckIn ? "#fed7aa" : "#bfdbfe"}`,
                          }}
                        >
                          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>
                            Weekly rhythm
                          </div>
                          <div style={{ fontSize: 13, color: project.needsWeeklyCheckIn ? "#9a3412" : "#1d4ed8" }}>
                            {project.needsWeeklyCheckIn
                              ? "A fresh progress update would help keep momentum."
                              : "You are keeping your project story active."}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <div className="topbar" style={{ marginBottom: 10 }}>
          <div>
            <h2 style={{ fontSize: 20, margin: 0 }}>Current Projects</h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 0" }}>
              Browse the work already moving through the incubator.
            </p>
          </div>
        </div>
        {(allProjects as any[]).length > 0 ? (
          <div className="grid two">
            {(allProjects as any[]).map((project) => {
              const color = phaseColorFor(project.currentPhase);
              return (
                <Link
                  key={project.id}
                  href={`/incubator/project/${project.id}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div className="card" style={{ borderTop: `4px solid ${color}`, height: "100%" }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                      <span className="pill" style={{ background: `${color}15`, color, fontWeight: 700 }}>
                        {phaseLabelFor(project.currentPhase)}
                      </span>
                      <span className="pill">
                        {resolvePassionLabel(project.passionId, project.passionArea)}
                      </span>
                    </div>
                    <h3 style={{ margin: "0 0 6px" }}>{project.title}</h3>
                    <div style={{ fontSize: 12, color: "#475569", marginBottom: 10 }}>
                      by {project.student.name} · Level {project.student.level}
                    </div>
                    <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.6 }}>
                      {project.nextMilestone
                        ? `Next milestone: ${project.nextMilestone.title}`
                        : "This project has cleared the current phase milestones."}
                    </div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: "#64748b", marginTop: 12 }}>
                      <span>{project._count.updates} updates</span>
                      <span>{project.activeMentorCount} mentor(s)</span>
                      {project.launchStatus === "APPROVED" && <span>Public launch approved</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>★</div>
            <h3 style={{ marginTop: 0 }}>No incubator projects yet</h3>
            <p style={{ color: "var(--text-secondary)" }}>
              Apply to the next cohort to start building your launch-ready project.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
