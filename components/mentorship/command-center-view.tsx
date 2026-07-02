import Link from "next/link";

import { ButtonLink, CardV2, StatusBadge, cn } from "@/components/ui-v2";
import { DevelopmentCockpit } from "@/components/development/development-cockpit";
import type { MentorshipCommandCenter } from "@/lib/mentorship/command-center";
import { STAGE_META } from "@/lib/mentorship/cycle-constants";
import type { CycleSummary } from "@/lib/mentorship/cycle-load";
import type { DevelopmentLaneId } from "@/lib/development/signals";

/**
 * Admin POV of the unified mentorship hub — the command center. Server-
 * rendered, links only: active review cycles with live progress, the
 * lifecycle lanes (Leadership Development cockpit), and mentor load &
 * coverage. Every card ends in one concrete action on an existing surface.
 */

const TONE_TO_BADGE = {
  danger: "danger",
  warning: "warning",
  info: "info",
  brand: "brand",
  success: "success",
  neutral: "neutral",
} as const;

function CycleCard({ cycle }: { cycle: CycleSummary }) {
  const { progress } = cycle;
  const headline = progress.headlineStage ? STAGE_META[progress.headlineStage] : null;
  const stageChips = (Object.keys(STAGE_META) as Array<keyof typeof STAGE_META>)
    .filter((stage) => progress.counts[stage] > 0)
    .sort((a, b) => STAGE_META[a].order - STAGE_META[b].order);

  return (
    <li className="flex flex-col gap-2 px-4 py-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <Link
            href={`/mentorship/cycles/${cycle.id}`}
            className="text-[14px] font-semibold text-ink hover:text-brand-700 hover:underline"
          >
            {cycle.name}
          </Link>
          <span className="text-[12px] text-ink-muted">
            {cycle.kind === "quarterly" ? "Quarterly" : "Monthly"} · {cycle.periodLabel}
          </span>
        </div>
        <span className="text-[12.5px] font-semibold text-ink">
          {progress.completed}/{progress.total} done
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={progress.pctComplete}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${cycle.name} progress`}
        className="h-1.5 overflow-hidden rounded-full bg-surface-soft"
      >
        <div
          className={cn(
            "h-full rounded-full",
            progress.pctComplete === 100 ? "bg-success-500" : "bg-brand-600"
          )}
          style={{ width: `${progress.pctComplete}%` }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {stageChips.map((stage) => (
          <StatusBadge key={stage} tone={TONE_TO_BADGE[STAGE_META[stage].tone]}>
            {progress.counts[stage]} {STAGE_META[stage].label.toLowerCase()}
          </StatusBadge>
        ))}
        {headline && progress.pctComplete < 100 ? (
          <span className="text-[11.5px] text-ink-muted">
            next: {headline.blurb.toLowerCase()}
          </span>
        ) : null}
      </div>
    </li>
  );
}

function ReviewCyclesSection({ cycles }: { cycles: CycleSummary[] }) {
  return (
    <section
      aria-label="Review cycles"
      className="overflow-hidden rounded-[12px] border border-line-soft bg-surface shadow-card"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft bg-surface-soft/50 px-4 py-3">
        <div className="flex items-baseline gap-2">
          <h2 className="m-0 text-[13.5px] font-bold text-ink">Review cycles</h2>
          <span className="text-[12px] font-semibold text-ink-muted">{cycles.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/mentorship/cycles"
            className="text-[12.5px] font-semibold text-brand-700 hover:underline"
          >
            All cycles →
          </Link>
          <ButtonLink href="/mentorship/cycles/new" size="sm">
            Launch review cycle
          </ButtonLink>
        </div>
      </header>
      {cycles.length === 0 ? (
        <div className="px-4 py-6">
          <p className="m-0 max-w-lg text-[13px] text-ink-muted">
            No review cycle is running. Launch one for a single person or a whole
            cohort — all new instructors, a chapter, everyone in a lane — and
            track who is waiting on self-input, feedback, or chair approval.
          </p>
        </div>
      ) : (
        <ul className="m-0 list-none divide-y divide-line-soft/70 p-0">
          {cycles.map((cycle) => (
            <CycleCard key={cycle.id} cycle={cycle} />
          ))}
        </ul>
      )}
    </section>
  );
}

function MentorLoadSection({
  coverage,
}: {
  coverage: MentorshipCommandCenter["mentorCoverage"];
}) {
  const shown = coverage.mentors.slice(0, 8);
  return (
    <section
      aria-label="Mentor load"
      className="overflow-hidden rounded-[12px] border border-line-soft bg-surface shadow-card"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line-soft bg-surface-soft/50 px-4 py-3">
        <div className="flex items-baseline gap-2">
          <h2 className="m-0 text-[13.5px] font-bold text-ink">Mentor load &amp; coverage</h2>
          {coverage.overCapCount > 0 ? (
            <StatusBadge tone="danger">{coverage.overCapCount} over cap</StatusBadge>
          ) : null}
        </div>
        <p className="m-0 text-[12px] text-ink-muted">
          {coverage.coveredCount}/{coverage.mentorEligibleCount} covered ·{" "}
          {coverage.needsMentorCount} need a mentor
        </p>
      </header>
      {shown.length === 0 ? (
        <p className="m-0 px-4 py-4 text-[13px] text-ink-muted">
          Nobody in this population is mentoring right now.
        </p>
      ) : (
        <ul className="m-0 list-none divide-y divide-line-soft/70 p-0">
          {shown.map((mentor) => (
            <li
              key={mentor.userId}
              className="flex items-baseline justify-between gap-3 px-4 py-2.5"
            >
              <div className="flex min-w-0 items-baseline gap-2">
                <Link
                  href={`/mentorship/people/${mentor.userId}`}
                  className="text-[13.5px] font-semibold text-ink hover:text-brand-700 hover:underline"
                >
                  {mentor.name}
                </Link>
                {mentor.contextLabel ? (
                  <span className="text-[12px] text-ink-muted">{mentor.contextLabel}</span>
                ) : null}
              </div>
              <span
                className={cn(
                  "shrink-0 text-[12.5px] font-semibold",
                  mentor.overCap ? "text-danger-700" : "text-ink"
                )}
              >
                {mentor.menteeCount}
                {mentor.cap != null ? ` / ${mentor.cap}` : ""} mentees
              </span>
            </li>
          ))}
        </ul>
      )}
      {coverage.needsMentorCount > 0 ? (
        <div className="border-t border-line-soft px-4 py-2.5">
          <Link
            href="/admin/mentorship?tab=assignments"
            className="text-[12.5px] font-semibold text-brand-700 hover:underline"
          >
            Assign mentors to the {coverage.needsMentorCount} without one →
          </Link>
        </div>
      ) : null}
    </section>
  );
}

export function CommandCenterView({
  data,
  who,
  laneFilter,
}: {
  data: MentorshipCommandCenter;
  who: string;
  laneFilter: DevelopmentLaneId | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <ReviewCyclesSection cycles={data.activeCycles} />
      <DevelopmentCockpit overview={data.overview} who={who} laneFilter={laneFilter} />
      <MentorLoadSection coverage={data.mentorCoverage} />
      <p className="m-0 px-1 text-[12.5px] text-ink-muted">
        Program configuration — assignments, chair approvals, G&amp;R templates,
        committees — lives in{" "}
        <Link href="/admin/mentorship" className="font-semibold text-brand-700 hover:underline">
          Mentorship Ops
        </Link>
        . Quarterly calibration in{" "}
        <Link
          href="/people/quarterly-reviews"
          className="font-semibold text-brand-700 hover:underline"
        >
          Quarterly Reviews
        </Link>
        .
      </p>
    </div>
  );
}
