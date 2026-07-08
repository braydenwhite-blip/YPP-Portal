"use client";

// The Instructors lane: who's teaching, helping, applying, or waiting on
// onboarding, folded together with Curriculum (instructor-authored content
// moving through the CP/global review chain) and Live Classes (which depend
// on both an instructor and approved curriculum).

import { StatusBadge, ButtonLink } from "@/components/ui-v2";
import { LaneRecordCard } from "@/components/chapters/lane-record-card";
import { LaneNeeds } from "@/components/chapters/lane-needs";
import { CurriculumOneClickControl, CurriculumRevisionControl } from "@/components/chapters/lane-controls";
import type { ChapterLaneView, LaneRecord } from "@/lib/chapters/lanes";

function CurriculumAction({ chapterId, record }: { chapterId: string; record: LaneRecord }) {
  if (!record.curriculumOneClickStep && !record.curriculumCanRequestRevision) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {record.curriculumOneClickStep && (
        <CurriculumOneClickControl chapterId={chapterId} classTemplateId={record.id} step={record.curriculumOneClickStep} />
      )}
      {record.curriculumCanRequestRevision && <CurriculumRevisionControl chapterId={chapterId} classTemplateId={record.id} />}
    </div>
  );
}

function SectionBlock({ chapterId, title, question, records, emptyMessage, curriculum }: { chapterId: string; title: string; question?: string; records: LaneRecord[]; emptyMessage: string; curriculum?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h3 className="m-0 text-[13.5px] font-bold text-ink">{title}</h3>
        <StatusBadge tone="neutral">{records.length}</StatusBadge>
      </div>
      {question && <p className="m-0 text-[12px] text-ink-muted">{question}</p>}
      {records.length === 0 ? (
        <p className="m-0 text-[12.5px] text-ink-muted">{emptyMessage}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {records.map((r) => (
            <LaneRecordCard key={r.id} record={r} action={curriculum ? <CurriculumAction chapterId={chapterId} record={r} /> : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}

export function LaneInstructors({ chapterId, view }: { chapterId: string; view: ChapterLaneView }) {
  const curriculumSection = view.sections.find((s) => s.title === "Curriculum");
  const liveClassesSection = view.sections.find((s) => s.title === "Live Classes");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="m-0 text-[13px] font-semibold text-ink">{view.question}</p>
          <p className="m-0 text-[12px] text-ink-muted">{view.headline}</p>
        </div>
        <ButtonLink href="/chapter/recruiting?tab=candidates" variant="secondary" size="sm">
          Open full recruiting pipeline
        </ButtonLink>
      </div>

      <LaneNeeds chapterId={chapterId} needs={view.needs} />

      <SectionBlock chapterId={chapterId} title="Instructors & applicants" records={view.records} emptyMessage={view.emptyMessage} />
      {curriculumSection && (
        <SectionBlock chapterId={chapterId} title={curriculumSection.title} question={curriculumSection.question} records={curriculumSection.records} emptyMessage={curriculumSection.emptyMessage} curriculum />
      )}
      {liveClassesSection && (
        <SectionBlock chapterId={chapterId} title={liveClassesSection.title} question={liveClassesSection.question} records={liveClassesSection.records} emptyMessage={liveClassesSection.emptyMessage} />
      )}
    </div>
  );
}
