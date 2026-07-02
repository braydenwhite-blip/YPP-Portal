import Link from "next/link";

import { StatusBadge } from "@/components/ui-v2";
import type {
  MeetingAttentionGroup,
  MeetingAttentionLane,
} from "@/lib/weekly-meetings/meeting-attention";

/**
 * The hub's "needs follow-through" strip — compact lanes above the meeting
 * list, each naming a concrete gap (no facilitator, open follow-ups, no
 * recorded outcomes). Renders nothing when every meeting is in good shape,
 * so a healthy hub stays calm.
 */

const LANE_TONE: Record<MeetingAttentionLane, "danger" | "warning" | "info"> = {
  needs_owner: "danger",
  follow_ups_unresolved: "warning",
  no_outcomes: "warning",
  happening_soon: "info",
};

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function MeetingAttentionStrip({ groups }: { groups: MeetingAttentionGroup[] }) {
  if (groups.length === 0) return null;
  return (
    <section
      aria-label="Meetings needing follow-through"
      className="flex flex-col gap-3 rounded-[16px] border border-line-card bg-surface p-4 shadow-card"
    >
      {groups.map((group) => (
        <div key={group.lane}>
          <div className="mb-1.5 flex items-baseline gap-2">
            <StatusBadge tone={LANE_TONE[group.lane]}>{group.label}</StatusBadge>
            <span className="text-[12px] text-ink-muted">{group.hint}</span>
          </div>
          <div className="flex flex-col gap-1">
            {group.items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="flex items-center justify-between gap-3 rounded-[10px] border border-line-soft px-3 py-2 no-underline transition-colors duration-150 hover:border-brand-400 hover:bg-brand-50/50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-ink">
                    {item.title}
                  </span>
                  <span className="block truncate text-[12px] text-ink-muted">
                    {[fmtDay(item.scheduledISO), item.typeLabel, item.scopeLabel]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="shrink-0 text-[12px] font-medium text-ink-muted">
                  {item.detail}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
