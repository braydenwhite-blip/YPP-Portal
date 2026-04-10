import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getInstructorReadiness } from "@/lib/instructor-readiness";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function InstructorCertificationsPage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const isInstructor =
    session.user.roles.includes("INSTRUCTOR") ||
    session.user.roles.includes("ADMIN");

  if (!isInstructor) {
    redirect("/");
  }

  // Get instructor approvals with level details
  const approvals = await prisma.instructorApproval.findMany({
    where: { instructorId: session.user.id },
    include: {
      levels: true
    },
    orderBy: { updatedAt: "desc" }
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
  const readiness = await getInstructorReadiness(session.user.id);
  const readinessBadges = [
    {
      key: "training",
      name: "Training Academy",
      complete: readiness.trainingComplete,
      detail: `${readiness.completedRequiredModules}/${readiness.requiredModulesCount} required modules complete`,
      color: "#10b981",
      icon: "🎓",
    },
    {
      key: "interview",
      name: "Interview Readiness",
      complete: readiness.interviewPassed,
      detail: readiness.interviewStatus.replace(/_/g, " "),
      color: "#3b82f6",
      icon: "🗓️",
    },
    {
      key: "approval",
      name: "Offering Approval Requests",
      complete: readiness.canRequestOfferingApproval,
      detail: readiness.canRequestOfferingApproval
        ? "You can request offering approval from class settings."
        : readiness.nextAction.detail,
      color: "#8b3fe8",
      icon: "✅",
    },
  ];

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Instructor Tools</p>
          <h1 className="page-title">My Readiness & History</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Readiness Snapshot</h3>
        <p>
          Track your current instructor readiness and keep legacy approval history in one place.
        </p>
        <div style={{ marginTop: 14 }}>
          <Link href="/instructor-growth" className="button secondary">
            Open Instructor Growth
          </Link>
        </div>
      </div>

      {/* Readiness badges */}
      <div style={{ marginBottom: 28 }}>
        <div className="section-title">Current Readiness</div>
        <div className="grid three">
          {readinessBadges.map((badge) => {
            return (
              <div
                key={badge.key}
                className="card"
                style={{
                  textAlign: "center",
                  opacity: badge.complete ? 1 : 0.7,
                  border: badge.complete ? `2px solid ${badge.color}` : "1px solid var(--border-color)"
                }}
              >
                <div style={{ fontSize: 64, marginBottom: 12 }}>
                  {badge.complete ? badge.icon : "⏳"}
                </div>
                <h3>{badge.name}</h3>
                <div style={{
                  marginTop: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  color: badge.complete ? badge.color : "var(--text-secondary)"
                }}>
                  {badge.complete ? "✓ Ready" : "In Progress"}
                </div>
                <div style={{ marginTop: 8, fontSize: 13, color: "var(--text-secondary)" }}>
                  {badge.detail}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Approval history */}
      {approvals.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-title">Legacy Approval History</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {approvals.map(approval => (
              <div key={approval.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <h3>
                      {approval.levels.map(l => l.level.replace("LEVEL_", "Legacy level ")).join(", ")}
                    </h3>
                    <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                      Updated {new Date(approval.updatedAt).toLocaleDateString()}
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
                  <span className="pill success">{approval.status.replaceAll("_", " ")}</span>
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
              No training modules completed yet. Visit the instructor training page to get started.
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
