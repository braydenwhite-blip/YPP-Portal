import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import {
  deleteNotification,
  getNotifications,
  markAllAsRead,
  markAsRead,
} from "@/lib/notification-actions";
import { listNotificationPolicies } from "@/lib/notification-policy";
import PageHelp from "@/components/page-help";

function getTypeIcon(type: string): string {
  switch (type) {
    case "ANNOUNCEMENT":
      return "[!]";
    case "MENTOR_FEEDBACK":
      return "[M]";
    case "GOAL_DEADLINE":
      return "[G]";
    case "COURSE_UPDATE":
      return "[C]";
    case "REFLECTION_REMINDER":
      return "[R]";
    case "ATTENDANCE":
      return "[A]";
    case "MESSAGE":
      return "[>]";
    case "EVENT_UPDATE":
      return "[E]";
    case "EVENT_REMINDER":
      return "[!]";
    case "SYSTEM":
      return "[*]";
    default:
      return "[?]";
  }
}

function getTypeLabel(type: string): string {
  switch (type) {
    case "ANNOUNCEMENT":
      return "Announcement";
    case "MENTOR_FEEDBACK":
      return "Mentor Feedback";
    case "GOAL_DEADLINE":
      return "Goal Deadline";
    case "COURSE_UPDATE":
      return "Course Update";
    case "REFLECTION_REMINDER":
      return "Reflection Reminder";
    case "ATTENDANCE":
      return "Attendance";
    case "MESSAGE":
      return "Message";
    case "EVENT_UPDATE":
      return "Event Update";
    case "EVENT_REMINDER":
      return "Event Reminder";
    case "SYSTEM":
      return "System";
    default:
      return type;
  }
}

function formatTimestamp(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function NotificationsPage() {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const notifications = await getNotifications();
  const policies = listNotificationPolicies();
  const portalOnlyPolicies = policies.filter((policy) => policy.bucket === "portal_only");
  const emailOnlyPolicies = policies.filter((policy) => policy.bucket === "email_only");
  const urgentPolicies = policies.filter((policy) => policy.bucket === "email_and_sms_later");
  const unreadCount = notifications.filter((n) => !n.isRead).length;

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
        purpose="This page keeps a dated record of your portal alerts and the fixed delivery rules behind them."
        firstStep="Read the unread items first, especially anything tied to interviews, approvals, reviews, or deadlines."
        nextStep="When you clear an alert here, the system keeps the history but stops showing it as active work."
      />

      {notifications.length === 0 ? (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="empty">
            You have no notifications. When you receive announcements, mentor
            feedback, goal reminders, or other updates they will appear here.
          </p>
        </div>
      ) : (
        <div className="notification-list" style={{ marginTop: 16 }}>
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`card ${!notification.isRead ? "card-unread" : ""}`}
              style={{
                marginBottom: 12,
                borderLeft: !notification.isRead
                  ? "4px solid var(--primary, #6b21a8)"
                  : "4px solid transparent",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    fontFamily: "monospace",
                    fontWeight: 700,
                    fontSize: 14,
                    color: "var(--primary, #6b21a8)",
                    whiteSpace: "nowrap",
                    paddingTop: 2,
                  }}
                >
                  {getTypeIcon(notification.type)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                      marginBottom: 4,
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
                      <span
                        style={{
                          fontWeight: notification.isRead ? 500 : 700,
                        }}
                      >
                        {notification.title}
                      </span>
                    )}
                    <span className="badge">{getTypeLabel(notification.type)}</span>
                    {!notification.isRead ? (
                      <span
                        style={{
                          display: "inline-block",
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          backgroundColor: "var(--primary, #6b21a8)",
                          flexShrink: 0,
                        }}
                      />
                    ) : null}
                  </div>

                  <p
                    style={{
                      margin: "4px 0 8px",
                      fontSize: 14,
                      color: "var(--muted, #6b7280)",
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
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--muted, #9ca3af)",
                      }}
                    >
                      {formatTimestamp(notification.createdAt)}
                    </span>

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        marginLeft: "auto",
                      }}
                    >
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

      <div className="card" style={{ marginTop: 20 }}>
        <h2 style={{ marginTop: 0 }}>How Notifications Work</h2>
        <p style={{ color: "var(--muted, #6b7280)" }}>
          Notification delivery now follows one fixed portal-wide policy. These rules are not customizable, and
          every notification that creates a portal item stays visible here in your history.
        </p>
        <div style={{ display: "grid", gap: 16 }}>
          <div>
            <h3 style={{ marginBottom: 8 }}>Portal only</h3>
            <p style={{ color: "var(--muted, #6b7280)", marginTop: 0 }}>
              These reminders stay inside the portal so they are tied to your regular workflow.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {portalOnlyPolicies.map((policy) => (
                <span key={policy.type} className="badge">
                  {policy.label}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 style={{ marginBottom: 8 }}>Email delivery</h3>
            <p style={{ color: "var(--muted, #6b7280)", marginTop: 0 }}>
              These updates are sent by email and also remain visible here in your portal history.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {emailOnlyPolicies.map((policy) => (
                <span key={policy.type} className="badge">
                  {policy.label}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 style={{ marginBottom: 8 }}>Urgent alerts</h3>
            <p style={{ color: "var(--muted, #6b7280)", marginTop: 0 }}>
              These alerts send by email now and are already marked for SMS delivery once text support is enabled.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {urgentPolicies.map((policy) => (
                <span key={policy.type} className="badge">
                  {policy.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
