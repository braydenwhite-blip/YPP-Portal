import Link from "next/link";

import { cn, EmptyStateV2 } from "@/components/ui-v2";
import type { AttentionCategory } from "@/lib/operations/attention";
import type { TriageGroup } from "@/lib/queue/engine";
import type { QueueKey } from "@/lib/queue/types";

import { ArrowRightIcon } from "./icons";
import { QueueCard } from "./queue-card";

/**
 * TriageDesk — Needs Attention as a desk, not a list (Queue Engine §6). Items
 * are grouped by what's actually wrong (needs decision, missing owner, overdue
 * follow-up, stalled, upcoming risk, data incomplete); each category launches a
 * focused queue session.
 */

const CATEGORY_TO_QUEUE: Record<AttentionCategory, QueueKey> = {
  urgent: "leadership",
  missing_owner: "owner-accountability",
  missing_next_step: "decisions",
  stalled: "weekly-review",
  upcoming_risk: "meeting-prep",
  data_incomplete: "weekly-review",
};

const CATEGORY_ACCENT: Record<AttentionCategory, string> = {
  urgent: "border-l-danger-700",
  missing_owner: "border-l-warning-700",
  missing_next_step: "border-l-warning-700",
  stalled: "border-l-info-700",
  upcoming_risk: "border-l-warning-700",
  data_incomplete: "border-l-line",
};

export function TriageDesk({ groups }: { groups: TriageGroup[] }) {
  if (groups.length === 0) {
    return (
      <EmptyStateV2
        title="Nothing needs triage"
        body="No cross-domain signals are flagged right now — the desk is clear."
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {groups.map((group) => (
        <section
          key={group.category}
          className={cn(
            "flex flex-col rounded-[14px] border border-l-[3px] border-line-soft bg-surface/80 p-4 shadow-card backdrop-blur",
            CATEGORY_ACCENT[group.category]
          )}
        >
          <header className="mb-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="m-0 flex items-center gap-2 text-[15px] font-bold text-ink">
                {group.label}
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11.5px] font-bold text-brand-700">
                  {group.items.length}
                </span>
              </h3>
              <p className="m-0 mt-0.5 text-[12px] text-ink-muted">{group.hint}</p>
            </div>
          </header>

          <div className="flex flex-col gap-2">
            {group.items.slice(0, 3).map((item) => (
              <QueueCard key={item.id} item={item} />
            ))}
          </div>

          <Link
            href={`/work/queue?queue=${CATEGORY_TO_QUEUE[group.category]}`}
            className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-700 hover:underline"
          >
            Run a {group.label.toLowerCase()} session
            {group.items.length > 3 ? ` · +${group.items.length - 3} more` : ""}
            <ArrowRightIcon className="size-3.5" />
          </Link>
        </section>
      ))}
    </div>
  );
}
