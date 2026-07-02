import Link from "next/link";
import { redirect } from "next/navigation";

import { ButtonLink, PageHeaderV2, StatusBadge } from "@/components/ui-v2";
import { getSession } from "@/lib/auth-supabase";
import {
  loadReviewCycleWorkspace,
  type ReviewCycleRow,
} from "@/lib/development/cycle-load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review Cycles — Pathways Portal" };

function CycleRow({ row }: { row: ReviewCycleRow }) {
  return (
    <li className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <Link
            href={`/people/develop/reviews/${row.id}`}
            className="text-[14.5px] font-semibold text-ink hover:text-brand-700 hover:underline"
          >
            {row.revieweeName}
          </Link>
          {row.contextLabel ? (
            <span className="text-[12px] text-ink-muted">{row.contextLabel}</span>
          ) : null}
          {row.dueLabel ? (
            <span className="text-[12px] text-ink-muted">· Due {row.dueLabel}</span>
          ) : null}
        </div>
        <p className="m-0 mt-1 text-[12.5px] text-ink-muted">
          {[row.nextStepLabel, row.feedbackSummary].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge tone={row.stateTone}>{row.stateLabel}</StatusBadge>
        <ButtonLink
          href={`/people/develop/reviews/${row.id}`}
          size="sm"
          variant="secondary"
        >
          Open
        </ButtonLink>
      </div>
    </li>
  );
}

export default async function ReviewCyclesPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const workspace = await loadReviewCycleWorkspace();
  if (!workspace.canStart && workspace.active.length === 0 && workspace.completed.length === 0) {
    redirect("/");
  }

  return (
    <div className="mx-auto w-full max-w-[880px] px-1 pb-12 pt-4">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <PageHeaderV2
          eyebrow="Leadership development"
          title="Review cycles"
          subtitle="Run each instructor and officer review end to end — collect input, synthesize, and turn it into a coaching plan."
          backHref="/mentorship"
          backLabel="Mentorship"
        />
        {workspace.canStart ? (
          <ButtonLink href="/people/develop/reviews/new" variant="primary" size="sm">
            Start a review
          </ButtonLink>
        ) : null}
      </div>

      {workspace.active.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[16px] border border-dashed border-line-soft bg-surface-soft/50 px-6 py-10 text-center">
          <p className="m-0 max-w-sm text-[13.5px] text-ink-muted">
            No reviews in flight.{" "}
            {workspace.canStart
              ? "Start one from the development cockpit or the button above."
              : "You'll see reviews here when you're assigned as a reviewer."}
          </p>
        </div>
      ) : (
        <section className="overflow-hidden rounded-[12px] border border-line-soft bg-surface shadow-card">
          <header className="border-b border-line-soft bg-surface-soft/50 px-4 py-3">
            <h2 className="m-0 text-[13.5px] font-bold text-ink">
              In flight{" "}
              <span className="font-semibold text-ink-muted">
                {workspace.active.length}
              </span>
            </h2>
          </header>
          <ul className="m-0 list-none divide-y divide-line-soft/70 p-0">
            {workspace.active.map((row) => (
              <CycleRow key={row.id} row={row} />
            ))}
          </ul>
        </section>
      )}

      {workspace.completed.length > 0 ? (
        <section className="mt-4 overflow-hidden rounded-[12px] border border-line-soft bg-surface shadow-card">
          <header className="border-b border-line-soft bg-surface-soft/50 px-4 py-3">
            <h2 className="m-0 text-[13.5px] font-bold text-ink">Recently completed</h2>
          </header>
          <ul className="m-0 list-none divide-y divide-line-soft/70 p-0">
            {workspace.completed.map((row) => (
              <CycleRow key={row.id} row={row} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
