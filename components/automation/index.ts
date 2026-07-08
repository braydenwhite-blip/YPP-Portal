// Barrel for the embeddable Automation Brain components. These are read-only,
// presentational, and bind only to the canonical automation read-model types —
// so any surface (chapter home, partner/instructor workspace, class detail,
// impact meeting page, leadership dashboard) can compose them.

export { AutomationItemCard } from "./automation-item-card";
export { AutomationItemList } from "./automation-item-list";
export { AutomationPriorityStrip } from "./automation-priority-strip";
export { TodayWorkPanel } from "./today-work-panel";
export { PlaybookProgressPanel } from "./playbook-progress-panel";
export { ReadinessChecklist } from "./readiness-checklist";
export { ImpactMeetingPrepPanel } from "./impact-meeting-prep-panel";
export { EscalationPanel } from "./escalation-panel";
export { ChapterAutomationSection } from "./chapter-automation-section";
export { severityTone, SEVERITY_LABEL, workflowLabel } from "./severity";
