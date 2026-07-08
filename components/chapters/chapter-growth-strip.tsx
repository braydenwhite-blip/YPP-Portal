"use client";

// Chapter Growth — kept, but as a persistent "This week" pulse strip above the
// 5 lane tabs, not a 6th tab. It's a week-over-week trend rollup with no
// primary entity of its own (it doesn't organize partners/students/
// instructors/actions/meetings directly), so it stays visible without
// competing with the five lanes a Chapter President actually works from.

import { CardV2, StatusBadge } from "@/components/ui-v2";
import { SaveSnapshotButton } from "@/components/chapters/lane-controls";
import type { ChapterGrowthSummary, ChapterGrowthStatus } from "@/lib/chapters/chapter-growth";

const GROWTH_TONE: Record<ChapterGrowthStatus, "success" | "neutral" | "warning" | "danger"> = {
  Strong: "success",
  Improving: "success",
  Flat: "neutral",
  Slipping: "warning",
  Critical: "danger",
  "No Baseline Yet": "neutral",
};

export function ChapterGrowthStrip({ chapterId, growth, weekNumber }: { chapterId: string; growth: ChapterGrowthSummary; weekNumber: number }) {
  const targetsMet = growth.evidence.filter((e) => e.status === "met").length;

  return (
    <CardV2 padding="md" className="flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">Week {weekNumber} pulse</p>
          <StatusBadge tone={GROWTH_TONE[growth.status]} withDot>
            {growth.status}
          </StatusBadge>
        </div>
        <p className="m-0 mt-1 text-[13.5px] font-semibold text-ink">{growth.nextAction}</p>
        <p className="m-0 mt-0.5 text-[12px] text-ink-muted">
          {targetsMet}/{growth.targets.length} targets on track · {growth.signals.growth.length} improving ·{" "}
          {growth.signals.regression.length} slipping
        </p>
      </div>
      <SaveSnapshotButton chapterId={chapterId} />
    </CardV2>
  );
}
