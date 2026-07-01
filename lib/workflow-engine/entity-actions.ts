"use server";

// ============================================================================
// Universal Workflow Engine — entity-scoped activation server actions
// ============================================================================
//
// The mutations behind the new interactive workflow buttons that live on
// entity detail pages (Partner, Class, Application, etc.): start a brand-new
// instance for this entity, attach/detach an existing instance to this
// entity, and list the instances already touching it (for an "attach to an
// existing workflow instead" picker). Mirrors instance-actions.ts's shape:
// validate (zod) → authorize → delegate to the engine/attachment core →
// revalidate → return { ok: true, ... }.

import { revalidatePath } from "next/cache";

import { requireWorkflowRunner, requireWorkflowViewer } from "@/lib/workflow-engine/permissions";
import { startInstance as startInstanceCore } from "@/lib/workflow-engine/engine";
import {
  attachWorkflowToEntity as attachWorkflowToEntityCore,
  detachWorkflowFromEntity as detachWorkflowFromEntityCore,
  getWorkflowsForEntity,
} from "@/lib/workflow-engine/attachment";
import { isWorkflowEntityType } from "@/lib/workflow-engine/entity-types";
import { getTemplateDefinition } from "@/lib/workflow-engine/queries";
import { computeLaunchPreview, type LaunchPreview } from "@/lib/workflow-engine/launch-center";
import {
  AttachWorkflowToEntitySchema,
  DetachWorkflowFromEntitySchema,
  ListActiveWorkflowsForEntitySchema,
  ListAttachableWorkflowCandidatesSchema,
  StartWorkflowForEntitySchema,
  TemplateIdSchema,
} from "@/lib/workflow-engine/schemas";

function revalidateWorkflowViews(instanceId?: string, revalidatePathHint?: string | null) {
  revalidatePath("/workflows");
  if (instanceId) revalidatePath(`/workflows/${instanceId}`);
  if (revalidatePathHint) revalidatePath(revalidatePathHint);
}

/**
 * Start a brand-new workflow instance from a chosen template, scoped to a
 * specific entity as its PRIMARY subject. This is the human "start workflow"
 * button — unlike ensureWorkflowForEntity (which is the idempotent
 * get-or-start used by automated/programmatic callers), this always creates a
 * new instance, because a person clicking "start workflow" has already chosen
 * to start one.
 */
export async function startWorkflowForEntity(
  input: unknown
): Promise<{ ok: true; instanceId: string; created: boolean }> {
  const viewer = await requireWorkflowRunner();
  const data = StartWorkflowForEntitySchema.parse(input);

  if (!isWorkflowEntityType(data.entityType)) {
    throw new Error(`Invalid workflow entity type: "${data.entityType}".`);
  }

  const dueAt = data.dueAt ? new Date(data.dueAt) : null;
  if (dueAt && Number.isNaN(dueAt.getTime())) throw new Error("Invalid due date.");

  const result = await startInstanceCore({
    templateId: data.templateId,
    title: data.title,
    subjectType: data.entityType,
    subjectId: data.entityId,
    chapterId: data.chapterId,
    ownerId: data.ownerId ?? viewer.id,
    startedById: viewer.id,
    dueAt,
  });

  revalidateWorkflowViews(result.id, data.revalidatePathHint);
  return { ok: true, instanceId: result.id, created: true };
}

/** Attach an already-running workflow instance to an entity as a SECONDARY link. */
export async function attachWorkflowToEntityAction(input: unknown): Promise<{ ok: true }> {
  await requireWorkflowRunner();
  const data = AttachWorkflowToEntitySchema.parse(input);

  await attachWorkflowToEntityCore({
    instanceId: data.instanceId,
    entityType: data.entityType,
    entityId: data.entityId,
    relationship: data.relationship ?? undefined,
  });

  revalidateWorkflowViews(data.instanceId);
  return { ok: true };
}

/** Remove a workflow instance's (non-primary) attachment(s) to an entity. */
export async function detachWorkflowFromEntityAction(input: unknown): Promise<{ ok: true }> {
  await requireWorkflowRunner();
  const data = DetachWorkflowFromEntitySchema.parse(input);

  await detachWorkflowFromEntityCore({
    instanceId: data.instanceId,
    entityType: data.entityType,
    entityId: data.entityId,
    relationship: data.relationship ?? undefined,
  });

  revalidateWorkflowViews(data.instanceId);
  return { ok: true };
}

export type ActiveWorkflowForEntity = {
  id: string;
  title: string;
  status: string;
  templateName: string;
};

/**
 * Read-only: the workflow instances already touching an entity, shaped for an
 * "attach to an existing workflow instead of starting a new one" picker.
 * getWorkflowsForEntity's summary doesn't carry a template name, so it's
 * resolved here rather than widening that shared/public return type.
 */
export async function listActiveWorkflowsForEntity(
  input: unknown
): Promise<ActiveWorkflowForEntity[]> {
  await requireWorkflowViewer();
  const data = ListActiveWorkflowsForEntitySchema.parse(input);

  if (!isWorkflowEntityType(data.entityType)) {
    throw new Error(`Invalid workflow entity type: "${data.entityType}".`);
  }

  const summaries = await getWorkflowsForEntity(data.entityType, data.entityId);
  if (summaries.length === 0) return [];

  const { prisma } = await import("@/lib/prisma");
  const templateIds = Array.from(new Set(summaries.map((s) => s.templateId)));
  const templates = await prisma.workflowTemplate.findMany({
    where: { id: { in: templateIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(templates.map((t) => [t.id, t.name]));

  return summaries.map((s) => ({
    id: s.id,
    title: s.title,
    status: s.status,
    templateName: nameById.get(s.templateId) ?? "—",
  }));
}

/**
 * Read-only: the "here's what starting this will do" preview for the embedded
 * WorkflowStartButton modal (components/workflow-engine/workflow-start-button.tsx)
 * — loads the full template definition then shapes it via the pure
 * launch-center helper. Any signed-in viewer may preview (matches
 * requireWorkflowViewer's use elsewhere in this file); only actually starting
 * the workflow requires requireWorkflowRunner.
 */
export async function getTemplatePreview(input: unknown): Promise<LaunchPreview | null> {
  await requireWorkflowViewer();
  const data = TemplateIdSchema.parse(input);

  const definition = await getTemplateDefinition(data.id);
  if (!definition) return null;

  return computeLaunchPreview(definition);
}

const ATTACHABLE_CANDIDATE_LIMIT = 20;

export type AttachableWorkflowCandidate = {
  id: string;
  title: string;
  status: string;
  templateName: string;
};

/**
 * Read-only, lightweight "contains" search over active workflow instance
 * titles/templates for the WorkflowAttachButton picker
 * (components/workflow-engine/workflow-attach-button.tsx) — lets a user
 * type-to-search for an already-running instance to attach, rather than
 * needing to already know its id. Capped at ATTACHABLE_CANDIDATE_LIMIT
 * results; a blank/whitespace-only query returns no results rather than
 * dumping every active instance.
 */
export async function listAttachableWorkflowCandidates(
  input: unknown
): Promise<AttachableWorkflowCandidate[]> {
  await requireWorkflowViewer();
  const data = ListAttachableWorkflowCandidatesSchema.parse(input);

  const query = data.query.trim();
  if (query.length === 0) return [];

  const { prisma } = await import("@/lib/prisma");
  const rows = await prisma.workflowInstance.findMany({
    where: {
      status: { in: ["ACTIVE", "BLOCKED", "ON_HOLD"] },
      ...(data.excludeInstanceId ? { id: { not: data.excludeInstanceId } } : {}),
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { template: { name: { contains: query, mode: "insensitive" } } },
      ],
    },
    select: {
      id: true,
      title: true,
      status: true,
      template: { select: { name: true } },
    },
    orderBy: { startedAt: "desc" },
    take: ATTACHABLE_CANDIDATE_LIMIT,
  });

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    templateName: r.template?.name ?? "—",
  }));
}
