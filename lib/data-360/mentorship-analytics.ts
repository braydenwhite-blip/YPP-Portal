/**
 * Data 360 — mentorship (student-advising) operating analytics (server loader).
 *
 * Hydrates the pure `mentorship-analytics-core` input from the advising models
 * (`StudentAdvisorAssignment`, `AdvisingNote` check-ins, `AdvisingRecommendation`)
 * in a few batched reads, then assembles the serializable snapshot the Data 360
 * Mentorship section, the Chapter Impact Meeting, and Needs Attention all read.
 * Query shapes mirror `lib/advising/queries.ts` so the numbers can never
 * disagree with the advising cockpit. Fail-soft: any read error yields an empty
 * snapshot rather than 500-ing the control room.
 */

import "server-only";

import { prisma } from "@/lib/prisma";

import {
  assembleMentorshipSnapshot,
  type MentorshipAnalyticsInput,
  type MentorshipMetric,
  type MentorshipSuggestion,
  type MentorshipTrends,
} from "./mentorship-analytics-core";
import { DEFAULT_TREND_WEEKS } from "./week-buckets";

/** Blueprint keys whose live instances "cover" an advising gap (dedupe). */
const ADVISING_TEMPLATE_KEYS = ["student-advising"] as const;
const LIVE_WORKFLOW_STATUSES = ["ACTIVE", "BLOCKED", "ON_HOLD"] as const;

export type MentorshipSnapshot = {
  generatedAtISO: string;
  scope: "organization" | "chapter";
  chapterId: string | null;
  chapterName: string | null;
  advisingActive: boolean;
  totalStudents: number;
  totalAssignments: number;
  gapCount: number;
  metrics: MentorshipMetric[];
  suggestions: MentorshipSuggestion[];
  trends: MentorshipTrends;
};

function emptyTrends(): MentorshipTrends {
  return { checkIns: [], recommendationsOpened: [], recommendationsCompleted: [] };
}

export function emptyMentorshipSnapshot(
  now: Date,
  scope: "organization" | "chapter" = "organization",
  chapterId: string | null = null,
  chapterName: string | null = null
): MentorshipSnapshot {
  return {
    generatedAtISO: now.toISOString(),
    scope,
    chapterId,
    chapterName,
    advisingActive: false,
    totalStudents: 0,
    totalAssignments: 0,
    gapCount: 0,
    metrics: [],
    suggestions: [],
    trends: emptyTrends(),
  };
}

export type LoadMentorshipOpts = {
  /** Scope every read to a single chapter (via the student's chapter). */
  chapterId?: string | null;
  chapterName?: string | null;
  weeks?: number;
};

/**
 * Load the mentorship operating snapshot — org-wide, or scoped to one chapter
 * when `chapterId` is provided.
 */
export async function loadMentorshipSnapshot(
  now: Date = new Date(),
  opts: LoadMentorshipOpts = {}
): Promise<MentorshipSnapshot> {
  const chapterId = opts.chapterId ?? null;
  const scope: "organization" | "chapter" = chapterId ? "chapter" : "organization";

  try {
    const studentWhere = chapterId ? { chapterId } : {};
    const assignmentWhere = chapterId ? { student: { chapterId } } : {};
    const throughAssignment = chapterId ? { assignment: { student: { chapterId } } } : {};

    const [assignments, recommendations, checkIns, students, liveInstances] =
      await Promise.all([
        prisma.studentAdvisorAssignment.findMany({
          where: assignmentWhere,
          select: {
            id: true,
            isActive: true,
            advisingStatus: true,
            needsFollowUp: true,
            followUpNote: true,
            lastCheckInAt: true,
            nextCheckInDueAt: true,
            startDate: true,
            studentId: true,
            advisorId: true,
            student: { select: { name: true, chapterId: true } },
            advisor: { select: { name: true } },
          },
        }),
        prisma.advisingRecommendation.findMany({
          where: throughAssignment,
          select: { id: true, status: true, createdAt: true, updatedAt: true },
        }),
        prisma.advisingNote.findMany({
          where: { kind: "CHECK_IN", ...throughAssignment },
          select: { createdAt: true },
        }),
        prisma.user.findMany({
          where: { archivedAt: null, roles: { some: { role: "STUDENT" } }, ...studentWhere },
          select: { id: true },
        }),
        prisma.workflowInstance.findMany({
          where: {
            status: { in: [...LIVE_WORKFLOW_STATUSES] },
            template: { key: { in: [...ADVISING_TEMPLATE_KEYS] } },
            ...(chapterId ? { chapterId } : {}),
          },
          select: { template: { select: { key: true } } },
        }),
      ]);

    const input: MentorshipAnalyticsInput = {
      assignments: assignments.map((a) => ({
        assignmentId: a.id,
        isActive: a.isActive,
        advisingStatus: a.advisingStatus,
        needsFollowUp: a.needsFollowUp,
        followUpNote: a.followUpNote,
        lastCheckInAt: a.lastCheckInAt,
        nextCheckInDueAt: a.nextCheckInDueAt,
        startDate: a.startDate,
        studentId: a.studentId,
        studentName: a.student?.name ?? "Student",
        advisorId: a.advisorId,
        advisorName: a.advisor?.name ?? "Advisor",
        chapterId: a.student?.chapterId ?? null,
      })),
      recommendations: recommendations.map((r) => ({
        id: r.id,
        status: r.status,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      checkIns: checkIns.map((c) => ({ createdAt: c.createdAt })),
      studentIds: students.map((s) => s.id),
    };

    const activeTemplateKeys = new Set(
      liveInstances.map((i) => i.template?.key).filter((k): k is string => Boolean(k))
    );

    const core = assembleMentorshipSnapshot(input, {
      activeTemplateKeys,
      now,
      weeks: opts.weeks ?? DEFAULT_TREND_WEEKS,
    });

    return {
      generatedAtISO: now.toISOString(),
      scope,
      chapterId,
      chapterName: opts.chapterName ?? null,
      advisingActive: core.counts.advisingActive,
      totalStudents: core.counts.totalStudents,
      totalAssignments: core.counts.totalAssignments,
      gapCount: core.gapCount,
      metrics: core.metrics,
      suggestions: core.suggestions,
      trends: core.trends,
    };
  } catch {
    return emptyMentorshipSnapshot(now, scope, chapterId, opts.chapterName ?? null);
  }
}
