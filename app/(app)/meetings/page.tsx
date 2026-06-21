import { notFound } from "next/navigation";

import skin from "@/components/ui-v2/portal-skin.module.css";
import { requireOfficer } from "@/lib/authorization";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import {
  listMeetingsInRange,
  mapMeetingToCardDTO,
  type MeetingCardDTO,
} from "@/lib/people-strategy/meetings-queries";
import {
  meetingNextAction,
  selectPrimaryMeeting,
} from "@/lib/people-strategy/meeting-command-center";
import {
  bucketMeetings,
  isImpactMeetingType,
  meetingDetailHref,
  meetingStatusLabel,
} from "@/lib/people-strategy/meetings-home";
import type { EffectiveMeetingStatus } from "@/lib/people-strategy/meetings-status";
import {
  ButtonLink,
  CardV2,
  PageHeaderV2,
  type StatusTone,
} from "@/components/ui-v2";
import {
  EmptySimpleState,
  PrimaryFocusCard,
  SimpleActionStrip,
  SimpleListCard,
  SimpleRow,
  type SimpleAction,
} from "@/components/command-center/simple";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meetings" };

/**
 * `/meetings` — the canonical Meetings home and the single front door for the
 * whole meetings experience. It reads the same `OfficerMeeting` records the two
 * type-specific hubs read (no second data source), groups them into four
 * plain-language sections, and points every card at the ONE canonical detail for
 * its type. The two meeting types stay clearly distinct:
 *   • Officer Meetings — leadership coordination (decisions, escalations, accountability)
 *   • Impact Meetings  — team-by-team weekly operating meeting (updates feed the agenda)
 */

const STATUS_TONE: Record<EffectiveMeetingStatus, StatusTone> = {
  in_progress: "info",
  today: "brand",
  upcoming: "neutral",
  completed: "success",
  needs_follow_up: "warning",
  canceled: "neutral",
};

function fmtWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function fmtDay(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

/** Short, leader-friendly type label for a card (avoids the long internal names). */
function typeLabel(card: MeetingCardDTO): string {
  if (isImpactMeetingType(card.meetingType)) return "Impact meeting";
  if (card.meetingType === "OFFICER_MEETING") return "Officer meeting";
  return card.meetingTypeLabel ?? "Meeting";
}

function MeetingRow({ card, needsPrep = false }: { card: MeetingCardDTO; needsPrep?: boolean }) {
  const status = needsPrep
    ? { label: "Needs prep", tone: "warning" as StatusTone }
    : { label: meetingStatusLabel(card.effectiveStatus), tone: STATUS_TONE[card.effectiveStatus] };
  return (
    <SimpleRow
      href={meetingDetailHref(card.meetingType, card.id)}
      icon="calendar"
      name={card.title}
      what={`${typeLabel(card)} · ${fmtWhen(card.startISO)}`}
      related={card.facilitator?.name ?? null}
      status={status}
    />
  );
}

/** The single meeting that matters right now, with its one next move. Impact
 *  meetings open into the Impact workspace; everything else into the officer
 *  workspace — so the CTA always lands on the canonical detail for its type. */
function MeetingsFocus({ cards, now }: { cards: MeetingCardDTO[]; now: Date }) {
  const selection = selectPrimaryMeeting(
    cards.map((c) => ({ ...c, hasRelatedEntity: !!c.relatedEntityType && !!c.relatedEntityId })),
    now
  );
  if (!selection) {
    return (
      <PrimaryFocusCard
        eyebrow="Meetings"
        title="No meeting needs you right now."
        reason="Nothing is live, nothing is coming up, and finished meetings are wrapped up. Schedule one when you're ready."
        icon="check"
        tone="success"
        ctaLabel="Schedule a meeting"
        ctaHref="/actions/meetings/new"
      />
    );
  }
  const card = selection.meeting;
  const next = meetingNextAction(card);
  const when = selection.mode === "current" ? "Happening now" : fmtWhen(card.startISO);
  const bits = [when, card.facilitator?.name ?? null].filter(Boolean).join(" · ");
  // Impact meetings live at /impact-meetings/[id]; the officer next-action hash
  // (#agenda, #notes…) only applies to the officer workspace.
  const ctaHref = isImpactMeetingType(card.meetingType)
    ? meetingDetailHref(card.meetingType, card.id)
    : next.href;
  return (
    <PrimaryFocusCard
      eyebrow={typeLabel(card)}
      title={card.title}
      reason={`${bits}. ${next.reason}`}
      icon="calendar"
      ctaLabel={next.label}
      ctaHref={ctaHref}
    />
  );
}

function TypeLane({
  title,
  blurb,
  ctaLabel,
  ctaHref,
  secondary,
  hint,
}: {
  title: string;
  blurb: string;
  ctaLabel: string;
  ctaHref: string;
  secondary?: { label: string; href: string };
  hint: string | null;
}) {
  return (
    <CardV2 className="flex h-full flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-[15.5px] font-bold text-ink">{title}</h2>
        <p className="m-0 text-[12.5px] leading-relaxed text-ink-muted">{blurb}</p>
      </div>
      <p className="m-0 text-[12.5px] font-semibold text-ink">{hint ?? "Nothing scheduled yet."}</p>
      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <ButtonLink href={ctaHref} variant="primary" size="sm">
          {ctaLabel}
        </ButtonLink>
        {secondary ? (
          <ButtonLink href={secondary.href} variant="secondary" size="sm">
            {secondary.label}
          </ButtonLink>
        ) : null}
      </div>
    </CardV2>
  );
}

export default async function MeetingsHomePage() {
  if (!isActionTrackerEnabled()) notFound();
  const viewer = await requireOfficer().catch(() => null);
  if (!viewer) notFound();

  const now = new Date();
  // One window, one query — the home reads the canonical OfficerMeeting records
  // (3 weeks back → 3 weeks ahead) and groups them; it never holds its own data.
  const windowStart = new Date(now);
  windowStart.setUTCDate(windowStart.getUTCDate() - 21);
  const windowEnd = new Date(now);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 21);

  const meetings = await listMeetingsInRange(windowStart, windowEnd);
  const cards = meetings.map((m) => mapMeetingToCardDTO(m, now));
  const { today, needsPrep, upcoming, recent } = bucketMeetings(cards, now);

  // Type-lane hints derived from the same in-range cards (no extra query). The
  // soonest still-ahead meeting of each type, falling back to the latest impact
  // meeting so the Impact lane stays useful right after a meeting wraps.
  const ahead = (c: MeetingCardDTO) =>
    c.effectiveStatus === "upcoming" ||
    c.effectiveStatus === "today" ||
    c.effectiveStatus === "in_progress";
  const sortedByStart = [...cards].sort((a, b) => a.startISO.localeCompare(b.startISO));
  const nextOfficer = sortedByStart.find((c) => ahead(c) && !isImpactMeetingType(c.meetingType));
  const nextImpact =
    sortedByStart.find((c) => ahead(c) && isImpactMeetingType(c.meetingType)) ??
    [...cards]
      .filter((c) => isImpactMeetingType(c.meetingType))
      .sort((a, b) => b.startISO.localeCompare(a.startISO))[0];

  const officerHint = nextOfficer ? `Next: ${fmtDay(nextOfficer.startISO)}` : null;
  const impactHint = nextImpact
    ? `${ahead(nextImpact) ? "Next" : "Latest"}: ${fmtDay(nextImpact.startISO)}`
    : null;

  const hasAny =
    today.length > 0 || needsPrep.length > 0 || upcoming.length > 0 || recent.length > 0;

  const strip: SimpleAction[] = [
    { label: "Schedule meeting", href: "/actions/meetings/new", icon: "calendar", primary: true },
    { label: "Officer meetings", href: "/actions/meetings", icon: "calendar" },
    { label: "Impact meeting", href: "/impact-meetings", icon: "activity" },
    { label: "Submit weekly update", href: "/my-weekly-impact", icon: "send" },
  ];

  return (
    <div className={skin.portalSkin}>
      <div className="mx-auto flex w-full max-w-[980px] flex-col gap-6 pb-12">
        <PageHeaderV2
          eyebrow="Work"
          backHref="/work"
          backLabel="Work"
          title="Meetings"
          subtitle="One place for every meeting. See what's today, what's coming up, what still needs prep, and what just happened — then open the meeting to run it."
          actions={
            <ButtonLink href="/actions/meetings/new" variant="primary" size="sm">
              ＋ Schedule meeting
            </ButtonLink>
          }
        />

        <MeetingsFocus cards={cards} now={now} />

        {/* The two meeting types — clearly different, same system. */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TypeLane
            title="Officer Meetings"
            blurb="Leadership coordination — decisions, org-wide issues, officer updates, escalations, and accountability."
            ctaLabel="Open officer meetings"
            ctaHref="/actions/meetings"
            secondary={{ label: "Schedule", href: "/actions/meetings/new" }}
            hint={officerHint}
          />
          <TypeLane
            title="Impact Meetings"
            blurb="Team-by-team operating meeting — Tech, Fundraising, Expansion, and Socials present progress, blockers, and next commitments. Weekly team updates feed the agenda."
            ctaLabel="Open impact meeting"
            ctaHref="/impact-meetings"
            secondary={{ label: "Submit my update", href: "/my-weekly-impact" }}
            hint={impactHint}
          />
        </section>

        {hasAny ? (
          <div className="flex flex-col gap-4">
            {today.length > 0 ? (
              <SimpleListCard title="Today">
                {today.map((card) => (
                  <MeetingRow key={card.id} card={card} />
                ))}
              </SimpleListCard>
            ) : null}

            {needsPrep.length > 0 ? (
              <SimpleListCard title="Needs prep">
                {needsPrep.map((card) => (
                  <MeetingRow key={card.id} card={card} needsPrep />
                ))}
              </SimpleListCard>
            ) : null}

            {upcoming.length > 0 ? (
              <SimpleListCard title="Upcoming">
                {upcoming.map((card) => (
                  <MeetingRow key={card.id} card={card} />
                ))}
              </SimpleListCard>
            ) : null}

            {recent.length > 0 ? (
              <SimpleListCard title="Recent">
                {recent.slice(0, 6).map((card) => (
                  <MeetingRow key={card.id} card={card} />
                ))}
              </SimpleListCard>
            ) : null}
          </div>
        ) : (
          <EmptySimpleState icon="calendar">
            No meetings in the last three weeks or the next three. Schedule one to get started.
          </EmptySimpleState>
        )}

        <SimpleActionStrip actions={strip} />
      </div>
    </div>
  );
}
