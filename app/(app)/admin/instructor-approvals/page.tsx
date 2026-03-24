import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getLegacyLearnerFitCopy } from "@/lib/learner-fit";

export default async function InstructorApprovalsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.primaryRole !== "ADMIN") {
    redirect("/");
  }

  // Get pending instructor approvals
  const pendingApprovals = await prisma.user.findMany({
    where: {
      primaryRole: "INSTRUCTOR",
      NOT: {
        approvals: {
          some: {}
        }
      }
    }
  });

  // Get all instructor approvals
  const approvals = await prisma.instructorApproval.findMany({
    include: {
      instructor: true,
      levels: true
    },
    orderBy: { updatedAt: "desc" }
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Legacy Instructor Approval History</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Legacy Teaching-Permission Records</h3>
        <p>
          New v1 publishing uses readiness plus per-offering approval. Use the modern review queue to approve draft offerings before they go live.
        </p>
        <a href="/admin/instructor-readiness" className="button secondary" style={{ marginTop: 10, display: "inline-block", textDecoration: "none" }}>
          Open Offering Approval Queue
        </a>
      </div>

      <div className="grid three" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi">{pendingApprovals.length}</div>
          <div className="kpi-label">Pending Approvals</div>
        </div>
        <div className="card">
          <div className="kpi">{approvals.length}</div>
          <div className="kpi-label">Total Approvals</div>
        </div>
        <div className="card">
          <div className="kpi">{approvals.filter(a => new Date(a.updatedAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length}</div>
          <div className="kpi-label">Last 30 Days</div>
        </div>
      </div>

      {pendingApprovals.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-title">Legacy Pending Records</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {pendingApprovals.map(instructor => (
              <div key={instructor.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <h3>{instructor.name}</h3>
                    <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                      {instructor.email}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8 }}>
                      This instructor has no legacy level approval row yet. New publishing decisions now happen in the offering approval queue instead of here.
                    </div>
                  </div>
                  <a href="/admin/instructor-readiness" className="button primary small" style={{ textDecoration: "none" }}>
                    Review in new queue
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="section-title">Legacy Level Approvals</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {approvals.map(approval => (
            <div key={approval.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <h4>{approval.instructor.name}</h4>
                  <div style={{ fontSize: 14, marginTop: 8 }}>
                    Legacy learner-fit history: {approval.levels.map((level) => getLegacyLearnerFitCopy(level.level).label).join(", ")}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                    Updated {new Date(approval.updatedAt).toLocaleDateString()}
                  </div>
                  {approval.notes && (
                    <div style={{ fontSize: 13, marginTop: 8, padding: 8, backgroundColor: "var(--accent-bg)", borderRadius: 4 }}>
                      {approval.notes}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
