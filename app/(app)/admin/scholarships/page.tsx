import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function ScholarshipManagementPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.primaryRole !== "ADMIN") {
    redirect("/");
  }

  // Get all scholarship applications
  const applications = await prisma.scholarshipApplication.findMany({
    include: {
      student: true,
      scholarship: true
    },
    orderBy: { submittedAt: 'desc' }
  });

  // Get all scholarships
  const scholarships = await prisma.scholarship.findMany({
    include: {
      _count: {
        select: { applications: true }
      }
    },
    orderBy: { deadline: 'asc' }
  });

  const pendingApplications = applications.filter(a => a.status === 'PENDING');
  const approvedApplications = applications.filter(a => a.status === 'APPROVED');
  const rejectedApplications = applications.filter(a => a.status === 'REJECTED');

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Scholarship Portal Management</h1>
        </div>
        <Link href="/admin/scholarships/create" className="button primary">
          Create Scholarship
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Manage Scholarship Applications</h3>
        <p>Create scholarship opportunities, review applications, and award students.</p>
      </div>

      <div className="grid four" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi">{applications.length}</div>
          <div className="kpi-label">Total Applications</div>
        </div>
        <div className="card">
          <div className="kpi" style={{ color: "var(--warning-color)" }}>{pendingApplications.length}</div>
          <div className="kpi-label">Pending Review</div>
        </div>
        <div className="card">
          <div className="kpi" style={{ color: "var(--success-color)" }}>{approvedApplications.length}</div>
          <div className="kpi-label">Approved</div>
        </div>
        <div className="card">
          <div className="kpi">{scholarships.length}</div>
          <div className="kpi-label">Active Scholarships</div>
        </div>
      </div>

      {/* Scholarships */}
      <div style={{ marginBottom: 28 }}>
        <div className="section-title">Scholarship Opportunities</div>
        <div className="grid two">
          {scholarships.map(scholarship => {
            const isOpen = new Date(scholarship.deadline) >= new Date();
            
            return (
              <div key={scholarship.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <h3>{scholarship.name}</h3>
                      {isOpen ? (
                        <span className="pill success">Open</span>
                      ) : (
                        <span className="pill">Closed</span>
                      )}
                    </div>
                    <div style={{ fontSize: 14, marginBottom: 8 }}>
                      💰 ${scholarship.amount.toLocaleString()}
                    </div>
                    {scholarship.description && (
                      <p style={{ fontSize: 14, marginBottom: 8, color: "var(--text-secondary)" }}>
                        {scholarship.description.length > 150 
                          ? scholarship.description.substring(0, 150) + "..." 
                          : scholarship.description}
                      </p>
                    )}
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
                      📅 Deadline: {new Date(scholarship.deadline).toLocaleDateString()}
                    </div>
                    <div style={{ fontSize: 13, marginTop: 8 }}>
                      {scholarship._count.applications} applications
                    </div>
                  </div>
                  <Link 
                    href={`/admin/scholarships/${scholarship.id}/applications`}
                    className="button secondary small"
                    style={{ marginLeft: 16 }}
                  >
                    View Applications
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending applications */}
      {pendingApplications.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-title">Pending Applications - Action Required</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {pendingApplications.map(application => (
              <div key={application.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <h4>{application.student.name}</h4>
                      <span className="pill warning">Pending</span>
                    </div>
                    <div style={{ fontSize: 14, marginBottom: 8 }}>
                      Applied for: <strong>{application.scholarship.name}</strong>
                    </div>
                    {application.essay && (
                      <div style={{
                        fontSize: 13,
                        padding: 12,
                        backgroundColor: "var(--accent-bg)",
                        borderRadius: 6,
                        marginBottom: 8
                      }}>
                        <strong>Essay:</strong> {application.essay.length > 200 
                          ? application.essay.substring(0, 200) + "..." 
                          : application.essay}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      Submitted {new Date(application.submittedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginLeft: 16 }}>
                    <form action="/api/admin/scholarships/review" method="POST">
                      <input type="hidden" name="applicationId" value={application.id} />
                      <input type="hidden" name="decision" value="APPROVED" />
                      <button type="submit" className="button primary small">
                        Approve
                      </button>
                    </form>
                    <form action="/api/admin/scholarships/review" method="POST">
                      <input type="hidden" name="applicationId" value={application.id} />
                      <input type="hidden" name="decision" value="REJECTED" />
                      <button type="submit" className="button secondary small">
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent decisions */}
      {(approvedApplications.length > 0 || rejectedApplications.length > 0) && (
        <div>
          <div className="section-title">Recent Decisions</div>
          <div className="grid two">
            {[...approvedApplications, ...rejectedApplications].slice(0, 10).map(application => (
              <div key={application.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h4>{application.student.name}</h4>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                      {application.scholarship.name}
                    </div>
                  </div>
                  <span className={`pill ${application.status === 'APPROVED' ? 'success' : 'secondary'}`}>
                    {application.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {applications.length === 0 && (
        <div className="card">
          <p style={{ color: "var(--text-secondary)", textAlign: "center" }}>
            No scholarship applications yet. Create a scholarship to get started!
          </p>
        </div>
      )}
    </div>
  );
}
