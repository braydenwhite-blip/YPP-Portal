// WorkflowAutomationCard — a single workflow lane (e.g. Partners) with its items
// and a one-line description of the workflow. Read-only. Useful in a per-domain
// workspace (the partner pass can embed the PARTNERS lane).

import { CardV2, StatusBadge } from "@/components/ui-v2";
import type { AutomationItem, AutomationWorkflow } from "@/lib/automation/types";
import { WORKFLOW_LABELS } from "@/lib/automation/types";
import { recipesForWorkflow } from "@/lib/automation/workflows";
import { AutomationItemList } from "./automation-item-list";

export function WorkflowAutomationCard({
  workflow,
  items,
  limit = 5,
}: {
  workflow: AutomationWorkflow;
  items: AutomationItem[];
  limit?: number;
}) {
  const recipes = recipesForWorkflow(workflow);
  const description = recipes[0]?.description ?? "";
  return (
    <CardV2 padding="md" className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="m-0 text-[15px] font-bold text-ink">{WORKFLOW_LABELS[workflow]}</h2>
          {description && <p className="m-0 text-[12px] text-ink-muted">{description}</p>}
        </div>
        <StatusBadge tone={items.length > 0 ? "warning" : "success"}>
          {items.length > 0 ? `${items.length} open` : "Clear"}
        </StatusBadge>
      </div>
      <AutomationItemList
        items={items}
        compact
        limit={limit}
        emptyTitle="Nothing in this workflow"
        emptyBody="No automation items in this lane right now."
      />
    </CardV2>
  );
}
