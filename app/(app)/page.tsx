import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ADMIN_SUBTYPE_LABELS, normalizeAdminSubtypes } from "@/lib/admin-subtypes";
import { listWorkflowHomeData } from "@/lib/workflow";
import PageHelp from "@/components/page-help";

function formatAbsoluteDate(value: Date | null | undefined) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function formatStage(stage: string) {
  return stage.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function notificationTag(type: string) {
  return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function OverviewPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = session.user.roles ?? [];
  const adminSubtypes = normalizeAdminSubtypes(
    ((session.user as { adminSubtypes?: string[] }).adminSubtypes ?? [])
  );
  const isAdmin = roles.includes("ADMIN");
  const isSuperAdmin = adminSubtypes.includes("SUPER_ADMIN");

  const [workflowHome, notifications, unreadNotifications] = await Promise.all([
    listWorkflowHomeData({
      userId: session.user.id,
      roles,
      adminSubtypes,
    }),
    prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.notification.count({
      where: { userId: session.user.id, isRead: false },
    }),
  ]);

  const todayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <span className="badge">Home</span>
          <h1 className="page-title">Your Portal Home</h1>
          <p className="page-subtitle">
            {todayLabel}. Start with the next action at the top, then clear notifications that need attention.
          </p>
        </div>
      </div>

      <PageHelp
        purpose="This home page is your role-based command center for assigned work and recent alerts."
        firstStep="Open the first next action with the nearest due date or the item that is already assigned to you."
        nextStep="When you finish an action, the workflow record updates and the next owner or next stage appears automatically."
      />

      {isAdmin && adminSubtypes.length === 0 ? (
        <div className="card" style={{ marginTop: 16, marginBottom: 16 }}>
          <h2 style={{ marginTop: 0, marginBottom: 8 }}>Waiting for Admin Subtype Assignment</h2>
          <p style={{ margin: 0, color: "var(--muted)" }}>
            Your account has the base admin role, but no admin subtype has been assigned yet. Until that happens, this page stays in a minimal queue mode.
          </p>
        </div>
      ) : null}

      {adminSubtypes.length > 0 ? (
        <div className="card" style={{ marginTop: 16, marginBottom: 16 }}>
          <p style={{ margin: 0, color: "var(--muted)" }}>
            Active admin types:{" "}
            <strong>
              {adminSubtypes.map((subtype) => ADMIN_SUBTYPE_LABELS[subtype]).join(", ")}
            </strong>
          </p>
        </div>
      ) : null}

      <div className="grid two" style={{ alignItems: "start" }}>
        <section className="card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0 }}>Next Actions</h2>
              <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
                Assigned work for your current role and workflow ownership.
              </p>
            </div>
            <span className="badge">{workflowHome.items.length}</span>
          </div>

          {workflowHome.items.length === 0 ? (
            <p style={{ margin: 0, color: "var(--muted)" }}>
              You do not have any assigned workflow items right now.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {workflowHome.items.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="workflow-home-card"
                  style={{ display: "block", color: "inherit", textDecoration: "none" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                    <div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                        <span className="pill pill-small pill-info">{formatStage(item.stage)}</span>
                        <span className="pill pill-small">{item.kind.replace(/_/g, " ")}</span>
                      </div>
                      <p style={{ margin: 0, fontWeight: 700 }}>{item.title}</p>
                      {item.summary ? (
                        <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 14 }}>{item.summary}</p>
                      ) : null}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>Open</span>
                  </div>
                  <div style={{ marginTop: 12, fontSize: 12, color: "var(--muted)" }}>
                    Deadline to action: {formatAbsoluteDate(item.dueAt)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0 }}>Notifications</h2>
              <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
                Recent portal alerts with exact dates.
              </p>
            </div>
            <span className="badge">{unreadNotifications} unread</span>
          </div>

          {notifications.length === 0 ? (
            <p style={{ margin: 0, color: "var(--muted)" }}>
              You do not have any notifications right now.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href={notification.link || "/notifications"}
                  className="workflow-home-card"
                  style={{ display: "block", color: "inherit", textDecoration: "none" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                    <div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                        <span className="pill pill-small">{notificationTag(notification.type)}</span>
                        {!notification.isRead ? (
                          <span className="pill pill-small pill-attention">Unread</span>
                        ) : null}
                      </div>
                      <p style={{ margin: 0, fontWeight: 700 }}>{notification.title}</p>
                      <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 14 }}>{notification.body}</p>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>Open</span>
                  </div>
                  <div style={{ marginTop: 12, fontSize: 12, color: "var(--muted)" }}>
                    Posted: {formatAbsoluteDate(notification.createdAt)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {isSuperAdmin ? (
        <section className="card" style={{ marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0 }}>Master Dashboard</h2>
              <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
                Progress across everyone currently tracked in the shared workflow system.
              </p>
            </div>
          </div>

          {workflowHome.masterRows.length === 0 ? (
            <p style={{ margin: 0, color: "var(--muted)" }}>
              Workflow items will appear here once people are routed into the shared dashboard.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {workflowHome.masterRows.map((row) => (
                <div
                  key={row.subjectUserId}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 14,
                    padding: 16,
                    background: "var(--surface)",
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1fr) minmax(160px, 220px) minmax(220px, 2fr)", gap: 16, alignItems: "start" }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 700 }}>{row.name}</p>
                    </div>
                    <div>
                      <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>Progress</p>
                      <div style={{ height: 10, borderRadius: 999, background: "var(--surface-hover)", overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${row.progressPercent}%`,
                            height: "100%",
                            background: "linear-gradient(90deg, var(--accent) 0%, #4f46e5 100%)",
                          }}
                        />
                      </div>
                      <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)" }}>{row.progressPercent}% complete</p>
                    </div>
                    <div>
                      <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>Remaining Tasks</p>
                      {row.remainingTasks.length === 0 ? (
                        <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>No remaining tasks.</p>
                      ) : (
                        <div style={{ display: "grid", gap: 8 }}>
                          {row.remainingTasks.map((task) => (
                            <div key={`${row.subjectUserId}-${task.title}`} style={{ fontSize: 14 }}>
                              <strong>{task.title}</strong>
                              <span style={{ color: "var(--muted)" }}>
                                {" "}· {formatAbsoluteDate(task.dueAt)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
