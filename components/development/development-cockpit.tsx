import Link from "next/link";

import {
  ButtonLink,
  FilterBar,
  FilterChipLink,
  StatusBadge,
  cn,
  type StatusTone,
} from "@/components/ui-v2";
import type { DevelopmentOverview } from "@/lib/development/load";
import type {
  DevelopmentCard,
  DevelopmentLane,
  DevelopmentLaneId,
  DevelopmentSignalTone,
} from "@/lib/development/signals";
import type { ReviewQueueItem } from "@/lib/development/review-queue";

/**
 * Leadership Development cockpit — server-rendered, links only. Calm attention
 * lanes over the signal engine in `lib/development/signals.ts`: every card is
 * one person, their evidence, and one concrete next step. Filters are URL
 * params (the page re-queries), so views are shareable and back-button safe.
 */

const SIGNAL_TONE_TO_BADGE: Record<DevelopmentSignalTone, StatusTone> = {
  danger: "danger",
  warning: "warning",
  info: "info",
  brand: "brand",
  success: "success",
  neutral: "neutral",
};

/** Cards shown per lane before the "+N more" line — keeps the page low-scroll. */
const LANE_CARD_CAP = 6;
const CARD_SIGNAL_CAP = 3;

function developHref(who: string, lane?: DevelopmentLaneId | null): string {
  const params = new URLSearchParams();
  params.set("view", "admin");
  if (who === "officers") params.set("who", "officers");
  if (lane) params.set("lane", lane);
  return `/mentorship?${params.toString()}`;
}

function PersonCard({ card }: { card: DevelopmentCard }) {
  const { facts, signals, nextStep } = card;
  const visible = signals.slice(0, CARD_SIGNAL_CAP);
  return (
    <li className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <Link
            href={`/people/develop/${facts.id}`}
            className="text-[14.5px] font-semibold text-ink hover:text-brand-700 hover:underline"
          >
            {facts.name || facts.email}
          </Link>
          {facts.contextLabel ? (
            <span className="text-[12px] text-ink-muted">{facts.contextLabel}</span>
          ) : null}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {visible.map((signal, index) => (
            <StatusBadge key={`${signal.kind}-${index}`} tone={SIGNAL_TONE_TO_BADGE[signal.tone]}>
              {signal.label}
            </StatusBadge>
          ))}
          {signals.length > CARD_SIGNAL_CAP ? (
            <span className="text-[11.5px] text-ink-muted">
              +{signals.length - CARD_SIGNAL_CAP} more
            </span>
          ) : null}
        </div>
      </div>
      <div className="shrink-0">
        <ButtonLink href={nextStep.href} size="sm" variant="secondary">
          {nextStep.label}
        </ButtonLink>
      </div>
    </li>
  );
}

function LaneSection({ lane, who }: { lane: DevelopmentLane; who: string }) {
  const shown = lane.cards.slice(0, LANE_CARD_CAP);
  const hidden = lane.cards.length - shown.length;
  return (
    <section
      aria-label={lane.title}
      className="overflow-hidden rounded-[12px] border border-line-soft bg-surface shadow-card"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line-soft bg-surface-soft/50 px-4 py-3">
        <div className="flex items-baseline gap-2">
          <h2 className="m-0 text-[13.5px] font-bold text-ink">{lane.title}</h2>
          <span className="text-[12px] font-semibold text-ink-muted">{lane.cards.length}</span>
        </div>
        <p className="m-0 text-[12px] text-ink-muted">{lane.blurb}</p>
      </header>
      <ul className="m-0 list-none divide-y divide-line-soft/70 p-0">
        {shown.map((card) => (
          <PersonCard key={card.facts.id} card={card} />
        ))}
      </ul>
      {hidden > 0 ? (
        <div className="border-t border-line-soft px-4 py-2.5">
          <Link
            href={developHref(who, lane.id)}
            className="text-[12.5px] font-semibold text-brand-700 hover:underline"
          >
            Show all {lane.cards.length} in “{lane.title}”
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function ReviewQueueSection({ items }: { items: ReviewQueueItem[] }) {
  if (items.length === 0) return null;
  return (
    <section
      aria-label="Review queue"
      className="overflow-hidden rounded-[12px] border border-line-soft bg-surface shadow-card"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line-soft bg-surface-soft/50 px-4 py-3">
        <div className="flex items-baseline gap-2">
          <h2 className="m-0 text-[13.5px] font-bold text-ink">Review queue</h2>
          <span className="text-[12px] font-semibold text-ink-muted">{items.length}</span>
        </div>
        <p className="m-0 text-[12px] text-ink-muted">
          Reviews to record, approvals to unblock, strong work to recognize.
        </p>
      </header>
      <ul className="m-0 list-none divide-y divide-line-soft/70 p-0">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <Link
                  href={`/people/develop/${item.personId}`}
                  className="text-[14px] font-semibold text-ink hover:text-brand-700 hover:underline"
                >
                  {item.personName}
                </Link>
                {item.contextLabel ? (
                  <span className="text-[12px] text-ink-muted">{item.contextLabel}</span>
                ) : null}
              </div>
              <p
                className={cn(
                  "m-0 mt-0.5 text-[12.5px]",
                  item.tone === "danger" ? "text-danger-700" : "text-ink-muted"
                )}
              >
                {item.reason}
              </p>
            </div>
            <div className="shrink-0">
              <ButtonLink href={item.href} size="sm" variant="secondary">
                {item.actionLabel}
              </ButtonLink>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DevelopmentCockpit({
  overview,
  who,
  laneFilter,
}: {
  overview: DevelopmentOverview;
  /** "instructors" | "officers" — the population URL param. */
  who: string;
  laneFilter: DevelopmentLaneId | null;
}) {
  const { cockpit, reviewQueue, populationCounts } = overview;
  const lanes = laneFilter
    ? cockpit.lanes.filter((lane) => lane.id === laneFilter)
    : cockpit.lanes;

  return (
    <div className="flex flex-col gap-4">
      <FilterBar aria-label="Population">
        <FilterChipLink
          href={developHref("instructors", laneFilter)}
          active={who !== "officers"}
          count={populationCounts.instructor}
        >
          Instructors
        </FilterChipLink>
        <FilterChipLink
          href={developHref("officers", laneFilter)}
          active={who === "officers"}
          count={populationCounts.officer}
        >
          Officers
        </FilterChipLink>
      </FilterBar>

      {cockpit.chips.length > 0 ? (
        <FilterBar aria-label="Attention lanes">
          <FilterChipLink href={developHref(who)} active={laneFilter === null}>
            Everything
          </FilterChipLink>
          {cockpit.chips.map((chip) => (
            <FilterChipLink
              key={chip.laneId}
              href={developHref(who, chip.laneId)}
              active={laneFilter === chip.laneId}
            >
              {chip.label}
            </FilterChipLink>
          ))}
        </FilterBar>
      ) : null}

      {lanes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[16px] border border-dashed border-line-soft bg-surface-soft/50 px-6 py-10 text-center">
          <p className="m-0 max-w-sm text-[13.5px] text-ink-muted">
            {laneFilter
              ? "Nobody is in this lane right now."
              : "Nobody needs attention right now — everyone is steady."}
          </p>
        </div>
      ) : (
        lanes.map((lane) => <LaneSection key={lane.id} lane={lane} who={who} />)
      )}

      {!laneFilter ? <ReviewQueueSection items={reviewQueue} /> : null}

      {cockpit.steadyCount > 0 ? (
        <p className="m-0 px-1 text-[12.5px] text-ink-muted">
          {cockpit.steadyCount}{" "}
          {cockpit.steadyCount === 1 ? "person is" : "people are"} steady — nothing
          pressing and no flags.
        </p>
      ) : null}
    </div>
  );
}
