import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function InstructorCertificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/public/login");
  }

  const isInstructor = session.user.primaryRole === "INSTRUCTOR" || session.user.primaryRole === "ADMIN";

  if (!isInstructor) {
    redirect("/");
  }

  // Get instructor approvals with level details
  const approvals = await prisma.instructorApproval.findMany({
    where: { instructorId: session.user.id },
    include: {
      levels: true,
      approvedBy: true
    },
    orderBy: { approvedAt: "desc" }
  });

  // Get completed training modules
  const completedTraining = await prisma.trainingAssignment.findMany({
    where: {
      userId: session.user.id,
      status: "COMPLETE"
    },
    include: { module: true },
    orderBy: { completedAt: "desc" }
  });

  // Extract unique certification levels
  const certifiedLevels = new Set<string>();
  approvals.forEach(approval => {
    approval.levels.forEach(level => {
      certifiedLevels.add(level.level);
    });
  });

  const levelBadges = [
    { level: "LEVEL_101", name: "Level 101", color: "#10b981", icon: "🌱" },
    { level: "LEVEL_201", name: "Level 201", color: "#3b82f6", icon: "🌿" },
    { level: "LEVEL_301", name: "Level 301", color: "#8b5cf6", icon: "🌳" }
  ];

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Instructor Tools</p>
          <h1 className="page-title">My Certifications</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Instructor Certification Badges</h3>
        <p>
          Display your certifications and training achievements. These badges show your approved
          teaching levels and completed professional development.
        </p>
      </div>

      {/* Certification badges */}
      <div style={{ marginBottom: 28 }}>
        <div className="section-title">Teaching Level Certifications</div>
        <div className="grid three">
          {levelBadges.map(badge => {
            const isCertified = certifiedLevels.has(badge.level);

            return (
              <div
                key={badge.level}
                className="card"
                style={{
                  textAlign: "center",
                  opacity: isCertified ? 1 : 0.5,
                  border: isCertified ? `2px solid ${badge.color}` : "1px solid var(--border-color)"
                }}
              >
                <div style={{ fontSize: 64, marginBottom: 12 }}>
                  {isCertified ? badge.icon : "🔒"}
                </div>
                <h3>{badge.name}</h3>
                <div style={{
                  marginTop: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  color: isCertified ? badge.color : "var(--text-secondary)"
                }}>
                  {isCertified ? "✓ Certified" : "Not Certified"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Approval history */}
      {approvals.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-title">Approval History</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {approvals.map(approval => (
              <div key={approval.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <h3>
                      {approval.levels.map(l => l.level.replace("LEVEL_", "Level ")).join(", ")}
                    </h3>
                    <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                      Approved by {approval.approvedBy.name} on{" "}
                      {new Date(approval.approvedAt).toLocaleDateString()}
                    </div>
                    {approval.notes && (
                      <div style={{
                        marginTop: 12,
                        padding: 12,
                        backgroundColor: "var(--accent-bg)",
                        borderRadius: 6,
                        fontSize: 14
                      }}>
                        {approval.notes}
                      </div>
                    )}
                  </div>
                  <span className="pill success">Active</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed training */}
      <div>
        <div className="section-title">Completed Training Modules</div>
        {completedTraining.length === 0 ? (
          <div className="card">
            <p style={{ color: "var(--text-secondary)" }}>
              No training modules completed yet. Visit the Training Progress page to get started.
            </p>
          </div>
        ) : (
          <div className="grid two">
            {completedTraining.map(assignment => (
              <div key={assignment.id} className="card">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontSize: 32 }}>✅</div>
                  <div>
                    <h4>{assignment.module.title}</h4>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                      Completed {new Date(assignment.completedAt!).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
