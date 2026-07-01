// ============================================================================
// Universal Workflow Engine — execution core (server-only)
// ============================================================================
//
// The mutating side of the engine: starting instances, completing/blocking
// steps, advancing stages, and — crucially — running automation rules that
// REUSE the existing subsystems instead of duplicating them:
//
//   CREATE_ACTION        → ActionItem            (People-Strategy tracker)
//   CREATE_MEETING       → Meeting               (weekly-meetings)
//   SEND_NOTIFICATION    → createNotification    (lib/notifications)
//   CREATE_WORKFLOW_ITEM → upsertWorkflowItem    (home queue + assignment routing)
//   ESCALATE             → notifications to leadership
//   SCHEDULE_FOLLOW_UP   → instance.followUpAt (engine cron picks it up)
//   ADVANCE_STAGE        → marker: the stage auto-advances when criteria are met
//   START_WORKFLOW       → starts another published template's instance (chaining)
//
// State transitions follow the codebase's "persist then fire side-effects"
// convention (see lib/workflow.ts) — the row is written first, automations run
// after with the global prisma client, so a failed side-effect never corrupts
// the instance (the pure runtime always recomputes from the executions).

import "server-only";

import {
  AdminSubtype,
  MeetingType,
  RoleType,
  type WorkflowKind,
  type WorkflowStage as WorkflowItemStage,
} from "@prisma/client";

import type { AdminSubtypeValue } from "@/lib/admin-subtypes";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { upsertWorkflowItem, resolveWorkflowAssignment } from "@/lib/workflow";
import { ACTION_TYPE_VALUES } from "@/lib/people-strategy/action-types";
import {
  computeCompletionPercent,
  evaluateExitCriteria,
  resolveAdvanceTarget,
} from "@/lib/workflow-engine/runtime";
import { loadInstanceRuntime } from "@/lib/workflow-engine/definition";
import type {
  AutomationRuleDefinition,
  StageDefinition,
  WorkflowTemplateDefinition,
} from "@/lib/workflow-engine/types";
import { WORKFLOW_ENGINE_KIND, WORKFLOW_NOTIFICATION_TYPE } from "@/lib/workflow-engine/constants";

const HOUR_MS = 60 * 60 * 1000;

type InstanceRecord = NonNullable<
  Awaited<ReturnType<typeof prisma.workflowInstance.findUnique>>
>;

function addHours(now: Date, hours: number | null | undefined): Date | null {
  if (!hours || hours <= 0) return null;
  return new Date(now.getTime() + hours * HOUR_MS);
}

function configNumber(config: Record<string, unknown> | null, key: string): number | null {
  const v = config?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function configString(config: Record<string, unknown> | null, key: string): string | null {
  const v = config?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

// User-authored templates store assignee role/subtype as free strings. Validate
// against the real Postgres enums BEFORE any query — an invalid label would make
// Postgres raise "invalid input value for enum …" and abort the operation.
const ROLE_TYPES = new Set<string>(Object.values(RoleType));
const ADMIN_SUBTYPES = new Set<string>(Object.values(AdminSubtype));
const MEETING_TYPES = new Set<string>(Object.values(MeetingType));
const ACTION_TYPES = new Set<string>(ACTION_TYPE_VALUES);
function asRole(s: string | null | undefined): RoleType | null {
  return s && ROLE_TYPES.has(s) ? (s as RoleType) : null;
}
function asSubtype(s: string | null | undefined): AdminSubtypeValue | null {
  return s && ADMIN_SUBTYPES.has(s) ? (s as AdminSubtypeValue) : null;
}
function asMeetingType(s: string | null | undefined): MeetingType | null {
  return s && MEETING_TYPES.has(s) ? (s as MeetingType) : null;
}
function asActionType(s: string | null | undefined): string | null {
  return s && ACTION_TYPES.has(s) ? s : null;
}

async function recordEvent(
  instanceId: string,
  kind:
    | "INSTANCE_CREATED"
    | "STAGE_ENTERED"
    | "STAGE_EXITED"
    | "STEP_STARTED"
    | "STEP_COMPLETED"
    | "STEP_BLOCKED"
    | "STEP_SKIPPED"
    | "AUTOMATION_RAN"
    | "OWNER_CHANGED"
    | "FOLLOW_UP_SCHEDULED"
    | "ESCALATED"
    | "INSTANCE_COMPLETED"
    | "INSTANCE_CANCELLED"
    | "NOTE",
  summary: string,
  extra?: {
    fromStageKey?: string | null;
    toStageKey?: string | null;
    stepKey?: string | null;
    actorId?: string | null;
    data?: Record<string, unknown> | null;
  }
): Promise<void> {
  await prisma.workflowEvent.create({
    data: {
      instanceId,
      kind,
      summary,
      fromStageKey: extra?.fromStageKey ?? null,
      toStageKey: extra?.toStageKey ?? null,
      stepKey: extra?.stepKey ?? null,
      actorId: extra?.actorId ?? null,
      data: (extra?.data ?? undefined) as object | undefined,
    },
  });
}

/** Resolve a user id for an assignee directive, reusing the existing
 *  WorkflowAssignmentRule routing for ROLE/SUBTYPE modes. */
async function resolveAssignee(
  instance: InstanceRecord,
  mode: string | null,
  role: string | null,
  subtype: string | null
): Promise<string | null> {
  switch (mode) {
    case "UNASSIGNED":
      return null;
    case "SUBJECT":
      return instance.subjectType === "USER" ? instance.subjectId : instance.ownerId;
    case "ROLE":
    case "SUBTYPE": {
      const r = asRole(role);
      const st = asSubtype(subtype);
      if (!r && !st) return instance.ownerId; // nothing valid to route on
      try {
        const routed = await resolveWorkflowAssignment({
          kind: WORKFLOW_ENGINE_KIND as WorkflowKind,
          stage: "DELIVERY" as WorkflowItemStage,
          chapterId: instance.chapterId,
          allowedAssigneeRole: r,
          allowedAdminSubtype: st,
        });
        return routed.assigneeUserId ?? instance.ownerId;
      } catch (err) {
        console.error("[workflow-engine] assignee routing failed", err);
        return instance.ownerId;
      }
    }
    case "OWNER":
    default:
      return instance.ownerId;
  }
}

/** Create the WorkflowStepExecution rows for a stage on entry (idempotent —
 *  skips steps that already have an execution for this stage). */
async function materializeStage(
  instance: InstanceRecord,
  stage: StageDefinition,
  now: Date
): Promise<void> {
  const existing = await prisma.workflowStepExecution.findMany({
    where: { instanceId: instance.id, stageKey: stage.key },
    select: { stepKey: true },
  });
  const seen = new Set(existing.map((e) => e.stepKey));

  for (const step of [...stage.steps].sort((a, b) => a.order - b.order)) {
    if (seen.has(step.key)) continue;
    const ownerId = await resolveAssignee(
      instance,
      step.assigneeMode,
      step.assigneeRole,
      step.assigneeSubtype
    );
    await prisma.workflowStepExecution.create({
      data: {
        instanceId: instance.id,
        stepId: step.id,
        stageKey: stage.key,
        stepKey: step.key,
        title: step.name,
        kind: step.kind,
        state: "PENDING",
        isRequired: step.isRequired,
        ownerId: ownerId ?? null,
        dueAt: addHours(now, step.dueOffsetHours),
      },
    });
  }
}

async function linkExecutionArtifact(
  instanceId: string,
  stepKey: string | null,
  patch: {
    linkedActionItemId?: string;
    linkedMeetingId?: string;
    linkedWorkflowItemId?: string;
  }
): Promise<void> {
  if (!stepKey) return;
  const exec = await prisma.workflowStepExecution.findFirst({
    where: { instanceId, stepKey },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (exec) await prisma.workflowStepExecution.update({ where: { id: exec.id }, data: patch });
}

// --- Reuse adapters --------------------------------------------------------

async function effectCreateAction(
  instance: InstanceRecord,
  rule: AutomationRuleDefinition,
  now: Date
): Promise<void> {
  const ownerId = await resolveAssignee(
    instance,
    configString(rule.config, "assigneeMode") ?? "OWNER",
    configString(rule.config, "role"),
    configString(rule.config, "subtype")
  );
  if (!ownerId) return; // an ActionItem requires a lead — skip when unassigned
  const title = configString(rule.config, "title") ?? rule.name;
  const dueHours = configNumber(rule.config, "dueOffsetHours");
  const actionType = asActionType(configString(rule.config, "actionType"));
  const action = await prisma.actionItem.create({
    data: {
      title,
      description: `Auto-created by workflow “${instance.title}”.`,
      actionType,
      status: "NOT_STARTED",
      priority: "MEDIUM",
      visibility: "ALL_LEADERSHIP",
      deadlineStart: now,
      deadlineEnd: addHours(now, dueHours),
      leadId: ownerId,
      createdById: ownerId,
      chapterId: instance.chapterId,
      assignments: {
        create: [
          { userId: ownerId, role: "LEAD" },
          { userId: ownerId, role: "EXECUTING" },
        ],
      },
      comments: {
        create: { authorId: ownerId, type: "NOTE", body: `Created by workflow “${instance.title}”.` },
      },
    },
    select: { id: true },
  });
  await linkExecutionArtifact(instance.id, rule.stepKey, { linkedActionItemId: action.id });
  await recordEvent(instance.id, "AUTOMATION_RAN", `Created action “${title}”.`, {
    stepKey: rule.stepKey,
    data: { ruleId: rule.id, action: "CREATE_ACTION", actionItemId: action.id },
  });
}

async function effectCreateMeeting(
  instance: InstanceRecord,
  rule: AutomationRuleDefinition,
  now: Date
): Promise<void> {
  const ownerId = instance.ownerId;
  const title = configString(rule.config, "title") ?? rule.name;
  const offset = configNumber(rule.config, "offsetHours") ?? 72;
  const meetingType = asMeetingType(configString(rule.config, "meetingType")) ?? "GENERIC";
  const meeting = await prisma.meeting.create({
    data: {
      type: meetingType,
      status: "SCHEDULED",
      title,
      scheduledAt: addHours(now, offset) ?? now,
      facilitatorId: ownerId,
      chapterId: instance.chapterId,
      sourceType: "WorkflowInstance",
      sourceId: instance.id,
      createdById: ownerId,
    },
    select: { id: true },
  });
  await linkExecutionArtifact(instance.id, rule.stepKey, { linkedMeetingId: meeting.id });
  await recordEvent(instance.id, "AUTOMATION_RAN", `Scheduled meeting “${title}”.`, {
    stepKey: rule.stepKey,
    data: { ruleId: rule.id, action: "CREATE_MEETING", meetingId: meeting.id },
  });
}

async function effectNotify(
  instance: InstanceRecord,
  rule: AutomationRuleDefinition
): Promise<void> {
  const userId = await resolveAssignee(
    instance,
    configString(rule.config, "mode") ?? "OWNER",
    configString(rule.config, "role"),
    configString(rule.config, "subtype")
  );
  if (!userId) return;
  await createNotification({
    userId,
    type: WORKFLOW_NOTIFICATION_TYPE,
    title: configString(rule.config, "title") ?? rule.name,
    body: configString(rule.config, "body") ?? `Workflow: ${instance.title}`,
    link: `/workflows/${instance.id}`,
  });
  await recordEvent(instance.id, "AUTOMATION_RAN", `Notified owner.`, {
    stepKey: rule.stepKey,
    data: { ruleId: rule.id, action: "SEND_NOTIFICATION", userId },
  });
}

async function effectWorkflowItem(
  instance: InstanceRecord,
  definition: WorkflowTemplateDefinition,
  rule: AutomationRuleDefinition,
  now: Date
): Promise<void> {
  // Only attach a subject when it is a USER that actually exists — the column is
  // a real FK, so a stale/non-existent id would violate the constraint.
  let subjectUserId: string | null = null;
  if (instance.subjectType === "USER" && instance.subjectId) {
    const user = await prisma.user.findUnique({
      where: { id: instance.subjectId },
      select: { id: true },
    });
    subjectUserId = user?.id ?? null;
  }

  const item = await upsertWorkflowItem({
    kind: WORKFLOW_ENGINE_KIND as WorkflowKind,
    stage: "DELIVERY" as WorkflowItemStage,
    status: "OPEN",
    title: configString(rule.config, "title") ?? instance.title,
    summary: `Workflow step · ${definition.name}`,
    href: `/workflows/${instance.id}`,
    sourceType: "WorkflowInstance",
    sourceId: instance.id,
    chapterId: instance.chapterId,
    subjectUserId,
    dueAt: addHours(now, configNumber(rule.config, "dueOffsetHours")),
    allowedAssigneeRole:
      asRole(configString(rule.config, "role")) ?? asRole(definition.defaultOwnerRole),
    allowedAdminSubtype:
      asSubtype(configString(rule.config, "subtype")) ??
      asSubtype(definition.defaultOwnerSubtype),
    createdById: instance.ownerId,
  });
  await linkExecutionArtifact(instance.id, rule.stepKey, { linkedWorkflowItemId: item.id });
  await recordEvent(instance.id, "AUTOMATION_RAN", `Added to home queue.`, {
    stepKey: rule.stepKey,
    data: { ruleId: rule.id, action: "CREATE_WORKFLOW_ITEM", workflowItemId: item.id },
  });
}

async function effectScheduleFollowUp(
  instance: InstanceRecord,
  definition: WorkflowTemplateDefinition,
  rule: AutomationRuleDefinition,
  now: Date
): Promise<void> {
  const offset =
    configNumber(rule.config, "offsetHours") ?? definition.followUpCadenceHours ?? 168;
  const followUpAt = addHours(now, offset);
  await prisma.workflowInstance.update({
    where: { id: instance.id },
    data: { followUpAt },
  });
  await recordEvent(instance.id, "FOLLOW_UP_SCHEDULED", `Follow-up scheduled.`, {
    stepKey: rule.stepKey,
    data: { ruleId: rule.id, followUpAt: followUpAt?.toISOString() ?? null },
  });
}

async function effectEscalate(
  instance: InstanceRecord,
  rule: AutomationRuleDefinition,
  now: Date
): Promise<void> {
  await prisma.workflowInstance.update({
    where: { id: instance.id },
    data: { escalatedAt: instance.escalatedAt ?? now, lastEscalationAt: now },
  });
  // Reuse the notification system to alert leadership.
  const leaders = await prisma.user.findMany({
    where: { adminSubtypes: { some: { subtype: { in: ["SUPER_ADMIN", "LEADERSHIP"] } } } },
    select: { id: true },
    take: 10,
  });
  const recipients = new Set<string>(leaders.map((l) => l.id));
  if (instance.ownerId) recipients.add(instance.ownerId);
  await Promise.all(
    Array.from(recipients).map((userId) =>
      createNotification({
        userId,
        type: WORKFLOW_NOTIFICATION_TYPE,
        title: configString(rule.config, "title") ?? "Workflow escalation",
        body: `“${instance.title}” needs attention.`,
        link: `/workflows/${instance.id}`,
      })
    )
  );
  await recordEvent(instance.id, "ESCALATED", `Escalated to leadership.`, {
    stepKey: rule.stepKey,
    data: { ruleId: rule.id, recipients: recipients.size },
  });
}

/** Start another published template's instance for the same subject/chapter —
 *  real workflow chaining (e.g. Chapter Launch completing starts Instructor
 *  Hiring). Reuses startInstance(), the exact path the "Start Workflow" UI
 *  uses, so chained instances behave identically to manually-started ones. */
async function effectStartWorkflow(
  instance: InstanceRecord,
  definition: WorkflowTemplateDefinition,
  rule: AutomationRuleDefinition,
  now: Date
): Promise<void> {
  const targetKey = configString(rule.config, "targetBlueprintKey");
  if (!targetKey || targetKey === definition.key) return; // guard a trivial self-chain

  const target = await prisma.workflowTemplate.findUnique({
    where: { key: targetKey },
    select: {
      id: true,
      key: true,
      name: true,
      status: true,
      defaultOwnerRole: true,
      defaultOwnerSubtype: true,
    },
  });
  if (!target || target.status !== "PUBLISHED") {
    await recordEvent(
      instance.id,
      "AUTOMATION_RAN",
      `Could not start “${targetKey}”: template not found or not published.`,
      { data: { ruleId: rule.id, action: "START_WORKFLOW", targetKey, skipped: "missing_or_unpublished" } }
    );
    return;
  }

  const existing = await prisma.workflowInstance.findFirst({
    where: {
      templateId: target.id,
      subjectType: instance.subjectType,
      subjectId: instance.subjectId,
      status: { in: ["ACTIVE", "BLOCKED", "ON_HOLD"] },
    },
    select: { id: true },
  });
  if (existing) {
    await recordEvent(
      instance.id,
      "AUTOMATION_RAN",
      `Skipped starting “${target.name}”: already running for this subject.`,
      { data: { ruleId: rule.id, action: "START_WORKFLOW", targetKey, existingInstanceId: existing.id } }
    );
    return;
  }

  let ownerId = instance.ownerId;
  if (target.defaultOwnerRole) {
    ownerId = (await resolveAssignee(instance, "ROLE", target.defaultOwnerRole, null)) ?? ownerId;
  } else if (target.defaultOwnerSubtype) {
    ownerId = (await resolveAssignee(instance, "SUBTYPE", null, target.defaultOwnerSubtype)) ?? ownerId;
  }

  const title = configString(rule.config, "title") ?? `${target.name} (from ${instance.title})`;
  const started = await startInstance({
    templateId: target.id,
    title,
    subjectType: instance.subjectType,
    subjectId: instance.subjectId,
    chapterId: instance.chapterId,
    ownerId,
    startedById: instance.startedById ?? instance.ownerId ?? null,
    now,
  });

  await recordEvent(instance.id, "AUTOMATION_RAN", `Started “${target.name}”.`, {
    data: { ruleId: rule.id, action: "START_WORKFLOW", targetKey, newInstanceId: started.id },
  });
}

/** Run all enabled automations matching a trigger (and optional stage scope).
 *  ADVANCE_STAGE is a marker, never executed here. */
async function runAutomations(
  instance: InstanceRecord,
  definition: WorkflowTemplateDefinition,
  trigger: AutomationRuleDefinition["trigger"],
  opts: { stageKey?: string | null; now: Date }
): Promise<void> {
  const rules = definition.automationRules
    .filter((r) => r.enabled && r.trigger === trigger && r.action !== "ADVANCE_STAGE")
    .filter((r) => !r.stageKey || r.stageKey === opts.stageKey)
    .sort((a, b) => a.order - b.order);

  for (const rule of rules) {
    try {
      switch (rule.action) {
        case "CREATE_ACTION":
          await effectCreateAction(instance, rule, opts.now);
          break;
        case "CREATE_MEETING":
          await effectCreateMeeting(instance, rule, opts.now);
          break;
        case "SEND_NOTIFICATION":
          await effectNotify(instance, rule);
          break;
        case "CREATE_WORKFLOW_ITEM":
          await effectWorkflowItem(instance, definition, rule, opts.now);
          break;
        case "SCHEDULE_FOLLOW_UP":
          await effectScheduleFollowUp(instance, definition, rule, opts.now);
          break;
        case "ESCALATE":
          await effectEscalate(instance, rule, opts.now);
          break;
        case "START_WORKFLOW":
          await effectStartWorkflow(instance, definition, rule, opts.now);
          break;
        default:
          break;
      }
    } catch (err) {
      // Side-effects are best-effort (matches lib/workflow's fire-and-forget).
      console.error(`[workflow-engine] automation ${rule.id} (${rule.action}) failed`, err);
    }
  }
}

function stageHasAutoAdvance(
  definition: WorkflowTemplateDefinition,
  stageKey: string
): boolean {
  return definition.automationRules.some(
    (r) => r.enabled && r.action === "ADVANCE_STAGE" && (!r.stageKey || r.stageKey === stageKey)
  );
}

/** Recompute and persist the instance's completion % and blocked status. */
async function recompute(instanceId: string): Promise<void> {
  const loaded = await loadInstanceRuntime(instanceId);
  if (!loaded) return;
  const { definition, instance, executions } = loaded;
  if (instance.status === "COMPLETED" || instance.status === "CANCELLED") return;

  const completionPercent = computeCompletionPercent(definition, instance, executions);
  const currentStageExecs = executions.filter((e) => e.stageKey === instance.currentStageKey);
  const blocked = currentStageExecs.some((e) => e.state === "BLOCKED");
  const nextStatus = blocked ? "BLOCKED" : instance.status === "ON_HOLD" ? "ON_HOLD" : "ACTIVE";

  await prisma.workflowInstance.update({
    where: { id: instanceId },
    data: { completionPercent, status: nextStatus },
  });
}

// --- Public engine operations ---------------------------------------------

export type StartInstanceArgs = {
  templateId: string;
  title?: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
  chapterId?: string | null;
  ownerId?: string | null;
  startedById?: string | null;
  dueAt?: Date | null;
  now?: Date;
};

/** Create a running instance from a template and enter its initial stage. */
export async function startInstance(args: StartInstanceArgs): Promise<{ id: string }> {
  const now = args.now ?? new Date();
  const loadedTemplate = await loadInstanceTemplate(args.templateId);
  if (!loadedTemplate) throw new Error("Workflow template not found.");
  const definition = loadedTemplate;
  if (definition.stages.length === 0) throw new Error("Template has no stages.");

  const initial =
    definition.stages.find((s) => s.isInitial) ??
    [...definition.stages].sort((a, b) => a.order - b.order)[0];

  const instance = await prisma.workflowInstance.create({
    data: {
      templateId: definition.id,
      title: args.title?.trim() || definition.name,
      status: "ACTIVE",
      currentStageId: initial.id,
      subjectType: args.subjectType ?? null,
      subjectId: args.subjectId ?? null,
      chapterId: args.chapterId ?? null,
      ownerId: args.ownerId ?? null,
      startedById: args.startedById ?? null,
      dueAt: args.dueAt ?? null,
    },
  });

  await recordEvent(instance.id, "INSTANCE_CREATED", `Workflow started: ${instance.title}.`, {
    toStageKey: initial.key,
    actorId: args.startedById ?? null,
  });
  await materializeStage(instance, initial, now);
  await recordEvent(instance.id, "STAGE_ENTERED", `Entered stage “${initial.name}”.`, {
    toStageKey: initial.key,
  });

  await runAutomations(instance, definition, "ON_INSTANCE_START", { now });
  await runAutomations(instance, definition, "ON_STAGE_ENTER", { stageKey: initial.key, now });
  await recompute(instance.id);

  return { id: instance.id };
}

async function loadInstanceTemplate(templateId: string): Promise<WorkflowTemplateDefinition | null> {
  const { loadTemplateDefinition } = await import("@/lib/workflow-engine/definition");
  return loadTemplateDefinition(templateId);
}

/** Mark a step execution complete and react (automations + maybe advance). */
export async function completeStep(
  executionId: string,
  opts: { actorId?: string | null; output?: Record<string, unknown> | null; now?: Date } = {}
): Promise<void> {
  const now = opts.now ?? new Date();
  const exec = await prisma.workflowStepExecution.findUnique({ where: { id: executionId } });
  if (!exec) throw new Error("Step not found.");
  if (exec.state === "COMPLETE") return;

  await prisma.workflowStepExecution.update({
    where: { id: executionId },
    data: {
      state: "COMPLETE",
      completedAt: now,
      completedById: opts.actorId ?? null,
      startedAt: exec.startedAt ?? now,
      blockedReason: null,
      output: (opts.output ?? undefined) as object | undefined,
    },
  });

  const loaded = await loadInstanceRuntime(exec.instanceId);
  if (!loaded) return;
  const { definition } = loaded;
  const instance = await prisma.workflowInstance.findUnique({ where: { id: exec.instanceId } });
  if (!instance) return;

  await recordEvent(instance.id, "STEP_COMPLETED", `Completed “${exec.title}”.`, {
    stepKey: exec.stepKey,
    actorId: opts.actorId ?? null,
  });
  await runAutomations(instance, definition, "ON_STEP_COMPLETE", {
    stageKey: exec.stageKey,
    now,
  });
  await recompute(instance.id);

  // Auto-advance when this stage is flagged auto-advancing and its gate is met.
  if (instance.currentStageId) {
    const stage = definition.stages.find((s) => s.id === instance.currentStageId);
    if (stage && stageHasAutoAdvance(definition, stage.key)) {
      const stageExecs = (await loadInstanceRuntime(instance.id))?.executions.filter(
        (e) => e.stageKey === stage.key
      ) ?? [];
      if (evaluateExitCriteria(stage, stageExecs).met) {
        await advanceInstance(instance.id, { actorId: opts.actorId, now });
      }
    }
  }
}

export async function blockStep(
  executionId: string,
  reason: string,
  opts: { actorId?: string | null; now?: Date } = {}
): Promise<void> {
  const now = opts.now ?? new Date();
  const exec = await prisma.workflowStepExecution.update({
    where: { id: executionId },
    data: { state: "BLOCKED", blockedReason: reason, startedAt: undefined },
  });
  await recordEvent(exec.instanceId, "STEP_BLOCKED", `Blocked “${exec.title}”: ${reason}`, {
    stepKey: exec.stepKey,
    actorId: opts.actorId ?? null,
  });
  void now;
  await recompute(exec.instanceId);
}

export async function unblockStep(
  executionId: string,
  opts: { actorId?: string | null } = {}
): Promise<void> {
  const exec = await prisma.workflowStepExecution.update({
    where: { id: executionId },
    data: { state: "IN_PROGRESS", blockedReason: null },
  });
  await recordEvent(exec.instanceId, "NOTE", `Unblocked “${exec.title}”.`, {
    stepKey: exec.stepKey,
    actorId: opts.actorId ?? null,
  });
  await recompute(exec.instanceId);
}

export async function skipStep(
  executionId: string,
  opts: { actorId?: string | null; now?: Date } = {}
): Promise<void> {
  const now = opts.now ?? new Date();
  const current = await prisma.workflowStepExecution.findUnique({ where: { id: executionId } });
  if (!current) throw new Error("Step not found.");
  // Don't downgrade an already-finished step (and re-fire its automations).
  if (current.state === "COMPLETE" || current.state === "SKIPPED") return;
  const exec = await prisma.workflowStepExecution.update({
    where: { id: executionId },
    data: { state: "SKIPPED", completedAt: now, completedById: opts.actorId ?? null },
  });
  await recordEvent(exec.instanceId, "STEP_SKIPPED", `Skipped “${exec.title}”.`, {
    stepKey: exec.stepKey,
    actorId: opts.actorId ?? null,
  });
  // Skipping can satisfy a gate too — re-run the same completion reaction.
  await completeStepReaction(exec.instanceId, exec.stageKey, opts.actorId ?? null, now);
}

async function completeStepReaction(
  instanceId: string,
  stageKey: string,
  actorId: string | null,
  now: Date
): Promise<void> {
  const loaded = await loadInstanceRuntime(instanceId);
  if (!loaded) return;
  const { definition } = loaded;
  const instance = await prisma.workflowInstance.findUnique({ where: { id: instanceId } });
  if (!instance) return;
  await runAutomations(instance, definition, "ON_STEP_COMPLETE", { stageKey, now });
  await recompute(instanceId);
  if (instance.currentStageId) {
    const stage = definition.stages.find((s) => s.id === instance.currentStageId);
    if (stage && stageHasAutoAdvance(definition, stage.key)) {
      const stageExecs =
        (await loadInstanceRuntime(instanceId))?.executions.filter(
          (e) => e.stageKey === stage.key
        ) ?? [];
      if (evaluateExitCriteria(stage, stageExecs).met) {
        await advanceInstance(instanceId, { actorId, now });
      }
    }
  }
}

export async function reassignStep(executionId: string, ownerId: string): Promise<void> {
  const exec = await prisma.workflowStepExecution.update({
    where: { id: executionId },
    data: { ownerId },
  });
  await recordEvent(exec.instanceId, "OWNER_CHANGED", `Reassigned “${exec.title}”.`, {
    stepKey: exec.stepKey,
    data: { ownerId },
  });
}

/** Advance an instance to the next stage (or complete it if terminal). When
 *  `toStageId` is given, it's a manual override that skips the exit gate.
 *  `depth` bounds chained auto-advances so a misconfigured cycle can't loop. */
export async function advanceInstance(
  instanceId: string,
  opts: { actorId?: string | null; toStageId?: string | null; now?: Date; depth?: number } = {}
): Promise<void> {
  const now = opts.now ?? new Date();
  const depth = opts.depth ?? 0;
  const loaded = await loadInstanceRuntime(instanceId);
  if (!loaded) return;
  const { definition, instance, executions } = loaded;
  if (instance.status === "COMPLETED" || instance.status === "CANCELLED") return;
  if (depth > definition.stages.length + 1) return; // cycle guard

  const current = instance.currentStageKey
    ? definition.stages.find((s) => s.key === instance.currentStageKey)
    : null;

  // Manual override to a specific stage.
  if (opts.toStageId) {
    const target = definition.stages.find((s) => s.id === opts.toStageId);
    if (!target) throw new Error("Target stage not found.");
    await leaveAndEnter(instanceId, definition, current, target, opts.actorId ?? null, now, depth);
    return;
  }

  if (!current) return;
  const stageExecs = executions.filter((e) => e.stageKey === current.key);
  const exit = evaluateExitCriteria(current, stageExecs);
  if (!exit.met) return; // gate not satisfied

  if (current.isTerminal) {
    await completeInstance(instanceId, opts.actorId ?? null, now);
    return;
  }

  const targetKey = resolveAdvanceTarget(definition, current.key);
  const target = targetKey ? definition.stages.find((s) => s.key === targetKey) : null;
  if (!target) {
    // Nowhere to go but the gate is met — treat as complete.
    await completeInstance(instanceId, opts.actorId ?? null, now);
    return;
  }
  await leaveAndEnter(instanceId, definition, current, target, opts.actorId ?? null, now, depth);
}

async function leaveAndEnter(
  instanceId: string,
  definition: WorkflowTemplateDefinition,
  fromStage: StageDefinition | null | undefined,
  target: StageDefinition,
  actorId: string | null,
  now: Date,
  depth = 0
): Promise<void> {
  const instance = await prisma.workflowInstance.findUnique({ where: { id: instanceId } });
  if (!instance) return;

  // Compare-and-set: only the writer that still sees the expected current stage
  // performs the transition and its ON_STAGE_ENTER side-effects. Concurrent
  // advances (and lost self-loop races) become a no-op, so the reused Actions /
  // Meetings are never created twice.
  const claimed = await prisma.workflowInstance.updateMany({
    where: {
      id: instanceId,
      currentStageId: instance.currentStageId,
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
    data: { currentStageId: target.id, status: "ACTIVE" },
  });
  if (claimed.count === 0) return;

  if (fromStage) {
    await recordEvent(instanceId, "STAGE_EXITED", `Left stage “${fromStage.name}”.`, {
      fromStageKey: fromStage.key,
      toStageKey: target.key,
      actorId,
    });
    await runAutomations(instance, definition, "ON_STAGE_EXIT", {
      stageKey: fromStage.key,
      now,
    });
  }

  const refreshed = await prisma.workflowInstance.findUnique({ where: { id: instanceId } });
  if (!refreshed) return;

  await materializeStage(refreshed, target, now);
  await recordEvent(instanceId, "STAGE_ENTERED", `Entered stage “${target.name}”.`, {
    toStageKey: target.key,
    actorId,
  });
  await runAutomations(refreshed, definition, "ON_STAGE_ENTER", { stageKey: target.key, now });
  await recompute(instanceId);

  if (target.isTerminal) {
    // A terminal stage with no steps completes immediately.
    if (target.steps.length === 0) await completeInstance(instanceId, actorId, now);
    return;
  }

  // Chained auto-advance: if the freshly-entered stage is flagged auto-advancing
  // and its exit gate is ALREADY satisfied (e.g. only optional steps), keep
  // going instead of stalling with a met gate.
  if (stageHasAutoAdvance(definition, target.key)) {
    const fresh = await loadInstanceRuntime(instanceId);
    const targetExecs = fresh?.executions.filter((e) => e.stageKey === target.key) ?? [];
    if (evaluateExitCriteria(target, targetExecs).met) {
      await advanceInstance(instanceId, { actorId, now, depth: depth + 1 });
    }
  }
}

export async function completeInstance(
  instanceId: string,
  actorId: string | null,
  now: Date
): Promise<void> {
  const instance = await prisma.workflowInstance.findUnique({ where: { id: instanceId } });
  if (!instance || instance.status === "COMPLETED") return;
  await prisma.workflowInstance.update({
    where: { id: instanceId },
    data: { status: "COMPLETED", completedAt: now, completionPercent: 100, followUpAt: null },
  });
  await recordEvent(instanceId, "INSTANCE_COMPLETED", `Workflow completed.`, { actorId });
  const loaded = await loadInstanceRuntime(instanceId);
  if (loaded) {
    const refreshed = await prisma.workflowInstance.findUnique({ where: { id: instanceId } });
    if (refreshed) {
      await runAutomations(refreshed, loaded.definition, "ON_INSTANCE_COMPLETE", { now });
    }
  }
}

export async function cancelInstance(
  instanceId: string,
  opts: { actorId?: string | null; reason?: string | null; now?: Date } = {}
): Promise<void> {
  const now = opts.now ?? new Date();
  await prisma.workflowInstance.update({
    where: { id: instanceId },
    data: { status: "CANCELLED", cancelledAt: now, followUpAt: null },
  });
  await recordEvent(instanceId, "INSTANCE_CANCELLED", opts.reason ?? `Workflow cancelled.`, {
    actorId: opts.actorId ?? null,
  });
}

export async function setInstanceOwner(instanceId: string, ownerId: string): Promise<void> {
  await prisma.workflowInstance.update({ where: { id: instanceId }, data: { ownerId } });
  await recordEvent(instanceId, "OWNER_CHANGED", `Owner reassigned.`, { data: { ownerId } });
}

export async function addInstanceNote(
  instanceId: string,
  body: string,
  actorId: string | null
): Promise<void> {
  await recordEvent(instanceId, "NOTE", body, { actorId });
}

/** Run a lifecycle trigger's automations for an instance — used by the engine
 *  cron for ON_OVERDUE / ON_FOLLOW_UP_DUE. Returns how many rules matched. */
export async function runInstanceTrigger(
  instanceId: string,
  trigger: AutomationRuleDefinition["trigger"],
  now: Date = new Date()
): Promise<number> {
  const loaded = await loadInstanceRuntime(instanceId);
  if (!loaded) return 0;
  const instance = await prisma.workflowInstance.findUnique({ where: { id: instanceId } });
  if (!instance) return 0;
  const matched = loaded.definition.automationRules.filter(
    (r) =>
      r.enabled &&
      r.trigger === trigger &&
      r.action !== "ADVANCE_STAGE" &&
      (!r.stageKey || r.stageKey === loaded.instance.currentStageKey)
  ).length;
  await runAutomations(instance, loaded.definition, trigger, {
    stageKey: loaded.instance.currentStageKey,
    now,
  });
  return matched;
}
