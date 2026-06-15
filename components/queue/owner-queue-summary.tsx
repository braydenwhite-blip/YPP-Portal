import Link from "next/link";

import { cn, EmptyStateV2 } from "@/components/ui-v2";
import type { OwnerLane } from "@/lib/queue/types";

/**
 * OwnerQueueSummary — the Owner Accountability lane (Queue Engine §7). Who owes
 * what, worst-first, with the unassigned lane called out as the accountability
 * gap it is. Operational, not evaluative: counts of open / overdue / blocked
 * loops, each expandable to the actual work.
 */
export function OwnerQueueSummary({ lanes }: { lanes: OwnerLane[] }) {
  if (lanes.length === 0) {
    return <EmptyStateV2 title="No open work to attribute" body="Every loop is closed." />;
  }

  return (
    <div className="flex flex-col gap-2">
      {lanes.map((lane) => (
        <details
          key={lane.ownerName}
          className={cn(
            "group rounded-[12px] border bg-surface/80 shadow-card backdrop-blur [&_summary::-webkit-details-marker]:hidden",
            lane.unowned ? "border-warning-700/30 bg-warning-100/20" : "border-line-soft"
          )}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
            <span className="flex min-w-0 items-center gap-2.5">
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
                  lane.unowned ? "bg-warning-100 text-warning-700" : "bg-brand-100 text-brand-700"
                )}
                aria-hidden
              >
                {lane.unowned ? "?" : lane.ownerName.slice(0, 1).toUpperCase()}
              </span>
              <span className="truncate text-[14px] font-bold text-ink">{lane.ownerName}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5 text-[11.5px] font-semibold">
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-700">{lane.open} open</span>
              {lane.overdue > 0 ? (
                <span className="rounded-full bg-danger-100 px-2 py-0.5 text-danger-700">{lane.overdue} overdue</span>
              ) : null}
              {lane.blocked > 0 ? (
                <span className="rounded-full bg-warning-100 px-2 py-0.5 text-warning-700">{lane.blocked} blocked</span>
              ) : null}
            </span>
          </summary>
          <ul className="m-0 flex list-none flex-col gap-1 border-t border-line-soft p-2">
            {lane.items.slice(0, 6).map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-center justify-between gap-3 rounded-[8px] px-2.5 py-1.5 transition-colors hover:bg-surface-soft"
                >
                  <span className="min-w-0 truncate text-[13px] text-ink">{item.title}</span>
                  <span className="shrink-0 text-[11.5px] text-ink-muted">{item.statusLabel}</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
