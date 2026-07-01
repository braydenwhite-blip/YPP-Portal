/**
 * Data 360 — Chapter Health Update (server).
 *
 * The structured metric table a Chapter Impact Meeting runs on. Reuses the SAME
 * chapter comparison + expectations + suggestion logic as Data 360 (so the
 * meeting and the dashboard never disagree), then adds a per-metric weekly
 * inflow trend and a week-over-week momentum delta from real record timestamps.
 * "Chapter Health Update" is a plain-language label only — there is no synthetic
 * health score; every row is a concrete count graded against a concrete target.
 */

import "server-only";

import { prisma } from "@/lib/prisma";

import {
  CHAPTER_EXPECTATION_LIST,
  expectationStatusLabel,
  expectationTone,
  isMetricRelevant,
  type ChapterMetricKey,
  type ExpectationStatus,
} from "./expectations";
import { SUGGESTION_TEMPLATE_LABELS, suggestionsForChapter } from "./suggestions";
import type { MetricTone, TimeSeriesPoint } from "./types";
import { bucketDatesByWeek } from "./week-buckets";
import { loadChapterComparison } from "./chapter-analytics";
import { loadWorkflowAnalyticsInstances } from "./workflow-analytics";
import { loadMentorshipSnapshot } from "./mentorship-analytics";
import type { MentorshipMetric, MentorshipSuggestion } from "./mentorship-analytics-core";

const TREND_WEEKS = 12;

export type ChapterHealthUpdateRow = {
  key: ChapterMetricKey;
  label: string;
  expectationLabel: string;
  current: number | null;
  status: ExpectationStatus;
  statusLabel: string;
  tone: MetricTone;
  href: string | null;
  relevant: boolean;
  unit: "count" | "percent";
  /** Weekly inflow trend (new records per reporting week), when timestamped. */
  trend: TimeSeriesPoint[] | null;
  /** This week's inflow minus last week's — momentum, null when no trend. */
  deltaThisWeek: number | null;
  suggestionTemplateLabel: string | null;
  suggestionPrimaryHref: string | null;
};

/**
 * The mentorship (student-advising) block of a Chapter Impact Meeting. Reuses
 * the SAME pure metrics/suggestions as the Data 360 Mentorship tab so the
 * meeting and the dashboard never disagree. `relevant` is false when the
 * chapter has no students/advising yet — the meeting hides the block rather
 * than showing a wall of honest zeros.
 */
export type ChapterHealthMentorship = {
  relevant: boolean;
  metrics: MentorshipMetric[];
  suggestions: MentorshipSuggestion[];
};

export type ChapterHealthUpdate = {
  chapterId: string;
  chapterName: string;
  phaseLabel: string;
  rows: ChapterHealthUpdateRow[];
  mentorship: ChapterHealthMentorship;
} | null;

function deltaFromTrend(trend: TimeSeriesPoint[] | null): number | null {
  if (!trend || trend.length < 2) return null;
  return trend[trend.length - 1].value - trend[trend.length - 2].value;
}

export async function loadChapterHealthUpdate(
  chapterId: string,
  now: Date = new Date()
): Promise<ChapterHealthUpdate> {
  const instances = await loadWorkflowAnalyticsInstances(now);
  const comparison = await loadChapterComparison(now, instances, { chapterIds: [chapterId] });
  const row = comparison.rows[0];
  if (!row) return null;

  const suggestions = new Map(suggestionsForChapter(row).map((s) => [s.metricKey, s]));

  // Weekly inflow series for the metrics whose records carry a reliable date.
  const [partners, enrollments, meetings, actions, sessions] = await Promise.all([
    prisma.partner.findMany({
      where: { chapterId, archivedAt: null },
      select: { createdAt: true },
    }),
    prisma.classEnrollment.findMany({
      where: { status: "ENROLLED", offering: { chapterId } },
      select: { enrolledAt: true },
    }),
    prisma.meeting.findMany({
      where: { chapterId, status: "COMPLETED" },
      select: { scheduledAt: true },
    }),
    prisma.actionItem.findMany({
      where: { chapterId, status: "COMPLETE", completedAt: { not: null } },
      select: { completedAt: true },
    }),
    prisma.classSession.findMany({
      where: { isCancelled: false, date: { lte: now }, offering: { chapterId } },
      select: { date: true },
    }),
  ]);

  const trendByKey: Partial<Record<ChapterMetricKey, TimeSeriesPoint[]>> = {
    partners: bucketDatesByWeek(partners.map((p) => p.createdAt), now, TREND_WEEKS),
    students: bucketDatesByWeek(
      enrollments.map((e) => e.enrolledAt).filter((d): d is Date => !!d),
      now,
      TREND_WEEKS
    ),
    meetingsHeld: bucketDatesByWeek(meetings.map((m) => m.scheduledAt), now, TREND_WEEKS),
    completedActions: bucketDatesByWeek(
      actions.map((a) => a.completedAt).filter((d): d is Date => !!d),
      now,
      TREND_WEEKS
    ),
    sessions: bucketDatesByWeek(sessions.map((s) => s.date), now, TREND_WEEKS),
  };

  const rows: ChapterHealthUpdateRow[] = CHAPTER_EXPECTATION_LIST.map((exp) => {
    const cell = row.metrics[exp.key];
    const relevant = isMetricRelevant(exp.key, row.phase);
    const trend = relevant ? trendByKey[exp.key] ?? null : null;
    const suggestion = suggestions.get(exp.key) ?? null;
    return {
      key: exp.key,
      label: exp.label,
      expectationLabel: exp.expectationLabel,
      current: cell.value,
      status: cell.status,
      statusLabel: expectationStatusLabel(cell.status),
      tone: expectationTone(cell.status),
      href: cell.href,
      relevant,
      unit: exp.unit,
      trend,
      deltaThisWeek: deltaFromTrend(trend),
      suggestionTemplateLabel: suggestion
        ? SUGGESTION_TEMPLATE_LABELS[suggestion.templateKey] ?? suggestion.templateLabel
        : null,
      suggestionPrimaryHref: suggestion ? suggestion.primaryActionHref : null,
    };
  });

  // Mentorship (student-advising) block — same pure metrics as the Data 360
  // Mentorship tab, scoped to this chapter. Hidden when the chapter has no
  // students/advising yet.
  const mentorshipSnap = await loadMentorshipSnapshot(now, {
    chapterId,
    chapterName: row.chapterName,
  });
  const mentorship: ChapterHealthMentorship = {
    relevant: mentorshipSnap.totalStudents > 0 || mentorshipSnap.totalAssignments > 0,
    metrics: mentorshipSnap.metrics,
    suggestions: mentorshipSnap.suggestions,
  };

  return {
    chapterId: row.chapterId,
    chapterName: row.chapterName,
    phaseLabel: row.phaseLabel,
    rows,
    mentorship,
  };
}
