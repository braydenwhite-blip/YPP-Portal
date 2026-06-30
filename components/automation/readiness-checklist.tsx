// ReadinessChecklist — the chapter launch checklist (not a score). Read-only.

import { CardV2, StatusBadge, Checklist, type ChecklistItem } from "@/components/ui-v2";
import type { ChapterReadiness } from "@/lib/automation/readiness";

export function ReadinessChecklist({ readiness }: { readiness: ChapterReadiness }) {
  return (
    <CardV2 padding="md" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-[15px] font-bold text-ink">Launch readiness</h2>
        <StatusBadge tone={readiness.ready ? "success" : readiness.blockingGaps.length > 0 ? "danger" : "warning"}>
          {readiness.ready ? "Ready" : `${readiness.blockingGaps.length} blocking`}
        </StatusBadge>
      </div>

      {readiness.daysUntilLaunch != null && (
        <p className="m-0 text-[12.5px] text-ink-muted">
          {readiness.daysUntilLaunch <= 0
            ? "Launch date has arrived."
            : `Launch in ${readiness.daysUntilLaunch} day${readiness.daysUntilLaunch === 1 ? "" : "s"}.`}{" "}
          {readiness.readyAreas}/{readiness.totalAreas} areas ready.
        </p>
      )}

      {readiness.launchRiskReasons.length > 0 && (
        <div className="rounded-[12px] border border-blocked-700/30 bg-blocked-50 px-3 py-2">
          <p className="m-0 text-[12.5px] font-semibold text-blocked-700">Launch risk</p>
          <ul className="m-0 mt-1 list-disc pl-4 text-[12px] text-ink">
            {readiness.launchRiskReasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {readiness.areas.map((area) => {
          const items: ChecklistItem[] = area.items.map((i) => ({
            label: i.label,
            done: i.done,
            detail: i.detail,
          }));
          return (
            <div key={area.key} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <h3 className="m-0 text-[13px] font-bold text-ink">{area.label}</h3>
                <span className={area.ready ? "text-[12px] font-semibold text-complete-700" : "text-[12px] text-ink-muted"}>
                  {area.done}/{area.total}
                </span>
              </div>
              <Checklist items={items} />
            </div>
          );
        })}
      </div>
    </CardV2>
  );
}
