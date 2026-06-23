import Link from "next/link";
import { notFound } from "next/navigation";

import skin from "@/components/ui-v2/portal-skin.module.css";
import { getSession } from "@/lib/auth-supabase";
import { requireOfficer } from "@/lib/authorization";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import {
  listMeetingsInRange,
  mapMeetingToCardDTO,
  type MeetingCardDTO,
} from "@/lib/people-strategy/meetings-queries";
import {
  bucketMeetings,
  isImpactMeetingType,
  meetingDetailHref,
} from "@/lib/people-strategy/meetings-home";
import {
  GLOBAL_OPERATIONS_IMPACT_MEETING_TYPE,
  loadGlobalOperationsImpactAgendaForMeeting,
  type ImpactMeetingAgenda,
} from "@/lib/people-strategy/impact-meetings";
import { CardV2, StatCardV2 } from "@/components/ui-v2";
import { EmptySimpleState } from "@/components/command-center/simple";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meetings" };

// --- formatting helpers -----------------------------------------------------

function greetingWord(hour: number): string {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function fmtEyebrow(date: Date): string {
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);
  const rest = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
  return `${weekday} · ${rest}`.toUpperCase();
}

function fmtClock(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Short date chip parts, e.g. { month: "JUN", day: "26" }. */
function chipParts(iso: string): { month: string; day: string } {
  const date = new Date(iso);
  return {
    month: new Intl.DateTimeFormat("en-US", { month: "short" }).format(date).toUpperCase(),
    day: new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(date),
  };
}

/** Compact "Jun 19" date for the recent list. */
function fmtShortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(iso));
}

/** Whole days from now until the meeting, clamped at 0 ("today"). */
function daysUntil(iso: string, now: Date): number {
  const diff = new Date(iso).getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

/** "Thursdays · 6:00 PM · 5 people" — recurrence/time/attendees when present. */
function metaLine(card: MeetingCardDTO): string {
  const parts: string[] = [];
  if (card.recurrence?.trim()) parts.push(card.recurrence.trim());
  else parts.push(fmtShortDate(card.startISO));
  parts.push(fmtClock(card.startISO));
  if (card.attendeeCount > 0) {
    parts.push(`${card.attendeeCount} ${card.attendeeCount === 1 ? "person" : "people"}`);
  }
  return parts.join(" · ");
}

/** A short category/type pill label, skipping the redundant Impact label. */
function categoryPill(card: MeetingCardDTO): string | null {
  if (isImpactMeetingType(card.meetingType)) return null;
  return card.meetingTypeLabel ?? card.categoryLabel ?? null;
}

// --- impact agenda stats ----------------------------------------------------

type AgendaSection = ImpactMeetingAgenda["sections"][number];

function isSubmitted(section: AgendaSection): boolean {
  return section.readiness !== "missing" && section.readiness !== "draft";
}

interface AgendaStats {
  total: number;
  ready: number;
  needsRevision: number;
  pending: number;
  firstFlagged: AgendaSection | null;
}

function agendaStats(agenda: ImpactMeetingAgenda | null): AgendaStats {
  if (!agenda) {
    return { total: 0, ready: 0, needsRevision: 0, pending: 0, firstFlagged: null };
  }
  const ready = agenda.sections.filter((s) => isSubmitted(s) && s.needsAttention.length === 0);
  const flagged = agenda.sections.filter((s) => isSubmitted(s) && s.needsAttention.length > 0);
  const total = agenda.sections.length;
  return {
    total,
    ready: ready.length,
    needsRevision: flagged.length,
    pending: total - ready.length - flagged.length,
    firstFlagged: flagged[0] ?? null,
  };
}

/** 2-3 word reason derived from a flagged team's needsAttention. */
function flaggedReason(section: AgendaSection): string {
  const first = section.needsAttention[0];
  if (!first) return "Needs a look";
  // The needsAttention strings begin with the team name; strip it for a tight phrase.
  const trimmed = first.replace(new RegExp(`^${section.teamName}\\s+`, "i"), "").trim();
  const words = (trimmed || first).split(/\s+/).slice(0, 3).join(" ");
  return `${section.teamName} — ${words}`;
}

// --- meeting cards ----------------------------------------------------------

function MeetingRow({ card, core }: { card: MeetingCardDTO; core?: boolean }) {
  const chip = chipParts(card.startISO);
  const pill = categoryPill(card);
  return (
    <Link
      href={meetingDetailHref(card.meetingType, card.id)}
      className="group flex items-center gap-4 rounded-[12px] border border-line-card bg-surface p-4 shadow-card transition-colors hover:border-brand-400"
    >
      <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-[10px] bg-surface-muted leading-none">
        <span className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">{chip.month}</span>
        <span className="mt-0.5 text-[18px] font-bold text-ink">{chip.day}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[15px] font-bold text-ink">{card.title}</span>
          {core ? (
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700">
              Core
            </span>
          ) : null}
          {pill ? (
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
              {pill}
            </span>
          ) : null}
        </span>
        <span className="mt-1 block truncate text-[12.5px] font-medium text-ink-muted">{metaLine(card)}</span>
      </span>
      <span aria-hidden className="shrink-0 text-[20px] text-ink-muted transition-colors group-hover:text-brand-600">
        ›
      </span>
    </Link>
  );
}

function RecentRow({ card }: { card: MeetingCardDTO }) {
  const summary = card.purpose?.trim() || null;
  return (
    <div className="flex flex-col gap-2 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 truncate text-[14px] font-bold text-ink">{card.title}</span>
        <span className="shrink-0 text-[12px] font-semibold text-ink-muted">{fmtShortDate(card.startISO)}</span>
      </div>
      {summary ? <p className="m-0 line-clamp-2 text-[12.5px] leading-relaxed text-ink-muted">{summary}</p> : null}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
          {card.decisionCount} decided
        </span>
        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
          {card.openFollowUps} actions
        </span>
      </div>
    </div>
  );
}

// --- page -------------------------------------------------------------------

export default async function MeetingsHomePage() {
  if (!isActionTrackerEnabled()) notFound();
  const viewer = await requireOfficer().catch(() => null);
  if (!viewer) notFound();

  const session = await getSession();
  const firstName = (session?.user?.name ?? "there").split(" ")[0];

  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setUTCDate(windowStart.getUTCDate() - 21);
  const windowEnd = new Date(now);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 45);

  const meetings = await listMeetingsInRange(windowStart, windowEnd);
  const cards = meetings.map((meeting) => mapMeetingToCardDTO(meeting, now));
  const { today, needsPrep, upcoming, recent } = bucketMeetings(cards, now);

  // The single Global Impact meeting to anchor the dashboard on: the next
  // upcoming one in the window, else the most recent.
  const impactCards = cards.filter(
    (card) => card.meetingType === GLOBAL_OPERATIONS_IMPACT_MEETING_TYPE
  );
  const upcomingImpact = impactCards
    .filter((card) => new Date(card.startISO).getTime() >= now.getTime())
    .sort((a, b) => a.startISO.localeCompare(b.startISO))[0];
  const pastImpact = impactCards
    .filter((card) => new Date(card.startISO).getTime() < now.getTime())
    .sort((a, b) => b.startISO.localeCompare(a.startISO))[0];
  const giCard = upcomingImpact ?? pastImpact ?? null;
  const giUpcoming = !!upcomingImpact;

  // Your meetings: today + needs-prep + upcoming, deduped, Global Impact first.
  const seen = new Set<string>();
  const yourMeetings: MeetingCardDTO[] = [];
  for (const card of [...today, ...needsPrep, ...upcoming]) {
    if (seen.has(card.id)) continue;
    seen.add(card.id);
    yourMeetings.push(card);
  }
  yourMeetings.sort((a, b) => {
    const aGi = a.meetingType === GLOBAL_OPERATIONS_IMPACT_MEETING_TYPE ? 0 : 1;
    const bGi = b.meetingType === GLOBAL_OPERATIONS_IMPACT_MEETING_TYPE ? 0 : 1;
    if (aGi !== bGi) return aGi - bGi;
    return a.startISO.localeCompare(b.startISO);
  });
  const yourMeetingsLane = yourMeetings.slice(0, 8);

  const recentMeetings = recent.slice(0, 4);

  // Load the Global Impact agenda for the four status cards.
  const agenda = giCard
    ? await loadGlobalOperationsImpactAgendaForMeeting({
        meetingId: giCard.id,
        meetingTitle: giCard.title,
        meetingDate: new Date(giCard.startISO),
        viewer: {
          id: viewer.id,
          roles: viewer.roles,
          primaryRole: viewer.primaryRole,
          adminSubtypes: viewer.adminSubtypes,
        },
      }).catch(() => null)
    : null;

  const stats = agendaStats(agenda);
  const openFollowUps = giCard
    ? giCard.openFollowUps
    : recent.reduce((sum, card) => sum + card.openFollowUps, 0);
  const days = giCard ? daysUntil(giCard.startISO, now) : null;
  const giHref = giCard ? meetingDetailHref(giCard.meetingType, giCard.id) : "/meetings";

  // Status sentence under the greeting.
  let statusSentence: string;
  if (giCard && giUpcoming && days !== null) {
    const when = days === 0 ? "in a few hours" : days === 1 ? "tomorrow" : `in ${days} days`;
    statusSentence = `Global Impact runs ${when}. Here's where things stand across the org.`;
  } else if (cards.length === 0) {
    statusSentence = "Nothing on the calendar right now. A calm window to plan the next cycle.";
  } else {
    statusSentence = "No Global Impact meeting is coming up. Here's where things stand across the org.";
  }

  const hasAny = cards.length > 0;

  return (
    <div className={skin.portalSkin}>
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-7 pb-12">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="m-0 text-[12px] font-bold uppercase tracking-wide text-ink-muted">{fmtEyebrow(now)}</p>
            <h1 className="m-0 mt-1.5 text-[34px] font-bold leading-tight text-ink">
              Good {greetingWord(now.getHours())}, {firstName}
            </h1>
            <p className="m-0 mt-2 text-[15px] leading-relaxed text-ink-muted">{statusSentence}</p>
          </div>
          <Link
            href="/actions/meetings/new"
            className="shrink-0 rounded-lg bg-brand-700 px-4 py-2.5 text-[14px] font-bold text-white no-underline shadow-sm transition-colors hover:bg-brand-800"
          >
            + Schedule meeting
          </Link>
        </header>

        {hasAny ? (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCardV2
                label="Teams ready"
                value={`${stats.ready}/${stats.total}`}
                accent="success"
                detail={stats.pending > 0 ? `${stats.pending} still pending` : "All teams in"}
                href={giHref}
              />
              <StatCardV2
                label="Open follow-ups"
                value={openFollowUps}
                accent="warning"
                detail={
                  openFollowUps > 0
                    ? `${openFollowUps} need a decision`
                    : "All clear"
                }
                href={giHref}
              />
              <StatCardV2
                label="Needs revision"
                value={stats.needsRevision}
                accent="danger"
                detail={
                  stats.firstFlagged ? flaggedReason(stats.firstFlagged) : "All updates clean"
                }
                href={giHref}
              />
              <StatCardV2
                label="Days to meeting"
                value={days === null ? "—" : days === 0 ? "Today" : days}
                accent="brand"
                detail={
                  giCard
                    ? days === 0
                      ? `Today at ${fmtClock(giCard.startISO)}`
                      : `${fmtShortDate(giCard.startISO)} at ${fmtClock(giCard.startISO)}`
                    : "Nothing scheduled"
                }
                href={giHref}
              />
            </div>

            <div className="grid gap-7 lg:grid-cols-[1.4fr_1fr]">
              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="m-0 text-[18px] font-bold text-ink">Your meetings</h2>
                  <Link href="/my-weekly-impact" className="text-[13px] font-semibold text-brand-700 hover:underline">
                    Submit weekly impact
                  </Link>
                </div>
                {yourMeetingsLane.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {yourMeetingsLane.map((card) => (
                      <MeetingRow
                        key={card.id}
                        card={card}
                        core={card.meetingType === GLOBAL_OPERATIONS_IMPACT_MEETING_TYPE}
                      />
                    ))}
                  </div>
                ) : (
                  <CardV2 className="text-[13.5px] font-semibold text-ink-muted">
                    Nothing coming up in this window.
                  </CardV2>
                )}
              </section>

              <section className="flex flex-col gap-3">
                <h2 className="m-0 text-[18px] font-bold text-ink">Recent meetings</h2>
                {recentMeetings.length > 0 ? (
                  <CardV2 padding="none" className="divide-y divide-line-soft/70 p-2">
                    {recentMeetings.map((card) => (
                      <RecentRow key={card.id} card={card} />
                    ))}
                  </CardV2>
                ) : (
                  <CardV2 className="text-[13.5px] font-semibold text-ink-muted">
                    No completed meetings yet.
                  </CardV2>
                )}
              </section>
            </div>
          </>
        ) : (
          <EmptySimpleState icon="calendar">
            No meetings in the last three weeks or the next six weeks. A calm window to plan the
            next cycle.
          </EmptySimpleState>
        )}
      </div>
    </div>
  );
}
