import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getServiceProjects } from "@/lib/real-world-actions";
import Link from "next/link";
import { JoinProjectButton, CreateProjectForm } from "./client";

export default async function ServiceProjectsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { projects, myProjectIds } = await getServiceProjects();

  const isAdmin = session.user.roles?.includes("ADMIN");
  const isInstructor = session.user.roles?.includes("INSTRUCTOR");
  const isChapterLead = session.user.roles?.includes("CHAPTER_LEAD");

  const statusColors: Record<string, string> = {
    RECRUITING: "#16a34a",
    IN_PROGRESS: "#3b82f6",
    COMPLETED: "#7c3aed",
    CANCELLED: "#6b7280",
  };

  const myProjects = projects.filter((p) => myProjectIds.includes(p.id));
  const availableProjects = projects.filter((p) => !myProjectIds.includes(p.id) && p.status === "RECRUITING");
  const activeProjects = projects.filter((p) => p.status === "IN_PROGRESS");

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Service Projects</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            Give back to your community while building real-world skills
          </p>
        </div>
        {(isAdmin || isInstructor || isChapterLead) && <CreateProjectForm />}
      </div>

      {/* Stats */}
      <div className="grid four" style={{ marginBottom: 24 }}>
        <div className="card">
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>My Projects</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ypp-purple)" }}>{myProjects.length}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>My Service Hours</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#16a34a" }}>
            {projects
              .flatMap((p) => p.volunteers)
              .filter((v) => v.studentId === session.user.id)
              .reduce((sum, v) => sum + v.hoursLogged, 0)}
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Recruiting</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#3b82f6" }}>{availableProjects.length}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Total Impact Hours</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#d97706" }}>
            {projects.reduce((sum, p) => sum + p.currentHours, 0)}
          </div>
        </div>
      </div>

      {/* My Active Projects */}
      {myProjects.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>My Projects</h2>
          <div className="grid two">
            {myProjects.map((project) => {
              const color = statusColors[project.status] || "#6b7280";
              const myVolunteer = project.volunteers.find((v) => v.studentId === session.user.id);
              const hoursProgress = project.totalHoursGoal
                ? Math.round((project.currentHours / project.totalHoursGoal) * 100)
                : 0;

              return (
                <Link
                  key={project.id}
                  href={`/service-projects/${project.id}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div className="card" style={{ borderLeft: `4px solid ${color}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span className="pill" style={{ background: `${color}15`, color, fontSize: 11, fontWeight: 600 }}>
                        {project.status.replace("_", " ")}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        {project.xpReward} XP
                      </span>
                    </div>
                    <h4 style={{ margin: "4px 0" }}>{project.title}</h4>
                    {project.partnerOrg && (
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{project.partnerOrg}</div>
                    )}
                    <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 12 }}>
                      <span>My hours: <strong>{myVolunteer?.hoursLogged || 0}</strong></span>
                      <span>Team: <strong>{project._count.volunteers}/{project.volunteersNeeded}</strong></span>
                    </div>
                    {project.totalHoursGoal && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>
                          {project.currentHours}/{project.totalHoursGoal} hours
                        </div>
                        <div style={{ width: "100%", height: 6, background: "var(--gray-200)", borderRadius: 3 }}>
                          <div style={{ width: `${Math.min(hoursProgress, 100)}%`, height: "100%", background: color, borderRadius: 3 }} />
                        </div>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Available Projects */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Recruiting Volunteers</h2>
        {availableProjects.length > 0 ? (
          <div className="grid two">
            {availableProjects.map((project) => {
              const spotsLeft = project.volunteersNeeded - project._count.volunteers;

              return (
                <div key={project.id} className="card" style={{ borderLeft: "4px solid #16a34a" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    {project.passionArea && (
                      <span className="pill" style={{ fontSize: 11 }}>{project.passionArea}</span>
                    )}
                    <span style={{ fontSize: 12, color: spotsLeft <= 2 ? "#ef4444" : "var(--text-secondary)" }}>
                      {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left
                    </span>
                  </div>
                  <h4 style={{ margin: "4px 0" }}>{project.title}</h4>
                  {project.partnerOrg && (
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{project.partnerOrg}</div>
                  )}
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 8px" }}>
                    {project.description.length > 150 ? project.description.slice(0, 150) + "..." : project.description}
                  </p>
                  <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
                    {project.location && <span>{project.location}</span>}
                    {project.startDate && (
                      <span>
                        Starts {new Date(project.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                    <span>{project.xpReward} XP</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      by {project.createdBy.name}
                    </span>
                    <JoinProjectButton projectId={project.id} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card">
            <p style={{ color: "var(--text-secondary)" }}>
              No projects recruiting right now. Check back soon!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
