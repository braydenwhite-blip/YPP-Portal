import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

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
          <h1 className="page-title">Instructor Approval Workflow</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Manage Instructor Certifications</h3>
        <p>Approve instructors for teaching at specific levels based on their training and experience.</p>
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
          <div className="section-title">Pending Instructor Approvals</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {pendingApprovals.map(instructor => (
              <div key={instructor.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <h3>{instructor.name}</h3>
                    <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                      {instructor.email}
                    </div>
                  </div>
                  <form action="/api/admin/instructor-approvals/approve" method="POST">
                    <input type="hidden" name="instructorId" value={instructor.id} />
                    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                      <label style={{ fontSize: 13 }}>
                        <input type="checkbox" name="level_101" value="true" /> Level 101
                      </label>
                      <label style={{ fontSize: 13 }}>
                        <input type="checkbox" name="level_201" value="true" /> Level 201
                      </label>
                      <label style={{ fontSize: 13 }}>
                        <input type="checkbox" name="level_301" value="true" /> Level 301
                      </label>
                    </div>
                    <textarea
                      name="notes"
                      placeholder="Approval notes (optional)"
                      rows={2}
                      style={{ width: "100%", marginBottom: 8, padding: "6px", fontSize: 13, fontFamily: "inherit" }}
                    />
                    <button type="submit" className="button primary small">
                      Approve Instructor
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="section-title">Approved Instructors</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {approvals.map(approval => (
            <div key={approval.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <h4>{approval.instructor.name}</h4>
                  <div style={{ fontSize: 14, marginTop: 8 }}>
                    Approved for: {approval.levels.map(l => l.level.replace("LEVEL_", "Level ")).join(", ")}
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
