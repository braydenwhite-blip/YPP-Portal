// ============================================================================
// Universal Workflow Engine — read loaders (server-only)
// ============================================================================
//
// Page/data loaders that compose the Prisma reads with the pure runtime +
// analytics. Everything returned is serializable so server pages can hand it to
// "use client" components directly.

import "server-only";

import { prisma } from "@/lib/prisma";
import { computeRuntimeState } from "@/lib/workflow-engine/runtime";
import {
  loadInstanceRuntime,
  loadTemplateDefinition,
} from "@/lib/workflow-engine/definition";
import {
  buildPortfolioAnalytics,
  type InstanceAnalyticsRecord,
  type PortfolioAnalytics,
  type StageDwellRecord,
} from "@/lib/workflow-engine/analytics";
import type {
  RuntimeState,
  StepExecutionView,
  WorkflowTemplateDefinition,
  InstanceView,
} from "@/lib/workflow-engine/types";
import { workflowDomainLabel } from "@/lib/workflow-engine/constants";

async function namesFor(ids: Array<string | null | undefined>): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter((x): x is string => !!x)));
  if (unique.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true },
  });
  return new Map(users.map((u) => [u.id, u.name ?? "Unknown"]));
}

export type TemplateSummary = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  domain: string | null;
  domainLabel: string;
  status: string;
  isBlueprint: boolean;
  stageCount: number;
  stepCount: number;
  automationCount: number;
  instanceCount: number;
  activeInstanceCount: number;
};

export async function listTemplates(opts: { includeArchived?: boolean } = {}): Promise<
  TemplateSummary[]
> {
  const templates = await prisma.workflowTemplate.findMany({
    where: opts.includeArchived ? {} : { status: { not: "ARCHIVED" } },
    include: {
      _count: { select: { automationRules: true, instances: true } },
      stages: { select: { _count: { select: { steps: true } } } },
      instances: { where: { status: { in: ["ACTIVE", "BLOCKED", "ON_HOLD"] } }, select: { id: true } },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  return templates.map((t) => ({
    id: t.id,
    key: t.key,
    name: t.name,
    description: t.description,
    domain: t.domain,
    domainLabel: workflowDomainLabel(t.domain),
    status: t.status,
    isBlueprint: t.isBlueprint,
    stageCount: t.stages.length,
    stepCount: t.stages.reduce((sum, s) => sum + s._count.steps, 0),
    automationCount: t._count.automationRules,
    instanceCount: t._count.instances,
    activeInstanceCount: t.instances.length,
  }));
}

/** Published templates only — the start-a-workflow picker. */
export async function listStartableTemplates(): Promise<TemplateSummary[]> {
  return (await listTemplates()).filter((t) => t.status === "PUBLISHED");
}

export async function getTemplateDefinition(
  templateId: string
): Promise<WorkflowTemplateDefinition | null> {
  return loadTemplateDefinition(templateId);
}

export type InstanceSummary = {
  id: string;
  title: string;
  status: string;
  templateName: string;
  domainLabel: string;
  ownerId: string | null;
  ownerName: string | null;
  completionPercent: number;
  currentStageName: string | null;
  startedAt: string;
  dueAt: string | null;
  isOverdue: boolean;
};

export type InstanceFilter = {
  status?: string[];
  templateId?: string;
  ownerId?: string;
  chapterId?: string;
};

export async function listInstances(filter: InstanceFilter = {}): Promise<InstanceSummary[]> {
  const now = Date.now();
  const instances = await prisma.workflowInstance.findMany({
    where: {
      ...(filter.status && filter.status.length > 0
        ? { status: { in: filter.status as never } }
        : {}),
      ...(filter.templateId ? { templateId: filter.templateId } : {}),
      ...(filter.ownerId ? { ownerId: filter.ownerId } : {}),
      ...(filter.chapterId ? { chapterId: filter.chapterId } : {}),
    },
    include: {
      template: { select: { name: true, domain: true } },
      currentStage: { select: { name: true } },
    },
    orderBy: [{ status: "asc" }, { startedAt: "desc" }],
    take: 200,
  });

  const names = await namesFor(instances.map((i) => i.ownerId));

  return instances.map((i) => {
    const due = i.dueAt ? i.dueAt.getTime() : null;
    const overdue =
      ["ACTIVE", "BLOCKED", "ON_HOLD"].includes(i.status) && due !== null && now > due;
    return {
      id: i.id,
      title: i.title,
      status: i.status,
      templateName: i.template?.name ?? "—",
      domainLabel: workflowDomainLabel(i.template?.domain ?? null),
      ownerId: i.ownerId,
      ownerName: i.ownerId ? names.get(i.ownerId) ?? null : null,
      completionPercent: i.completionPercent,
      currentStageName: i.currentStage?.name ?? null,
      startedAt: i.startedAt.toISOString(),
      dueAt: i.dueAt ? i.dueAt.toISOString() : null,
      isOverdue: overdue,
    };
  });
}

export type InstanceTimelineEvent = {
  id: string;
  kind: string;
  summary: string;
  actorName: string | null;
  createdAt: string;
};

export type InstanceDetail = {
  instance: InstanceView;
  definition: WorkflowTemplateDefinition;
  executions: StepExecutionView[];
  runtime: RuntimeState;
  templateName: string;
  ownerName: string | null;
  /** Per-step owner names keyed by StepExecutionView.ownerId, batch-resolved
   *  in one extra query alongside the instance owner / event actors (a plain
   *  Record, not a Map, so it survives the server→client serialization
   *  boundary when handed to WorkflowRunner). */
  executionOwnerNames: Record<string, string>;
  events: InstanceTimelineEvent[];
};

export async function getInstanceDetail(instanceId: string): Promise<InstanceDetail | null> {
  const loaded = await loadInstanceRuntime(instanceId);
  if (!loaded) return null;
  const { definition, instance, executions } = loaded;

  const runtime = computeRuntimeState({
    template: definition,
    instance,
    executions,
    now: new Date().toISOString(),
  });

  const eventRows = await prisma.workflowEvent.findMany({
    where: { instanceId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const names = await namesFor([
    instance.ownerId,
    ...eventRows.map((e) => e.actorId),
    ...executions.map((e) => e.ownerId),
  ]);

  return {
    instance,
    definition,
    executions,
    runtime,
    templateName: definition.name,
    ownerName: instance.ownerId ? names.get(instance.ownerId) ?? null : null,
    executionOwnerNames: Object.fromEntries(names),
    events: eventRows.map((e) => ({
      id: e.id,
      kind: e.kind,
      summary: e.summary,
      actorName: e.actorId ? names.get(e.actorId) ?? null : null,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

// --- Analytics -------------------------------------------------------------

function buildDwellRecords(
  events: Array<{
    instanceId: string;
    templateId: string;
    kind: string;
    toStageKey: string | null;
    fromStageKey: string | null;
    createdAt: Date;
    stageNameByKey: Map<string, string>;
  }>
): StageDwellRecord[] {
  // Pair STAGE_ENTERED (toStageKey) with the next STAGE_EXITED/COMPLETED.
  const byInstance = new Map<string, typeof events>();
  for (const e of events) {
    const arr = byInstance.get(e.instanceId) ?? [];
    arr.push(e);
    byInstance.set(e.instanceId, arr);
  }
  const records: StageDwellRecord[] = [];
  for (const arr of byInstance.values()) {
    const ordered = [...arr].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    let open: { stageKey: string; enteredAt: Date; templateId: string } | null = null;
    for (const e of ordered) {
      if (e.kind === "STAGE_ENTERED" && e.toStageKey) {
        if (open) {
          records.push({
            templateId: open.templateId,
            stageKey: open.stageKey,
            stageName: e.stageNameByKey.get(open.stageKey) ?? open.stageKey,
            enteredAt: open.enteredAt.toISOString(),
            exitedAt: e.createdAt.toISOString(),
          });
        }
        open = { stageKey: e.toStageKey, enteredAt: e.createdAt, templateId: e.templateId };
      } else if ((e.kind === "STAGE_EXITED" || e.kind === "INSTANCE_COMPLETED") && open) {
        records.push({
          templateId: open.templateId,
          stageKey: open.stageKey,
          stageName: e.stageNameByKey.get(open.stageKey) ?? open.stageKey,
          enteredAt: open.enteredAt.toISOString(),
          exitedAt: e.createdAt.toISOString(),
        });
        open = null;
      }
    }
    if (open) {
      records.push({
        templateId: open.templateId,
        stageKey: open.stageKey,
        stageName: open.stageKey,
        enteredAt: open.enteredAt.toISOString(),
        exitedAt: null,
      });
    }
  }
  return records;
}

export type WorkflowAnalytics = PortfolioAnalytics & {
  generatedAt: string;
};

export async function getWorkflowAnalytics(
  filter: { templateId?: string } = {}
): Promise<WorkflowAnalytics> {
  const now = new Date();
  const where = filter.templateId ? { templateId: filter.templateId } : {};

  const [instances, events, stages] = await Promise.all([
    prisma.workflowInstance.findMany({
      where,
      select: {
        id: true,
        templateId: true,
        status: true,
        startedAt: true,
        completedAt: true,
        dueAt: true,
      },
    }),
    prisma.workflowEvent.findMany({
      where: {
        kind: { in: ["STAGE_ENTERED", "STAGE_EXITED", "INSTANCE_COMPLETED"] },
        ...(filter.templateId ? { instance: { templateId: filter.templateId } } : {}),
      },
      select: {
        instanceId: true,
        kind: true,
        toStageKey: true,
        fromStageKey: true,
        createdAt: true,
        instance: { select: { templateId: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 5000,
    }),
    prisma.workflowTemplateStage.findMany({ select: { key: true, name: true } }),
  ]);

  const stageNameByKey = new Map(stages.map((s) => [s.key, s.name]));

  const analyticsInstances: InstanceAnalyticsRecord[] = instances.map((i) => ({
    id: i.id,
    templateId: i.templateId,
    status: i.status as InstanceAnalyticsRecord["status"],
    startedAt: i.startedAt.toISOString(),
    completedAt: i.completedAt ? i.completedAt.toISOString() : null,
    dueAt: i.dueAt ? i.dueAt.toISOString() : null,
  }));

  const dwell = buildDwellRecords(
    events.map((e) => ({
      instanceId: e.instanceId,
      templateId: e.instance?.templateId ?? "",
      kind: e.kind,
      toStageKey: e.toStageKey,
      fromStageKey: e.fromStageKey,
      createdAt: e.createdAt,
      stageNameByKey,
    }))
  );

  const portfolio = buildPortfolioAnalytics(
    analyticsInstances,
    dwell,
    now.toISOString()
  );
  return { ...portfolio, generatedAt: now.toISOString() };
}
