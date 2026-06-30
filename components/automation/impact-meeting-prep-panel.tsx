// ImpactMeetingPrepPanel — structured evidence for the weekly Chapter Impact
// Meeting: the week's numbers, what's below target, top blockers, and the one
// honest-answer prompt. Reuses the existing deterministic prep. Read-only.

import { CardV2, StatusBadge } from "@/components/ui-v2";
import type { ChapterImpactPrep } from "@/lib/automation/impact-meeting-prep";

export function ImpactMeetingPrepPanel({ impact }: { impact: ChapterImpactPrep }) {
  const { prep, missingNumbers, topBlockers, honestAnswerPrompt } = impact;
  return (
    <CardV2 padding="md" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="m-0 text-[11.5px] font-semibold uppercase tracking-wide text-ink-muted">
            {prep.weekLabel} · {prep.focus}
          </p>
          <h2 className="m-0 text-[15px] font-bold text-ink">Impact meeting prep — Week {prep.weekNumber}</h2>
        </div>
        {missingNumbers.length > 0 && (
          <StatusBadge tone="warning">{missingNumbers.length} below target</StatusBadge>
        )}
      </div>

      {prep.groups.map((group) => (
        <div key={group.title} className="flex flex-col gap-1.5">
          <h3 className="m-0 text-[12px] font-bold uppercase tracking-wide text-ink-muted">{group.title}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {group.metrics.map((m) => (
              <div
                key={m.label}
                className={`rounded-[10px] border px-2.5 py-2 ${
                  m.attention ? "border-progress-700/30 bg-progress-50" : "border-line bg-surface"
                }`}
              >
                <p className="m-0 text-[18px] font-bold leading-none text-ink">{m.value}</p>
                <p className="m-0 mt-1 text-[11.5px] leading-tight text-ink-muted">{m.label}</p>
                {m.detail && <p className="m-0 text-[10.5px] text-ink-muted">{m.detail}</p>}
              </div>
            ))}
          </div>
        </div>
      ))}

      {topBlockers.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="m-0 text-[12px] font-bold uppercase tracking-wide text-ink-muted">Top blockers to raise</h3>
          <ul className="m-0 list-disc pl-4 text-[12.5px] text-ink">
            {topBlockers.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-[12px] border border-brand-200 bg-brand-50 px-3 py-2.5">
        <p className="m-0 text-[12px] font-bold uppercase tracking-wide text-brand-700">Honest answer</p>
        <p className="m-0 mt-0.5 text-[13px] font-semibold text-brand-900">{honestAnswerPrompt}</p>
      </div>
    </CardV2>
  );
}
