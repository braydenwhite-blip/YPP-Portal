import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getRoleMatrixData } from "@/lib/governance/actions";
import Link from "next/link";

export const metadata = { title: "Role Matrix Audit" };

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  CHAPTER_PRESIDENT: "Chapter President",
  INSTRUCTOR: "Instructor",
  MENTOR: "Mentor",
  STUDENT: "Student",
  STAFF: "Staff",
  PARENT: "Parent",
};

const ROLE_KEYS = ["ADMIN", "CHAPTER_PRESIDENT", "INSTRUCTOR", "MENTOR", "STUDENT", "STAFF", "PARENT"];

export default async function RoleMatrixPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) redirect("/");

  const matrix = await getRoleMatrixData();

  const totals: Record<string, number> = {};
  for (const role of ROLE_KEYS) totals[role] = 0;
  let totalUsers = 0;

  for (const ch of matrix) {
    totalUsers += ch.totalUsers;
    for (const role of ROLE_KEYS) {
      totals[role] += ch.roleCounts[role] ?? 0;
    }
  }

  const warnings = matrix.filter((ch) => !ch.hasLead || !ch.hasInstructor);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Role Matrix Audit</h1>
          <p className="page-subtitle">
            Role distribution by chapter. Chapters missing key roles are flagged.
          </p>
        </div>
        <Link href="/admin/governance" className="button outline small">
          Back to Governance
        </Link>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="card" style={{ marginBottom: "1.5rem", borderLeft: "4px solid #d97706" }}>
          <p style={{ fontWeight: 700, marginBottom: "0.5rem" }}>
            Chapters Missing Key Roles ({warnings.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {warnings.map((ch) => (
              <div
                key={ch.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.5rem 0.75rem",
                  background: "#fffbeb",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.85rem",
                }}
              >
                <span style={{ fontWeight: 600 }}>{ch.name}</span>
                <div style={{ display: "flex", gap: "0.3rem" }}>
                  {!ch.hasLead && (
                    <span className="pill" style={{ background: "#fef2f2", color: "#dc2626", fontSize: "0.7rem" }}>
                      No Chapter President
                    </span>
                  )}
                  {!ch.hasInstructor && (
                    <span className="pill" style={{ background: "#fef2f2", color: "#dc2626", fontSize: "0.7rem" }}>
                      No Instructor
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Matrix Table */}
      <div className="card" style={{ overflow: "auto" }}>
        <table className="table" style={{ width: "100%", fontSize: "0.82rem" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Chapter</th>
              <th style={{ textAlign: "left" }}>Location</th>
              <th style={{ textAlign: "right" }}>Total</th>
              {ROLE_KEYS.map((role) => (
                <th key={role} style={{ textAlign: "right" }}>{ROLE_LABELS[role]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((ch) => (
              <tr
                key={ch.id}
                style={{
                  background: !ch.hasLead || !ch.hasInstructor ? "#fffbeb" : undefined,
                }}
              >
                <td style={{ fontWeight: 600 }}>{ch.name}</td>
                <td style={{ color: "var(--muted)" }}>
                  {[ch.city, ch.region].filter(Boolean).join(", ") || "—"}
                </td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>{ch.totalUsers}</td>
                {ROLE_KEYS.map((role) => {
                  const count = ch.roleCounts[role] ?? 0;
                  const isWarning =
                    (role === "CHAPTER_PRESIDENT" && count === 0) ||
                    (role === "INSTRUCTOR" && count === 0);
                  return (
                    <td
                      key={role}
                      style={{
                        textAlign: "right",
                        color: isWarning ? "#dc2626" : count === 0 ? "var(--muted)" : undefined,
                        fontWeight: isWarning ? 700 : undefined,
                      }}
                    >
                      {count}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700, borderTop: "2px solid var(--border)" }}>
              <td>Totals</td>
              <td>{matrix.length} chapters</td>
              <td style={{ textAlign: "right" }}>{totalUsers}</td>
              {ROLE_KEYS.map((role) => (
                <td key={role} style={{ textAlign: "right" }}>{totals[role]}</td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
