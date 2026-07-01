// ============================================================================
// Universal Workflow Engine — attachment read/write API (server-only)
// ============================================================================
//
// The reusable "which workflow(s) touch this entity" surface. A WorkflowInstance
// always has exactly one PRIMARY subject (WorkflowInstance.subjectType/subjectId
// — never duplicated here). This module manages SECONDARY (or other
// non-primary) links via the WorkflowAttachment table, and gives every entity
// kind a single set of read helpers (list all workflows touching it, find its
// primary one, get-or-start one) regardless of whether the link is primary or
// an attachment.

import "server-only";

import { prisma } from "@/lib/prisma";
import { startInstance } from "@/lib/workflow-engine/engine";
import { isWorkflowEntityType } from "@/lib/workflow-engine/entity-types";

const ACTIVE_STATUSES = ["ACTIVE", "BLOCKED", "ON_HOLD"] as const;

const DEFAULT_RELATIONSHIP = "SECONDARY";

// ---------------------------------------------------------------------------
// attachWorkflowToEntity
// ---------------------------------------------------------------------------

export type AttachWorkflowToEntityInput = {
  instanceId: string;
  entityType: string;
  entityId: string;
  relationship?: string;
  createdById?: string | null;
};

export type AttachWorkflowToEntityResult =
  | { attached: true; alreadyPrimary: false; attachmentId: string }
  | { attached: false; alreadyPrimary: true };

/**
 * Link a workflow instance to an entity as a SECONDARY (or other non-primary)
 * attachment. A no-op when the entity is already the instance's own PRIMARY
 * subject — the primary link lives on WorkflowInstance.subjectType/subjectId
 * and is never duplicated into WorkflowAttachment.
 */
export async function attachWorkflowToEntity(
  input: AttachWorkflowToEntityInput
): Promise<AttachWorkflowToEntityResult> {
  if (!isWorkflowEntityType(input.entityType)) {
    throw new Error(`Invalid workflow entity type: "${input.entityType}".`);
  }
  const relationship = input.relationship?.trim() || DEFAULT_RELATIONSHIP;

  const instance = await prisma.workflowInstance.findUnique({
    where: { id: input.instanceId },
    select: { subjectType: true, subjectId: true },
  });
  if (!instance) throw new Error(`Workflow instance not found: "${input.instanceId}".`);

  if (instance.subjectType === input.entityType && instance.subjectId === input.entityId) {
    return { attached: false, alreadyPrimary: true };
  }

  const attachment = await prisma.workflowAttachment.upsert({
    where: {
      workflowInstanceId_entityType_entityId_relationship: {
        workflowInstanceId: input.instanceId,
        entityType: input.entityType,
        entityId: input.entityId,
        relationship,
      },
    },
    create: {
      workflowInstanceId: input.instanceId,
      entityType: input.entityType,
      entityId: input.entityId,
      relationship,
      createdById: input.createdById ?? null,
    },
    update: {},
    select: { id: true },
  });

  return { attached: true, alreadyPrimary: false, attachmentId: attachment.id };
}

// ---------------------------------------------------------------------------
// detachWorkflowFromEntity
// ---------------------------------------------------------------------------

export type DetachWorkflowFromEntityInput = {
  instanceId: string;
  entityType: string;
  entityId: string;
  relationship?: string;
};

export type DetachWorkflowFromEntityResult = { detachedCount: number };

/**
 * Remove a workflow instance's attachment(s) to an entity. Omitting
 * `relationship` deletes every relationship recorded for that entity on that
 * instance. Throws if the entity is the instance's own PRIMARY subject — that
 * link lives on the instance itself and cannot be detached this way.
 */
export async function detachWorkflowFromEntity(
  input: DetachWorkflowFromEntityInput
): Promise<DetachWorkflowFromEntityResult> {
  if (!isWorkflowEntityType(input.entityType)) {
    throw new Error(`Invalid workflow entity type: "${input.entityType}".`);
  }

  const instance = await prisma.workflowInstance.findUnique({
    where: { id: input.instanceId },
    select: { subjectType: true, subjectId: true },
  });
  if (!instance) throw new Error(`Workflow instance not found: "${input.instanceId}".`);

  if (instance.subjectType === input.entityType && instance.subjectId === input.entityId) {
    throw new Error(
      "Cannot detach the primary subject — it lives on the workflow instance itself (subjectType/subjectId), not as an attachment."
    );
  }

  const result = await prisma.workflowAttachment.deleteMany({
    where: {
      workflowInstanceId: input.instanceId,
      entityType: input.entityType,
      entityId: input.entityId,
      ...(input.relationship ? { relationship: input.relationship } : {}),
    },
  });

  return { detachedCount: result.count };
}

// ---------------------------------------------------------------------------
// getWorkflowsForEntity
// ---------------------------------------------------------------------------

export type WorkflowSummaryForEntity = {
  id: string;
  title: string;
  status: string;
  templateId: string;
  currentStageKey: string | null;
  completionPercent: number;
  dueAt: string | null;
  ownerId: string | null;
  startedAt: string;
};

export type GetWorkflowsForEntityOpts = {
  statuses?: string[];
};

/**
 * Pure dedupe + filter + sort — extracted so the merge logic between the
 * "primary subject" query and the "attachment" query is unit-testable without
 * mocking prisma. Later entries win ties (stable de-dupe by `id`); the result
 * is filtered by `statuses` (when given) and sorted by `startedAt` desc.
 */
export function dedupeWorkflowSummaries(
  list: WorkflowSummaryForEntity[],
  opts: GetWorkflowsForEntityOpts = {}
): WorkflowSummaryForEntity[] {
  const byId = new Map<string, WorkflowSummaryForEntity>();
  for (const item of list) byId.set(item.id, item);

  let result = Array.from(byId.values());
  if (opts.statuses && opts.statuses.length > 0) {
    const allowed = new Set(opts.statuses);
    result = result.filter((w) => allowed.has(w.status));
  }
  result.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  return result;
}

const instanceSummarySelect = {
  id: true,
  title: true,
  status: true,
  templateId: true,
  currentStage: { select: { key: true } },
  completionPercent: true,
  dueAt: true,
  ownerId: true,
  startedAt: true,
} as const;

type InstanceSummaryRow = {
  id: string;
  title: string;
  status: string;
  templateId: string;
  currentStage: { key: string } | null;
  completionPercent: number;
  dueAt: Date | null;
  ownerId: string | null;
  startedAt: Date;
};

function toWorkflowSummary(row: InstanceSummaryRow): WorkflowSummaryForEntity {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    templateId: row.templateId,
    currentStageKey: row.currentStage?.key ?? null,
    completionPercent: row.completionPercent,
    dueAt: row.dueAt ? row.dueAt.toISOString() : null,
    ownerId: row.ownerId,
    startedAt: row.startedAt.toISOString(),
  };
}

/**
 * All workflow instances that touch an entity — either as its PRIMARY subject
 * or via a WorkflowAttachment — deduped by instance id and sorted newest-first.
 */
export async function getWorkflowsForEntity(
  entityType: string,
  entityId: string,
  opts: GetWorkflowsForEntityOpts = {}
): Promise<WorkflowSummaryForEntity[]> {
  if (!isWorkflowEntityType(entityType)) {
    throw new Error(`Invalid workflow entity type: "${entityType}".`);
  }

  const [primaryRows, attachmentRows] = await Promise.all([
    prisma.workflowInstance.findMany({
      where: { subjectType: entityType, subjectId: entityId },
      select: instanceSummarySelect,
    }),
    prisma.workflowAttachment.findMany({
      where: { entityType, entityId },
      select: { workflowInstance: { select: instanceSummarySelect } },
    }),
  ]);

  const combined: WorkflowSummaryForEntity[] = [
    ...primaryRows.map((r) => toWorkflowSummary(r as InstanceSummaryRow)),
    ...attachmentRows.map((a) => toWorkflowSummary(a.workflowInstance as InstanceSummaryRow)),
  ];

  return dedupeWorkflowSummaries(combined, opts);
}

// ---------------------------------------------------------------------------
// getPrimaryWorkflowForEntity
// ---------------------------------------------------------------------------

export type GetPrimaryWorkflowForEntityOpts = {
  templateId?: string;
  templateKey?: string;
};

/**
 * The most recently started ACTIVE/BLOCKED/ON_HOLD instance whose PRIMARY
 * subject matches this entity — across all templates, unless narrowed by
 * `templateId`/`templateKey`. Returns null when none is running.
 */
export async function getPrimaryWorkflowForEntity(
  entityType: string,
  entityId: string,
  opts: GetPrimaryWorkflowForEntityOpts = {}
): Promise<WorkflowSummaryForEntity | null> {
  if (!isWorkflowEntityType(entityType)) {
    throw new Error(`Invalid workflow entity type: "${entityType}".`);
  }

  let templateId = opts.templateId;
  if (!templateId && opts.templateKey) {
    const template = await prisma.workflowTemplate.findUnique({
      where: { key: opts.templateKey },
      select: { id: true },
    });
    if (!template) return null;
    templateId = template.id;
  }

  const row = await prisma.workflowInstance.findFirst({
    where: {
      subjectType: entityType,
      subjectId: entityId,
      status: { in: [...ACTIVE_STATUSES] },
      ...(templateId ? { templateId } : {}),
    },
    select: instanceSummarySelect,
    orderBy: { startedAt: "desc" },
  });

  return row ? toWorkflowSummary(row as InstanceSummaryRow) : null;
}

// ---------------------------------------------------------------------------
// ensureWorkflowForEntity
// ---------------------------------------------------------------------------

export type EnsureWorkflowForEntityInput = {
  entityType: string;
  entityId: string;
  templateKey: string;
  ownerId?: string | null;
  chapterId?: string | null;
  startedById?: string | null;
};

export type EnsureWorkflowForEntityResult = { instanceId: string; created: boolean };

/**
 * Idempotent get-or-start: reuses an already-running instance of this template
 * for this entity if one exists, otherwise starts one. Throws if the template
 * key doesn't resolve to a PUBLISHED template.
 */
export async function ensureWorkflowForEntity(
  input: EnsureWorkflowForEntityInput
): Promise<EnsureWorkflowForEntityResult> {
  if (!isWorkflowEntityType(input.entityType)) {
    throw new Error(`Invalid workflow entity type: "${input.entityType}".`);
  }

  const existing = await getPrimaryWorkflowForEntity(input.entityType, input.entityId, {
    templateKey: input.templateKey,
  });
  if (existing) return { instanceId: existing.id, created: false };

  const template = await prisma.workflowTemplate.findUnique({
    where: { key: input.templateKey },
    select: { id: true, status: true },
  });
  if (!template) {
    throw new Error(`Workflow template not found: "${input.templateKey}".`);
  }
  if (template.status !== "PUBLISHED") {
    throw new Error(`Workflow template "${input.templateKey}" is not published.`);
  }

  const started = await startInstance({
    templateId: template.id,
    subjectType: input.entityType,
    subjectId: input.entityId,
    ownerId: input.ownerId ?? null,
    chapterId: input.chapterId ?? null,
    startedById: input.startedById ?? null,
  });

  return { instanceId: started.id, created: true };
}
