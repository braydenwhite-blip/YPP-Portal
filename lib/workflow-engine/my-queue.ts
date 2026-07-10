// ============================================================================
// Universal Workflow Engine — "My Workflow Queue" loader (server-only)
// ============================================================================
//
// Powers the Home dashboard's "My Workflow Queue" section (Part 6 of the
// activation-layer spec). Two lists:
//   - assignedToMe: open WorkflowStepExecution rows this user owns, on
//     instances that are still ACTIVE/BLOCKED.
//   - instancesIOwn: WorkflowInstance rows this user owns outright.
//
// The only real logic here is the overdue/due-this-week date math on
// assignedToMe, which is extracted into `countQueueUrgency` (pure, no
// Prisma) so it's trivially unit-testable.

import "server-only";

import { prisma } from "@/lib/prisma";

export type MyWorkflowQueueItem = {
  executionId: string;
  instanceId: string;
  instanceTitle: string;
  stageKey: string;
  stageName: string;
  stepTitle: string;
  kind: string;
  dueAt: string | null;
  isOverdue: boolean;
  isBlocked: boolean;
  entityType: string | null;
  entityId: string | null;
};

export type MyWorkflowQueueInstance = {
  instanceId: string;
  title: string;
  status: string;
  completionPercent: number;
  currentStageName: string | null;
};

export type MyWorkflowQueue = {
  assignedToMe: MyWorkflowQueueItem[];
  instancesIOwn: MyWorkflowQueueInstance[];
  overdueCount: number;
  dueThisWeekCount: number;
};

const EMPTY_MY_WORKFLOW_QUEUE: MyWorkflowQueue = {
  assignedToMe: [],
  instancesIOwn: [],
  overdueCount: 0,
  dueThisWeekCount: 0,
};

/** True when `prisma generate` has been run after the workflow-engine migration. */
export function isWorkflowEnginePrismaReady(): boolean {
  const client = prisma as {
    workflowStepExecution?: { findMany?: unknown };
    workflowInstance?: { findMany?: unknown };
  };
  return (
    typeof client.workflowStepExecution?.findMany === "function" &&
    typeof client.workflowInstance?.findMany === "function"
  );
}

function isWorkflowSchemaMissingError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: string }).code) : "";
  if (code === "P2021") return true;
  const message = "message" in error ? String((error as { message?: string }).message) : "";
  return /WorkflowStepExecution|WorkflowInstance/i.test(message);
}

const ASSIGNED_TO_ME_TAKE = 50;
const INSTANCES_I_OWN_TAKE = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Pure date-math over the raw "assigned to me" rows: which are overdue
 * (dueAt in the past) vs. due within the next 7 days. A step counts toward
 * at most one bucket (overdue takes precedence), and steps with no dueAt
 * count toward neither — kept standalone so it's testable without any
 * Prisma mocking.
 */
export function countQueueUrgency(
  rows: Array<{ dueAt: string | null }>,
  now: Date
): { overdueCount: number; dueThisWeekCount: number } {
  const nowMs = now.getTime();
  const weekAheadMs = nowMs + 7 * DAY_MS;

  let overdueCount = 0;
  let dueThisWeekCount = 0;
  for (const row of rows) {
    if (!row.dueAt) continue;
    const dueMs = new Date(row.dueAt).getTime();
    if (Number.isNaN(dueMs)) continue;
    if (dueMs < nowMs) {
      overdueCount += 1;
    } else if (dueMs <= weekAheadMs) {
      dueThisWeekCount += 1;
    }
  }
  return { overdueCount, dueThisWeekCount };
}

/**
 * The signed-in user's workflow queue for the Home dashboard: the concrete
 * steps they own (ordered overdue/blocked first, then soonest due) plus the
 * instances they own outright.
 */
export async function getMyWorkflowQueue(
  userId: string,
  now: Date = new Date()
): Promise<MyWorkflowQueue> {
  if (!isWorkflowEnginePrismaReady()) {
    return EMPTY_MY_WORKFLOW_QUEUE;
  }

  try {
  const [executions, instances] = await Promise.all([
    prisma.workflowStepExecution.findMany({
      where: {
        ownerId: userId,
        state: { in: ["PENDING", "IN_PROGRESS", "BLOCKED"] },
        instance: { status: { in: ["ACTIVE", "BLOCKED"] } },
      },
      include: {
        instance: {
          select: {
            id: true,
            title: true,
            subjectType: true,
            subjectId: true,
            currentStage: { select: { name: true } },
          },
        },
      },
      orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }],
      take: ASSIGNED_TO_ME_TAKE,
    }),
    prisma.workflowInstance.findMany({
      where: { ownerId: userId, status: { in: ["ACTIVE", "BLOCKED", "ON_HOLD"] } },
      select: {
        id: true,
        title: true,
        status: true,
        completionPercent: true,
        currentStage: { select: { name: true } },
      },
      orderBy: [{ status: "asc" }, { startedAt: "desc" }],
      take: INSTANCES_I_OWN_TAKE,
    }),
  ]);

  const nowMs = now.getTime();

  const assignedToMe: MyWorkflowQueueItem[] = executions.map((e) => {
    const dueMs = e.dueAt ? e.dueAt.getTime() : null;
    return {
      executionId: e.id,
      instanceId: e.instance.id,
      instanceTitle: e.instance.title,
      stageKey: e.stageKey,
      stageName: e.instance.currentStage?.name ?? e.stageKey,
      stepTitle: e.title,
      kind: e.kind,
      dueAt: e.dueAt ? e.dueAt.toISOString() : null,
      isOverdue: dueMs !== null && dueMs < nowMs,
      isBlocked: e.state === "BLOCKED",
      entityType: e.instance.subjectType,
      entityId: e.instance.subjectId,
    };
  });

  // Overdue/blocked first, then soonest due, then no-due-date last.
  assignedToMe.sort((a, b) => {
    const aUrgent = a.isOverdue || a.isBlocked;
    const bUrgent = b.isOverdue || b.isBlocked;
    if (aUrgent !== bUrgent) return aUrgent ? -1 : 1;
    const aMs = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bMs = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    return aMs - bMs;
  });

  const instancesIOwn: MyWorkflowQueueInstance[] = instances.map((i) => ({
    instanceId: i.id,
    title: i.title,
    status: i.status,
    completionPercent: i.completionPercent,
    currentStageName: i.currentStage?.name ?? null,
  }));

  const { overdueCount, dueThisWeekCount } = countQueueUrgency(
    assignedToMe.map((item) => ({ dueAt: item.dueAt })),
    now
  );

  return { assignedToMe, instancesIOwn, overdueCount, dueThisWeekCount };
  } catch (error) {
    if (isWorkflowSchemaMissingError(error)) {
      return EMPTY_MY_WORKFLOW_QUEUE;
    }
    throw error;
  }
}
