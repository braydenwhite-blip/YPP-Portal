/**
 * Data 360 — workflow analytics (server loader).
 *
 * Loads active workflow instances, scores each with the EXISTING health engine
 * (`computeWorkflowHealth`), and enriches them with step / linked-action /
 * linked-meeting / attachment rollups. Pure aggregation lives in
 * `./workflow-analytics-core`; this file only does the Prisma reads and the
 * per-instance health scoring, mirroring the query shape of
 * `lib/workflow-engine/needs-attention.ts` (the one existing place instances
 * are shaped for health). No second engine, no second health model.
 */

import "server-only";

import { prisma } from "@/lib/prisma";
import { toStepExecutionView } from "@/lib/workflow-engine/definition";
import { computeWorkflowHealth } from "@/lib/workflow-engine/health";
import type { WorkflowInstanceStatusValue } from "@/lib/workflow-engine/types";

import {
  buildWorkflowData360Overview,
  buildWorkflowHealthDistribution,
  buildWorkflowLinkedWorkSummary,
  buildWorkflowStepAnalytics,
  groupWorkflowsByChapter,
  groupWorkflowsByEntityType,
  groupWorkflowsByTemplate,
  isActiveHealth,
  type WorkflowAnalyticsInstance,
  type WorkflowStepCounts,
} from "./workflow-analytics-core";

const ACTIVE_STATUSES = ["ACTIVE", "BLOCKED", "ON_HOLD"] as const;
const MAX_INSTANCES = 800;
const DAY_MS = 24 * 60 * 60 * 1000;

const TERMINAL_STATES = new Set(["COMPLETE", "SKIPPED"]);

function stepRollup(
  execs: { state: string; isRequired: boolean; dueAt: Date | null }[],
  now: Date
): WorkflowStepCounts {
  let complete = 0;
  let blocked = 0;
  let overdue = 0;
  let pending = 0;
  for (const e of execs) {
    if (e.state === "COMPLETE") complete += 1;
    else if (e.state === "BLOCKED") blocked += 1;
    else if (e.state === "PENDING" || e.state === "IN_PROGRESS") pending += 1;
    const nonTerminal = !TERMINAL_STATES.has(e.state) && e.state !== "BLOCKED";
    if (e.isRequired && nonTerminal && e.dueAt && e.dueAt.getTime() < now.getTime()) {
      overdue += 1;
    }
  }
  return { total: execs.length, complete, blocked, overdue, pending };
}

/**
 * Load active workflow instances, health-scored and enriched. This is the one
 * read the whole Data 360 workflow layer is built on — call it once per request
 * and feed the result to the pure builders in `./workflow-analytics-core`.
 */
export async function loadWorkflowAnalyticsInstances(
  now: Date = new Date()
): Promise<WorkflowAnalyticsInstance[]> {
  const instances = await prisma.workflowInstance.findMany({
    where: { status: { in: [...ACTIVE_STATUSES] as never } },
    include: {
      currentStage: { select: { key: true, name: true, slaHours: true } },
      template: { select: { id: true, name: true, key: true } },
    },
    orderBy: [{ status: "asc" }, { startedAt: "asc" }],
    take: MAX_INSTANCES,
  });
  if (instances.length === 0) return [];

  const instanceIds = instances.map((i) => i.id);
  const chapterIds = Array.from(
    new Set(instances.map((i) => i.chapterId).filter((c): c is string => !!c))
  );
  const ownerIds = Array.from(
    new Set(instances.map((i) => i.ownerId).filter((o): o is string => !!o))
  );

  const [executions, stageEnteredEvents, owners, chapters, attachmentGroups] =
    await Promise.all([
      prisma.workflowStepExecution.findMany({
        where: { instanceId: { in: instanceIds } },
      }),
      prisma.workflowEvent.findMany({
        where: { instanceId: { in: instanceIds }, kind: "STAGE_ENTERED" },
        orderBy: { createdAt: "desc" },
        select: { instanceId: true, toStageKey: true, createdAt: true },
      }),
      ownerIds.length > 0
        ? prisma.user.findMany({
            where: { id: { in: ownerIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      chapterIds.length > 0
        ? prisma.chapter.findMany({
            where: { id: { in: chapterIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      prisma.workflowAttachment.groupBy({
        by: ["workflowInstanceId"],
        where: { workflowInstanceId: { in: instanceIds } },
        _count: { _all: true },
      }),
    ]);

  const ownerNameById = new Map(owners.map((u) => [u.id, u.name ?? "Unknown"]));
  const chapterNameById = new Map(chapters.map((c) => [c.id, c.name]));
  const attachmentCountById = new Map(
    attachmentGroups.map((g) => [g.workflowInstanceId, g._count._all])
  );

  // All executions grouped by instance (for step rollups) and by instance+stage
  // (only the current stage feeds health, matching health.ts semantics).
  const execByInstance = new Map<string, typeof executions>();
  const execByInstanceStage = new Map<string, typeof executions>();
  for (const e of executions) {
    const all = execByInstance.get(e.instanceId) ?? [];
    all.push(e);
    execByInstance.set(e.instanceId, all);
    const sk = `${e.instanceId}::${e.stageKey}`;
    const stg = execByInstanceStage.get(sk) ?? [];
    stg.push(e);
    execByInstanceStage.set(sk, stg);
  }

  const enteredAtByInstanceStage = new Map<string, string>();
  for (const ev of stageEnteredEvents) {
    if (!ev.toStageKey) continue;
    const k = `${ev.instanceId}::${ev.toStageKey}`;
    if (!enteredAtByInstanceStage.has(k)) {
      enteredAtByInstanceStage.set(k, ev.createdAt.toISOString());
    }
  }

  const nowISO = now.toISOString();

  return instances.map((i) => {
    const stageKey = i.currentStage?.key ?? null;
    const stageComboKey = stageKey ? `${i.id}::${stageKey}` : null;
    const currentStageExecs = stageComboKey
      ? execByInstanceStage.get(stageComboKey) ?? []
      : [];
    const allExecs = execByInstance.get(i.id) ?? [];

    const health = computeWorkflowHealth({
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
      currentStageEnteredAt: stageComboKey
        ? enteredAtByInstanceStage.get(stageComboKey) ?? null
        : null,
      executions: currentStageExecs.map(toStepExecutionView),
      now: nowISO,
    });

    // Next actionable step: earliest-due non-terminal required step in the
    // current stage, else the first non-terminal step there.
    const candidates = currentStageExecs
      .filter((e) => e.state === "PENDING" || e.state === "IN_PROGRESS")
      .sort((a, b) => {
        const at = a.dueAt ? a.dueAt.getTime() : Infinity;
        const bt = b.dueAt ? b.dueAt.getTime() : Infinity;
        return at - bt;
      });
    const nextStep =
      candidates.find((e) => e.isRequired) ?? candidates[0] ?? null;

    const linkedActionCount = allExecs.filter((e) => e.linkedActionItemId).length;
    const linkedMeetingCount = allExecs.filter((e) => e.linkedMeetingId).length;

    return {
      id: i.id,
      title: i.title,
      status: i.status as WorkflowInstanceStatusValue,
      health: health.status,
      healthReasons: health.reasons,
      chapterId: i.chapterId,
      chapterName: i.chapterId ? chapterNameById.get(i.chapterId) ?? null : null,
      entityType: i.subjectType,
      entityId: i.subjectId,
      templateId: i.templateId,
      templateName: i.template?.name ?? "Workflow",
      templateKey: i.template?.key ?? null,
      ownerId: i.ownerId,
      ownerName: i.ownerId ? ownerNameById.get(i.ownerId) ?? null : null,
      startedAtISO: i.startedAt.toISOString(),
      dueAtISO: i.dueAt ? i.dueAt.toISOString() : null,
      currentStageName: i.currentStage?.name ?? null,
      completionPercent: i.completionPercent,
      ageDays: Math.max(0, Math.floor((now.getTime() - i.startedAt.getTime()) / DAY_MS)),
      nextStepTitle: nextStep?.title ?? null,
      nextStepDueISO: nextStep?.dueAt ? nextStep.dueAt.toISOString() : null,
      stepCounts: stepRollup(allExecs, now),
      linkedActionCount,
      linkedMeetingCount,
      attachmentCount: attachmentCountById.get(i.id) ?? 0,
    } satisfies WorkflowAnalyticsInstance;
  });
}

// --- module functions (the Part-2 API) ---------------------------------------

export async function getWorkflowData360Overview(now: Date = new Date()) {
  const instances = await loadWorkflowAnalyticsInstances(now);
  return buildWorkflowData360Overview(instances);
}

export async function getWorkflowAnalyticsByChapter(now: Date = new Date()) {
  return groupWorkflowsByChapter(await loadWorkflowAnalyticsInstances(now));
}

export async function getWorkflowAnalyticsByEntityType(now: Date = new Date()) {
  return groupWorkflowsByEntityType(await loadWorkflowAnalyticsInstances(now));
}

export async function getWorkflowAnalyticsByTemplate(now: Date = new Date()) {
  return groupWorkflowsByTemplate(await loadWorkflowAnalyticsInstances(now));
}

export async function getWorkflowHealthDistribution(now: Date = new Date()) {
  return buildWorkflowHealthDistribution(await loadWorkflowAnalyticsInstances(now));
}

export async function getWorkflowStepAnalytics(now: Date = new Date()) {
  return buildWorkflowStepAnalytics(await loadWorkflowAnalyticsInstances(now));
}

export async function getWorkflowLinkedWorkAnalytics(now: Date = new Date()) {
  return buildWorkflowLinkedWorkSummary(await loadWorkflowAnalyticsInstances(now));
}

/**
 * The workflows that need attention, worst-first, shaped as an actionable queue
 * (Part 12). Reads the same health the engine produced — no re-derivation.
 */
export async function getWorkflowNeedsAttentionQueue(
  now: Date = new Date()
): Promise<WorkflowAnalyticsInstance[]> {
  const instances = await loadWorkflowAnalyticsInstances(now);
  const rank: Record<string, number> = {
    BLOCKED: 0,
    OVERDUE: 1,
    STALLED: 2,
    NEEDS_ATTENTION: 3,
  };
  return instances
    .filter((i) => isActiveHealth(i.health) && i.health !== "ON_TRACK")
    .sort((a, b) => {
      const ra = rank[a.health] ?? 9;
      const rb = rank[b.health] ?? 9;
      if (ra !== rb) return ra - rb;
      return b.ageDays - a.ageDays;
    });
}
