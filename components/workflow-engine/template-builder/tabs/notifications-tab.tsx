"use client";

import { CardV2 } from "@/components/ui-v2/card";
import type { WorkflowTemplateDefinition } from "@/lib/workflow-engine/types";
import { AutomationRuleRow } from "./automations-tab";

export function NotificationsTab({
  template,
  pending,
  run,
}: {
  template: WorkflowTemplateDefinition;
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const rules = template.automationRules
    .filter((r) => r.action === "SEND_NOTIFICATION" || r.action === "ESCALATE")
    .sort((a, b) => a.order - b.order);

  function scopeLabel(stageKey: string | null): string {
    if (!stageKey) return "Whole workflow";
    const stage = template.stages.find((s) => s.key === stageKey);
    return stage ? stage.name : stageKey;
  }

  return (
    <CardV2 padding="lg" className="flex flex-col gap-3">
      <p className="text-[12px] text-ink-muted">
        These are the same underlying automation rules, filtered to notifications and escalations.
        Edit trigger, action, or title from the Automations tab.
      </p>
      <ul className="flex flex-col gap-1.5">
        {rules.map((r) => (
          <AutomationRuleRow key={r.id} rule={r} scopeLabel={scopeLabel(r.stageKey)} pending={pending} run={run} />
        ))}
        {rules.length === 0 ? (
          <li className="text-[12px] text-ink-muted">No notification or escalation rules yet.</li>
        ) : null}
      </ul>
    </CardV2>
  );
}
