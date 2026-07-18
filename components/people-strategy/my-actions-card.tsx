import Link from "next/link";

import { ButtonLink, CardV2, cn } from "@/components/ui-v2";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { formatDueDate } from "@/lib/leadership-action-center/dates";
import { getMyActionItems } from "@/lib/people-strategy/action-queries";
import type { ActionViewer } from "@/lib/people-strategy/action-permissions";
import {
  effectiveDeadline,
  isActionOverdue,
  selectUpcoming,
} from "@/lib/people-strategy/my-actions-selectors";

function readableStatus(status: string): string {
  return status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (letter) => letter.toUpperCase());
}

/**
 * Compact "My Actions" queue card for the unified home dashboard. Async server
 * component: it self-gates on the ENABLE_ACTION_TRACKER flag and shows the
 * viewer's nearest deadlines using the shared My Actions selectors.
 */
export default async function MyActionsCard({ viewer }: { viewer: ActionViewer }) {
  if (!isActionTrackerEnabled()) return null;

  const items = selectUpcoming(await getMyActionItems(viewer.id, viewer));
  const now = new Date();
  const top = items.slice(0, 5);

  return (
    <CardV2 padding="none" className="overflow-hidden rounded-[18px]">
      <div className="flex items-center justify-between gap-4 border-b border-line-soft px-5 py-4 sm:px-6">
        <div>
          <h2 className="m-0 text-[16px] font-bold tracking-[-0.01em] text-ink">
            Your actions
          </h2>
          <p className="mt-0.5 mb-0 text-[12.5px] text-ink-muted">
            {items.length === 0
              ? "Nothing needs you right now"
              : `${items.length} open ${items.length === 1 ? "item" : "items"}`}
          </p>
        </div>
        {items.length > 0 ? (
          <ButtonLink href="/actions" variant="ghost" size="sm">
            View all
          </ButtonLink>
        ) : null}
      </div>

      {top.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <span
            aria-hidden
            className="mb-3 flex size-10 items-center justify-center rounded-full bg-emerald-50 text-[18px] font-bold text-emerald-700"
          >
            ✓
          </span>
          <p className="m-0 text-[14px] font-semibold text-ink">You&rsquo;re all caught up</p>
          <p className="mt-1 mb-0 text-[12.5px] text-ink-muted">
            New assignments will appear here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-line-soft">
          {top.map((item) => {
            const overdue = isActionOverdue(item, now);
            const department = item.department?.name ?? null;
            return (
              <Link
                key={item.id}
                href={`/actions/${item.id}`}
                className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 py-4 no-underline transition-colors hover:bg-brand-50/60 sm:px-6"
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full text-[14px] font-bold",
                    overdue
                      ? "bg-danger-50 text-danger-700"
                      : "bg-brand-50 text-brand-700"
                  )}
                >
                  {overdue ? "!" : "✓"}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-semibold text-ink group-hover:text-brand-800">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-ink-muted">
                    {department
                      ? `${department} · ${readableStatus(item.status)}`
                      : readableStatus(item.status)}
                  </span>
                </span>
                <span
                  className={cn(
                    "whitespace-nowrap text-[11.5px] font-semibold",
                    overdue ? "text-danger-700" : "text-ink-muted"
                  )}
                >
                  {overdue ? "Overdue" : formatDueDate(effectiveDeadline(item))}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </CardV2>
  );
}
