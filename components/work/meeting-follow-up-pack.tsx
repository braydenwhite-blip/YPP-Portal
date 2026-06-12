import Link from "next/link";

import { StatusBadge } from "@/components/ui-v2";
import type { MeetingFollowUpPack } from "@/lib/people-strategy/action-operations-intel";

/**
 * Action System 4.0 — the Meeting Follow-Up Pack, rendered on the meeting
 * detail page: what still has to happen after this meeting. Decisions that
 * never became tracked actions, the meeting's open/overdue actions, and what
 * recently got done. Pure presentation over `deriveMeetingFollowUpPack`;
 * Tailwind-only subtree (allowed on legacy pages per the hybrid rules).
 */
export function MeetingFollowUpPackSection({ pack }: { pack: MeetingFollowUpPack }) {
  if (pack.isClear) {
    return (
      <section className="mt-5 rounded-[12px] border border-line-soft bg-surface p-5 shadow-card">
        <h2 className="m-0 text-[16px] font-semibold text-ink">Follow-up pack</h2>
        <p className="m-0 mt-1.5 text-[13.5px] text-ink-muted">
          Clean meeting — every decision has an action and nothing from this
          meeting is open or overdue.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-5 rounded-[12px] border border-line-soft bg-surface p-5 shadow-card">
      <h2 className="m-0 text-[16px] font-semibold text-ink">Follow-up pack</h2>
      <p className="m-0 mt-1 text-[12.5px] text-ink-muted">
        What still has to happen after this meeting.
      </p>

      {pack.decisionsWithoutActions.length > 0 ? (
        <div className="mt-3.5">
          <p className="m-0 text-[12.5px] font-semibold text-ink">
            Decisions without actions ({pack.decisionsWithoutActions.length})
          </p>
          <ul className="m-0 mt-1.5 flex list-none flex-col gap-1.5 p-0">
            {pack.decisionsWithoutActions.map((decision) => (
              <li
                key={decision.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-line-soft px-3 py-2"
              >
                <span className="min-w-0 flex-1 text-[13px] text-ink">
                  {decision.decision}
                </span>
                <StatusBadge tone="warning">Not tracked</StatusBadge>
              </li>
            ))}
          </ul>
          <p className="m-0 mt-1.5 text-[12px] text-ink-muted">
            Convert these from the Decisions section below so the work is owned.
          </p>
        </div>
      ) : null}

      {pack.overdueActions.length > 0 ? (
        <div className="mt-3.5">
          <p className="m-0 text-[12.5px] font-semibold text-ink">
            Overdue from this meeting ({pack.overdueActions.length})
          </p>
          <ul className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0">
            {pack.overdueActions.map((action) => (
              <li key={action.id}>
                <Link
                  href={`/actions/${action.id}`}
                  className="text-[13px] font-medium text-danger-700 hover:underline"
                >
                  {action.title}
                </Link>
                <span className="ml-1.5 text-[12px] text-ink-muted">
                  {action.lead?.name ?? action.lead?.email ?? "Unassigned"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {pack.openActions.length > 0 ? (
        <div className="mt-3.5">
          <p className="m-0 text-[12.5px] font-semibold text-ink">
            Open actions from this meeting ({pack.openActions.length})
          </p>
          <ul className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0">
            {pack.openActions.slice(0, 6).map((action) => (
              <li key={action.id}>
                <Link
                  href={`/actions/${action.id}`}
                  className="text-[13px] font-medium text-brand-700 hover:underline"
                >
                  {action.title}
                </Link>
                <span className="ml-1.5 text-[12px] text-ink-muted">
                  {action.lead?.name ?? action.lead?.email ?? "Unassigned"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {pack.recentlyCompleted.length > 0 ? (
        <p className="m-0 mt-3.5 text-[12.5px] text-ink-muted">
          Recently completed:{" "}
          {pack.recentlyCompleted
            .slice(0, 4)
            .map((action) => action.title)
            .join(" · ")}
        </p>
      ) : null}
    </section>
  );
}
