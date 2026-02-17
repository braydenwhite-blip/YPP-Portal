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

const PHASE_LABELS: Record<string, string> = {
  IDEATION: "Ideation",
  PLANNING: "Planning",
  BUILDING: "Building",
  FEEDBACK: "Feedback",
  POLISHING: "Polishing",
  SHOWCASE: "Showcase",
};

const PHASE_COLORS: Record<string, string> = {
  IDEATION: "#8b5cf6",
  PLANNING: "#3b82f6",
  BUILDING: "#d97706",
  FEEDBACK: "#ec4899",
  POLISHING: "#06b6d4",
  SHOWCASE: "#16a34a",
};

const PHASES = ["IDEATION", "PLANNING", "BUILDING", "FEEDBACK", "POLISHING", "SHOWCASE"];

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
  const isAdmin = roleSet.has("ADMIN");
  const isInstructor = roleSet.has("INSTRUCTOR");
  const isChapterLead = roleSet.has("CHAPTER_LEAD");

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
  const resolvePassionLabel = (value: string | null | undefined) =>
    value ? (passionNameById.get(value) ?? value) : null;

  const pendingApp = (myApps as any[]).find(
    (a) => a.status === "SUBMITTED" || a.status === "UNDER_REVIEW"
  );

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Passion Project Incubator</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            Turn your passion into a real project &mdash; from idea to showcase
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {activeCohort && (activeCohort as any).status === "ACCEPTING_APPLICATIONS" && !pendingApp && (
            <Link href="/incubator/apply" className="button primary">
              Apply Now
            </Link>
          )}
          {(isAdmin || isInstructor || isChapterLead) && (
            <Link href="/admin/incubator" className="button secondary">
              Manage
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ypp-purple)" }}>{stats.totalProjects}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Total Projects</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#3b82f6" }}>{stats.activeProjects}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>In Progress</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#d97706" }}>{stats.totalUpdates}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Updates Posted</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#16a34a" }}>{stats.showcaseReady}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Showcase Ready</div>
        </div>
      </div>

      {/* Active Cohort Banner */}
      {activeCohort && (
        <div className="card" style={{ marginBottom: 24, border: "2px solid var(--ypp-purple)", background: "linear-gradient(135deg, #fff 80%, #f3e8ff)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
            <div>
              <span className="pill" style={{ background: "#7c3aed15", color: "#7c3aed", fontWeight: 600, marginBottom: 8 }}>
                {(activeCohort as any).status === "ACCEPTING_APPLICATIONS" ? "Now Accepting Applications" : "In Progress"}
              </span>
              <h2 style={{ margin: "8px 0 4px" }}>{(activeCohort as any).name}</h2>
              {(activeCohort as any).description && (
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 8px" }}>
                  {(activeCohort as any).description}
                </p>
              )}
              <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-secondary)" }}>
                <span>Starts: {new Date((activeCohort as any).startDate).toLocaleDateString()}</span>
                <span>Ends: {new Date((activeCohort as any).endDate).toLocaleDateString()}</span>
                {(activeCohort as any).showcaseDate && (
                  <span>Showcase: {new Date((activeCohort as any).showcaseDate).toLocaleDateString()}</span>
                )}
                <span>{(activeCohort as any)._count.projects} projects</span>
              </div>
            </div>
            {(activeCohort as any).status === "ACCEPTING_APPLICATIONS" && !pendingApp && (
              <Link href="/incubator/apply" className="button primary">Apply</Link>
            )}
          </div>
        </div>
      )}

      {/* Pending Application */}
      {pendingApp && (
        <div className="card" style={{ marginBottom: 24, borderLeft: "4px solid #d97706", background: "#fffbeb" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#92400e" }}>Application Pending</div>
          <div style={{ fontSize: 13, color: "#a16207", marginTop: 4 }}>
            Your application for &ldquo;{pendingApp.projectTitle}&rdquo; to {pendingApp.cohort.name} is {pendingApp.status.toLowerCase().replace(/_/g, " ")}.
          </div>
        </div>
      )}

      {/* My Projects */}
      {(myProjects as any[]).length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>My Incubator Projects</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {(myProjects as any[]).map((project) => {
              const phaseIdx = PHASES.indexOf(project.currentPhase);
              const phasePct = ((phaseIdx + 1) / PHASES.length) * 100;
              const color = PHASE_COLORS[project.currentPhase] || "#7c3aed";

              return (
                <Link
                  key={project.id}
                  href={`/incubator/project/${project.id}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div className="card" style={{ borderLeft: `4px solid ${color}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span className="pill" style={{ background: `${color}15`, color, fontSize: 11, fontWeight: 600 }}>
                            {PHASE_LABELS[project.currentPhase]}
                          </span>
                          <span className="pill" style={{ fontSize: 11 }}>
                            {resolvePassionLabel(project.passionArea)}
                          </span>
                          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                            {project.cohort.name}
                          </span>
                        </div>
                        <h3 style={{ margin: "0 0 4px" }}>{project.title}</h3>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                          {project._count.updates} updates &middot; {project.mentors.length} mentor(s)
                          {project._count.pitchFeedback > 0 && ` · ${project._count.pitchFeedback} feedback`}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color }}>{Math.round(phasePct)}%</div>
                      </div>
                    </div>
                    {/* Phase progress bar */}
                    <div style={{ display: "flex", gap: 4, marginTop: 12 }}>
                      {PHASES.map((phase, i) => (
                        <div
                          key={phase}
                          style={{
                            flex: 1,
                            height: 6,
                            borderRadius: 3,
                            background: i <= phaseIdx ? PHASE_COLORS[phase] : "var(--gray-200)",
                          }}
                          title={PHASE_LABELS[phase]}
                        />
                      ))}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Browse All Projects */}
      <div>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>All Incubator Projects</h2>
        {(allProjects as any[]).length > 0 ? (
          <div className="grid two">
            {(allProjects as any[]).map((project) => {
              const color = PHASE_COLORS[project.currentPhase] || "#7c3aed";
              return (
                <Link
                  key={project.id}
                  href={`/incubator/project/${project.id}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div className="card">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span className="pill" style={{ background: `${color}15`, color, fontSize: 11, fontWeight: 600 }}>
                        {PHASE_LABELS[project.currentPhase]}
                      </span>
                      <span className="pill" style={{ fontSize: 11 }}>
                        {resolvePassionLabel(project.passionArea)}
                      </span>
                    </div>
                    <h4 style={{ margin: "0 0 4px" }}>{project.title}</h4>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      by {project.student.name} &middot; Level {project.student.level}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                      {project._count.updates} updates
                      {project.mentors.length > 0 && ` · Mentor: ${project.mentors.map((m: any) => m.mentor.name).join(", ")}`}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>★</div>
            <h3>No incubator projects yet</h3>
            <p style={{ color: "var(--text-secondary)" }}>
              Apply to an incubator cohort to start your passion project journey!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
