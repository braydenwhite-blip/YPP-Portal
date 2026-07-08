"use client";

// The Partners lane: every partner relationship for this chapter, who owns
// it, its concrete status, the single next step, and what it's connected to.

import { StatusBadge, ButtonLink } from "@/components/ui-v2";
import { LaneRecordCard } from "@/components/chapters/lane-record-card";
import { LaneNeeds } from "@/components/chapters/lane-needs";
import { LogFollowUpControl } from "@/components/chapters/lane-controls";
import type { ChapterLaneView } from "@/lib/chapters/lanes";

export function LanePartners({ chapterId, view }: { chapterId: string; view: ChapterLaneView }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="m-0 text-[13px] font-semibold text-ink">{view.question}</p>
          <p className="m-0 text-[12px] text-ink-muted">{view.headline}</p>
        </div>
        <ButtonLink href="/partners" variant="secondary" size="sm">
          Open full partner pipeline
        </ButtonLink>
      </div>

      <LaneNeeds chapterId={chapterId} needs={view.needs} />

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h3 className="m-0 text-[13.5px] font-bold text-ink">Every partner</h3>
          <StatusBadge tone="neutral">{view.totalRecords}</StatusBadge>
        </div>
        {view.records.length === 0 ? (
          <p className="m-0 text-[12.5px] text-ink-muted">{view.emptyMessage}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {view.records.map((r) => (
              <LaneRecordCard key={r.id} record={r} action={<LogFollowUpControl chapterId={chapterId} partnerId={r.id} />} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
