"use client";

import Link from "next/link";
import { cn } from "@/components/ui-v2";

export type MentorshipSidebarProps = {
  /** Mentor info — null if the viewer has no mentor. */
  mentor: { name: string; email: string } | null;
  /** Mentee count — 0 if the viewer mentors no one. */
  menteeCount: number;
  /** Upcoming events for the quick calendar. */
  upcomingEvents: { date: string; label: string; href: string }[];
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Compact bottom-right info panel — shows mentors/mentees at a glance and
 * upcoming dates as mini sections. No user name or profile avatar.
 */
export function MentorshipSidebar({
  mentor,
  menteeCount,
  upcomingEvents,
}: MentorshipSidebarProps) {
  const hasMentor = mentor !== null;
  const hasMentees = menteeCount > 0;

  return (
    <aside className="flex flex-col gap-3 rounded-[14px] border border-line-soft bg-surface p-4 shadow-sm">
      {/* ── Mentors / Mentees section ──────────────── */}
      {hasMentor || hasMentees ? (
        <div className="flex flex-col gap-1.5">
          <p className="m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
            People
          </p>
          <div className="flex flex-wrap gap-2">
            {hasMentor ? (
              <Link
                href="/mentorship?view=me"
                className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-[12px] font-semibold text-brand-800 no-underline"
              >
                <span>🧑‍🏫</span>
                <span>Mentor: {mentor.name}</span>
              </Link>
            ) : null}
            {hasMentees ? (
              <Link
                href="/mentorship/mentees"
                className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-[12px] font-semibold text-blue-800 no-underline"
              >
                <span>👥</span>
                <span>{menteeCount} mentee{menteeCount !== 1 ? "s" : ""}</span>
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* ── Upcoming dates section ─────────────────── */}
      {upcomingEvents.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
            Upcoming
          </p>
          <div className="flex flex-col gap-1">
            {upcomingEvents.slice(0, 5).map((ev, i) => (
              <Link
                key={i}
                href={ev.href}
                className="flex items-center justify-between rounded-[8px] px-2.5 py-1.5 text-[12px] text-ink no-underline transition-colors hover:bg-brand-50/40"
              >
                <span className="truncate text-ink-muted">{ev.label}</span>
                <span className="shrink-0 text-[11px] font-semibold text-brand-700">
                  {formatDate(ev.date)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {!hasMentor && !hasMentees && upcomingEvents.length === 0 ? (
        <p className="m-0 text-[12px] text-ink-muted">No info yet — get started above.</p>
      ) : null}
    </aside>
  );
}