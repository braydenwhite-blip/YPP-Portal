import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import skin from "@/components/ui-v2/portal-skin.module.css";
import { ButtonLink, CardV2, PageHeaderV2, StatusBadge } from "@/components/ui-v2";
import {
  CloseCycleButton,
  WaiveToggle,
} from "@/components/mentorship/cycle-row-actions";
import { getSession } from "@/lib/auth-supabase";
import { hasMentorshipCommandAccess } from "@/lib/mentorship/command-access";
import {
  COMPLETED_STAGES,
  STAGE_META,
  type ParticipantStage,
} from "@/lib/mentorship/cycle-constants";
import {
  loadReviewCycle,
  type CycleParticipantDetail,
} from "@/lib/mentorship/cycle-load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review cycle — Pathways Portal" };

const TONE_TO_BADGE = {
  danger: "danger",
  warning: "warning",
  info: "info",
  brand: "brand",
  success: "success",
  neutral: "neutral",
} as const;

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** The one thing an operator can do for this row, given its stage. */
function rowCta(
  p: CycleParticipantDetail,
  kind: "monthly" | "quarterly"
): { label: string; href: string } | { note: string } | null {
  switch (p.stage) {
    case "blocked-no-mentor":
      return {
        label: "Assign mentor",
        href: `/admin/mentorship?tab=assignments&menteeId=${p.userId}&supportRole=PRIMARY_MENTOR`,
      };
    case "waiting-self-input":
      return { note: `Waiting on ${firstName(p.name)}'s reflection` };
    case "waiting-review":
      // Quarterly: no QuarterlyReview row exists yet at this stage (that's what
      // the stage means) and there is no per-person recording route, so the
      // dashboard is the surface where the review actually gets recorded.
      return kind === "quarterly"
        ? { label: "Record review", href: "/people/quarterly-reviews" }
        : { label: "Write review", href: `/mentorship/reviews/${p.userId}` };
    case "ready-for-chair":
      return {
        label: "Open chair review",
        href: p.reviewId ? `/mentorship/chair/${p.reviewId}` : "/mentorship/reviews",
      };
    case "follow-ups-open":
      return { label: "See open work", href: `/mentorship/people/${p.userId}` };
    case "released":
    case "waived":
      return null;
  }
}

export default async function ReviewCyclePage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  if (!(await hasMentorshipCommandAccess(session.user))) redirect("/mentorship");

  const cycle = await loadReviewCycle(params.id);
  if (!cycle) notFound();

  const stageOrder = (Object.keys(STAGE_META) as ParticipantStage[]).sort(
    (a, b) => STAGE_META[a].order - STAGE_META[b].order
  );
  const byStage = stageOrder
    .map((stage) => ({
      stage,
      people: cycle.participants.filter((p) => p.stage === stage),
    }))
    .filter((group) => group.people.length > 0);

  return (
    <div className={`${skin.portalSkin} flex flex-col gap-6`}>
      <PageHeaderV2
        eyebrow={`Review cycle · ${cycle.kind === "quarterly" ? "Quarterly" : "Monthly"} · ${cycle.periodLabel}`}
        title={cycle.name}
        subtitle={`${cycle.scopeLabel} — ${cycle.progress.completed} of ${cycle.progress.total} done${
          cycle.dueDate ? ` · due ${DATE_FMT.format(cycle.dueDate)}` : ""
        }`}
        actions={
          <>
            <ButtonLink href="/mentorship/cycles" variant="secondary" size="sm">
              All cycles
            </ButtonLink>
            {cycle.status === "active" ? (
              <CloseCycleButton cycleId={cycle.id} />
            ) : (
              <StatusBadge tone="neutral">Closed</StatusBadge>
            )}
          </>
        }
      >
        <div
          role="progressbar"
          aria-valuenow={cycle.progress.pctComplete}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Cycle progress"
          className="mt-1 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-surface-soft"
        >
          <div
            className="h-full rounded-full bg-brand-600"
            style={{ width: `${cycle.progress.pctComplete}%` }}
          />
        </div>
      </PageHeaderV2>

      {cycle.participants.length === 0 ? (
        <CardV2 padding="md">
          <p className="m-0 text-[13.5px] text-ink-muted">This cycle has no participants.</p>
        </CardV2>
      ) : (
        byStage.map(({ stage, people }) => (
          <section
            key={stage}
            aria-label={STAGE_META[stage].label}
            className="overflow-hidden rounded-[12px] border border-line-soft bg-surface shadow-card"
          >
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line-soft bg-surface-soft/50 px-4 py-3">
              <div className="flex items-baseline gap-2">
                <h2 className="m-0 text-[13.5px] font-bold text-ink">
                  {STAGE_META[stage].label}
                </h2>
                <span className="text-[12px] font-semibold text-ink-muted">
                  {people.length}
                </span>
              </div>
              <p className="m-0 text-[12px] text-ink-muted">{STAGE_META[stage].blurb}</p>
            </header>
            <ul className="m-0 list-none divide-y divide-line-soft/70 p-0">
              {people.map((p) => {
                const cta = rowCta(p, cycle.kind);
                return (
                  <li
                    key={p.participantId}
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <Link
                          href={`/mentorship/people/${p.userId}`}
                          className="text-[14px] font-semibold text-ink hover:text-brand-700 hover:underline"
                        >
                          {p.name}
                        </Link>
                        {p.contextLabel ? (
                          <span className="text-[12px] text-ink-muted">{p.contextLabel}</span>
                        ) : null}
                        {p.mentorName ? (
                          <span className="text-[12px] text-ink-muted">
                            mentor: {p.mentorName}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1">
                        <StatusBadge tone={TONE_TO_BADGE[STAGE_META[p.stage].tone]}>
                          {STAGE_META[p.stage].label}
                        </StatusBadge>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {cta && "href" in cta ? (
                        <ButtonLink href={cta.href} size="sm" variant="secondary">
                          {cta.label}
                        </ButtonLink>
                      ) : cta && "note" in cta ? (
                        <span className="text-[12.5px] text-ink-muted">{cta.note}</span>
                      ) : null}
                      {/* Waiving only makes sense while the row is still in
                          flight — hide it once released. Waived rows keep the
                          toggle so the override can be undone. */}
                      {cycle.status === "active" &&
                      (p.stageOverride === "waived" ||
                        !COMPLETED_STAGES.includes(p.stage)) ? (
                        <WaiveToggle
                          participantId={p.participantId}
                          waived={p.stageOverride === "waived"}
                        />
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
