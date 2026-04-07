import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { linkStudent, unlinkStudent } from "@/lib/parent-actions";

export default async function ParentConnectPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  if (!roles.includes("PARENT") && !roles.includes("ADMIN")) redirect("/");

  const userId = session.user.id;

  // Get all parent-student links (including pending/rejected)
  const links = await prisma.parentStudent.findMany({
    where: {
      parentId: userId,
      archivedAt: null,
      student: {
        archivedAt: null,
      },
    },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          chapter: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const approved = links.filter((l) => l.approvalStatus === "APPROVED");
  const pending = links.filter((l) => l.approvalStatus === "PENDING");
  const rejected = links.filter((l) => l.approvalStatus === "REJECTED");

  // Get parent settings if they exist
  const parentProfile = await prisma.parentProfile
    .findUnique({
      where: { userId },
      include: { settings: true },
    })
    .catch(() => null);

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href="/parent" style={{ fontSize: 13, color: "var(--muted)" }}>
            &larr; Parent Portal
          </Link>
          <h1 className="page-title">Manage Connections</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            Link student accounts and review how parent updates are delivered
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/parent/student-intake/new" className="button small">
            Start Student Journey
          </Link>
        </div>
      </div>

      <div
        style={{
          padding: "12px 16px",
          background: "var(--surface-alt)",
          borderRadius: "var(--radius-sm)",
          borderLeft: "3px solid var(--ypp-purple)",
          marginBottom: 20,
          fontSize: 13,
          color: "var(--text-secondary)",
        }}
      >
        <strong style={{ color: "var(--foreground)" }}>Need to start from scratch?</strong>{" "}
        Use <Link href="/parent/student-intake/new">Start Student Journey</Link> when your child does not already
        have a YPP student account. Keep the form below for students who are already registered and only need the parent link approved.
      </div>

      {/* Link a New Student */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 12px" }}>Link a New Student</h3>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 16px" }}>
          Enter your child&apos;s email to request a connection. An admin will review and approve the request.
        </p>
        <form action={linkStudent} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            className="input"
            name="email"
            type="email"
            placeholder="student@example.com"
            required
            style={{ flex: "1 1 200px" }}
          />
          <select className="input" name="relationship" defaultValue="Parent" style={{ flex: "0 1 150px" }}>
            <option value="Parent">Parent</option>
            <option value="Guardian">Guardian</option>
            <option value="Grandparent">Grandparent</option>
            <option value="Other">Other</option>
          </select>
          <button type="submit" className="button primary">
            Link Student
          </button>
        </form>
      </div>

      {/* Stats */}
      <div className="grid three" style={{ marginBottom: 24 }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="kpi" style={{ color: "#16a34a" }}>{approved.length}</div>
          <div className="kpi-label">Active Connections</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="kpi" style={{ color: "#d97706" }}>{pending.length}</div>
          <div className="kpi-label">Pending Approval</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="kpi" style={{ color: "#ef4444" }}>{rejected.length}</div>
          <div className="kpi-label">Rejected</div>
        </div>
      </div>

      {/* Pending Connections */}
      {pending.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div className="section-title">Pending Approval</div>
          <div
            style={{
              padding: "10px 14px",
              background: "#fffbeb",
              borderRadius: "var(--radius-sm)",
              border: "1px solid #fcd34d",
              marginBottom: 10,
              fontSize: 13,
              color: "#78350f",
            }}
          >
            These connections are waiting for a YPP admin to review and approve.
            This typically takes 1–2 business days. You&apos;ll be notified once
            approved. Until then, student data is not visible.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pending.map((link) => (
              <div
                key={link.id}
                className="card"
                style={{ padding: "12px 16px", borderLeft: "4px solid #d97706" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{link.student.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      {link.student.email} &middot; {link.relationship}
                    </div>
                  </div>
                  <span className="pill" style={{ background: "#fef3c7", color: "#92400e" }}>
                    Awaiting admin approval
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Connections */}
      {approved.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div className="section-title">Active Connections</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {approved.map((link) => (
              <div
                key={link.id}
                className="card"
                style={{ padding: "12px 16px" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{link.student.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      {link.student.email} &middot; {link.relationship}
                      {link.student.chapter && ` &middot; ${link.student.chapter.name}`}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {link.isPrimary && (
                      <span className="pill" style={{ background: "#e0e7ff", color: "#3730a3" }}>
                        Primary
                      </span>
                    )}
                    <Link
                      href={`/parent/${link.studentId}`}
                      className="button small"
                      style={{ textDecoration: "none" }}
                    >
                      View Progress
                    </Link>
                    <form action={unlinkStudent} style={{ margin: 0 }}>
                      <input type="hidden" name="id" value={link.id} />
                      <button type="submit" className="button small secondary">
                        Unlink
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rejected */}
      {rejected.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div className="section-title">Rejected Requests</div>
          <div
            style={{
              padding: "10px 14px",
              background: "#fef2f2",
              borderRadius: "var(--radius-sm)",
              border: "1px solid #fca5a5",
              marginBottom: 10,
              fontSize: 13,
              color: "#7f1d1d",
            }}
          >
            These requests were not approved. This may be because the student
            email didn&apos;t match records, the relationship couldn&apos;t be
            verified, or the student&apos;s account is restricted. Contact your
            chapter admin for more information.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rejected.map((link) => (
              <div
                key={link.id}
                className="card"
                style={{ padding: "12px 16px", opacity: 0.7 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{link.student.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      {link.student.email} &middot; {link.relationship}
                    </div>
                  </div>
                  <span className="pill" style={{ background: "#fef2f2", color: "#991b1b" }}>
                    Rejected
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notification Delivery */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="section-title">Notification Delivery</div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 0 }}>
          Parent notifications now follow one fixed portal policy. Important parent messages, attendance alerts,
          and intake updates send by email now and are marked for SMS delivery once text support is enabled.
          Progress reminders stay available in the portal history.
        </p>
        {parentProfile?.settings ? (
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 0 }}>
            Current report cadence: {parentProfile.settings.reportFrequency.toLowerCase()} summary reports.
          </p>
        ) : (
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 0 }}>
            Summary-report cadence will appear here after your first student connection is approved.
          </p>
        )}
      </div>

      {/* Empty State */}
      {links.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 40, marginTop: 24 }}>
          <h3>No connections yet</h3>
          <p style={{ color: "var(--text-secondary)" }}>
            Use the form above to link your child&apos;s student account.
            Once approved by an admin, you&apos;ll be able to view their progress and receive updates.
          </p>
        </div>
      )}
    </div>
  );
}
