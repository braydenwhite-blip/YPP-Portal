import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { linkStudent, unlinkStudent } from "@/lib/parent-actions";

export default async function ParentConnectPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  if (!roles.includes("PARENT") && !roles.includes("ADMIN")) redirect("/");

  const userId = session.user.id;

  // Get all parent-student links (including pending/rejected)
  const links = await prisma.parentStudent.findMany({
    where: { parentId: userId },
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
            Link student accounts and manage your notification preferences
          </p>
        </div>
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

      {/* Notification Preferences */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="section-title">Notification Preferences</div>
        {parentProfile?.settings ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Email Notifications</div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                {parentProfile.settings.emailNotifications ? "Enabled" : "Disabled"}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>SMS Notifications</div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                {parentProfile.settings.smsNotifications ? "Enabled" : "Disabled"}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Weekly Digest</div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                {parentProfile.settings.weeklyDigest ? "Enabled" : "Disabled"}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Achievement Alerts</div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                {parentProfile.settings.achievementAlerts ? "Enabled" : "Disabled"}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Attendance Alerts</div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                {parentProfile.settings.attendanceAlerts ? "Enabled" : "Disabled"}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Report Frequency</div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                {parentProfile.settings.reportFrequency}
              </div>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Notification preferences will be available after your first student connection is approved.
            Default settings: weekly email digest, achievement and attendance alerts enabled.
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
