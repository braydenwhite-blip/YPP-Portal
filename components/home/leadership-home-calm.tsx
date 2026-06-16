import Link from "next/link";

import { cn } from "@/components/ui-v2";
import { buildHomeFocus, buildHomeQueuePreview, type HomeFocusTone } from "@/lib/home/home-focus";
import type { LeadershipHomeData } from "@/lib/home/leadership-home";

import { HomeSearchButton } from "./home-search-button";

/**
 * Leadership Home — the CALM front door (the default). One calm daily starting
 * point, never a dashboard: a greeting, the single most important thing right
 * now (with why + the one obvious next move), a small "your queue" preview, a
 * couple of real counts that actually need attention, and a short list of recent
 * changes. Everything else lives in Executive mode or its own page. Nobody is
 * ever overwhelmed here.
 */

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

const FOCUS_TONE: Record<HomeFocusTone, { ring: string; chip: string; bar: string }> = {
  danger: { ring: "border-danger-700/25", chip: "bg-danger-100 text-danger-700", bar: "bg-danger-600" },
  warning: { ring: "border-warning-700/25", chip: "bg-warning-100 text-warning-700", bar: "bg-warning-600" },
  info: { ring: "border-info-700/25", chip: "bg-info-100 text-info-700", bar: "bg-info-600" },
  brand: { ring: "border-brand-400/40", chip: "bg-brand-100 text-brand-700", bar: "bg-brand-600" },
};

type SmallCard = { label: string; count: number; hint: string; href: string };

export function LeadershipHomeCalm({
  firstName,
  data,
}: {
  firstName: string;
  data: LeadershipHomeData;
}) {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const focus = buildHomeFocus(data, now);
  const queue = buildHomeQueuePreview(data, focus);
  const { stats } = data;

  // Only surface counts that actually need attention — never a wall of zeros.
  const cards: SmallCard[] = (
    [
      { label: "Overdue actions", count: stats.overdueActions, hint: "past their due date", href: "/work?flag=overdue" },
      { label: "Decisions waiting", count: stats.applicantsAwaitingDecision, hint: "applicants need your call", href: "/admin/instructor-applicants" },
      { label: "Check-ins overdue", count: stats.advisorCheckInsOverdue, hint: "advisees to reconnect with", href: "/people?flag=checkin-overdue" },
      { label: "Partner follow-ups", count: stats.partnerFollowUpsOverdue, hint: "past their follow-up date", href: "/partners?view=follow-up" },
      { label: "Need an owner", count: stats.unownedActions, hint: "actions with nobody on them", href: "/work?flag=unowned" },
    ] as SmallCard[]
  )
    .filter((c) => c.count > 0)
    .slice(0, 3);

  return (
    <div className="mx-auto flex w-full max-w-[820px] flex-col gap-6 py-2">
      {/* Greeting */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-[26px] font-bold leading-tight text-ink sm:text-[30px]">
            {firstName ? `${greeting}, ${firstName}.` : `${greeting}.`}
          </h1>
          <p className="m-0 mt-1 text-[15px] text-ink-muted">
            {focus ? "Here's what matters most right now." : "Nothing needs you right now."}
          </p>
        </div>
        <HomeSearchButton />
      </header>

      {/* The one focus */}
      {focus ? (
        <section
          className={cn(
            "relative overflow-hidden rounded-[18px] border bg-surface p-6 shadow-card sm:p-7",
            FOCUS_TONE[focus.tone].ring
          )}
        >
          <span className={cn("absolute inset-y-0 left-0 w-1.5", FOCUS_TONE[focus.tone].bar)} aria-hidden />
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-[0.06em]",
              FOCUS_TONE[focus.tone].chip
            )}
          >
            {focus.category}
          </span>
          <h2 className="mt-3 text-[21px] font-bold leading-tight text-ink sm:text-[23px]">
            {focus.title}
          </h2>
          <p className="mt-2 text-[14.5px] leading-snug text-ink">{focus.why}</p>
          {focus.meta ? <p className="mt-1 text-[13px] text-ink-muted">{focus.meta}</p> : null}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              href={focus.primaryHref}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-card transition-colors hover:bg-brand-700"
            >
              {focus.primaryLabel} →
            </Link>
            <Link
              href="/work/queue"
              className="text-[13px] font-semibold text-brand-700 hover:underline"
            >
              Open My Queue
            </Link>
          </div>
        </section>
      ) : (
        <section className="rounded-[18px] border border-line-soft bg-surface p-7 text-center shadow-card">
          <p className="m-0 text-[18px] font-bold text-ink">You&apos;re clear for now 🎉</p>
          <p className="m-0 mt-1 text-[14px] text-ink-muted">
            No fires, no overdue work, nothing waiting on you.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            {data.upcomingMeetings[0] ? (
              <Link
                href={`/actions/meetings/${data.upcomingMeetings[0].id}`}
                className="rounded-full bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-700"
              >
                Next: {data.upcomingMeetings[0].title} →
              </Link>
            ) : null}
            <Link href="/browse" className="text-[13px] font-semibold text-brand-700 hover:underline">
              Browse everything
            </Link>
          </div>
        </section>
      )}

      {/* Your queue — a small, calm preview (no controls). */}
      <Link
        href="/work/queue"
        className="flex items-center justify-between gap-4 rounded-[14px] border border-line-soft bg-surface px-5 py-4 shadow-card transition-colors hover:border-brand-400"
      >
        <div className="min-w-0">
          <p className="m-0 text-[13.5px] font-bold text-ink">
            My Queue{queue.count > 0 ? ` · ${queue.count} ${queue.count === 1 ? "loop" : "loops"} open` : " · clear"}
          </p>
          <p className="m-0 mt-0.5 truncate text-[12.5px] text-ink-muted">
            {queue.next
              ? `Next: ${queue.next.title}`
              : "Work your loops one at a time — nothing waiting right now."}
          </p>
        </div>
        <span className="shrink-0 text-[13px] font-semibold text-brand-700">Open →</span>
      </Link>

      {/* A few real counts that need attention — never zeros. */}
      {cards.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className="rounded-[14px] border border-line-soft bg-surface px-4 py-3.5 shadow-card transition-colors hover:border-brand-400"
            >
              <p className="m-0 text-[22px] font-bold leading-none text-ink">{card.count}</p>
              <p className="m-0 mt-1.5 text-[13px] font-semibold text-ink">{card.label}</p>
              <p className="m-0 text-[12px] text-ink-muted">{card.hint}</p>
            </Link>
          ))}
        </div>
      ) : null}

      {/* Recent changes — lower priority than active work, kept short. */}
      {data.recentActivity.length > 0 ? (
        <section className="rounded-[14px] border border-line-soft bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between gap-2">
            <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">
              Recent changes
            </p>
            <Link href="/work?view=recent" className="text-[12px] font-semibold text-brand-700 hover:underline">
              View all
            </Link>
          </div>
          <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
            {data.recentActivity.slice(0, 4).map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]"
              >
                <span className="min-w-0 text-ink">
                  {event.href ? (
                    <Link href={event.href} className="hover:underline">
                      {event.title}
                    </Link>
                  ) : (
                    event.title
                  )}
                </span>
                <span className="shrink-0 text-[12px] text-ink-muted">
                  {fmtDay(event.occurredAtISO)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
