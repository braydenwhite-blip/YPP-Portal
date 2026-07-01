/**
 * Data 360 — workflow operating trends (server loader).
 *
 * Week-by-week series for the workflow signals that ARE reconstructable from
 * real timestamps: workflows started (startedAt), workflows completed
 * (completedAt), steps completed (execution.completedAt), and the actions /
 * meetings those workflows created (linked record createdAt). Point-in-time
 * states (currently blocked / overdue) are NOT faked as history — they live in
 * the health strip, which is an honest snapshot. Optional `chapterId` scopes
 * every series to one chapter for Chapter Data 360.
 */

import "server-only";

import { prisma } from "@/lib/prisma";
import { addWeeks, weekStartFor } from "@/lib/weekly-meetings/week";

import type { TimeSeries, TimeSeriesPoint } from "./types";
import { bucketDatesByWeek, DEFAULT_TREND_WEEKS } from "./week-buckets";
import { workflowData360DrilldownHref } from "./workflow-analytics-core";

function toSeries(
  key: string,
  label: string,
  points: TimeSeriesPoint[],
  href: string | null
): TimeSeries {
  const added = points.reduce((s, p) => s + p.value, 0);
  return { key, label, points, total: added, added, href };
}

export type WorkflowTrends = {
  weeks: number;
  series: TimeSeries[];
};

export async function loadWorkflowTrends(
  now: Date = new Date(),
  opts: { weeks?: number; chapterId?: string } = {}
): Promise<WorkflowTrends> {
  const weeks = opts.weeks ?? DEFAULT_TREND_WEEKS;
  const windowStart = addWeeks(weekStartFor(now), -(weeks - 1));
  const chapterWhere = opts.chapterId ? { chapterId: opts.chapterId } : {};

  const [started, completed, completedSteps, linkedActionIds, linkedMeetingIds] =
    await Promise.all([
      prisma.workflowInstance.findMany({
        where: { startedAt: { gte: windowStart }, ...chapterWhere },
        select: { startedAt: true },
      }),
      prisma.workflowInstance.findMany({
        where: { completedAt: { gte: windowStart }, ...chapterWhere },
        select: { completedAt: true },
      }),
      prisma.workflowStepExecution.findMany({
        where: {
          completedAt: { gte: windowStart },
          ...(opts.chapterId ? { instance: { chapterId: opts.chapterId } } : {}),
        },
        select: { completedAt: true },
      }),
      prisma.workflowStepExecution.findMany({
        where: {
          linkedActionItemId: { not: null },
          ...(opts.chapterId ? { instance: { chapterId: opts.chapterId } } : {}),
        },
        select: { linkedActionItemId: true },
      }),
      prisma.workflowStepExecution.findMany({
        where: {
          linkedMeetingId: { not: null },
          ...(opts.chapterId ? { instance: { chapterId: opts.chapterId } } : {}),
        },
        select: { linkedMeetingId: true },
      }),
    ]);

  const actionIds = Array.from(
    new Set(linkedActionIds.map((e) => e.linkedActionItemId).filter((v): v is string => !!v))
  );
  const meetingIds = Array.from(
    new Set(linkedMeetingIds.map((e) => e.linkedMeetingId).filter((v): v is string => !!v))
  );

  const [linkedActions, linkedMeetings] = await Promise.all([
    actionIds.length > 0
      ? prisma.actionItem.findMany({
          where: { id: { in: actionIds }, createdAt: { gte: windowStart } },
          select: { createdAt: true },
        })
      : Promise.resolve([]),
    meetingIds.length > 0
      ? prisma.meeting.findMany({
          where: { id: { in: meetingIds }, createdAt: { gte: windowStart } },
          select: { createdAt: true },
        })
      : Promise.resolve([]),
  ]);

  const series: TimeSeries[] = [
    toSeries(
      "wf_started",
      "Workflows started",
      bucketDatesByWeek(started.map((r) => r.startedAt), now, weeks),
      workflowData360DrilldownHref({
        ...(opts.chapterId ? { chapterId: opts.chapterId } : {}),
      })
    ),
    toSeries(
      "wf_completed",
      "Workflows completed",
      bucketDatesByWeek(
        completed.map((r) => r.completedAt).filter((d): d is Date => !!d),
        now,
        weeks
      ),
      workflowData360DrilldownHref({
        status: "COMPLETED",
        ...(opts.chapterId ? { chapterId: opts.chapterId } : {}),
      })
    ),
    toSeries(
      "wf_steps_completed",
      "Steps completed",
      bucketDatesByWeek(
        completedSteps.map((r) => r.completedAt).filter((d): d is Date => !!d),
        now,
        weeks
      ),
      null
    ),
    toSeries(
      "wf_actions_created",
      "Actions created from workflows",
      bucketDatesByWeek(linkedActions.map((r) => r.createdAt), now, weeks),
      "/actions?source=workflow"
    ),
    toSeries(
      "wf_meetings_created",
      "Meetings created from workflows",
      bucketDatesByWeek(linkedMeetings.map((r) => r.createdAt), now, weeks),
      "/meetings"
    ),
  ];

  return { weeks, series };
}
