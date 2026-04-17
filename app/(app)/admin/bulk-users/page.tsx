import Link from "next/link";
import { redirect } from "next/navigation";
import { RoleType } from "@prisma/client";
import { getSession } from "@/lib/auth-supabase";
import { formatAccessLabel } from "@/lib/admin-user-access";
import {
  ADMIN_SUBTYPE_LABELS,
  ADMIN_SUBTYPE_VALUES,
} from "@/lib/admin-subtypes";
import { prisma } from "@/lib/prisma";

function readSearchParam(
  params: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = params[key];
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] ?? "" : "";
}

export default async function BulkUserManagementPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
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
  const error = readSearchParam(params, "error");
  const manageUser = readSearchParam(params, "manageUser").trim().toLowerCase();
  const accessUpdated = readSearchParam(params, "accessUpdated") === "1";
  const accessUser = readSearchParam(params, "accessUser");
  const accessError = readSearchParam(params, "accessError");

  const [totalUsers, recentUsers, usersByRole, chapters, managedUser] = await Promise.all([
    prisma.user.count(),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        chapter: { select: { name: true } },
        roles: { select: { role: true } },
        adminSubtypes: {
          select: {
            subtype: true,
            isDefaultOwner: true,
          },
        },
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
    manageUser
      ? prisma.user.findUnique({
          where: { email: manageUser },
          include: {
            chapter: { select: { id: true, name: true } },
            roles: { select: { role: true } },
            adminSubtypes: {
              select: {
                subtype: true,
                isDefaultOwner: true,
              },
            },
          },
        })
      : Promise.resolve(null),
  ]);

  const managedUserRoleSet = new Set(managedUser?.roles.map((role) => role.role) ?? []);
  const managedUserSubtypeSet = new Set(
    managedUser?.adminSubtypes.map((entry) => entry.subtype) ?? []
  );
  const managedUserDefaultOwnerSubtype =
    managedUser?.adminSubtypes.find((entry) => entry.isDefaultOwner)?.subtype ?? "";

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

      {(accessUpdated || accessError) && (
        <div
          className="card"
          style={{
            marginBottom: 20,
            borderLeft: `4px solid ${accessError ? "#dc2626" : "#16a34a"}`,
          }}
        >
          <h3 style={{ marginTop: 0 }}>
            {accessError ? "Access Update Failed" : "Access Updated"}
          </h3>
          <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)" }}>
            {accessError
              ? decodeURIComponent(accessError)
              : `${decodeURIComponent(accessUser)} now has the saved role and admin access settings.`}
          </p>
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
                <option value="CHAPTER_PRESIDENT">Chapter President</option>
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
          Update the primary role, synced role list, and optional chapter assignment for multiple users at once.
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
              Primary Role
              <select id="primaryRole" name="primaryRole" required className="input" defaultValue="STUDENT">
                {Object.values(RoleType).map((role) => (
                  <option key={role} value={role}>
                    {formatAccessLabel(role)}
                  </option>
                ))}
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

          <div className="form-row" style={{ marginBottom: 12 }}>
            Roles To Keep On Each User
            <p style={{ margin: "6px 0 10px", fontSize: 12, color: "var(--muted)" }}>
              The primary role is always kept. Leave the extra boxes empty if you want primary-role-only access.
            </p>
            <div className="checkbox-grid">
              {Object.values(RoleType).map((role) => (
                <label
                  key={role}
                  style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}
                >
                  <input type="checkbox" name="roles" value={role} />
                  {formatAccessLabel(role)}
                </label>
              ))}
            </div>
          </div>

          <p style={{ margin: "0 0 16px", fontSize: 12, color: "var(--muted)" }}>
            Admin subtypes are managed in the single-user access editor below.
          </p>

          <button type="submit" className="button primary">Run Role Update</button>
        </form>
      </div>

      <div id="manage-access" className="card" style={{ marginBottom: 20 }}>
        <h3>Manage One User Access</h3>
        <p style={{ fontSize: 14, marginTop: 8, marginBottom: 16, color: "var(--text-secondary)" }}>
          Use this editor when you need to assign multiple roles, add admin subtypes, or mark a default admin owner without leaving the portal.
        </p>

        <form action="/api/admin/bulk-users/update-access" method="POST">
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="manageEmail" style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
              User Email
            </label>
            <input
              id="manageEmail"
              name="email"
              className="input"
              list="bulk-user-email-suggestions"
              defaultValue={managedUser?.email ?? manageUser}
              placeholder="name@example.com"
              required
            />
            <datalist id="bulk-user-email-suggestions">
              {recentUsers.map((user) => (
                <option key={user.id} value={user.email}>
                  {user.name}
                </option>
              ))}
            </datalist>
            {managedUser ? (
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)" }}>
                Editing {managedUser.name}. Current chapter: {managedUser.chapter?.name ?? "None"}.
              </p>
            ) : (
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)" }}>
                Pick a recent user from the buttons below or type any portal email address.
              </p>
            )}
          </div>

          <div className="grid three" style={{ marginBottom: 12 }}>
            <label className="form-row">
              Primary Role
              <select
                name="primaryRole"
                className="input"
                defaultValue={managedUser?.primaryRole ?? RoleType.STUDENT}
              >
                {Object.values(RoleType).map((role) => (
                  <option key={role} value={role}>
                    {formatAccessLabel(role)}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-row">
              Chapter Assignment
              <select name="chapterId" className="input" defaultValue="__KEEP__">
                <option value="__KEEP__">Keep current chapter</option>
                <option value="__CLEAR__">Clear chapter</option>
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.name}{chapter.city ? ` (${chapter.city})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-row">
              Default Owner Subtype
              <select
                name="defaultOwnerSubtype"
                className="input"
                defaultValue={managedUserDefaultOwnerSubtype}
              >
                <option value="">None</option>
                {ADMIN_SUBTYPE_VALUES.map((subtype) => (
                  <option key={subtype} value={subtype}>
                    {ADMIN_SUBTYPE_LABELS[subtype]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-row" style={{ marginBottom: 12 }}>
            Roles
            <p style={{ margin: "6px 0 10px", fontSize: 12, color: "var(--muted)" }}>
              The primary role is always kept. If you select any admin subtype, the Admin role is added automatically.
            </p>
            <div className="checkbox-grid">
              {Object.values(RoleType).map((role) => (
                <label
                  key={role}
                  style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}
                >
                  <input
                    type="checkbox"
                    name="roles"
                    value={role}
                    defaultChecked={managedUserRoleSet.has(role)}
                  />
                  {formatAccessLabel(role)}
                </label>
              ))}
            </div>
          </div>

          <div className="form-row" style={{ marginBottom: 16 }}>
            Admin Subtypes
            <div className="checkbox-grid">
              {ADMIN_SUBTYPE_VALUES.map((subtype) => (
                <label
                  key={subtype}
                  style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}
                >
                  <input
                    type="checkbox"
                    name="adminSubtypes"
                    value={subtype}
                    defaultChecked={managedUserSubtypeSet.has(subtype)}
                  />
                  {ADMIN_SUBTYPE_LABELS[subtype]}
                </label>
              ))}
            </div>
          </div>

          <button type="submit" className="button primary">Save Access</button>
        </form>
      </div>

      <div>
        <div className="section-title">Recently Created Users</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {recentUsers.map((user) => (
            <div key={user.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                <div>
                  <h4>{user.name}</h4>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
                    {user.email} • {formatAccessLabel(user.primaryRole)}
                    {user.chapter ? ` • ${user.chapter.name}` : ""}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                    {user.roles.map((role) => (
                      <span key={role.role} className="pill">
                        {formatAccessLabel(role.role)}
                      </span>
                    ))}
                    {user.adminSubtypes.map((entry) => (
                      <span
                        key={entry.subtype}
                        className="pill"
                        style={{
                          background: entry.isDefaultOwner ? "#ede9fe" : "var(--surface-alt)",
                          color: entry.isDefaultOwner ? "#6b21a8" : undefined,
                        }}
                      >
                        {ADMIN_SUBTYPE_LABELS[entry.subtype]}
                        {entry.isDefaultOwner ? " (Default)" : ""}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </div>
                  <Link
                    href={`/admin/bulk-users?manageUser=${encodeURIComponent(user.email)}#manage-access`}
                    className="button secondary small"
                  >
                    Manage Access
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
