"use client";

// The Students lane: every student community for this chapter — enrollment,
// attendance, feedback, retention — folded together with Live Classes (the
// same classes, seen from the enrollment/readiness side) so a Chapter
// President can see both without leaving the tab.

import { StatusBadge, ButtonLink } from "@/components/ui-v2";
import { LaneRecordCard } from "@/components/chapters/lane-record-card";
import { LaneNeeds } from "@/components/chapters/lane-needs";
import type { ChapterLaneView } from "@/lib/chapters/lanes";
import type { loadChapterStudentOperations } from "@/lib/chapters/operations";

type StudentOperations = Awaited<ReturnType<typeof loadChapterStudentOperations>>;

export function LaneStudents({ chapterId, view, operations }: { chapterId: string; view: ChapterLaneView; operations?: StudentOperations }) {
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

      {operations && <section><div className="grid grid-cols-3 border-y border-slate-200"><div className="px-3 py-3"><p className="text-[11px] uppercase tracking-wide text-slate-500">Total students</p><p className="mt-1 text-xl font-semibold tabular-nums text-slate-950">{operations.totalStudents}</p></div><div className="border-l border-slate-200 px-3 py-3"><p className="text-[11px] uppercase tracking-wide text-slate-500">Active / enrolled</p><p className="mt-1 text-xl font-semibold tabular-nums text-slate-950">{operations.activeStudents}</p></div><div className="border-l border-slate-200 px-3 py-3"><p className="text-[11px] uppercase tracking-wide text-slate-500">Current active-rate proxy</p><p className="mt-1 text-xl font-semibold tabular-nums text-slate-950">{operations.activeRateProxy}%</p></div></div><div className="mt-4 overflow-x-auto"><table className="w-full border-y border-slate-200 text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2 text-left">Cohort month</th><th className="px-3 py-2 text-right">Students added</th><th className="px-3 py-2 text-right">Currently active</th></tr></thead><tbody>{operations.cohorts.map((row) => <tr key={row.month} className="border-t border-slate-100"><td className="px-3 py-2">{row.month}</td><td className="px-3 py-2 text-right tabular-nums">{row.studentsAdded}</td><td className="px-3 py-2 text-right tabular-nums">{row.currentlyActive}</td></tr>)}</tbody></table></div><p className="mt-2 text-[11.5px] text-slate-500">This is a current-status cohort proxy. True retention requires historical student-status snapshots; this view does not claim otherwise.</p></section>}

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
