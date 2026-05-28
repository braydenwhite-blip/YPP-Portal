import Link from "next/link";

import type { HiringChairHomeData } from "@/lib/hiring-chair-home";

const CHAIR_QUEUE_HREF = "/admin/instructor-applicants/chair-queue";
const ACTIVITY_FEED_HREF = "/admin/instructor-applicants/activity";

function finalReviewHref(applicationId: string): string {
  return `/admin/instructor-applicants/${applicationId}/review`;
}

const ACTION_LABELS: Record<string, string> = {
  APPROVE: "Approved",
  APPROVE_WITH_CONDITIONS: "Approved (conditions)",
  REJECT: "Rejected",
  HOLD: "Held",
  WAITLIST: "Waitlisted",
  REQUEST_INFO: "Info requested",
  REQUEST_SECOND_INTERVIEW: "2nd interview",
};

function formatActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ").toLowerCase();
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

interface Props {
  firstName: string;
  todayDateLabel: string;
  data: HiringChairHomeData;
  unreadMessages: number;
  unreadNotifications: number;
}

export default function HiringChairHome({
  firstName,
  todayDateLabel,
  data,
  unreadMessages,
  unreadNotifications,
}: Props) {
  const {
    pendingTotal,
    oldestWaiting,
    pending,
    decisionsThisWeek,
    myDecisionsThisWeek,
    recentDecisions,
  } = data;

  const hasPending = pendingTotal > 0;
  const oldestDays = oldestWaiting?.daysInQueue ?? null;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <span className="badge">Hiring Chair</span>
          <h1 className="page-title">Hiring Chair Command Center</h1>
          <p className="page-subtitle">
            {todayDateLabel}. {hasPending
              ? `Hi ${firstName} — ${pendingTotal} application${
                  pendingTotal === 1 ? "" : "s"
                } awaiting your decision.`
              : `Hi ${firstName} — the chair queue is clear right now.`}
          </p>
        </div>
        <div className="dashboard-header-actions">
          <Link
            href="/messages"
            className={`dashboard-header-icon-btn${unreadMessages > 0 ? " has-unread" : ""}`}
            aria-label={
              unreadMessages > 0
                ? `Messages, ${unreadMessages > 99 ? "99+" : unreadMessages} unread`
                : "Messages"
            }
          >
            ✉
          </Link>
          <Link
            href="/notifications"
            className={`dashboard-header-icon-btn${unreadNotifications > 0 ? " has-unread" : ""}`}
            aria-label={
              unreadNotifications > 0
                ? `Notifications, ${
                    unreadNotifications > 99 ? "99+" : unreadNotifications
                  } unread`
                : "Notifications"
            }
          >
            🔔
          </Link>
        </div>
      </div>

      <section className="card" style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Next decision</h2>
            <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
              {hasPending
                ? `Open the final review cockpit for the oldest application waiting on your decision.`
                : "There is nothing waiting on a chair decision right now."}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href={ACTIVITY_FEED_HREF} className="button outline">
              Activity feed
            </Link>
            <Link
              href={
                oldestWaiting
                  ? finalReviewHref(oldestWaiting.id)
                  : CHAIR_QUEUE_HREF
              }
              className="button"
            >
              {oldestWaiting ? `Review ${oldestWaiting.displayName}` : "Open Chair Queue"}
            </Link>
          </div>
        </div>
      </section>

      <section className="grid three" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="kpi">{pendingTotal}</div>
          <div className="kpi-label">Pending chair reviews</div>
        </div>
        <div className="card">
          <div className="kpi">{oldestDays === null ? "—" : `${oldestDays}d`}</div>
          <div className="kpi-label">Oldest waiting</div>
        </div>
        <div className="card">
          <div className="kpi">{decisionsThisWeek}</div>
          <div className="kpi-label">
            Decisions this week
            {myDecisionsThisWeek > 0 ? ` · ${myDecisionsThisWeek} by you` : ""}
          </div>
        </div>
      </section>

      <div className="grid two" style={{ alignItems: "start" }}>
        <section className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <div>
              <h2 style={{ margin: 0 }}>Pending applications</h2>
              <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
                Oldest first. Open any to launch the full chair workspace.
              </p>
            </div>
            <Link href={CHAIR_QUEUE_HREF} className="link">
              View all
            </Link>
          </div>
          {pending.length === 0 ? (
            <p style={{ margin: 0, color: "var(--muted)" }}>
              No applications are waiting on a chair decision. Nice work.
            </p>
          ) : (
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "grid",
                gap: 10,
              }}
            >
              {pending.map((app) => (
                <li key={app.id}>
                  <Link
                    href={finalReviewHref(app.id)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                      color: "inherit",
                      textDecoration: "none",
                    }}
                  >
                    <span style={{ minWidth: 0 }}>
                      <strong>{app.displayName}</strong>
                      {app.chapterName ? (
                        <span style={{ color: "var(--muted)", marginLeft: 8 }}>
                          · {app.chapterName}
                        </span>
                      ) : null}
                    </span>
                    <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {app.daysInQueue === null
                        ? "Just queued"
                        : `${app.daysInQueue}d in queue`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 style={{ margin: 0, marginBottom: 12 }}>Recently decided</h2>
          {recentDecisions.length === 0 ? (
            <p style={{ margin: 0, color: "var(--muted)" }}>
              No chair decisions in the last 14 days yet.
            </p>
          ) : (
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "grid",
                gap: 10,
              }}
            >
              {recentDecisions.map((decision) => (
                <li
                  key={decision.id}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <Link
                      href={finalReviewHref(decision.applicationId)}
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      <strong>{decision.displayName}</strong>
                      {decision.chapterName ? (
                        <span style={{ color: "var(--muted)", marginLeft: 8 }}>
                          · {decision.chapterName}
                        </span>
                      ) : null}
                    </Link>
                    <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {formatActionLabel(decision.action)} · {formatDate(decision.decidedAt)}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: "4px 0 0",
                      color: "var(--muted)",
                      fontSize: 13,
                    }}
                  >
                    {decision.isMine
                      ? "Decided by you"
                      : decision.chairName
                      ? `Decided by ${decision.chairName}`
                      : "Decided"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
