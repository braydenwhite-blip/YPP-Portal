// ============================================================================
// Universal Workflow Engine — Needs Attention loader (server-only)
// ============================================================================
//
// Feeds live workflow instances into the shared People Strategy "Needs
// Attention" engine (`lib/people-strategy/needs-attention.ts`). Loads active
// (ACTIVE / BLOCKED / ON_HOLD) instances, their current-stage step executions,
// and the current stage's most recent STAGE_ENTERED event, then shapes each
// into an `AttentionWorkflow` for `workflowAttention()` to score with
// `computeWorkflowHealth`. No parallel attention system — this is the only
// place workflow instances become `AttentionItem`s.

import "server-only";

import { prisma } from "@/lib/prisma";
import type { AttentionWorkflow } from "@/lib/people-strategy/needs-attention";
import { toStepExecutionView } from "@/lib/workflow-engine/definition";
import type { WorkflowInstanceStatusValue } from "@/lib/workflow-engine/types";

const ACTIVE_STATUSES = ["ACTIVE", "BLOCKED", "ON_HOLD"] as const;

/** Bound the scan: BLOCKED instances always matter; otherwise only ones with a
 *  due/follow-up date within this trailing+leading window are worth scoring
 *  (mirrors how the other People Strategy loaders bound their sweeps). */
const RELEVANT_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_INSTANCES = 300;

/**
 * Load active workflow instances shaped for `workflowAttention()`. Bounded to
 * BLOCKED instances plus ones with a due/follow-up date inside a trailing and
 * leading window around `now`, so this stays a cheap read even as the
 * template catalog grows.
 */
export async function loadWorkflowAttentionInputs(
  now: Date = new Date()
): Promise<AttentionWorkflow[]> {
  const windowStart = new Date(now.getTime() - RELEVANT_WINDOW_DAYS * DAY_MS);
  const windowEnd = new Date(now.getTime() + RELEVANT_WINDOW_DAYS * DAY_MS);

  const instances = await prisma.workflowInstance.findMany({
    where: {
      status: { in: [...ACTIVE_STATUSES] as never },
      OR: [
        { status: "BLOCKED" },
        { dueAt: { gte: windowStart, lte: windowEnd } },
        { followUpAt: { gte: windowStart, lte: windowEnd } },
      ],
    },
    include: {
      currentStage: { select: { key: true, name: true, slaHours: true } },
    },
    orderBy: [{ status: "asc" }, { startedAt: "asc" }],
    take: MAX_INSTANCES,
  });

  if (instances.length === 0) return [];

  const instanceIds = instances.map((i) => i.id);
  const stageKeys = instances
    .map((i) => i.currentStage?.key)
    .filter((k): k is string => !!k);

  const [executions, stageEnteredEvents, owners] = await Promise.all([
    prisma.workflowStepExecution.findMany({
      where: {
        instanceId: { in: instanceIds },
        ...(stageKeys.length > 0
          ? { stageKey: { in: Array.from(new Set(stageKeys)) } }
          : {}),
      },
    }),
    prisma.workflowEvent.findMany({
      where: { instanceId: { in: instanceIds }, kind: "STAGE_ENTERED" },
      orderBy: { createdAt: "desc" },
      select: { instanceId: true, toStageKey: true, createdAt: true },
    }),
    prisma.user.findMany({
      where: {
        id: {
          in: Array.from(
            new Set(instances.map((i) => i.ownerId).filter((id): id is string => !!id))
          ),
        },
      },
      select: { id: true, name: true },
    }),
  ]);

  const ownerNameById = new Map(owners.map((u) => [u.id, u.name ?? "Unknown"]));

  // Only the instance's CURRENT stage's executions should feed health scoring
  // (health.ts scores "what's happening now", not stage history).
  const executionsByInstanceAndStage = new Map<string, typeof executions>();
  for (const exec of executions) {
    const key = `${exec.instanceId}::${exec.stageKey}`;
    const arr = executionsByInstanceAndStage.get(key) ?? [];
    arr.push(exec);
    executionsByInstanceAndStage.set(key, arr);
  }

  // Most recent STAGE_ENTERED per (instance, stage) — first hit wins since the
  // query is ordered newest-first.
  const enteredAtByInstanceAndStage = new Map<string, string>();
  for (const ev of stageEnteredEvents) {
    if (!ev.toStageKey) continue;
    const key = `${ev.instanceId}::${ev.toStageKey}`;
    if (!enteredAtByInstanceAndStage.has(key)) {
      enteredAtByInstanceAndStage.set(key, ev.createdAt.toISOString());
    }
  }

  return instances.map((i) => {
    const stageKey = i.currentStage?.key ?? null;
    const key = stageKey ? `${i.id}::${stageKey}` : null;
    const stageExecutions = key ? executionsByInstanceAndStage.get(key) ?? [] : [];

    return {
      id: i.id,
      title: i.title,
      href: `/workflows/${i.id}`,
      chapterId: i.chapterId,
      ownerId: i.ownerId,
      ownerName: i.ownerId ? ownerNameById.get(i.ownerId) ?? null : null,
      instance: {
        status: i.status as WorkflowInstanceStatusValue,
        dueAt: i.dueAt ? i.dueAt.toISOString() : null,
        followUpAt: i.followUpAt ? i.followUpAt.toISOString() : null,
        escalatedAt: i.escalatedAt ? i.escalatedAt.toISOString() : null,
        startedAt: i.startedAt.toISOString(),
        completionPercent: i.completionPercent,
      },
      currentStage: i.currentStage
        ? { key: i.currentStage.key, slaHours: i.currentStage.slaHours, name: i.currentStage.name }
        : null,
      currentStageEnteredAt: key ? enteredAtByInstanceAndStage.get(key) ?? null : null,
      executions: stageExecutions.map(toStepExecutionView),
    };
  });
}
