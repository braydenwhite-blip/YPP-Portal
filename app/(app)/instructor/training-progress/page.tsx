import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function TrainingProgressPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const isInstructor = session.user.primaryRole === "INSTRUCTOR" || session.user.primaryRole === "ADMIN";

  if (!isInstructor) {
    redirect("/");
  }

  // Get all training modules
  const modules = await prisma.trainingModule.findMany({
    orderBy: { sortOrder: "asc" }
  });

  // Get user's training assignments
  const assignments = await prisma.trainingAssignment.findMany({
    where: { userId: session.user.id },
    include: { module: true }
  });

  // Get instructor approvals
  const approvals = await prisma.instructorApproval.findMany({
    where: { instructorId: session.user.id },
    include: {
      levels: true
    }
  });

  const assignmentMap = new Map(assignments.map(a => [a.moduleId, a]));

  // Group modules by level requirement
  const levels = ["101", "201", "301"] as const;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Instructor Tools</p>
          <h1 className="page-title">Training Progress</h1>
        </div>
      </div>

      {/* Certification levels */}
      <div className="grid three" style={{ marginBottom: 28 }}>
        {levels.map(level => {
          const approval = approvals.find(a =>
            a.levels.some(l => l.level === `LEVEL_${level}`)
          );

          return (
            <div key={level} className="card">
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>
                  {approval ? "✅" : "🔒"}
                </div>
                <div className="kpi">Level {level}</div>
                <div className="kpi-label">
                  {approval ? "Certified" : "Not Certified"}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Training checklist */}
      <div className="card">
        <h3>Training Checklist</h3>
        <p style={{ marginTop: 8, color: "var(--text-secondary)" }}>
          Complete all modules to get certified for teaching levels
        </p>

        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          {modules.map(module => {
            const assignment = assignmentMap.get(module.id);
            const status = assignment?.status || "NOT_STARTED";

            return (
              <div
                key={module.id}
                style={{
                  padding: 16,
                  border: "1px solid var(--border-color)",
                  borderRadius: 8,
                  backgroundColor: status === "COMPLETE" ? "var(--success-bg)" : "transparent"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ fontSize: 24 }}>
                        {status === "COMPLETE" ? "✅" :
                         status === "IN_PROGRESS" ? "⏳" :
                         "○"}
                      </div>
                      <div>
                        <h4>{module.title}</h4>
                        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                          {module.description}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginLeft: 16 }}>
                    <span className="pill">
                      {module.type.replace("_", " ")}
                    </span>
                    {module.required && (
                      <span className="pill" style={{ marginLeft: 4, backgroundColor: "var(--error-bg)", color: "var(--error-color)" }}>
                        Required
                      </span>
                    )}
                  </div>
                </div>

                {status === "COMPLETE" && assignment?.completedAt && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--success-color)" }}>
                    Completed {new Date(assignment.completedAt).toLocaleDateString()}
                  </div>
                )}

                {status === "NOT_STARTED" && (
                  <div style={{ marginTop: 12 }}>
                    <a href={`/training/${module.id}`} className="button primary small">
                      Start Module
                    </a>
                  </div>
                )}

                {status === "IN_PROGRESS" && (
                  <div style={{ marginTop: 12 }}>
                    <a href={`/training/${module.id}`} className="button secondary small">
                      Continue
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
