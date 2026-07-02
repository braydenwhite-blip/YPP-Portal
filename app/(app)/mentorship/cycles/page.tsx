import Link from "next/link";
import { redirect } from "next/navigation";

import skin from "@/components/ui-v2/portal-skin.module.css";
import { ButtonLink, CardV2, PageHeaderV2, StatusBadge, cn } from "@/components/ui-v2";
import { getSession } from "@/lib/auth-supabase";
import { hasMentorshipCommandAccess } from "@/lib/mentorship/command-access";
import { STAGE_META, type ParticipantStage } from "@/lib/mentorship/cycle-constants";
import { listReviewCycles, type CycleSummary } from "@/lib/mentorship/cycle-load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review Cycles — Pathways Portal" };

const TONE_TO_BADGE = {
  danger: "danger",
  warning: "warning",
  info: "info",
  brand: "brand",
  success: "success",
  neutral: "neutral",
} as const;

const DUE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function CycleRow({ cycle }: { cycle: CycleSummary }) {
  const { progress } = cycle;
  const chips = (Object.keys(STAGE_META) as ParticipantStage[])
    .filter((stage) => progress.counts[stage] > 0)
    .sort((a, b) => STAGE_META[a].order - STAGE_META[b].order);
  const overdue =
    cycle.status === "active" &&
    cycle.dueDate != null &&
    cycle.dueDate.getTime() < Date.now() &&
    progress.pctComplete < 100;
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
            {cycle.kind === "quarterly" ? "Quarterly" : "Monthly"} · {cycle.periodLabel} ·{" "}
            {cycle.scopeLabel}
          </span>
          {cycle.dueDate ? (
            <span
              className={cn(
                "text-[12px]",
                overdue ? "font-semibold text-danger-700" : "text-ink-muted"
              )}
            >
              {overdue
                ? `overdue — was due ${DUE_FMT.format(cycle.dueDate)}`
                : `due ${DUE_FMT.format(cycle.dueDate)}`}
            </span>
          ) : null}
          {cycle.status === "closed" ? <StatusBadge tone="neutral">Closed</StatusBadge> : null}
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
            progress.pctComplete === 100 ? "bg-success-700" : "bg-brand-600"
          )}
          style={{ width: `${progress.pctComplete}%` }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {chips.map((stage) => (
          <StatusBadge key={stage} tone={TONE_TO_BADGE[STAGE_META[stage].tone]}>
            {progress.counts[stage]} {STAGE_META[stage].label.toLowerCase()}
          </StatusBadge>
        ))}
      </div>
    </li>
  );
}

export default async function ReviewCyclesPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  if (!(await hasMentorshipCommandAccess(session.user))) redirect("/mentorship");

  const cycles = await listReviewCycles();
  const active = cycles.filter((c) => c.status === "active");
  const closed = cycles.filter((c) => c.status !== "active");

  return (
    <div className={`${skin.portalSkin} flex flex-col gap-6`}>
      <PageHeaderV2
        eyebrow="Mentorship"
        title="Review cycles"
        subtitle="Launch a review for one person or a whole cohort, then watch everyone move from self-input to released."
        actions={
          <>
            <ButtonLink href="/mentorship?view=admin" variant="secondary" size="sm">
              Command center
            </ButtonLink>
            <ButtonLink href="/mentorship/cycles/new" size="sm">
              Launch review cycle
            </ButtonLink>
          </>
        }
      />

      {cycles.length === 0 ? (
        <CardV2 padding="md">
          <p className="m-0 max-w-lg text-[13.5px] text-ink-muted">
            No review cycles yet. Launch the first one — pick a cohort (all new
            instructors, a chapter, everyone in a lane) or a single person, and
            this page tracks who is waiting on self-input, review, or chair
            approval.
          </p>
        </CardV2>
      ) : (
        <>
          <section
            aria-label="Active cycles"
            className="overflow-hidden rounded-[12px] border border-line-soft bg-surface shadow-card"
          >
            <header className="border-b border-line-soft bg-surface-soft/50 px-4 py-3">
              <h2 className="m-0 text-[13.5px] font-bold text-ink">
                Active <span className="font-semibold text-ink-muted">{active.length}</span>
              </h2>
            </header>
            {active.length === 0 ? (
              <p className="m-0 px-4 py-4 text-[13px] text-ink-muted">
                Nothing running right now.
              </p>
            ) : (
              <ul className="m-0 list-none divide-y divide-line-soft/70 p-0">
                {active.map((cycle) => (
                  <CycleRow key={cycle.id} cycle={cycle} />
                ))}
              </ul>
            )}
          </section>

          {closed.length > 0 ? (
            <section
              aria-label="Closed cycles"
              className="overflow-hidden rounded-[12px] border border-line-soft bg-surface shadow-card"
            >
              <header className="border-b border-line-soft bg-surface-soft/50 px-4 py-3">
                <h2 className="m-0 text-[13.5px] font-bold text-ink">
                  Closed <span className="font-semibold text-ink-muted">{closed.length}</span>
                </h2>
              </header>
              <ul className="m-0 list-none divide-y divide-line-soft/70 p-0">
                {closed.map((cycle) => (
                  <CycleRow key={cycle.id} cycle={cycle} />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
