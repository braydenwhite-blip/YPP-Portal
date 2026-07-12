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
import type { loadChapterInstructorOperations } from "@/lib/chapters/operations";

type InstructorOperations = Awaited<ReturnType<typeof loadChapterInstructorOperations>>;

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

export function LaneInstructors({ chapterId, view, operations }: { chapterId: string; view: ChapterLaneView; operations?: InstructorOperations }) {
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

      {operations && <section className="space-y-4"><div><h3 className="m-0 text-[13.5px] font-bold text-ink">Recruitment funnel</h3><p className="m-0 text-[12px] text-ink-muted">Each count comes from the current application status.</p></div><div className="flex flex-wrap border-y border-slate-200">{operations.pipeline.map((stage) => <a key={stage.status} href={stage.href} className="min-w-[118px] flex-1 px-3 py-3 no-underline hover:bg-slate-50"><p className="text-[11px] uppercase tracking-wide text-slate-500">{stage.label}</p><p className="mt-1 text-xl font-semibold tabular-nums text-slate-950">{stage.count}</p></a>)}</div></section>}

      {operations && <section><div><h3 className="m-0 text-[13.5px] font-bold text-ink">Instructor workload</h3><p className="m-0 text-[12px] text-ink-muted">Assignments are compared with each instructor’s stated concurrent-class limit.</p></div>{operations.workload.length ? <div className="mt-3 overflow-x-auto"><table className="w-full border-y border-slate-200 text-left text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Instructor</th><th className="px-3 py-2 text-right">Assigned / limit</th><th className="px-3 py-2 text-right">Sessions led</th><th className="px-3 py-2 text-right">Upcoming</th><th className="px-3 py-2 text-right">Open follow-ups</th></tr></thead><tbody>{operations.workload.map((row) => <tr key={row.id} className="border-t border-slate-100"><td className="px-3 py-2"><a href={row.href} className="font-medium text-brand-700">{row.name}</a>{row.assignedClasses > row.maxConcurrent && <p className="text-[11px] font-medium text-amber-700">Above stated limit</p>}</td><td className="px-3 py-2 text-right tabular-nums">{row.assignedClasses} / {row.maxConcurrent}</td><td className="px-3 py-2 text-right tabular-nums">{row.sessionsLed}</td><td className="px-3 py-2 text-right tabular-nums">{row.upcomingSessions}</td><td className="px-3 py-2 text-right tabular-nums">{row.openFollowUps}</td></tr>)}</tbody></table></div> : <p className="mt-3 text-[12.5px] text-ink-muted">No approved instructors are assigned to this chapter yet.</p>}</section>}

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
