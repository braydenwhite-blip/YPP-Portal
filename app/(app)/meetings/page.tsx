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
} from "@/lib/people-strategy/meetings-home";
import { ButtonLink, CardV2, PageHeaderV2, StatusBadge, type StatusTone } from "@/components/ui-v2";
import { EmptySimpleState } from "@/components/command-center/simple";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meetings" };

type MeetingStage = "Prepare" | "Ready" | "Live" | "Follow-up";

const STAGE_TONE: Record<MeetingStage, StatusTone> = {
  Prepare: "warning",
  Ready: "success",
  Live: "brand",
  "Follow-up": "info",
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

function groupLabel(card: MeetingCardDTO): string {
  if (card.relatedTeam) return card.relatedTeam;
  if (card.relatedChapter) return card.relatedChapter;
  if (isImpactMeetingType(card.meetingType)) return "Impact team meeting";
  return card.meetingTypeLabel ?? card.categoryLabel ?? "Meeting";
}

function ownerLabel(card: MeetingCardDTO): string {
  return card.facilitator?.name ? `Owner: ${card.facilitator.name}` : "Owner: not assigned";
}

function stageFor(card: MeetingCardDTO): MeetingStage {
  if (card.effectiveStatus === "in_progress") return "Live";
  if (card.effectiveStatus === "completed" || card.effectiveStatus === "needs_follow_up") {
    return "Follow-up";
  }
  if (card.agendaCount === 0 || card.attendeeCount === 0 || !card.facilitator) return "Prepare";
  return "Ready";
}

function plainLabel(card: MeetingCardDTO): string {
  const stage = stageFor(card);
  if (stage === "Live") return "Live now";
  if (stage === "Follow-up") return card.openFollowUps > 0 ? "Follow-ups open" : "Ready to close";
  if (card.agendaCount === 0) return "Needs agenda";
  if (card.attendeeCount === 0) return "Missing attendees";
  if (!card.facilitator) return "Needs owner";
  return "Ready to run";
}

function whyItMatters(card: MeetingCardDTO): string {
  const stage = stageFor(card);
  if (stage === "Live") return "This meeting is happening now, so notes and decisions should be captured here.";
  if (stage === "Follow-up") {
    return card.openFollowUps > 0
      ? "There are loose ends from this meeting that need owners, due dates, or action links."
      : "The meeting is done; use the summary and action links as the record.";
  }
  if (stage === "Prepare") return "A little prep now keeps the meeting from turning into a vague check-in.";
  return "The agenda is ready; open it when it is time to run the room.";
}

function concreteSteps(card: MeetingCardDTO): string[] {
  const next = meetingNextAction({
    ...card,
    hasRelatedEntity: !!card.relatedEntityType && !!card.relatedEntityId,
  });
  const steps: string[] = [next.reason];
  if (card.agendaCount === 0) steps.push("Add the first agenda item.");
  else steps.push("Review the agenda before the meeting starts.");
  if (card.openFollowUps > 0) {
    steps.push(`Review ${card.openFollowUps} open follow-up${card.openFollowUps === 1 ? "" : "s"}.`);
  } else if (card.decisionCount > 0) {
    steps.push("Check decisions and action links.");
  } else {
    steps.push("Capture decisions during the meeting.");
  }
  return Array.from(new Set(steps)).slice(0, 3);
}

function MeetingHomeCard({ card }: { card: MeetingCardDTO }) {
  const stage = stageFor(card);
  const href = meetingDetailHref(card.meetingType, card.id);
  const next = meetingNextAction({
    ...card,
    hasRelatedEntity: !!card.relatedEntityType && !!card.relatedEntityId,
  });

  return (
    <article className="flex min-h-[174px] flex-col rounded-[12px] border border-line-card bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 text-[17px] font-bold leading-snug text-ink">{card.title}</h3>
          <p className="m-0 mt-1 text-[13px] font-semibold text-ink-muted">{fmtWhen(card.startISO)}</p>
        </div>
        <StatusBadge tone={STAGE_TONE[stage]}>{plainLabel(card)}</StatusBadge>
      </div>
      <p className="m-0 mt-3 text-[13px] leading-relaxed text-ink-muted">{whyItMatters(card)}</p>
      <div className="mt-3 grid gap-1.5 text-[12.5px] font-semibold text-ink-muted">
        <span>{groupLabel(card)}</span>
        <span>{ownerLabel(card)}</span>
        <span>Next: {next.label}</span>
      </div>
      <div className="mt-auto pt-4">
        <ButtonLink href={href} variant="secondary" size="sm">
          Open meeting
        </ButtonLink>
      </div>
    </article>
  );
}

function MeetingLane({
  title,
  hint,
  cards,
  empty,
}: {
  title: string;
  hint: string;
  cards: MeetingCardDTO[];
  empty: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="m-0 text-[18px] font-bold text-ink">{title}</h2>
        <p className="m-0 mt-1 text-[13px] leading-relaxed text-ink-muted">{hint}</p>
      </div>
      {cards.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <MeetingHomeCard key={card.id} card={card} />
          ))}
        </div>
      ) : (
        <CardV2 className="text-[13.5px] font-semibold text-ink-muted">{empty}</CardV2>
      )}
    </section>
  );
}

function NextMeetingCard({ cards, now }: { cards: MeetingCardDTO[]; now: Date }) {
  const selection = selectPrimaryMeeting(
    cards.map((card) => ({
      ...card,
      hasRelatedEntity: !!card.relatedEntityType && !!card.relatedEntityId,
    })),
    now
  );

  if (!selection) {
    return (
      <CardV2 className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="m-0 text-[12px] font-bold uppercase text-brand-700">Next Meeting</p>
          <h2 className="m-0 mt-1 text-[24px] font-bold text-ink">No meeting needs attention right now.</h2>
          <p className="m-0 mt-2 text-[13.5px] text-ink-muted">
            Nothing is live, coming up, or waiting on follow-up in this window.
          </p>
        </div>
        <ButtonLink href="/actions/meetings/new" variant="primary" size="sm">
          Schedule meeting
        </ButtonLink>
      </CardV2>
    );
  }

  const card = selection.meeting;
  const stage = stageFor(card);
  const steps = concreteSteps(card);

  return (
    <section className="rounded-[18px] border border-line-card bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="m-0 text-[12px] font-bold uppercase text-brand-700">Next Meeting</p>
            <StatusBadge tone={STAGE_TONE[stage]}>{stage}</StatusBadge>
          </div>
          <h1 className="m-0 mt-2 text-[30px] font-bold leading-tight text-ink">{card.title}</h1>
          <p className="m-0 mt-2 text-[14px] font-semibold text-ink-muted">
            {fmtWhen(card.startISO)} · {groupLabel(card)} · {ownerLabel(card)}
          </p>
          <ul className="m-0 mt-4 grid list-none gap-2 p-0">
            {steps.map((step) => (
              <li key={step} className="rounded-[10px] border border-line-soft bg-surface-muted px-3 py-2 text-[13px] font-semibold text-ink">
                {step}
              </li>
            ))}
          </ul>
        </div>
        <ButtonLink href={meetingDetailHref(card.meetingType, card.id)} variant="primary" size="md">
          Open meeting
        </ButtonLink>
      </div>
    </section>
  );
}

export default async function MeetingsHomePage() {
  if (!isActionTrackerEnabled()) notFound();
  const viewer = await requireOfficer().catch(() => null);
  if (!viewer) notFound();

  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setUTCDate(windowStart.getUTCDate() - 21);
  const windowEnd = new Date(now);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 45);

  const meetings = await listMeetingsInRange(windowStart, windowEnd);
  const cards = meetings.map((meeting) => mapMeetingToCardDTO(meeting, now));
  const { today, needsPrep, upcoming, recent } = bucketMeetings(cards, now);

  const upcomingLane = [...today, ...upcoming].slice(0, 6);
  const prepLane = needsPrep.slice(0, 6);
  const followUpLane = recent
    .filter((card) => card.openFollowUps > 0 || card.effectiveStatus === "needs_follow_up")
    .slice(0, 6);
  const hasAny = cards.length > 0;

  return (
    <div className={skin.portalSkin}>
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-7 pb-12">
        <PageHeaderV2
          eyebrow="Meetings"
          title="Meetings"
          subtitle="Prepare, run, and follow up on YPP meetings from one place."
          actions={
            <ButtonLink href="/actions/meetings/new" variant="primary" size="sm">
              Schedule meeting
            </ButtonLink>
          }
        />

        {hasAny ? (
          <>
            <NextMeetingCard cards={cards} now={now} />
            <div className="grid gap-7">
              <MeetingLane
                title="Upcoming"
                hint="Meetings that are ready or close to ready."
                cards={upcomingLane}
                empty="No upcoming meetings in this window."
              />
              <MeetingLane
                title="Needs Prep"
                hint="Meetings missing an agenda, attendees, or owner."
                cards={prepLane}
                empty="No meetings need prep right now."
              />
              <MeetingLane
                title="Follow-Ups"
                hint="Finished meetings with loose ends still open."
                cards={followUpLane}
                empty="No meeting follow-ups are open right now."
              />
            </div>
          </>
        ) : (
          <EmptySimpleState icon="calendar">
            No meetings in the last three weeks or the next six weeks. Schedule one to get started.
          </EmptySimpleState>
        )}
      </div>
    </div>
  );
}
