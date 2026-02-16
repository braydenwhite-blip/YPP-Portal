import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function BulkUserManagementPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const params = await searchParams;
  const imported = Number(params.imported ?? 0);
  const failed = Number(params.failed ?? 0);
  const duplicates = Number(params.duplicates ?? 0);
  const invalid = Number(params.invalid ?? 0);
  const updated = Number(params.updated ?? 0);
  const dryRun = String(params.dryRun ?? "false") === "true";
  const error = typeof params.error === "string" ? params.error : "";

  const [totalUsers, recentUsers, usersByRole, chapters] = await Promise.all([
    prisma.user.count(),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        chapter: { select: { name: true } },
      },
    }),
    prisma.user.groupBy({
      by: ["primaryRole"],
      _count: true,
    }),
    prisma.chapter.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, city: true },
    }),
  ]);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Bulk User Management</h1>
          <p className="page-subtitle">Provision chapter presidents, instructors, and student cohorts with validation.</p>
        </div>
      </div>

      {(imported > 0 || failed > 0 || updated > 0 || error) && (
        <div
          className="card"
          style={{
            marginBottom: 20,
            borderLeft: `4px solid ${error ? "#dc2626" : "#16a34a"}`,
          }}
        >
          <h3 style={{ marginTop: 0 }}>{dryRun ? "Validation Preview" : "Bulk Operation Summary"}</h3>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", display: "flex", gap: 14, flexWrap: "wrap" }}>
            <span>Imported: <strong>{imported}</strong></span>
            <span>Failed: <strong>{failed}</strong></span>
            <span>Duplicates: <strong>{duplicates}</strong></span>
            <span>Invalid rows: <strong>{invalid}</strong></span>
            <span>Updated: <strong>{updated}</strong></span>
          </div>
          {error ? (
            <p style={{ marginTop: 10, color: "#b91c1c", fontSize: 14 }}>{decodeURIComponent(error)}</p>
          ) : null}
        </div>
      )}

      <div className="grid three" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="kpi">{totalUsers}</div>
          <div className="kpi-label">Total Users</div>
        </div>
        {usersByRole.map((role) => (
          <div key={role.primaryRole} className="card">
            <div className="kpi">{role._count}</div>
            <div className="kpi-label">{role.primaryRole}s</div>
          </div>
        ))}
      </div>

      <div className="grid two" style={{ marginBottom: 20 }}>
        <div className="card">
          <h3>Import With Validation</h3>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 8 }}>
            Upload CSV and optionally run preview-only validation before writing accounts.
          </p>

          <form action="/api/admin/bulk-users/import" method="POST" encType="multipart/form-data" style={{ marginTop: 14 }}>
            <div style={{ marginBottom: 12 }}>
              <label htmlFor="csvFile" style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
                CSV File
              </label>
              <input
                type="file"
                id="csvFile"
                name="csvFile"
                accept=".csv"
                required
                className="input"
                style={{ marginTop: 0 }}
              />
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>
                Columns: <code>name,email,role,chapter</code> (role/chapter optional if defaults are selected below).
              </p>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label htmlFor="rolePreset" style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
                Role Preset (fallback)
              </label>
              <select id="rolePreset" name="rolePreset" className="input" defaultValue="">
                <option value="">Use CSV role per row</option>
                <option value="INSTRUCTOR">Instructor Pilot</option>
                <option value="CHAPTER_LEAD">Chapter President</option>
                <option value="STUDENT">Student Cohort</option>
                <option value="PARENT">Parent Accounts</option>
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label htmlFor="defaultChapterId" style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
                Default Chapter (optional)
              </label>
              <select id="defaultChapterId" name="defaultChapterId" className="input" defaultValue="">
                <option value="">No default chapter</option>
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.name}{chapter.city ? ` (${chapter.city})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, fontSize: 14 }}>
              <input type="checkbox" name="dryRun" value="true" />
              Preview validation only (no accounts created)
            </label>

            <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, fontSize: 14 }}>
              <input type="checkbox" name="sendInvite" value="true" />
              Mark as send-invite batch (logged only)
            </label>

            <button type="submit" className="button primary">Run Import</button>
          </form>
        </div>

        <div className="card">
          <h3>Export Users</h3>
          <p style={{ fontSize: 14, marginTop: 8, marginBottom: 16, color: "var(--text-secondary)" }}>
            Download CSV files for full audits and chapter-level operations.
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
                Export Students
              </button>
            </form>
            <form action="/api/admin/bulk-users/export" method="POST">
              <input type="hidden" name="format" value="instructors" />
              <button type="submit" className="button secondary" style={{ width: "100%" }}>
                Export Instructors
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Bulk Role + Chapter Update</h3>
        <p style={{ fontSize: 14, marginTop: 8, marginBottom: 16, color: "var(--text-secondary)" }}>
          Update role and optional chapter assignment for multiple users.
        </p>
        <form action="/api/admin/bulk-users/update-roles" method="POST">
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="emails" style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
              Email Addresses (one per line)
            </label>
            <textarea
              id="emails"
              name="emails"
              required
              rows={6}
              className="input"
              placeholder="user1@example.com&#10;user2@example.com"
              style={{ fontFamily: "monospace" }}
            />
          </div>

          <div className="grid three" style={{ marginBottom: 12 }}>
            <label className="form-row">
              New Role
              <select id="newRole" name="newRole" required className="input">
                <option value="STUDENT">Student</option>
                <option value="INSTRUCTOR">Instructor</option>
                <option value="MENTOR">Mentor</option>
                <option value="PARENT">Parent</option>
                <option value="CHAPTER_LEAD">Chapter Lead</option>
                <option value="STAFF">Staff</option>
                <option value="ADMIN">Admin</option>
              </select>
            </label>

            <label className="form-row">
              Chapter Assignment (optional)
              <select name="chapterId" className="input" defaultValue="">
                <option value="">Keep current chapter</option>
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.name}{chapter.city ? ` (${chapter.city})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-row">
              Mode
              <select name="mode" className="input" defaultValue="apply">
                <option value="apply">Apply changes</option>
                <option value="validate">Validate only</option>
              </select>
            </label>
          </div>

          <button type="submit" className="button primary">Run Role Update</button>
        </form>
      </div>

      <div>
        <div className="section-title">Recently Created Users</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {recentUsers.map((user) => (
            <div key={user.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h4>{user.name}</h4>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
                    {user.email} • {user.primaryRole}
                    {user.chapter ? ` • ${user.chapter.name}` : ""}
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
