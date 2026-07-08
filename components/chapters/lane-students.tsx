"use client";

// The Students lane: every student community for this chapter — enrollment,
// attendance, feedback, retention — folded together with Live Classes (the
// same classes, seen from the enrollment/readiness side) so a Chapter
// President can see both without leaving the tab.

import { StatusBadge, ButtonLink } from "@/components/ui-v2";
import { LaneRecordCard } from "@/components/chapters/lane-record-card";
import { LaneNeeds } from "@/components/chapters/lane-needs";
import type { ChapterLaneView } from "@/lib/chapters/lanes";

export function LaneStudents({ chapterId, view }: { chapterId: string; view: ChapterLaneView }) {
  const liveClassesSection = view.sections.find((s) => s.title === "Live Classes");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="m-0 text-[13px] font-semibold text-ink">{view.question}</p>
          <p className="m-0 text-[12px] text-ink-muted">{view.headline}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href="/chapter/pathway-fallbacks" variant="ghost" size="sm">
            Pathway re-routing requests
          </ButtonLink>
          <ButtonLink href="/chapter/students" variant="secondary" size="sm">
            Open full student roster
          </ButtonLink>
        </div>
      </div>

      <LaneNeeds chapterId={chapterId} needs={view.needs} />

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h3 className="m-0 text-[13.5px] font-bold text-ink">Student community by class</h3>
          <StatusBadge tone="neutral">{view.totalRecords}</StatusBadge>
        </div>
        {view.records.length === 0 ? (
          <p className="m-0 text-[12.5px] text-ink-muted">{view.emptyMessage}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {view.records.map((r) => (
              <LaneRecordCard key={r.id} record={r} />
            ))}
          </div>
        )}
      </div>

      {liveClassesSection && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <h3 className="m-0 text-[13.5px] font-bold text-ink">{liveClassesSection.title}</h3>
            <StatusBadge tone="neutral">{liveClassesSection.records.length}</StatusBadge>
          </div>
          <p className="m-0 text-[12px] text-ink-muted">{liveClassesSection.question}</p>
          {liveClassesSection.records.length === 0 ? (
            <p className="m-0 text-[12.5px] text-ink-muted">{liveClassesSection.emptyMessage}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {liveClassesSection.records.map((r) => (
                <LaneRecordCard key={r.id} record={r} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
