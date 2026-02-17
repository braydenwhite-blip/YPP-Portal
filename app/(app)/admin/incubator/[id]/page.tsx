import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCohortById, getAvailableMentors } from "@/lib/incubator-actions";
import Link from "next/link";
import { ReviewAppButton, AssignMentorForm } from "./client";

const PHASE_LABELS: Record<string, string> = {
  IDEATION: "Ideation", PLANNING: "Planning", BUILDING: "Building",
  FEEDBACK: "Feedback", POLISHING: "Polishing", SHOWCASE: "Showcase",
};
const PHASE_COLORS: Record<string, string> = {
  IDEATION: "#8b5cf6", PLANNING: "#3b82f6", BUILDING: "#d97706",
  FEEDBACK: "#ec4899", POLISHING: "#06b6d4", SHOWCASE: "#16a34a",
};
const APP_STATUS_COLORS: Record<string, string> = {
  SUBMITTED: "#d97706", UNDER_REVIEW: "#3b82f6", ACCEPTED: "#16a34a",
  WAITLISTED: "#8b5cf6", REJECTED: "#ef4444", WITHDRAWN: "#6b7280",
};

export default async function CohortDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const roles = (session.user as any).roles ?? [];
  const primaryRole = (session.user as any).primaryRole;
  const canManage =
    roles.includes("ADMIN") ||
    roles.includes("INSTRUCTOR") ||
    roles.includes("CHAPTER_LEAD") ||
    primaryRole === "ADMIN" ||
    primaryRole === "INSTRUCTOR" ||
    primaryRole === "CHAPTER_LEAD";
  if (!canManage) redirect("/incubator");

  const [cohort, mentors] = await Promise.all([
    getCohortById(params.id),
    getAvailableMentors(),
  ]);

  if (!cohort) {
    return (
      <div>
        <div className="topbar"><h1 className="page-title">Cohort Not Found</h1></div>
        <div className="card"><Link href="/admin/incubator" className="button secondary">Back</Link></div>
      </div>
    );
  }

  const pendingApps = cohort.applications.filter((a) => a.status === "SUBMITTED" || a.status === "UNDER_REVIEW");
  const reviewedApps = cohort.applications.filter((a) => a.status !== "SUBMITTED" && a.status !== "UNDER_REVIEW");

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">{cohort.name}</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            {cohort.season} {cohort.year} &middot; {cohort.status.replace(/_/g, " ")}
          </p>
        </div>
        <Link href="/admin/incubator" className="button secondary">Back to All Cohorts</Link>
      </div>

      {/* Stats */}
      <div className="grid three" style={{ marginBottom: 24 }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#3b82f6" }}>{cohort._count.applications}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Applications</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ypp-purple)" }}>{cohort._count.projects}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Active Projects</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#16a34a" }}>{cohort._count.mentorAssignments}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Mentor Assignments</div>
        </div>
      </div>

      {/* Pending Applications */}
      {pendingApps.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Pending Applications ({pendingApps.length})</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {pendingApps.map((app) => (
              <div key={app.id} className="card" style={{ borderLeft: "4px solid #d97706" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <h3 style={{ margin: 0 }}>{app.projectTitle}</h3>
                      <span className="pill" style={{ fontSize: 11 }}>{app.passionArea}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                      {app.student.name} &middot; Level {app.student.level}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>
                      <strong>Idea:</strong> {app.projectIdea.slice(0, 200)}{app.projectIdea.length > 200 ? "..." : ""}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>
                      <strong>Why:</strong> {app.whyThisProject.slice(0, 150)}{app.whyThisProject.length > 150 ? "..." : ""}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
                      <strong>Goals:</strong> {app.goals.slice(0, 150)}{app.goals.length > 150 ? "..." : ""}
                    </div>
                    {app.needsMentor && (
                      <div style={{ fontSize: 12, color: "#3b82f6" }}>
                        Wants a mentor {app.mentorPreference && `(${app.mentorPreference})`}
                      </div>
                    )}
                  </div>
                  <ReviewAppButton applicationId={app.id} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Projects */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Active Projects ({cohort.projects.length})</h2>
        {cohort.projects.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {cohort.projects.map((project) => {
              const color = PHASE_COLORS[project.currentPhase] || "#7c3aed";
              return (
                <div key={project.id} className="card" style={{ borderLeft: `4px solid ${color}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <Link href={`/incubator/project/${project.id}`} style={{ fontSize: 16, fontWeight: 600 }}>
                          {project.title}
                        </Link>
                        <span className="pill" style={{ background: `${color}15`, color, fontSize: 11 }}>
                          {PHASE_LABELS[project.currentPhase]}
                        </span>
                        <span className="pill" style={{ fontSize: 11 }}>{project.passionArea}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                        {project.student.name} &middot; {project._count.updates} updates
                        {project.mentors.length > 0
                          ? ` · Mentor: ${project.mentors.map((m: any) => m.mentor.name).join(", ")}`
                          : " · No mentor assigned"}
                      </div>
                    </div>
                    {project.mentors.length === 0 && (
                      <AssignMentorForm
                        projectId={project.id}
                        mentors={mentors as any[]}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card">
            <p style={{ color: "var(--text-secondary)" }}>No projects in this cohort yet.</p>
          </div>
        )}
      </div>

      {/* Reviewed Applications */}
      {reviewedApps.length > 0 && (
        <div>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Reviewed Applications ({reviewedApps.length})</h2>
          <div className="grid two">
            {reviewedApps.map((app) => {
              const color = APP_STATUS_COLORS[app.status] || "#6b7280";
              return (
                <div key={app.id} className="card" style={{ borderLeft: `3px solid ${color}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span className="pill" style={{ background: `${color}15`, color, fontSize: 11 }}>{app.status}</span>
                  </div>
                  <h4 style={{ margin: "0 0 2px" }}>{app.projectTitle}</h4>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {app.student.name} &middot; {app.passionArea}
                  </div>
                  {app.reviewNote && (
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                      Note: {app.reviewNote}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
