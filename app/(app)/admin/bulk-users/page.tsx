import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function BulkUserManagementPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.primaryRole !== "ADMIN") {
    redirect("/");
  }

  // Get recent bulk operations (if we have a log table)
  const totalUsers = await prisma.user.count();
  const recentUsers = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 20
  });

  const usersByRole = await prisma.user.groupBy({
    by: ['primaryRole'],
    _count: true
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Bulk User Management</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Manage Users in Bulk</h3>
        <p style={{ color: "var(--text-secondary)" }}>
          Import, export, and manage multiple users at once. Perfect for onboarding
          new cohorts or making system-wide updates.
        </p>
      </div>

      <div className="grid three" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi">{totalUsers}</div>
          <div className="kpi-label">Total Users</div>
        </div>
        {usersByRole.map(role => (
          <div key={role.primaryRole} className="card">
            <div className="kpi">{role._count}</div>
            <div className="kpi-label">{role.primaryRole}s</div>
          </div>
        ))}
      </div>

      {/* Bulk operations */}
      <div className="grid two" style={{ marginBottom: 28 }}>
        <div className="card">
          <h3>📥 Import Users</h3>
          <p style={{ fontSize: 14, marginTop: 8, marginBottom: 16, color: "var(--text-secondary)" }}>
            Upload a CSV file to create multiple user accounts at once.
          </p>
          <form action="/api/admin/bulk-users/import" method="POST" encType="multipart/form-data">
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="csvFile" style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
                CSV File
              </label>
              <input
                type="file"
                id="csvFile"
                name="csvFile"
                accept=".csv"
                required
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                  fontSize: 14
                }}
              />
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                CSV format: name, email, role (STUDENT/INSTRUCTOR/PARENT/ADMIN)
              </div>
            </div>
            <button type="submit" className="button primary">
              Import Users
            </button>
          </form>
        </div>

        <div className="card">
          <h3>📤 Export Users</h3>
          <p style={{ fontSize: 14, marginTop: 8, marginBottom: 16, color: "var(--text-secondary)" }}>
            Download a CSV file of all users in the system.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <form action="/api/admin/bulk-users/export" method="POST">
              <input type="hidden" name="format" value="all" />
              <button type="submit" className="button primary" style={{ width: "100%" }}>
                Export All Users
              </button>
            </form>
            <form action="/api/admin/bulk-users/export" method="POST">
              <input type="hidden" name="format" value="students" />
              <button type="submit" className="button secondary" style={{ width: "100%" }}>
                Export Students Only
              </button>
            </form>
            <form action="/api/admin/bulk-users/export" method="POST">
              <input type="hidden" name="format" value="instructors" />
              <button type="submit" className="button secondary" style={{ width: "100%" }}>
                Export Instructors Only
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Bulk actions */}
      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Bulk Role Update</h3>
        <p style={{ fontSize: 14, marginTop: 8, marginBottom: 16, color: "var(--text-secondary)" }}>
          Update roles for multiple users by providing email addresses.
        </p>
        <form action="/api/admin/bulk-users/update-roles" method="POST">
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="emails" style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
              Email Addresses (one per line)
            </label>
            <textarea
              id="emails"
              name="emails"
              required
              rows={6}
              placeholder="user1@example.com&#10;user2@example.com&#10;user3@example.com"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid var(--border-color)",
                borderRadius: 6,
                fontSize: 14,
                fontFamily: "monospace",
                resize: "vertical"
              }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="newRole" style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
              New Role
            </label>
            <select
              id="newRole"
              name="newRole"
              required
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid var(--border-color)",
                borderRadius: 6,
                fontSize: 14
              }}
            >
              <option value="STUDENT">Student</option>
              <option value="INSTRUCTOR">Instructor</option>
              <option value="MENTOR">Mentor</option>
              <option value="PARENT">Parent</option>
              <option value="CHAPTER_LEAD">Chapter Lead</option>
              <option value="STAFF">Staff</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <button type="submit" className="button primary">
            Update Roles
          </button>
        </form>
      </div>

      {/* Recent users */}
      <div>
        <div className="section-title">Recently Created Users</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {recentUsers.map(user => (
            <div key={user.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h4>{user.name}</h4>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
                    {user.email} • {user.primaryRole}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {new Date(user.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
