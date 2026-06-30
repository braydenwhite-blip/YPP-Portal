// ============================================================================
// Universal Workflow Engine — scheduled maintenance (server-only)
// ============================================================================
//
// One daily job that (1) fires ON_FOLLOW_UP_DUE automations for instances whose
// follow-up has come due, (2) fires ON_OVERDUE automations (escalation) for
// overdue instances — deduped to once/day via lastEscalationAt — and (3) rolls
// up WorkflowMetric analytics buckets. Invoked from app/api/cron/workflow-engine.

import "server-only";

import { prisma } from "@/lib/prisma";
import { runInstanceTrigger } from "@/lib/workflow-engine/engine";
import { getWorkflowAnalytics } from "@/lib/workflow-engine/queries";
import { createNotification } from "@/lib/notifications";
import { WORKFLOW_METRIC_KEYS, WORKFLOW_NOTIFICATION_TYPE } from "@/lib/workflow-engine/constants";

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE = ["ACTIVE", "BLOCKED", "ON_HOLD"] as const;

export type WorkflowCronResult = {
  followUpsFired: number;
  overdueEscalated: number;
  metricsWritten: number;
};

async function processFollowUps(now: Date): Promise<number> {
  const due = await prisma.workflowInstance.findMany({
    where: { status: { in: ACTIVE as never }, followUpAt: { not: null, lte: now } },
    select: { id: true, title: true, ownerId: true },
    take: 200,
  });
  let fired = 0;
  for (const inst of due) {
    const matched = await runInstanceTrigger(inst.id, "ON_FOLLOW_UP_DUE", now);
    // Always nudge the owner even if the template defined no explicit rule.
    if (matched === 0 && inst.ownerId) {
      await createNotification({
        userId: inst.ownerId,
        type: WORKFLOW_NOTIFICATION_TYPE,
        title: "Workflow follow-up due",
        body: `Follow up on “${inst.title}”.`,
        link: `/workflows/${inst.id}`,
      });
    }
    await prisma.workflowInstance.update({
      where: { id: inst.id },
      data: { followUpAt: null },
    });
    fired += 1;
  }
  return fired;
}

async function processOverdue(now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - DAY_MS);
  const overdue = await prisma.workflowInstance.findMany({
    where: {
      status: { in: ACTIVE as never },
      dueAt: { not: null, lt: now },
      OR: [{ lastEscalationAt: null }, { lastEscalationAt: { lt: cutoff } }],
    },
    select: { id: true },
    take: 200,
  });
  let escalated = 0;
  for (const inst of overdue) {
    await runInstanceTrigger(inst.id, "ON_OVERDUE", now);
    escalated += 1;
  }
  return escalated;
}

async function snapshotMetrics(now: Date): Promise<number> {
  const dayKey = now.toISOString().slice(0, 10);
  const analytics = await getWorkflowAnalytics();
  const rows: Array<{ metricKey: string; value: number }> = [
    { metricKey: WORKFLOW_METRIC_KEYS.COMPLETION_RATE, value: analytics.completionRate },
    { metricKey: WORKFLOW_METRIC_KEYS.ACTIVE_COUNT, value: analytics.activeCount },
    { metricKey: WORKFLOW_METRIC_KEYS.BLOCKED_COUNT, value: analytics.blockedCount },
    { metricKey: WORKFLOW_METRIC_KEYS.OVERDUE_COUNT, value: analytics.overdueCount },
    { metricKey: WORKFLOW_METRIC_KEYS.AVG_CYCLE_HOURS, value: analytics.averageCycleHours },
    { metricKey: WORKFLOW_METRIC_KEYS.VELOCITY_PER_WEEK, value: analytics.velocityPerWeek },
  ];
  let written = 0;
  for (const r of rows) {
    const bucketKey = `ALL:${r.metricKey}::${dayKey}`;
    await prisma.workflowMetric.upsert({
      where: { bucketKey },
      create: {
        bucketKey,
        templateId: null,
        metricKey: r.metricKey,
        value: r.value,
        windowStart: new Date(`${dayKey}T00:00:00.000Z`),
        windowEnd: now,
      },
      update: { value: r.value, capturedAt: now, windowEnd: now },
    });
    written += 1;
  }
  return written;
}

export async function runWorkflowEngineCron(
  now: Date = new Date()
): Promise<WorkflowCronResult> {
  const followUpsFired = await processFollowUps(now);
  const overdueEscalated = await processOverdue(now);
  const metricsWritten = await snapshotMetrics(now);
  return { followUpsFired, overdueEscalated, metricsWritten };
}
