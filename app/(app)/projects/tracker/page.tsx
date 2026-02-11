import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { CreateProjectForm } from "./client";

const STATUS_COLORS: Record<string, string> = {
  PLANNING: "#6366f1",
  IN_PROGRESS: "#f59e0b",
  ON_HOLD: "#64748b",
  COMPLETED: "#10b981",
  CANCELLED: "#ef4444",
};

export default async function ProjectTrackerPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const projects = await prisma.projectTracker.findMany({
    where: { studentId: session.user.id },
    include: {
      milestones: { orderBy: { order: "asc" } },
      _count: { select: { milestones: true, documentation: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const activeCount = projects.filter((p) => p.status === "IN_PROGRESS").length;
  const completedCount = projects.filter((p) => p.status === "COMPLETED").length;
  const totalMilestones = projects.reduce((sum, p) => sum + p._count.milestones, 0);
  const completedMilestones = projects.reduce(
    (sum, p) => sum + p.milestones.filter((m) => m.isCompleted).length,
    0
  );

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">My Projects</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            Track your long-term passion projects from start to finish
          </p>
        </div>
        <Link href="/incubator" className="button secondary">
          Project Incubator
        </Link>
      </div>

      {/* Stats */}
      <div className="grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#f59e0b" }}>{activeCount}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Active</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#10b981" }}>{completedCount}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Completed</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ypp-purple)" }}>{completedMilestones}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Milestones Hit</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#3b82f6" }}>{totalMilestones}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Total Milestones</div>
        </div>
      </div>

      {/* Create New Project */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, marginBottom: 8 }}>Start a New Project</h3>
        <CreateProjectForm />
      </div>

      {/* Project List */}
      {projects.length > 0 ? (
        <div className="grid two">
          {projects.map((project) => {
            const color = STATUS_COLORS[project.status] || "#6b7280";
            const completedMs = project.milestones.filter((m) => m.isCompleted).length;
            const totalMs = project.milestones.length;
            const progress = totalMs > 0 ? Math.round((completedMs / totalMs) * 100) : 0;

            return (
              <div key={project.id} className="card" style={{ borderTop: `4px solid ${color}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                  <span className="pill" style={{ background: `${color}20`, color, fontWeight: 600, fontSize: 11 }}>
                    {project.status.replace(/_/g, " ")}
                  </span>
                  <span className="pill" style={{ fontSize: 11 }}>{project.visibility}</span>
                </div>

                <h3 style={{ margin: "0 0 4px" }}>{project.title}</h3>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>{project.passionId}</div>

                {project.description && (
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 12px" }}>
                    {project.description.length > 120 ? project.description.slice(0, 120) + "..." : project.description}
                  </p>
                )}

                {project.tags.length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
                    {project.tags.map((tag, i) => (
                      <span key={i} className="pill" style={{ fontSize: 10 }}>{tag}</span>
                    ))}
                  </div>
                )}

                {/* Progress */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span>{completedMs} of {totalMs} milestones</span>
                    <span>{progress}%</span>
                  </div>
                  <div style={{ width: "100%", height: 6, background: "var(--gray-200)", borderRadius: 3 }}>
                    <div style={{ width: `${progress}%`, height: "100%", background: color, borderRadius: 3 }} />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)" }}>
                  <span>Started {new Date(project.startDate).toLocaleDateString()}</span>
                  {project.targetEndDate && (
                    <span>Target: {new Date(project.targetEndDate).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>★</div>
          <h3>No projects yet</h3>
          <p style={{ color: "var(--text-secondary)" }}>
            Create a project above or join the Passion Project Incubator!
          </p>
        </div>
      )}
    </div>
  );
}
