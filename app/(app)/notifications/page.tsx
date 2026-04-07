import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import {
  deleteNotification,
  getNotifications,
  markAllAsRead,
  markAsRead,
} from "@/lib/notification-actions";
import {
  NOTIFICATION_POLICY,
  NOTIFICATION_POLICY_CHANNEL_LABELS,
} from "@/lib/notification-policy";
import PageHelp from "@/components/page-help";

function getTypeLabel(type: string) {
  return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatAbsoluteDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const notifications = await getNotifications();
  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  return (
    <div className="main-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p style={{ marginTop: 4, fontSize: 13, color: "var(--text-secondary)" }}>
            Important alerts stay fixed by policy so critical updates are not accidentally turned off.
          </p>
        </div>
        <div className="header-actions">
          {unreadCount > 0 ? <span className="badge">{unreadCount} unread</span> : null}
          {unreadCount > 0 ? (
            <form action={markAllAsRead}>
              <button type="submit" className="btn btn-secondary">
                Mark All Read
              </button>
            </form>
          ) : null}
        </div>
      </div>

      <PageHelp
        purpose="This page keeps a dated record of your portal alerts and the delivery rules behind them."
        firstStep="Read the unread items first, especially anything tied to hiring, reviews, or deadlines."
        nextStep="After you clear an alert, the archive stays here while your home page returns to the next active item."
      />

      <div className="card" style={{ marginTop: 16, marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>Notification Policy</h2>
        <p style={{ color: "var(--muted)" }}>
          These delivery rules are set by the system. Routine updates stay in the portal, while urgent items are pushed more directly.
        </p>
        <div style={{ display: "grid", gap: 12 }}>
          {Object.entries(NOTIFICATION_POLICY).map(([key, entry]) => (
            <div
              key={key}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(180px, 220px) minmax(120px, 160px) 1fr",
                gap: 12,
                alignItems: "start",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: 14,
              }}
            >
              <div style={{ fontWeight: 700 }}>{entry.label}</div>
              <div>
                <span className="pill pill-small">{NOTIFICATION_POLICY_CHANNEL_LABELS[entry.channel]}</span>
              </div>
              <div style={{ color: "var(--muted)" }}>{entry.description}</div>
            </div>
          ))}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="card">
          <p className="empty">
            You have no notifications right now.
          </p>
        </div>
      ) : (
        <div className="notification-list">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`card ${!notification.isRead ? "card-unread" : ""}`}
              style={{
                marginBottom: 12,
                borderLeft: !notification.isRead
                  ? "4px solid var(--accent)"
                  : "4px solid transparent",
              }}
            >
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                      marginBottom: 6,
                    }}
                  >
                    {notification.link ? (
                      <Link
                        href={notification.link}
                        style={{
                          fontWeight: notification.isRead ? 500 : 700,
                          color: "inherit",
                          textDecoration: "none",
                        }}
                      >
                        {notification.title}
                      </Link>
                    ) : (
                      <span style={{ fontWeight: notification.isRead ? 500 : 700 }}>
                        {notification.title}
                      </span>
                    )}
                    <span className="pill pill-small">{getTypeLabel(notification.type)}</span>
                    {!notification.isRead ? (
                      <span className="pill pill-small pill-attention">Unread</span>
                    ) : null}
                  </div>

                  <p
                    style={{
                      margin: "4px 0 10px",
                      fontSize: 14,
                      color: "var(--muted)",
                      lineHeight: 1.5,
                    }}
                  >
                    {notification.body}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      {formatAbsoluteDate(notification.createdAt)}
                    </span>

                    <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                      {!notification.isRead ? (
                        <form action={markAsRead}>
                          <input type="hidden" name="id" value={notification.id} />
                          <button type="submit" className="btn btn-primary">
                            Mark Read
                          </button>
                        </form>
                      ) : null}
                      <form action={deleteNotification}>
                        <input type="hidden" name="id" value={notification.id} />
                        <button type="submit" className="btn btn-secondary">
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
