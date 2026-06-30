// One automation item, rendered as an evidence-backed card: severity + workflow,
// the plain-language title, the WHY (explainability), and the primary/secondary
// actions. Read-only server component.

import Link from "next/link";

import { CardV2, StatusBadge, ButtonLink } from "@/components/ui-v2";
import type { AutomationItem } from "@/lib/automation/types";
import { severityTone, SEVERITY_LABEL, workflowLabel } from "./severity";

export function AutomationItemCard({ item, compact = false }: { item: AutomationItem; compact?: boolean }) {
  return (
    <CardV2 padding="md" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={severityTone(item.severity)}>{SEVERITY_LABEL[item.severity]}</StatusBadge>
        <span className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-muted">
          {workflowLabel(item.workflow)}
        </span>
        {item.escalation && (
          <StatusBadge tone="brand" title={item.escalation.reason}>
            Escalated
          </StatusBadge>
        )}
      </div>

      <p className="m-0 text-[14px] font-bold text-ink">{item.title}</p>
      {!compact && <p className="m-0 text-[12.5px] leading-snug text-ink-muted">{item.why}</p>}

      <div className="mt-1 flex flex-wrap items-center gap-2">
        <ButtonLink href={item.primaryActionHref} variant="secondary" size="sm">
          {item.primaryActionLabel}
        </ButtonLink>
        {item.secondaryActionLabel && item.secondaryActionHref && (
          <Link
            href={item.secondaryActionHref}
            className="text-[12.5px] font-semibold text-brand-700 hover:underline"
          >
            {item.secondaryActionLabel}
          </Link>
        )}
        {item.resolvesWhen && !compact && (
          <span className="text-[11.5px] text-ink-muted">Resolves when: {item.resolvesWhen}</span>
        )}
      </div>
    </CardV2>
  );
}
