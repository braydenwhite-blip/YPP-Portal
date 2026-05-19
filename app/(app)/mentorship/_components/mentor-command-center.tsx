import Link from "next/link";
import { formatEnum } from "@/lib/format-utils";
import type {
  MentorUpcomingSession,
  MentorQuietMentee,
} from "@/lib/mentor-overview";

/* ── Date helpers (server-rendered at request time) ─────────────── */

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function sessionWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.round((startOfDay(d) - startOfDay(now)) / 86_400_000);
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  let day: string;
  if (diffDays <= 0) day = "Today";
  else if (diffDays === 1) day = "Tomorrow";
  else if (diffDays < 7) day = d.toLocaleDateString("en-US", { weekday: "long" });
  else
    day = d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  return `${day} · ${time}`;
}

function nextSessionHint(iso: string | null): string {
  if (!iso) return "Nothing booked yet";
  return `Next: ${sessionWhen(iso)}`;
}

function quietSince(iso: string | null): string {
  if (!iso) return "No session or check-in logged yet";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 28) return `Last contact ${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 9) return `Last contact ${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  return `Last contact ${months}+ month${months === 1 ? "" : "s"} ago`;
}

/* ── Command strip ───────────────────────────────────────────────── */

interface MentorCommandStripProps {
  activeMentees: number;
  needsYou: number;
  upcomingSessionCount: number;
  nextSessionAt: string | null;
  quietCount: number;
}

/**
 * At-a-glance header for the mentor hub. Four tiles answer the questions a
 * mentor opens the portal to ask: who do I support, what needs me, what is
 * next, and who is slipping out of contact.
 */
export function MentorCommandStrip({
  activeMentees,
  needsYou,
  upcomingSessionCount,
  nextSessionAt,
  quietCount,
}: MentorCommandStripProps) {
  return (
    <div className="mentor-stat-grid">
      <Link href="/mentorship/mentees" className="mentor-stat">
        <span className="mentor-stat__label">Mentees</span>
        <span className="mentor-stat__value">{activeMentees}</span>
        <span className="mentor-stat__sub">
          {activeMentees === 0
            ? "All paused — open roster →"
            : "Open the full roster →"}
        </span>
      </Link>

      <div
        className={`mentor-stat${needsYou > 0 ? " mentor-stat--attention" : ""}`}
      >
        <span className="mentor-stat__label">Needs you now</span>
        <span
          className={`mentor-stat__value${
            needsYou > 0 ? " mentor-stat__value--attention" : ""
          }`}
        >
          {needsYou}
        </span>
        <span className="mentor-stat__sub">
          {needsYou > 0
            ? "Kickoffs, reviews & follow-ups"
            : "You're all caught up"}
        </span>
      </div>

      <Link href="/mentorship/schedule" className="mentor-stat">
        <span className="mentor-stat__label">Upcoming sessions</span>
        <span className="mentor-stat__value">{upcomingSessionCount}</span>
        <span className="mentor-stat__sub">{nextSessionHint(nextSessionAt)}</span>
      </Link>

      <div
        className={`mentor-stat${quietCount > 0 ? " mentor-stat--alert" : ""}`}
      >
        <span className="mentor-stat__label">Quiet</span>
        <span
          className={`mentor-stat__value${
            quietCount > 0 ? " mentor-stat__value--alert" : ""
          }`}
        >
          {quietCount}
        </span>
        <span className="mentor-stat__sub">
          {quietCount > 0
            ? "No contact in 2+ weeks"
            : "Everyone's been in touch"}
        </span>
      </div>
    </div>
  );
}

/* ── Engagement panels ───────────────────────────────────────────── */

interface MentorEngagementPanelsProps {
  upcomingSessions: MentorUpcomingSession[];
  quietMentees: MentorQuietMentee[];
}

/**
 * Forward-looking context that the cycle Kanban can't show: what's on the
 * calendar, and which relationships need a deliberate touchpoint. Renders
 * nothing when both are empty so a calm hub stays calm.
 */
export function MentorEngagementPanels({
  upcomingSessions,
  quietMentees,
}: MentorEngagementPanelsProps) {
  if (upcomingSessions.length === 0 && quietMentees.length === 0) return null;

  return (
    <div className="mentor-panels">
      {upcomingSessions.length > 0 && (
        <section className="mentor-panel" aria-labelledby="mentor-upcoming">
          <div className="mentor-panel__head">
            <h3 className="mentor-panel__title" id="mentor-upcoming">
              Upcoming sessions
            </h3>
            <Link
              href="/mentorship/schedule"
              style={{ fontSize: 12, color: "var(--muted)", textDecoration: "none" }}
            >
              Full schedule →
            </Link>
          </div>
          <ul className="mentor-panel__list">
            {upcomingSessions.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/mentorship/mentees/${s.menteeId}`}
                  className="mentor-panel__row"
                >
                  <span className="mentor-panel__row-main">
                    <span className="mentor-panel__row-title">
                      {s.menteeName}
                    </span>
                    <span className="mentor-panel__row-sub">
                      {s.title || formatEnum(s.type)}
                    </span>
                  </span>
                  <span className="mentor-panel__row-meta">
                    {sessionWhen(s.scheduledAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {quietMentees.length > 0 && (
        <section className="mentor-panel" aria-labelledby="mentor-quiet">
          <div className="mentor-panel__head">
            <h3 className="mentor-panel__title" id="mentor-quiet">
              Reach out · {quietMentees.length}
            </h3>
          </div>
          <p className="mentor-panel__hint">
            No session or check-in logged in 2+ weeks. A short message keeps
            momentum before the next review.
          </p>
          <ul className="mentor-panel__list">
            {quietMentees.map((m) => (
              <li key={m.menteeId}>
                <Link
                  href={`/mentorship/mentees/${m.menteeId}`}
                  className="mentor-panel__row mentor-panel__row--quiet"
                >
                  <span className="mentor-panel__row-main">
                    <span className="mentor-panel__row-title">
                      {m.menteeName}
                    </span>
                    <span className="mentor-panel__row-sub">
                      {quietSince(m.lastContactAt)}
                    </span>
                  </span>
                  <span className="mentor-panel__row-meta">
                    {formatEnum(m.cycleStage)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
