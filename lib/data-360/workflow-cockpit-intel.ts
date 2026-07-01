/**
 * Data 360 — workflow cockpit intelligence (server).
 *
 * The "why are we doing this?" context for a single workflow, layered on top of
 * the existing cockpit (does NOT duplicate its status / stages / steps / related
 * / timeline sections). Answers: what entity or metric caused this, what the
 * linked chapter metric reads now vs its target, how it's trending, its concrete
 * health reason, and how much downstream work it has created.
 *
 * Reuses the existing health engine (`computeWorkflowHealth`) and expectations
 * (`./expectations`) — no new scoring.
 */

import "server-only";

import { prisma } from "@/lib/prisma";
import { computeWorkflowHealth, type WorkflowHealthStatus } from "@/lib/workflow-engine/health";
import { workflowEntityTypeLabel } from "@/lib/workflow-engine/entity-types";
import type { InstanceDetail } from "@/lib/workflow-engine/queries";
import { deriveAdvisingLifecycle } from "@/lib/advising/relationship";
import type { AdvisingLifecycle, AdvisingTone } from "@/lib/advising/types";

import {
  CHAPTER_EXPECTATIONS,
  chapterPhase,
  CHAPTER_PHASE_LABELS,
  expectationStatus,
  expectationStatusLabel,
  type ChapterMetricKey,
  type ExpectationStatus,
} from "./expectations";
import type { TimeSeriesPoint } from "./types";
import { bucketDatesByWeek } from "./week-buckets";

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_WEEKS = 12;

export type WorkflowCockpitMetricIntel = {
  key: ChapterMetricKey;
  label: string;
  value: number | null;
  expectationLabel: string;
  status: ExpectationStatus;
  statusLabel: string;
  trend: TimeSeriesPoint[] | null;
};

/**
 * The live advising picture for a student-advising workflow — the relationship
 * this workflow is actually operating on, read from the SAME source of truth as
 * the advising cockpit (StudentAdvisorAssignment + deriveAdvisingLifecycle), so
 * the cockpit answers "who is this student, where does the relationship stand,
 * and what is the next real advising action" rather than showing generic
 * workflow metadata. Null for non-advising workflows.
 */
export type WorkflowCockpitAdvisingIntel = {
  studentId: string;
  studentName: string;
  advisorId: string;
  advisorName: string;
  lifecycle: AdvisingLifecycle;
  lifecycleLabel: string;
  lifecycleTone: AdvisingTone;
  reason: string;
  nextAction: string;
  lastCheckInISO: string | null;
  nextCheckInDueISO: string | null;
  daysSinceCheckIn: number | null;
  openRecommendations: number;
  /** Deep-link into the advising cockpit lane that holds this relationship. */
  advisingHref: string;
};

export type WorkflowCockpitIntel = {
  sourceEntityType: string | null;
  sourceEntityLabel: string | null;
  chapterId: string | null;
  chapterName: string | null;
  chapterPhaseLabel: string | null;
  health: WorkflowHealthStatus;
  healthReasons: string[];
  startedAtISO: string;
  ageDays: number;
  completionPercent: number;
  currentStageName: string | null;
  linkedActionCount: number;
  linkedMeetingCount: number;
  attachmentCount: number;
  metric: WorkflowCockpitMetricIntel | null;
  /** Present only for student-advising workflows with a resolvable student. */
  advising: WorkflowCockpitAdvisingIntel | null;
};

/** Blueprint keys whose instances operate a student-advising relationship. */
const ADVISING_TEMPLATE_KEYS = new Set(["student-advising"]);
const OPEN_REC_STATUSES = ["SUGGESTED", "IN_PROGRESS"];

/** Advising cockpit lane a relationship's lifecycle drills into. */
const LIFECYCLE_LANE: Record<AdvisingLifecycle, string> = {
  KICKOFF_NEEDED: "kickoff_needed",
  FOLLOW_UP_DUE: "follow_up_due",
  STALE: "follow_up_due",
  READY_FOR_NEXT: "recommendations_ready",
  ACTIVE: "recently_checked_in",
  INACTIVE: "needs_advisor",
};

/**
 * Load the advising context for a workflow whose primary subject is a student.
 * Reuses the advising lifecycle logic verbatim. Fail-soft: any read issue or a
 * student with no active advising relationship yields null (the cockpit simply
 * omits the block) rather than throwing.
 */
async function loadAdvisingIntel(
  subjectId: string | null,
  now: Date
): Promise<WorkflowCockpitAdvisingIntel | null> {
  if (!subjectId) return null;
  try {
    const assignment = await prisma.studentAdvisorAssignment.findFirst({
      where: { studentId: subjectId, isActive: true },
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        advisingStatus: true,
        needsFollowUp: true,
        followUpNote: true,
        lastCheckInAt: true,
        nextCheckInDueAt: true,
        startDate: true,
        studentId: true,
        advisorId: true,
        student: { select: { name: true } },
        advisor: { select: { name: true } },
      },
    });
    if (!assignment) return null;

    const life = deriveAdvisingLifecycle(
      {
        isActive: true,
        advisingStatus: assignment.advisingStatus,
        needsFollowUp: assignment.needsFollowUp,
        followUpNote: assignment.followUpNote,
        lastCheckInAt: assignment.lastCheckInAt,
        nextCheckInDueAt: assignment.nextCheckInDueAt,
        startDate: assignment.startDate,
      },
      now
    );

    const openRecommendations = await prisma.advisingRecommendation.count({
      where: { assignmentId: assignment.id, status: { in: OPEN_REC_STATUSES } },
    });

    return {
      studentId: assignment.studentId,
      studentName: assignment.student?.name ?? "Student",
      advisorId: assignment.advisorId,
      advisorName: assignment.advisor?.name ?? "Advisor",
      lifecycle: life.lifecycle,
      lifecycleLabel: life.label,
      lifecycleTone: life.tone,
      reason: life.reason,
      nextAction: life.nextAction,
      lastCheckInISO: assignment.lastCheckInAt ? assignment.lastCheckInAt.toISOString() : null,
      nextCheckInDueISO: assignment.nextCheckInDueAt
        ? assignment.nextCheckInDueAt.toISOString()
        : null,
      daysSinceCheckIn: life.daysSinceCheckIn,
      openRecommendations,
      advisingHref: `/operations/advising?lane=${LIFECYCLE_LANE[life.lifecycle]}`,
    };
  } catch {
    return null;
  }
}

/** Map a workflow's domain to the chapter metric it most directly moves. */
function metricForDomain(domain: string | null): ChapterMetricKey | null {
  switch (domain) {
    case "PARTNERS":
      return "partners";
    case "INSTRUCTORS":
      return "instructors";
    case "PROGRAMS":
      return "students";
    case "CURRICULUM":
      return "classes";
    default:
      return null;
  }
}

async function loadMetricIntel(
  metricKey: ChapterMetricKey,
  chapterId: string,
  phase: ReturnType<typeof chapterPhase>,
  now: Date
): Promise<WorkflowCockpitMetricIntel> {
  const exp = CHAPTER_EXPECTATIONS[metricKey];
  let value: number | null = null;
  let trend: TimeSeriesPoint[] | null = null;

  if (metricKey === "partners") {
    const rows = await prisma.partner.findMany({
      where: { chapterId, archivedAt: null },
      select: { createdAt: true },
    });
    value = rows.length;
    trend = bucketDatesByWeek(rows.map((r) => r.createdAt), now, TREND_WEEKS);
  } else if (metricKey === "instructors") {
    value = await prisma.user.count({
      where: { chapterId, primaryRole: "INSTRUCTOR", archivedAt: null },
    });
  } else if (metricKey === "students") {
    const rows = await prisma.classEnrollment.findMany({
      where: { status: "ENROLLED", offering: { chapterId } },
      select: { enrolledAt: true },
    });
    value = rows.length;
    trend = bucketDatesByWeek(
      rows.map((r) => r.enrolledAt).filter((d): d is Date => !!d),
      now,
      TREND_WEEKS
    );
  } else if (metricKey === "classes") {
    value = await prisma.classOffering.count({
      where: { chapterId, status: { in: ["PUBLISHED", "IN_PROGRESS"] } },
    });
  }

  const status = expectationStatus(metricKey, value, phase);
  return {
    key: metricKey,
    label: exp.label,
    value,
    expectationLabel: exp.expectationLabel,
    status,
    statusLabel: expectationStatusLabel(status),
    trend,
  };
}

export async function loadWorkflowCockpitIntel(
  detail: InstanceDetail,
  now: Date = new Date()
): Promise<WorkflowCockpitIntel> {
  const { instance, definition, executions } = detail;

  const currentStageKey = instance.currentStageKey;
  const currentStageDef = currentStageKey
    ? definition.stages.find((s) => s.key === currentStageKey) ?? null
    : null;
  const currentStageExecs = currentStageKey
    ? executions.filter((e) => e.stageKey === currentStageKey)
    : [];

  const [stageEnteredEvent, chapter, attachmentCount] = await Promise.all([
    currentStageKey
      ? prisma.workflowEvent.findFirst({
          where: { instanceId: instance.id, kind: "STAGE_ENTERED", toStageKey: currentStageKey },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        })
      : Promise.resolve(null),
    instance.chapterId
      ? prisma.chapter.findUnique({
          where: { id: instance.chapterId },
          select: { name: true, lifecycleStatus: true },
        })
      : Promise.resolve(null),
    prisma.workflowAttachment.count({ where: { workflowInstanceId: instance.id } }),
  ]);

  const health = computeWorkflowHealth({
    instance: {
      status: instance.status,
      dueAt: instance.dueAt,
      followUpAt: instance.followUpAt,
      escalatedAt: instance.escalatedAt,
      startedAt: instance.startedAt,
      completionPercent: instance.completionPercent,
    },
    currentStage: currentStageDef
      ? { key: currentStageDef.key, slaHours: currentStageDef.slaHours ?? null, name: currentStageDef.name }
      : null,
    currentStageEnteredAt: stageEnteredEvent ? stageEnteredEvent.createdAt.toISOString() : null,
    executions: currentStageExecs,
    now: now.toISOString(),
  });

  const phase = chapter ? chapterPhase(chapter.lifecycleStatus) : "operating";
  const metricKey = instance.chapterId ? metricForDomain(definition.domain) : null;
  const metric =
    metricKey && instance.chapterId
      ? await loadMetricIntel(metricKey, instance.chapterId, phase, now)
      : null;

  // Advising-specific context: only for a student-advising workflow whose
  // primary subject is a person (the student). Everything else gets null.
  const advising =
    ADVISING_TEMPLATE_KEYS.has(definition.key) && instance.subjectType === "USER"
      ? await loadAdvisingIntel(instance.subjectId, now)
      : null;

  const startedMs = new Date(instance.startedAt).getTime();

  return {
    sourceEntityType: instance.subjectType,
    sourceEntityLabel: instance.subjectType ? workflowEntityTypeLabel(instance.subjectType) : null,
    chapterId: instance.chapterId,
    chapterName: chapter?.name ?? null,
    chapterPhaseLabel: chapter ? CHAPTER_PHASE_LABELS[phase] : null,
    health: health.status,
    healthReasons: health.reasons,
    startedAtISO: instance.startedAt,
    ageDays: Math.max(0, Math.floor((now.getTime() - startedMs) / DAY_MS)),
    completionPercent: instance.completionPercent,
    currentStageName: currentStageDef?.name ?? null,
    linkedActionCount: executions.filter((e) => e.linkedActionItemId).length,
    linkedMeetingCount: executions.filter((e) => e.linkedMeetingId).length,
    attachmentCount,
    metric,
    advising,
  };
}
