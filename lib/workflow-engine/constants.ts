// ============================================================================
// Universal Workflow Engine — shared constants & vocabularies
// ============================================================================
//
// Pure, client-safe constant data. No Prisma, no server-only. The string
// vocabularies here (domains, assignee modes, metric keys) are validated in app
// code rather than baked into Postgres enums, mirroring the loosely-typed
// `actionType` / `relatedEntityType` convention elsewhere in the codebase so the
// vocabulary can grow without a migration.

/** Domain lanes a template can belong to. Free-text; this is the curated set
 *  the builder offers, but any string is accepted. */
export const WORKFLOW_DOMAINS = [
  "PARTNERS",
  "INSTRUCTORS",
  "VOLUNTEERS",
  "STUDENTS",
  "PROGRAMS",
  "CHAPTERS",
  "CURRICULUM",
  "MENTORSHIP",
  "EVENTS",
  "FUNDRAISING",
  "GOVERNANCE",
  "GENERAL",
] as const;
export type WorkflowDomain = (typeof WORKFLOW_DOMAINS)[number];

export const WORKFLOW_DOMAIN_LABELS: Record<string, string> = {
  PARTNERS: "Partners",
  INSTRUCTORS: "Instructors",
  VOLUNTEERS: "Volunteers",
  STUDENTS: "Students",
  PROGRAMS: "Programs",
  CHAPTERS: "Chapters",
  CURRICULUM: "Curriculum",
  MENTORSHIP: "Mentorship",
  EVENTS: "Events",
  FUNDRAISING: "Fundraising",
  GOVERNANCE: "Governance",
  GENERAL: "General",
};

export function workflowDomainLabel(domain: string | null | undefined): string {
  if (!domain) return "General";
  return WORKFLOW_DOMAIN_LABELS[domain] ?? domain;
}

/** How a step / automation resolves its owner. */
export const ASSIGNEE_MODES = ["OWNER", "ROLE", "SUBTYPE", "SUBJECT", "UNASSIGNED"] as const;
export type AssigneeMode = (typeof ASSIGNEE_MODES)[number];

export const STEP_KINDS = [
  "TASK",
  "APPROVAL",
  "MEETING",
  "DOCUMENT",
  "FORM",
  "DECISION",
  "AUTOMATED",
] as const;

export const STEP_KIND_LABELS: Record<string, string> = {
  TASK: "Task",
  APPROVAL: "Approval",
  MEETING: "Meeting",
  DOCUMENT: "Document",
  FORM: "Form",
  DECISION: "Decision",
  AUTOMATED: "Automated",
};

export const AUTOMATION_TRIGGERS = [
  "ON_INSTANCE_START",
  "ON_STAGE_ENTER",
  "ON_STAGE_EXIT",
  "ON_STEP_COMPLETE",
  "ON_INSTANCE_COMPLETE",
  "ON_OVERDUE",
  "ON_FOLLOW_UP_DUE",
] as const;

export const AUTOMATION_TRIGGER_LABELS: Record<string, string> = {
  ON_INSTANCE_START: "When the workflow starts",
  ON_STAGE_ENTER: "When a stage is entered",
  ON_STAGE_EXIT: "When a stage is exited",
  ON_STEP_COMPLETE: "When a step completes",
  ON_INSTANCE_COMPLETE: "When the workflow completes",
  ON_OVERDUE: "When the workflow is overdue",
  ON_FOLLOW_UP_DUE: "When a follow-up is due",
};

export const AUTOMATION_ACTIONS = [
  "CREATE_ACTION",
  "CREATE_MEETING",
  "SEND_NOTIFICATION",
  "CREATE_WORKFLOW_ITEM",
  "SCHEDULE_FOLLOW_UP",
  "ESCALATE",
  "ADVANCE_STAGE",
] as const;

export const AUTOMATION_ACTION_LABELS: Record<string, string> = {
  CREATE_ACTION: "Create an action item",
  CREATE_MEETING: "Schedule a meeting",
  SEND_NOTIFICATION: "Notify the owner",
  CREATE_WORKFLOW_ITEM: "Add to the assignee's home queue",
  SCHEDULE_FOLLOW_UP: "Schedule a follow-up",
  ESCALATE: "Escalate to leadership",
  ADVANCE_STAGE: "Advance the workflow",
};

/** Reusing the existing WorkflowItem home feed: the new generic WorkflowKind
 *  value the engine surfaces its actionable steps under. */
export const WORKFLOW_ENGINE_KIND = "WORKFLOW_ENGINE" as const;

/** NotificationType used for engine notifications (existing enum value). */
export const WORKFLOW_NOTIFICATION_TYPE = "SYSTEM" as const;

/** Metric keys persisted to WorkflowMetric and computed live for analytics. */
export const WORKFLOW_METRIC_KEYS = {
  COMPLETION_RATE: "completion_rate",
  ACTIVE_COUNT: "active_count",
  BLOCKED_COUNT: "blocked_count",
  OVERDUE_COUNT: "overdue_count",
  AVG_CYCLE_HOURS: "avg_cycle_hours",
  AVG_STAGE_HOURS: "avg_stage_hours",
  VELOCITY_PER_WEEK: "velocity_per_week",
} as const;

export function isWorkflowDomain(value: string): value is WorkflowDomain {
  return (WORKFLOW_DOMAINS as readonly string[]).includes(value);
}

/** StatusBadge tones (components/ui-v2/status-badge) keyed by instance status. */
export const INSTANCE_STATUS_TONE: Record<
  string,
  "neutral" | "success" | "warning" | "danger" | "info" | "brand"
> = {
  ACTIVE: "info",
  BLOCKED: "danger",
  ON_HOLD: "warning",
  COMPLETED: "success",
  CANCELLED: "neutral",
};

export const STEP_STATE_TONE: Record<
  string,
  "neutral" | "success" | "warning" | "danger" | "info" | "brand"
> = {
  PENDING: "neutral",
  IN_PROGRESS: "info",
  BLOCKED: "danger",
  COMPLETE: "success",
  SKIPPED: "neutral",
};

export const INSTANCE_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  BLOCKED: "Blocked",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};
