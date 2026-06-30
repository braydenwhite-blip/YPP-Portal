// Shared visual mappings for automation components → DS 2.0 tones. Keeping this
// in one place means every automation surface reads severity the same way.

import type { StatusTone } from "@/components/ui-v2";
import type { AutomationSeverity, AutomationWorkflow } from "@/lib/automation/types";
import { WORKFLOW_LABELS } from "@/lib/automation/types";

export function severityTone(s: AutomationSeverity): StatusTone {
  switch (s) {
    case "BLOCKING":
      return "danger";
    case "URGENT":
      return "warning";
    case "ATTENTION":
      return "info";
    case "INFO":
    default:
      return "neutral";
  }
}

export const SEVERITY_LABEL: Record<AutomationSeverity, string> = {
  BLOCKING: "Blocking",
  URGENT: "Urgent",
  ATTENTION: "Attention",
  INFO: "Info",
};

export function workflowLabel(w: AutomationWorkflow): string {
  return WORKFLOW_LABELS[w];
}
