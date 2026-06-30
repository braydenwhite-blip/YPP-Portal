// PlaybookProgressPanel — "where are you in the 12-week playbook, and what's
// missing?" Operational, not a score. Read-only server component.

import { CardV2, StatusBadge, Checklist, type ChecklistItem, type StatusTone } from "@/components/ui-v2";
import type { PlaybookInterpretation } from "@/lib/automation/playbook";

const PACE_TONE: Record<PlaybookInterpretation["paceLabel"], StatusTone> = {
  "On pace": "success",
  "Slightly behind": "warning",
  Behind: "danger",
};

export function PlaybookProgressPanel({ playbook }: { playbook: PlaybookInterpretation }) {
  const expectedItems: ChecklistItem[] = playbook.expected.map((e) => ({
    label: e.label,
    done: e.done,
    detail: e.overdue ? `Overdue (due by Week ${e.dueByWeek}) — ${e.evidence}` : e.evidence,
  }));

  return (
    <CardV2 padding="md" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="m-0 text-[11.5px] font-semibold uppercase tracking-wide text-ink-muted">
            {playbook.currentWindow.label} · {playbook.currentWindow.focus}
          </p>
          <h2 className="m-0 text-[15px] font-bold text-ink">Playbook — Week {playbook.weekNumber}</h2>
        </div>
        <StatusBadge tone={PACE_TONE[playbook.paceLabel]}>{playbook.paceLabel}</StatusBadge>
      </div>

      <div className="rounded-[12px] border border-brand-200 bg-brand-50 px-3 py-2.5">
        <p className="m-0 text-[13px] font-semibold leading-snug text-brand-900">
          {playbook.recommendedNextAction}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-[12px] text-ink-muted">
        <span>{playbook.completed.length} done</span>
        <span>·</span>
        <span>{playbook.missing.length} this window</span>
        <span>·</span>
        <span className={playbook.overdue.length > 0 ? "font-semibold text-blocked-700" : ""}>
          {playbook.overdue.length} overdue
        </span>
        {playbook.confidence !== "high" && (
          <>
            <span>·</span>
            <span title="The chapter's launch cycle isn't fully dated, so the week is an estimate.">
              {playbook.confidence} confidence
            </span>
          </>
        )}
      </div>

      <Checklist items={expectedItems} />

      {playbook.kpiTargets.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-line pt-3">
          <p className="m-0 text-[12px] font-bold uppercase tracking-wide text-ink-muted">This week's targets</p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {playbook.kpiTargets.map((t) => (
              <li key={t.key} className="flex items-center justify-between gap-2 text-[12.5px]">
                <span className="text-ink">{t.label}</span>
                <span className={t.met ? "font-semibold text-complete-700" : "font-semibold text-progress-700"}>
                  {t.current}/{t.target}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </CardV2>
  );
}
