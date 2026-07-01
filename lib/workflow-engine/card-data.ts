// ============================================================================
// Universal Workflow Engine — entity card + preview read-side (server-only)
// ============================================================================
//
// The data-shaping layer behind entity-scoped workflow surfaces (Part 3's
// embeddable "workflow card" on an entity's detail page, Part 9's hover/side
// preview). Composes the already-built attachment + queries + health modules
// rather than re-deriving anything they already own:
//   - getPrimaryWorkflowForEntity (attachment.ts) resolves which instance to show.
//   - getInstanceDetail (queries.ts) gives instance/definition/executions/runtime/
//     templateName/ownerName/events in one call.
//   - computeWorkflowHealth (health.ts) turns that into a status + reasons.
//   - getWorkflowsForEntity (attachment.ts) gives the "+N more workflows" count.

import "server-only";

import { prisma } from "@/lib/prisma";
import {
  getPrimaryWorkflowForEntity,
  getWorkflowsForEntity,
} from "@/lib/workflow-engine/attachment";
import { getInstanceDetail } from "@/lib/workflow-engine/queries";
import { computeWorkflowHealth, type WorkflowHealth } from "@/lib/workflow-engine/health";
import { executionsForStage } from "@/lib/workflow-engine/runtime";
import type {
  StepExecutionView,
  WorkflowInstanceStatusValue,
} from "@/lib/workflow-engine/types";

// ---------------------------------------------------------------------------
// getEntityWorkflowSummary
// ---------------------------------------------------------------------------

export type EntityWorkflowNextStep = {
  executionId: string;
  title: string;
  description: string | null;
  ownerId: string | null;
  ownerName: string | null;
  dueAt: string | null;
  kind: string;
};

export type EntityWorkflowSummary = {
  instanceId: string;
  instanceTitle: string;
  templateName: string;
  status: WorkflowInstanceStatusValue;
  completionPercent: number;
  currentStageKey: string | null;
  currentStageName: string | null;
  dueAt: string | null;
  ownerId: string | null;
  ownerName: string | null;
  health: WorkflowHealth;
  nextStep: EntityWorkflowNextStep | null;
  /** Currently-BLOCKED executions in the current stage, for WorkflowBlockerList. */
  blockers: Array<{ executionId: string; title: string; blockedReason: string | null }>;
  otherActiveCount: number;
};

const ACTIVE_STATUSES = ["ACTIVE", "BLOCKED", "ON_HOLD"] as const;

/**
 * Pure selection: the step a card should surface as "what happens next" for
 * a stage — the first non-terminal REQUIRED execution, ordered by the
 * template's own step order (via `stepOrderByKey`); falls back to the first
 * non-terminal execution at all (required or not) when no required step is
 * outstanding. Extracted standalone (no Prisma) so it is trivially testable.
 */
export function pickNextStepExecution(
  stageExecutions: StepExecutionView[],
  stepOrderByKey: Map<string, number>
): StepExecutionView | null {
  const nonTerminal = stageExecutions.filter(
    (e) => e.state === "PENDING" || e.state === "IN_PROGRESS"
  );
  if (nonTerminal.length === 0) return null;

  const orderOf = (e: StepExecutionView) => stepOrderByKey.get(e.stepKey) ?? Number.MAX_SAFE_INTEGER;
  const byOrder = (a: StepExecutionView, b: StepExecutionView) => orderOf(a) - orderOf(b);

  const required = nonTerminal.filter((e) => e.isRequired).sort(byOrder);
  if (required.length > 0) return required[0];

  return [...nonTerminal].sort(byOrder)[0];
}

/**
 * Resolve the single PRIMARY workflow for an entity (if any) and shape it
 * into the compact summary an entity-scoped card needs: health + reason,
 * the concrete next step, and how many OTHER active workflows also touch
 * this entity. Returns null when no primary workflow is running — callers
 * render an empty state / "start workflow" affordance in that case.
 */
export async function getEntityWorkflowSummary(
  entityType: string,
  entityId: string
): Promise<EntityWorkflowSummary | null> {
  const primary = await getPrimaryWorkflowForEntity(entityType, entityId);
  if (!primary) return null;

  const detail = await getInstanceDetail(primary.id);
  if (!detail) return null;

  const { instance, definition, executions, runtime, templateName, ownerName } = detail;

  const currentStage = instance.currentStageKey
    ? (definition.stages.find((s) => s.key === instance.currentStageKey) ?? null)
    : null;

  const stageExecutions = currentStage
    ? executionsForStage(executions, currentStage.key)
    : [];

  let currentStageEnteredAt: string | null = null;
  if (currentStage) {
    const stageEnteredEvent = await prisma.workflowEvent.findFirst({
      where: { instanceId: instance.id, kind: "STAGE_ENTERED", toStageKey: currentStage.key },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    currentStageEnteredAt = stageEnteredEvent ? stageEnteredEvent.createdAt.toISOString() : null;
  }

  const health = computeWorkflowHealth({
    instance: {
      status: instance.status,
      dueAt: instance.dueAt,
      followUpAt: instance.followUpAt,
      escalatedAt: instance.escalatedAt,
      startedAt: instance.startedAt,
      completionPercent: instance.completionPercent,
    },
    currentStage: currentStage
      ? { key: currentStage.key, slaHours: currentStage.slaHours, name: currentStage.name }
      : null,
    currentStageEnteredAt,
    executions: stageExecutions,
    now: new Date().toISOString(),
  });

  const stepOrderByKey = new Map(
    (currentStage?.steps ?? []).map((s) => [s.key, s.order])
  );
  const nextStepExecution = pickNextStepExecution(stageExecutions, stepOrderByKey);

  let nextStep: EntityWorkflowNextStep | null = null;
  if (nextStepExecution) {
    let nextStepOwnerName: string | null = null;
    if (nextStepExecution.ownerId) {
      const owner = await prisma.user.findUnique({
        where: { id: nextStepExecution.ownerId },
        select: { name: true },
      });
      nextStepOwnerName = owner?.name ?? null;
    }
    const stepDefinition = currentStage?.steps.find(
      (s) => s.key === nextStepExecution.stepKey
    );
    nextStep = {
      executionId: nextStepExecution.id,
      title: nextStepExecution.title,
      description: stepDefinition?.description ?? null,
      ownerId: nextStepExecution.ownerId,
      ownerName: nextStepOwnerName,
      dueAt: nextStepExecution.dueAt,
      kind: nextStepExecution.kind,
    };
  }

  const allActive = await getWorkflowsForEntity(entityType, entityId, {
    statuses: [...ACTIVE_STATUSES],
  });
  const otherActiveCount = Math.max(0, allActive.length - 1);

  const blockers = stageExecutions
    .filter((e) => e.state === "BLOCKED")
    .map((e) => ({ executionId: e.id, title: e.title, blockedReason: e.blockedReason }));

  return {
    instanceId: instance.id,
    instanceTitle: instance.title,
    templateName,
    status: instance.status,
    completionPercent: runtime.completionPercent,
    currentStageKey: instance.currentStageKey,
    currentStageName: currentStage?.name ?? null,
    blockers,
    dueAt: instance.dueAt,
    ownerId: instance.ownerId,
    ownerName,
    health,
    nextStep,
    otherActiveCount,
  };
}

// ---------------------------------------------------------------------------
// getWorkflowLinkedActionsData
// ---------------------------------------------------------------------------

export type WorkflowLinkedAction = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  ownerName: string | null;
};

const MAX_LINKED_ACTIONS = 20;

/** Open-before-done, then soonest-deadline-first — the ordering a person
 *  scanning "what's outstanding on this workflow" cares about most. */
const ACTION_STATUS_RANK: Record<string, number> = {
  OVERDUE: 0,
  BLOCKED: 1,
  IN_PROGRESS: 2,
  NOT_STARTED: 3,
  COMPLETE: 4,
  DROPPED: 5,
};

/**
 * ActionItems linked to this workflow instance's steps (via
 * WorkflowStepExecution.linkedActionItemId), open/overdue first.
 */
export async function getWorkflowLinkedActionsData(
  instanceId: string
): Promise<WorkflowLinkedAction[]> {
  const executions = await prisma.workflowStepExecution.findMany({
    where: { instanceId, linkedActionItemId: { not: null } },
    select: { linkedActionItemId: true },
  });
  const actionItemIds = Array.from(
    new Set(
      executions
        .map((e) => e.linkedActionItemId)
        .filter((id): id is string => !!id)
    )
  );
  if (actionItemIds.length === 0) return [];

  const actions = await prisma.actionItem.findMany({
    where: { id: { in: actionItemIds } },
    select: {
      id: true,
      title: true,
      status: true,
      deadlineStart: true,
      deadlineEnd: true,
      lead: { select: { name: true } },
    },
  });

  return actions
    .map((a) => ({
      id: a.id,
      title: a.title,
      status: a.status as string,
      dueDate: (a.deadlineEnd ?? a.deadlineStart)
        ? (a.deadlineEnd ?? a.deadlineStart)!.toISOString()
        : null,
      ownerName: a.lead?.name ?? null,
      _dueMs: (a.deadlineEnd ?? a.deadlineStart)?.getTime() ?? Number.MAX_SAFE_INTEGER,
    }))
    .sort((a, b) => {
      const rankA = ACTION_STATUS_RANK[a.status] ?? 6;
      const rankB = ACTION_STATUS_RANK[b.status] ?? 6;
      if (rankA !== rankB) return rankA - rankB;
      return a._dueMs - b._dueMs;
    })
    .slice(0, MAX_LINKED_ACTIONS)
    .map(({ _dueMs, ...rest }) => rest);
}

// ---------------------------------------------------------------------------
// getWorkflowLinkedMeetingsData
// ---------------------------------------------------------------------------

export type WorkflowLinkedMeeting = {
  id: string;
  title: string;
  status: string;
  scheduledAt: string;
  type: string;
};

const MAX_LINKED_MEETINGS = 20;

/**
 * Meetings linked to this workflow instance's steps (via
 * WorkflowStepExecution.linkedMeetingId), soonest/most-recent first.
 */
export async function getWorkflowLinkedMeetingsData(
  instanceId: string
): Promise<WorkflowLinkedMeeting[]> {
  const executions = await prisma.workflowStepExecution.findMany({
    where: { instanceId, linkedMeetingId: { not: null } },
    select: { linkedMeetingId: true },
  });
  const meetingIds = Array.from(
    new Set(
      executions
        .map((e) => e.linkedMeetingId)
        .filter((id): id is string => !!id)
    )
  );
  if (meetingIds.length === 0) return [];

  const meetings = await prisma.meeting.findMany({
    where: { id: { in: meetingIds } },
    select: { id: true, title: true, status: true, scheduledAt: true, type: true },
    orderBy: { scheduledAt: "desc" },
    take: MAX_LINKED_MEETINGS,
  });

  return meetings.map((m) => ({
    id: m.id,
    title: m.title,
    status: m.status as string,
    scheduledAt: m.scheduledAt.toISOString(),
    type: m.type as string,
  }));
}

// ---------------------------------------------------------------------------
// getWorkflowContextForActionItems
// ---------------------------------------------------------------------------

export type ActionItemWorkflowContext = {
  instanceId: string;
  instanceTitle: string;
  stageName: string | null;
};

/**
 * Batch-resolve, for a whole list of ActionItem ids at once, which workflow
 * instance (and current stage) each is linked to via a
 * WorkflowStepExecution.linkedActionItemId — the reverse lookup Action
 * Tracker rows need to render a "Workflow" chip. ONE query per hop (never
 * N+1): callers rendering a list of rows should call this once for the whole
 * visible page, not per-row. Ids with no linked execution are simply absent
 * from the returned Map.
 */
export async function getWorkflowContextForActionItems(
  actionItemIds: string[]
): Promise<Map<string, ActionItemWorkflowContext>> {
  const result = new Map<string, ActionItemWorkflowContext>();
  if (actionItemIds.length === 0) return result;

  const executions = await prisma.workflowStepExecution.findMany({
    where: { linkedActionItemId: { in: actionItemIds } },
    select: {
      linkedActionItemId: true,
      stageKey: true,
      instance: { select: { id: true, title: true, templateId: true } },
    },
  });
  if (executions.length === 0) return result;

  const templateIds = Array.from(new Set(executions.map((e) => e.instance.templateId)));
  const stages = await prisma.workflowTemplateStage.findMany({
    where: { templateId: { in: templateIds } },
    select: { templateId: true, key: true, name: true },
  });
  const stageNameByTemplateAndKey = new Map(
    stages.map((s) => [`${s.templateId}:${s.key}`, s.name])
  );

  for (const execution of executions) {
    const actionItemId = execution.linkedActionItemId;
    if (!actionItemId || result.has(actionItemId)) continue;
    result.set(actionItemId, {
      instanceId: execution.instance.id,
      instanceTitle: execution.instance.title,
      stageName:
        stageNameByTemplateAndKey.get(`${execution.instance.templateId}:${execution.stageKey}`) ??
        null,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// getWorkflowTimelineData
// ---------------------------------------------------------------------------

export type WorkflowTimelineEvent = {
  id: string;
  kind: string;
  summary: string;
  actorName: string | null;
  createdAt: string;
};

/**
 * The instance's recent timeline, most-recent-first — reuses
 * getInstanceDetail's `events` (which already resolves actor names) rather
 * than re-querying WorkflowEvent directly.
 */
export async function getWorkflowTimelineData(
  instanceId: string,
  limit = 8
): Promise<WorkflowTimelineEvent[]> {
  const detail = await getInstanceDetail(instanceId);
  if (!detail) return [];
  return detail.events.slice(0, limit);
}
