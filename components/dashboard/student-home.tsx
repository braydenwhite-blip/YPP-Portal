import Link from "next/link";
import type { StudentProgressSnapshot } from "@/lib/student-progress-actions";
import type { DashboardNextAction } from "@/lib/dashboard/types";
import s from "./student-home.module.css";

export type StudentHomeNotification = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
  type: string;
};

interface StudentHomeProps {
  firstName: string;
  roleLabel: string;
  todayDateLabel: string;
  unreadNotifications: number;
  snapshot: StudentProgressSnapshot | null;
  nextActions: DashboardNextAction[];
  recentNotifications: StudentHomeNotification[];
}

function getActionIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes("profile")) return "👤";
  if (t.includes("message")) return "✉️";
  if (t.includes("class") || t.includes("enroll") || t.includes("curriculum")) return "📚";
  if (t.includes("assignment") || t.includes("homework") || t.includes("training")) return "📝";
  if (t.includes("check") || t.includes("attendance")) return "✅";
  if (t.includes("goal") || t.includes("pathway") || t.includes("step")) return "🎯";
  if (t.includes("challenge") || t.includes("streak")) return "🏆";
  if (t.includes("incubator") || t.includes("project")) return "🛠️";
  if (t.includes("application")) return "📋";
  return "📌";
}

function formatNotificationDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
}

function truncate(s: string, max: number) {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export default function StudentHome({
  firstName,
  roleLabel,
  todayDateLabel,
  unreadNotifications,
  snapshot,
  nextActions,
  recentNotifications,
}: StudentHomeProps) {
  const checklist = snapshot?.checklist;
  const checklistPending = checklist
    ? [
        !checklist.profileCompleted,
        !checklist.joinedFirstClass,
        !checklist.submittedFirstAssignment,
        !checklist.checkedInAtLeastOnce,
      ].filter(Boolean).length
    : 0;

  return (
    <div className={s.sh}>
      <section className={s.shTopCard} aria-labelledby="student-home-heading">
        <header className={s.shTopHead}>
          <div className={s.shIdentity}>
            <span className={s.shRolePill}>{roleLabel}</span>
            <span className={s.shNameTag} id="student-home-heading">
              {firstName.trim() ? `Hi, ${firstName.trim()}!` : "Hi there!"}
            </span>
          </div>
          <p className={s.shDateLine}>{todayDateLabel}</p>
        </header>

        <div className={s.shFeed}>
          <h2 className={s.shFeedTitle}>Next up</h2>
          <p className={s.shFeedHint}>
            Your role-specific priorities and latest updates — newest first where it matters.
          </p>

          {nextActions.length > 0 ? (
            <ul className={s.shItemList}>
              {nextActions.map((action) => (
                <li key={action.id}>
                  <Link href={action.href} className={s.shFeedRow}>
                    <div className={s.shFeedMain}>
                      <span className={s.shFeedIcon} aria-hidden>
                        {getActionIcon(action.title)}
                      </span>
                      <div className={s.shFeedCopy}>
                        <div className={s.shFeedRowTitle}>{action.title}</div>
                        <div className={s.shFeedRowDetail}>{action.detail}</div>
                      </div>
                    </div>
                    <div className={s.shFeedMeta}>
                      {action.ctaLabel ? (
                        <span className={s.shCtaChip}>{action.ctaLabel}</span>
                      ) : null}
                      <span className={s.shFeedDate}>{action.dateLabel ?? "—"}</span>
                      <span className={s.shFeedChevron} aria-hidden>
                        ›
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.shEmpty}>You&apos;re all caught up for now.</p>
          )}

          <div className={s.shNotifBlock}>
            <div className={s.shNotifHeader}>
              <h3 className={s.shNotifTitle}>Notifications</h3>
              {unreadNotifications > 0 ? (
                <span className={s.shUnreadBadge}>
                  {unreadNotifications > 99 ? "99+" : unreadNotifications} new
                </span>
              ) : (
                <span className={s.shReadState}>No unread</span>
              )}
            </div>

            {recentNotifications.length > 0 ? (
              <ul className={s.shNotifList}>
                {recentNotifications.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={n.link || "/notifications"}
                      className={`${s.shNotifRow}${n.isRead ? "" : ` ${s.shNotifRowUnread}`}`}
                    >
                      <div className={s.shNotifMain}>
                        <span className={s.shNotifDot} aria-hidden />
                        <div>
                          <div className={s.shNotifRowTitle}>{n.title}</div>
                          <div className={s.shNotifBody}>{truncate(n.body, 120)}</div>
                        </div>
                      </div>
                      <time className={s.shFeedDate} dateTime={n.createdAt}>
                        {formatNotificationDate(n.createdAt)}
                      </time>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={s.shEmptyMuted}>No notifications yet.</p>
            )}

            <Link href="/notifications" className={s.shNotifFooter}>
              Open notification center
            </Link>
          </div>

          {checklistPending > 0 ? (
            <div className={s.shSubtleRow}>
              <span className={s.shSubtleMuted}>
                {checklistPending} getting-started item{checklistPending === 1 ? "" : "s"} still open —{" "}
                <Link href="/profile" className={s.shSubtleLink}>
                  finish setup
                </Link>
              </span>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
