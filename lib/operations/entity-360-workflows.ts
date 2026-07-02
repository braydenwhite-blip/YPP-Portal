import "server-only";

import { prisma } from "@/lib/prisma";
import { getWorkflowsForEntity } from "@/lib/workflow-engine/attachment";
import { computeWorkflowHealth } from "@/lib/workflow-engine/health";
import type { StepExecutionView, WorkflowInstanceStatusValue } from "@/lib/workflow-engine/types";

import {
  ENTITY_360_WORKFLOW_SUBJECT,
  WORKFLOW_HEALTH_LABELS,
  WORKFLOW_HEALTH_TONES,
  sortWorkflowsWorstFirst,
  workflowProgressLabel,
  type Entity360Type,
  type Entity360Workflow,
} from "./entity-360";

/**
 * Data 360 — the Entity 360 "Workflows" section loader.
 *
 * Every 360 panel shows the Universal Workflow Engine instances that touch its
 * record — as the instance's PRIMARY subject or via a WorkflowAttachment — with
 * the engine's own health read (`computeWorkflowHealth`: concrete reasons, never
 * a vague score). One loader serves all nine entity types via the
 * {@link ENTITY_360_WORKFLOW_SUBJECT} mapping, and `loadEntity360` attaches the
 * result centrally (officer-gated), so no per-type loader re-implements it.
 *
 * Batched reads throughout — instances, stage-entered events, and owner names
 * each load in ONE query for the whole list, never per-instance.
 */

/** Only in-flight workflows belong on an operational panel. */
const IN_FLIGHT_STATUSES = ["ACTIVE", "BLOCKED", "ON_HOLD"] as const;

/** A drawer section stays scannable — the worst few, not an inventory. */
const MAX_WORKFLOWS = 6;

type ExecutionRow = {
  id: string;
  stepId: string | null;
  stageKey: string;
  stepKey: string;
  title: string;
  kind: string;
  state: string;
  isRequired: boolean;
  ownerId: string | null;
  dueAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  blockedReason: string | null;
  linkedActionItemId: string | null;
  linkedMeetingId: string | null;
  linkedWorkflowItemId: string | null;
};

function toExecutionView(row: ExecutionRow): StepExecutionView {
  return {
    id: row.id,
    stepId: row.stepId,
    stageKey: row.stageKey,
    stepKey: row.stepKey,
    title: row.title,
    kind: row.kind as StepExecutionView["kind"],
    state: row.state as StepExecutionView["state"],
    isRequired: row.isRequired,
    ownerId: row.ownerId,
    dueAt: row.dueAt ? row.dueAt.toISOString() : null,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    blockedReason: row.blockedReason,
    linkedActionItemId: row.linkedActionItemId,
    linkedMeetingId: row.linkedMeetingId,
    linkedWorkflowItemId: row.linkedWorkflowItemId,
  };
}

/**
 * The step to surface as "what happens next": the earliest-due non-terminal
 * REQUIRED step in the current stage, falling back to any non-terminal step.
 * (The template's step order isn't loaded here — due date is the honest
 * ordering an operational panel cares about anyway.)
 */
function pickNextStepTitle(stageExecutions: StepExecutionView[]): string | null {
  const nonTerminal = stageExecutions.filter(
    (e) => e.state === "PENDING" || e.state === "IN_PROGRESS"
  );
  if (nonTerminal.length === 0) return null;
  const byDue = (a: StepExecutionView, b: StepExecutionView) => {
    const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
    return aDue - bDue || a.title.localeCompare(b.title);
  };
  const required = nonTerminal.filter((e) => e.isRequired).sort(byDue);
  return (required[0] ?? [...nonTerminal].sort(byDue)[0]).title;
}

/**
 * The in-flight workflows touching one entity, shaped for the 360 panel and
 * sorted worst health first. Returns [] on an unknown ref — a stale id never
 * breaks the drawer.
 */
export async function loadEntity360Workflows(
  type: Entity360Type,
  id: string,
  now: Date
): Promise<Entity360Workflow[]> {
  const subjectType = ENTITY_360_WORKFLOW_SUBJECT[type];
  const trimmed = id?.trim();
  if (!trimmed) return [];

  const summaries = await getWorkflowsForEntity(subjectType, trimmed, {
    statuses: [...IN_FLIGHT_STATUSES],
  });

  // Step-level links count too: a workflow whose step scheduled this meeting
  // (linkedMeetingId) or created this action (linkedActionItemId) touches the
  // record just as much as a subject/attachment link does.
  let stepLinkedIds: string[] = [];
  if (type === "meeting" || type === "action") {
    const stepRows = await prisma.workflowStepExecution.findMany({
      where:
        type === "meeting" ? { linkedMeetingId: trimmed } : { linkedActionItemId: trimmed },
      select: { instanceId: true },
    });
    stepLinkedIds = stepRows.map((r) => r.instanceId);
  }

  const candidateIds = Array.from(
    new Set([...summaries.map((s) => s.id), ...stepLinkedIds])
  );
  if (candidateIds.length === 0) return [];

  const [instances, stageEvents] = await Promise.all([
    prisma.workflowInstance.findMany({
      // Re-filter by status: step-linked ids arrive unfiltered, and the panel
      // only shows in-flight work.
      where: { id: { in: candidateIds }, status: { in: [...IN_FLIGHT_STATUSES] } },
      orderBy: { startedAt: "desc" },
      take: MAX_WORKFLOWS,
      select: {
        id: true,
        title: true,
        status: true,
        dueAt: true,
        followUpAt: true,
        escalatedAt: true,
        startedAt: true,
        completionPercent: true,
        ownerId: true,
        currentStage: { select: { key: true, name: true, slaHours: true } },
        template: { select: { name: true } },
        executions: {
          select: {
            id: true,
            stepId: true,
            stageKey: true,
            stepKey: true,
            title: true,
            kind: true,
            state: true,
            isRequired: true,
            ownerId: true,
            dueAt: true,
            startedAt: true,
            completedAt: true,
            blockedReason: true,
            linkedActionItemId: true,
            linkedMeetingId: true,
            linkedWorkflowItemId: true,
          },
        },
      },
    }),
    prisma.workflowEvent.findMany({
      where: { instanceId: { in: candidateIds }, kind: "STAGE_ENTERED" },
      orderBy: { createdAt: "desc" },
      select: { instanceId: true, toStageKey: true, createdAt: true },
    }),
  ]);

  const ownerIds = Array.from(
    new Set(instances.map((i) => i.ownerId).filter((v): v is string => !!v))
  );
  const owners =
    ownerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: ownerIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
  const ownerNameById = new Map(owners.map((o) => [o.id, o.name ?? o.email]));

  const workflows: Entity360Workflow[] = instances.map((instance) => {
    const stageKey = instance.currentStage?.key ?? null;
    const stageExecutions = stageKey
      ? instance.executions.filter((e) => e.stageKey === stageKey).map(toExecutionView)
      : [];
    const enteredAt = stageKey
      ? (stageEvents.find(
          (e) => e.instanceId === instance.id && e.toStageKey === stageKey
        )?.createdAt ?? null)
      : null;

    const health = computeWorkflowHealth({
      instance: {
        status: instance.status as WorkflowInstanceStatusValue,
        dueAt: instance.dueAt ? instance.dueAt.toISOString() : null,
        followUpAt: instance.followUpAt ? instance.followUpAt.toISOString() : null,
        escalatedAt: instance.escalatedAt ? instance.escalatedAt.toISOString() : null,
        startedAt: instance.startedAt.toISOString(),
        completionPercent: instance.completionPercent,
      },
      currentStage: instance.currentStage
        ? {
            key: instance.currentStage.key,
            slaHours: instance.currentStage.slaHours,
            name: instance.currentStage.name,
          }
        : null,
      currentStageEnteredAt: enteredAt ? enteredAt.toISOString() : null,
      executions: stageExecutions,
      now: now.toISOString(),
    });

    return {
      id: instance.id,
      title: instance.title,
      templateName: instance.template.name,
      healthStatus: health.status,
      healthLabel: WORKFLOW_HEALTH_LABELS[health.status] ?? health.status,
      tone: WORKFLOW_HEALTH_TONES[health.status] ?? "neutral",
      reasons: health.reasons,
      stageName: instance.currentStage?.name ?? null,
      progressLabel: workflowProgressLabel(instance.completionPercent),
      ownerName: instance.ownerId ? (ownerNameById.get(instance.ownerId) ?? null) : null,
      dueISO: instance.dueAt ? instance.dueAt.toISOString() : null,
      nextStepTitle: pickNextStepTitle(stageExecutions),
      href: `/workflows/${instance.id}`,
    };
  });

  return sortWorkflowsWorstFirst(workflows);
}
