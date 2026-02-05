import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from "@/lib/notification-actions";
import Link from "next/link";

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
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const notifications = await getNotifications();
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="main-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          {unreadCount > 0 && (
            <p className="badge">{unreadCount} unread</p>
          )}
        </div>
        <div className="header-actions">
          {unreadCount > 0 && (
            <form action={markAllAsRead}>
              <button type="submit" className="btn btn-secondary">
                Mark All Read
              </button>
            </form>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="card">
          <p className="empty">
            You have no notifications. When you receive announcements, mentor
            feedback, goal reminders, or other updates they will appear here.
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
                {/* Icon */}
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

                {/* Content */}
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
                    {!notification.isRead && (
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
                    )}
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
                      {!notification.isRead && (
                        <form action={markAsRead}>
                          <input
                            type="hidden"
                            name="id"
                            value={notification.id}
                          />
                          <button type="submit" className="btn btn-primary">
                            Mark Read
                          </button>
                        </form>
                      )}
                      <form action={deleteNotification}>
                        <input
                          type="hidden"
                          name="id"
                          value={notification.id}
                        />
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
