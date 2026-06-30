// AutomationPriorityStrip — the "what matters today" headline. The top few
// highest-urgency items, plus a one-line count summary. Read-only server
// component; embeddable anywhere (chapter home, leadership cockpit).

import { CardV2, StatusBadge } from "@/components/ui-v2";
import type { AutomationItem } from "@/lib/automation/types";
import { severityTone, SEVERITY_LABEL } from "./severity";

export function AutomationPriorityStrip({
  items,
  counts,
  title = "What matters today",
  max = 3,
}: {
  items: AutomationItem[];
  counts?: { blocking: number; urgent: number; attention: number; info: number };
  title?: string;
  max?: number;
}) {
  const top = items.slice(0, max);
  return (
    <CardV2 padding="md" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-[15px] font-bold text-ink">{title}</h2>
        {counts && (
          <div className="flex flex-wrap items-center gap-1.5">
            {counts.blocking > 0 && <StatusBadge tone="danger">{counts.blocking} blocking</StatusBadge>}
            {counts.urgent > 0 && <StatusBadge tone="warning">{counts.urgent} urgent</StatusBadge>}
            {counts.attention > 0 && <StatusBadge tone="info">{counts.attention} attention</StatusBadge>}
          </div>
        )}
      </div>

      {top.length === 0 ? (
        <p className="m-0 text-[13px] text-ink-muted">You're all caught up — nothing urgent right now.</p>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {top.map((item, idx) => (
            <li key={item.id} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700">
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={severityTone(item.severity)}>{SEVERITY_LABEL[item.severity]}</StatusBadge>
                  <a href={item.primaryActionHref} className="text-[13.5px] font-bold text-ink hover:underline">
                    {item.title}
                  </a>
                </div>
                <p className="m-0 mt-0.5 text-[12px] leading-snug text-ink-muted">{item.why}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </CardV2>
  );
}
