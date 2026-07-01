/**
 * Data 360 — workflow analytics (pure core).
 *
 * The activation layer already computes workflow *health* per instance
 * (`lib/workflow-engine/health.ts`) and *portfolio* rollups
 * (`lib/workflow-engine/analytics.ts`). This module turns a set of
 * already-loaded, health-scored instances into the operating-intelligence
 * breakdowns Data 360 needs: by chapter, by entity type, by template, by
 * health, plus step / linked-action / linked-meeting / attachment rollups.
 *
 * Everything here is pure and deterministic (no Prisma, no server-only) so it
 * is unit-testable and reused by the server loader in
 * `lib/data-360/workflow-analytics.ts`. It does NOT recompute health — it reads
 * the concrete `WorkflowHealthStatus` the engine already produced.
 */

import type { WorkflowHealthStatus } from "@/lib/workflow-engine/health";
import { workflowEntityTypeLabel } from "@/lib/workflow-engine/entity-types";
import type { WorkflowInstanceStatusValue } from "@/lib/workflow-engine/types";

/** The order health statuses are shown in — worst-first, matching the engine. */
export const WORKFLOW_HEALTH_ORDER: WorkflowHealthStatus[] = [
  "BLOCKED",
  "OVERDUE",
  "STALLED",
  "NEEDS_ATTENTION",
  "ON_TRACK",
  "COMPLETE",
  "ARCHIVED",
];

export const WORKFLOW_HEALTH_LABELS: Record<WorkflowHealthStatus, string> = {
  BLOCKED: "Blocked",
  OVERDUE: "Overdue",
  STALLED: "Stalled",
  NEEDS_ATTENTION: "Needs attention",
  ON_TRACK: "On track",
  COMPLETE: "Complete",
  ARCHIVED: "Archived",
};

/** Cosmetic tone (Data 360 MetricTone vocabulary) for a health status. */
export function workflowHealthTone(
  status: WorkflowHealthStatus
): "positive" | "warning" | "danger" | "muted" | "accent" {
  switch (status) {
    case "ON_TRACK":
      return "positive";
    case "NEEDS_ATTENTION":
      return "warning";
    case "BLOCKED":
    case "OVERDUE":
      return "danger";
    case "STALLED":
      return "accent";
    case "COMPLETE":
    case "ARCHIVED":
    default:
      return "muted";
  }
}

export type WorkflowStepCounts = {
  total: number;
  complete: number;
  blocked: number;
  overdue: number;
  pending: number;
};

/** One instance, already health-scored, in the shape the analytics read from. */
export type WorkflowAnalyticsInstance = {
  id: string;
  title: string;
  status: WorkflowInstanceStatusValue;
  health: WorkflowHealthStatus;
  healthReasons: string[];
  chapterId: string | null;
  chapterName: string | null;
  entityType: string | null;
  entityId: string | null;
  templateId: string;
  templateName: string;
  templateKey: string | null;
  ownerId: string | null;
  ownerName: string | null;
  startedAtISO: string;
  dueAtISO: string | null;
  currentStageName: string | null;
  completionPercent: number;
  ageDays: number;
  nextStepTitle: string | null;
  nextStepDueISO: string | null;
  stepCounts: WorkflowStepCounts;
  linkedActionCount: number;
  linkedMeetingCount: number;
  attachmentCount: number;
};

const ACTIVE_HEALTHS: WorkflowHealthStatus[] = [
  "BLOCKED",
  "OVERDUE",
  "STALLED",
  "NEEDS_ATTENTION",
  "ON_TRACK",
];

export function isActiveHealth(status: WorkflowHealthStatus): boolean {
  return ACTIVE_HEALTHS.includes(status);
}

// --- health distribution -----------------------------------------------------

export type WorkflowHealthDistribution = {
  total: number;
  counts: Record<WorkflowHealthStatus, number>;
  /** attention = anything not ON_TRACK/COMPLETE/ARCHIVED */
  needsAttention: number;
};

export function buildWorkflowHealthDistribution(
  instances: WorkflowAnalyticsInstance[]
): WorkflowHealthDistribution {
  const counts: Record<WorkflowHealthStatus, number> = {
    BLOCKED: 0,
    OVERDUE: 0,
    STALLED: 0,
    NEEDS_ATTENTION: 0,
    ON_TRACK: 0,
    COMPLETE: 0,
    ARCHIVED: 0,
  };
  for (const i of instances) counts[i.health] += 1;
  const needsAttention =
    counts.BLOCKED + counts.OVERDUE + counts.STALLED + counts.NEEDS_ATTENTION;
  return { total: instances.length, counts, needsAttention };
}

// --- step rollup -------------------------------------------------------------

export function buildWorkflowStepAnalytics(
  instances: WorkflowAnalyticsInstance[]
): WorkflowStepCounts {
  return instances.reduce<WorkflowStepCounts>(
    (acc, i) => ({
      total: acc.total + i.stepCounts.total,
      complete: acc.complete + i.stepCounts.complete,
      blocked: acc.blocked + i.stepCounts.blocked,
      overdue: acc.overdue + i.stepCounts.overdue,
      pending: acc.pending + i.stepCounts.pending,
    }),
    { total: 0, complete: 0, blocked: 0, overdue: 0, pending: 0 }
  );
}

// --- linked work + attachments ----------------------------------------------

export type WorkflowLinkedWorkSummary = {
  actionsCreated: number;
  meetingsCreated: number;
  workflowsWithActions: number;
  workflowsWithMeetings: number;
  workflowsWithAttachments: number;
  attachmentsTotal: number;
};

export function buildWorkflowLinkedWorkSummary(
  instances: WorkflowAnalyticsInstance[]
): WorkflowLinkedWorkSummary {
  let actionsCreated = 0;
  let meetingsCreated = 0;
  let workflowsWithActions = 0;
  let workflowsWithMeetings = 0;
  let workflowsWithAttachments = 0;
  let attachmentsTotal = 0;
  for (const i of instances) {
    actionsCreated += i.linkedActionCount;
    meetingsCreated += i.linkedMeetingCount;
    attachmentsTotal += i.attachmentCount;
    if (i.linkedActionCount > 0) workflowsWithActions += 1;
    if (i.linkedMeetingCount > 0) workflowsWithMeetings += 1;
    if (i.attachmentCount > 0) workflowsWithAttachments += 1;
  }
  return {
    actionsCreated,
    meetingsCreated,
    workflowsWithActions,
    workflowsWithMeetings,
    workflowsWithAttachments,
    attachmentsTotal,
  };
}

// --- generic grouping --------------------------------------------------------

export type WorkflowGroupRow = {
  key: string;
  label: string;
  total: number;
  active: number;
  blocked: number;
  overdue: number;
  stalled: number;
  needsAttention: number;
  onTrack: number;
  actionsCreated: number;
  meetingsCreated: number;
  averageAgeDays: number;
  href: string | null;
};

function emptyGroupAccumulator(): Omit<WorkflowGroupRow, "key" | "label" | "href" | "averageAgeDays"> & {
  ageSum: number;
} {
  return {
    total: 0,
    active: 0,
    blocked: 0,
    overdue: 0,
    stalled: 0,
    needsAttention: 0,
    onTrack: 0,
    actionsCreated: 0,
    meetingsCreated: 0,
    ageSum: 0,
  };
}

function accumulate(
  acc: ReturnType<typeof emptyGroupAccumulator>,
  i: WorkflowAnalyticsInstance
): void {
  acc.total += 1;
  if (isActiveHealth(i.health)) acc.active += 1;
  if (i.health === "BLOCKED") acc.blocked += 1;
  if (i.health === "OVERDUE") acc.overdue += 1;
  if (i.health === "STALLED") acc.stalled += 1;
  if (i.health === "NEEDS_ATTENTION") acc.needsAttention += 1;
  if (i.health === "ON_TRACK") acc.onTrack += 1;
  acc.actionsCreated += i.linkedActionCount;
  acc.meetingsCreated += i.linkedMeetingCount;
  acc.ageSum += i.ageDays;
}

function finalizeGroup(
  key: string,
  label: string,
  acc: ReturnType<typeof emptyGroupAccumulator>,
  href: string | null
): WorkflowGroupRow {
  const { ageSum, ...rest } = acc;
  return {
    key,
    label,
    ...rest,
    averageAgeDays: rest.total > 0 ? Math.round(ageSum / rest.total) : 0,
    href,
  };
}

/**
 * Group instances by chapter. Instances with no chapterId are collected under
 * an "unassigned" row (honest — WorkflowInstance.chapterId is optional).
 */
export function groupWorkflowsByChapter(
  instances: WorkflowAnalyticsInstance[]
): WorkflowGroupRow[] {
  const groups = new Map<string, ReturnType<typeof emptyGroupAccumulator>>();
  const labels = new Map<string, string>();
  for (const i of instances) {
    const key = i.chapterId ?? "__unassigned__";
    labels.set(key, i.chapterId ? i.chapterName ?? "Chapter" : "No chapter");
    const acc = groups.get(key) ?? emptyGroupAccumulator();
    accumulate(acc, i);
    groups.set(key, acc);
  }
  return Array.from(groups.entries())
    .map(([key, acc]) =>
      finalizeGroup(
        key,
        labels.get(key) ?? "Chapter",
        acc,
        key === "__unassigned__"
          ? "/workflows"
          : workflowData360DrilldownHref({ chapterId: key })
      )
    )
    .sort((a, b) => b.total - a.total);
}

export function groupWorkflowsByEntityType(
  instances: WorkflowAnalyticsInstance[]
): WorkflowGroupRow[] {
  const groups = new Map<string, ReturnType<typeof emptyGroupAccumulator>>();
  for (const i of instances) {
    const key = i.entityType ?? "__none__";
    const acc = groups.get(key) ?? emptyGroupAccumulator();
    accumulate(acc, i);
    groups.set(key, acc);
  }
  return Array.from(groups.entries())
    .map(([key, acc]) =>
      finalizeGroup(
        key,
        key === "__none__" ? "Unattached" : workflowEntityTypeLabel(key),
        acc,
        key === "__none__" ? null : workflowData360DrilldownHref({ entityType: key })
      )
    )
    .sort((a, b) => b.total - a.total);
}

export type WorkflowTemplateRow = WorkflowGroupRow & {
  completed: number;
  chaptersUsing: number;
  entityTypes: string[];
};

/**
 * Group by template. Adds template-specific fields (completed count, distinct
 * chapters, source entity types) for the Workflow Template Analytics panel.
 */
export function groupWorkflowsByTemplate(
  instances: WorkflowAnalyticsInstance[]
): WorkflowTemplateRow[] {
  const groups = new Map<
    string,
    {
      acc: ReturnType<typeof emptyGroupAccumulator>;
      label: string;
      completed: number;
      chapters: Set<string>;
      entityTypes: Set<string>;
    }
  >();
  for (const i of instances) {
    const key = i.templateId;
    const g =
      groups.get(key) ??
      {
        acc: emptyGroupAccumulator(),
        label: i.templateName,
        completed: 0,
        chapters: new Set<string>(),
        entityTypes: new Set<string>(),
      };
    accumulate(g.acc, i);
    if (i.health === "COMPLETE") g.completed += 1;
    if (i.chapterId) g.chapters.add(i.chapterId);
    if (i.entityType) g.entityTypes.add(i.entityType);
    groups.set(key, g);
  }
  return Array.from(groups.entries())
    .map(([key, g]) => ({
      ...finalizeGroup(key, g.label, g.acc, workflowData360DrilldownHref({ templateId: key })),
      completed: g.completed,
      chaptersUsing: g.chapters.size,
      entityTypes: Array.from(g.entityTypes),
    }))
    .sort((a, b) => b.total - a.total);
}

// --- overview rollup ---------------------------------------------------------

export type WorkflowData360Overview = {
  total: number;
  active: number;
  health: WorkflowHealthDistribution;
  steps: WorkflowStepCounts;
  linkedWork: WorkflowLinkedWorkSummary;
  averageAgeDays: number;
  chaptersWithWorkflows: number;
};

export function buildWorkflowData360Overview(
  instances: WorkflowAnalyticsInstance[]
): WorkflowData360Overview {
  const health = buildWorkflowHealthDistribution(instances);
  const active = instances.filter((i) => isActiveHealth(i.health)).length;
  const ageSum = instances.reduce((s, i) => s + i.ageDays, 0);
  const chapters = new Set(
    instances.map((i) => i.chapterId).filter((c): c is string => !!c)
  );
  return {
    total: instances.length,
    active,
    health,
    steps: buildWorkflowStepAnalytics(instances),
    linkedWork: buildWorkflowLinkedWorkSummary(instances),
    averageAgeDays: instances.length > 0 ? Math.round(ageSum / instances.length) : 0,
    chaptersWithWorkflows: chapters.size,
  };
}

// --- drilldown href builder --------------------------------------------------

export type WorkflowDrilldownFilter = {
  status?: string;
  health?: WorkflowHealthStatus;
  chapterId?: string;
  templateId?: string;
  entityType?: string;
};

/**
 * Build a link into the filtered workflow list. Every workflow number in Data
 * 360 routes through here so there are no dead links — the `/workflows` page
 * reads these same params.
 */
export function workflowData360DrilldownHref(filter: WorkflowDrilldownFilter): string {
  const params = new URLSearchParams();
  if (filter.status) params.set("status", filter.status);
  if (filter.health) params.set("health", filter.health);
  if (filter.chapterId) params.set("chapterId", filter.chapterId);
  if (filter.templateId) params.set("templateId", filter.templateId);
  if (filter.entityType) params.set("entityType", filter.entityType);
  const qs = params.toString();
  return qs ? `/workflows?${qs}` : "/workflows";
}
