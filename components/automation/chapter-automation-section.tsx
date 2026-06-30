// ChapterAutomationSection — the embeddable composition for the Chapter
// President home: the chapter's stage, today's priorities, the playbook, the
// launch readiness checklist, the working set, and the impact-meeting prep.
// Read-only server component. The data comes from `loadChapterAutomations`.

import { CardV2, StatusBadge } from "@/components/ui-v2";
import type { ChapterAutomation } from "@/lib/automation/assemble";
import { AutomationPriorityStrip } from "./automation-priority-strip";
import { PlaybookProgressPanel } from "./playbook-progress-panel";
import { ReadinessChecklist } from "./readiness-checklist";
import { TodayWorkPanel } from "./today-work-panel";
import { ImpactMeetingPrepPanel } from "./impact-meeting-prep-panel";
import { EscalationPanel } from "./escalation-panel";

export function ChapterAutomationSection({
  automation,
  showEscalations = false,
}: {
  automation: ChapterAutomation;
  /** Leadership view also sees the escalation panel. */
  showEscalations?: boolean;
}) {
  const { stages, playbook, readiness, impactPrep, topPriorities, counts, overdue, thisWeek, escalations } = automation;

  return (
    <section className="flex flex-col gap-4" aria-label="Automation">
      {/* Stage header */}
      <CardV2 padding="md" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="m-0 text-[11.5px] font-semibold uppercase tracking-wide text-ink-muted">Operating stage</p>
            <h2 className="m-0 text-[16px] font-bold text-ink">{stages.primaryStageLabel}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {stages.activeStages.slice(0, 4).map((s) => (
              <StatusBadge key={s} tone="brand">
                {s.replace(/_/g, " ").toLowerCase()}
              </StatusBadge>
            ))}
          </div>
        </div>
        {stages.blockingGaps.length > 0 && (
          <ul className="m-0 mt-1 list-disc pl-4 text-[12.5px] text-blocked-700">
            {stages.blockingGaps.slice(0, 3).map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        )}
      </CardV2>

      <AutomationPriorityStrip items={topPriorities} counts={counts} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PlaybookProgressPanel playbook={playbook} />
        <ReadinessChecklist readiness={readiness} />
      </div>

      <TodayWorkPanel overdue={overdue} thisWeek={thisWeek} weekNumber={automation.weekNumber} />

      <ImpactMeetingPrepPanel impact={impactPrep} />

      {showEscalations && escalations.length > 0 && <EscalationPanel escalations={escalations} />}
    </section>
  );
}
