"use client";

// The "what needs you" list at the top of a lane panel — the same blockers
// the lane's records already reflect, surfaced as a short actionable list
// with the Track-as-Action bridge. Shared across Partners/Instructors/
// Students so a Chapter President sees the same pattern in every lane.

import { StatusBadge } from "@/components/ui-v2";
import { TrackButton } from "@/components/chapters/lane-controls";
import type { RoomNeedsItem } from "@/lib/chapters/rooms";

const SEVERITY_TONE: Record<RoomNeedsItem["severity"], "danger" | "warning" | "neutral"> = {
  critical: "danger",
  warning: "warning",
  info: "neutral",
};
const SEVERITY_LABEL: Record<RoomNeedsItem["severity"], string> = {
  critical: "Critical",
  warning: "Needs attention",
  info: "Heads up",
};

export function LaneNeeds({ chapterId, needs }: { chapterId: string; needs: RoomNeedsItem[] }) {
  if (needs.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h3 className="m-0 text-[13.5px] font-bold text-ink">Needs you</h3>
        <StatusBadge tone={needs.some((n) => n.severity === "critical") ? "danger" : "warning"}>{needs.length}</StatusBadge>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {needs.map((n) => (
          <li key={n.key} className="flex flex-wrap items-start justify-between gap-3 rounded-[10px] border border-line-card bg-surface-soft px-3.5 py-2.5">
            <div className="min-w-0 flex-1">
              <StatusBadge tone={SEVERITY_TONE[n.severity]} withDot>
                {SEVERITY_LABEL[n.severity]}
              </StatusBadge>
              <p className="m-0 mt-1 text-[13.5px] font-semibold text-ink">{n.title}</p>
              {n.detail && <p className="m-0 text-[12.5px] text-ink-muted">{n.detail}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <a href={n.href} className="text-[12.5px] font-semibold text-brand-700 hover:underline">
                Resolve →
              </a>
              <TrackButton chapterId={chapterId} need={n} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
