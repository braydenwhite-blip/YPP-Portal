"use client";

// The Partners lane: every partner relationship for this chapter, who owns
// it, its concrete status, the single next step, and what it's connected to.

import { StatusBadge, ButtonLink } from "@/components/ui-v2";
import { LaneRecordCard } from "@/components/chapters/lane-record-card";
import { LaneNeeds } from "@/components/chapters/lane-needs";
import { LogFollowUpControl } from "@/components/chapters/lane-controls";
import type { ChapterLaneView } from "@/lib/chapters/lanes";
import type { loadChapterPartnerOperations } from "@/lib/chapters/operations";

type PartnerOperations = Awaited<ReturnType<typeof loadChapterPartnerOperations>>;

export function LanePartners({ chapterId, view, operations }: { chapterId: string; view: ChapterLaneView; operations?: PartnerOperations }) {
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

      {operations && <div className="grid gap-5 lg:grid-cols-2"><section><h3 className="m-0 text-[13.5px] font-bold text-ink">Partner pipeline</h3><p className="m-0 text-[12px] text-ink-muted">Current relationship stage from each partner record.</p><div className="mt-3 flex flex-wrap border-y border-slate-200">{operations.pipeline.map((row) => <a key={row.stage} href={row.href} className="min-w-[112px] flex-1 px-3 py-3 no-underline hover:bg-slate-50"><p className="text-[11px] uppercase tracking-wide text-slate-500">{row.label}</p><p className="mt-1 text-xl font-semibold tabular-nums text-slate-950">{row.count}</p></a>)}</div></section><section><h3 className="m-0 text-[13.5px] font-bold text-ink">Agreement pipeline</h3><p className="m-0 text-[12px] text-ink-muted">Derived from the agreements already attached to partner records.</p><div className="mt-3 flex flex-wrap border-y border-slate-200">{operations.agreementStages.map((row) => <a key={row.stage} href="/partners" className="min-w-[112px] flex-1 px-3 py-3 no-underline hover:bg-slate-50"><p className="text-[11px] uppercase tracking-wide text-slate-500">{row.label}</p><p className="mt-1 text-xl font-semibold tabular-nums text-slate-950">{row.count}</p></a>)}</div></section></div>}

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
