/**
 * Chapter Analytics — server loader for Overview + Leaderboard.
 *
 * Counts are reconstructed from real record timestamps (users, partners,
 * offerings, feedback). Month-adjusted expectations come from analytics-pace.
 */

import "server-only";

import { prisma } from "@/lib/prisma";

import {
  ANALYTICS_CATEGORY_KEYS,
  ANALYTICS_METRIC_KEYS,
  CATEGORY_PRIMARY_METRIC,
  analyticsPanelKey,
  expectedAtMonth,
  formatMetricCell,
  lastNMonths,
  monthLongLabel,
  monthsActiveAsOf,
  pacePercent,
  paceStatus,
  type AnalyticsCategoryKey,
  type AnalyticsMetricKey,
} from "./analytics-pace";
import type {
  AnalyticsRangeMonths,
  ChapterOverviewModel,
  LeaderboardModel,
  LeaderboardRow,
  MetricPanelModel,
  MetricSnapshot,
  MonthlyCategoryCell,
  PaceCell,
  TrendPoint,
} from "./analytics-types";
import { ensureOperatingChapters, OPERATING_CHAPTER_NAMES } from "./operating";

export type {
  AnalyticsRangeMonths,
  ChapterOverviewModel,
  LeaderboardModel,
  LeaderboardRow,
  MetricActionItem,
  MetricPanelModel,
  MetricSnapshot,
  MonthlyCategoryCell,
  PaceCell,
  TrendPoint,
} from "./analytics-types";

function emptySnapshot(): MetricSnapshot {
  return { partners: 0, instructors: 0, students: 0, classes: 0, retention: 0, quality: 0 };
}

function expectedSnapshot(monthsActive: number): MetricSnapshot {
  const out = emptySnapshot();
  for (const key of ANALYTICS_METRIC_KEYS) out[key] = expectedAtMonth(key, monthsActive);
  return out;
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function countAsOf(
  dates: Date[],
  asOf: Date
): number {
  let n = 0;
  for (const d of dates) if (d <= asOf) n += 1;
  return n;
}

function retentionAsOf(
  enrollments: Array<{ enrolledAt: Date; droppedAt: Date | null; status: string }>,
  asOf: Date
): number {
  let enrolled = 0;
  let active = 0;
  for (const e of enrollments) {
    if (e.enrolledAt > asOf) continue;
    enrolled += 1;
    const droppedByThen = Boolean(e.droppedAt && e.droppedAt <= asOf) || e.status === "DROPPED";
    if (!droppedByThen) active += 1;
  }
  if (enrolled === 0) return 0;
  return Math.round((active / enrolled) * 100);
}

function qualityAsOf(
  ratings: Array<{ rating: number | null; createdAt: Date }>,
  asOf: Date
): number {
  const vals = ratings
    .filter((r) => r.createdAt <= asOf && typeof r.rating === "number" && r.rating != null)
    .map((r) => r.rating as number);
  return avg(vals) ?? 0;
}

async function loadChapterRaw(chapterIds: string[]) {
  const [
    chapters,
    partners,
    instructors,
    students,
    offerings,
    enrollments,
    classFeedback,
    parentFeedback,
    pendingPartnerMeetings,
    openFollowUps,
    unassignedInstructors,
  ] = await Promise.all([
    prisma.chapter.findMany({
      where: { id: { in: chapterIds }, archivedAt: null },
      select: { id: true, name: true, launchedAt: true, createdAt: true },
      orderBy: { name: "asc" },
    }),
    prisma.partner.findMany({
      where: { chapterId: { in: chapterIds }, archivedAt: null },
      select: { chapterId: true, createdAt: true },
    }),
    prisma.user.findMany({
      where: { chapterId: { in: chapterIds }, primaryRole: "INSTRUCTOR", archivedAt: null },
      select: { chapterId: true, createdAt: true },
    }),
    prisma.user.findMany({
      where: { chapterId: { in: chapterIds }, primaryRole: "STUDENT", archivedAt: null },
      select: { chapterId: true, createdAt: true },
    }),
    prisma.classOffering.findMany({
      where: {
        chapterId: { in: chapterIds },
        status: { in: ["PUBLISHED", "IN_PROGRESS", "COMPLETED"] },
      },
      select: { chapterId: true, createdAt: true, status: true },
    }),
    prisma.classEnrollment.findMany({
      where: { offering: { chapterId: { in: chapterIds } } },
      select: {
        enrolledAt: true,
        droppedAt: true,
        status: true,
        offering: { select: { chapterId: true } },
      },
      take: 20000,
    }),
    prisma.classFeedback.findMany({
      where: { offering: { chapterId: { in: chapterIds } } },
      select: { rating: true, createdAt: true, offering: { select: { chapterId: true } } },
      take: 8000,
    }),
    prisma.parentChapterFeedback.findMany({
      where: { chapterId: { in: chapterIds } },
      select: { chapterId: true, rating: true, createdAt: true },
      take: 4000,
    }),
    prisma.partner.count({
      where: {
        chapterId: { in: chapterIds },
        archivedAt: null,
        stage: { in: ["MEETING_SCHEDULED", "REACHED_OUT"] },
      },
    }),
    prisma.meetingFollowUp.count({
      where: {
        status: { in: ["OPEN", "IN_PROGRESS"] },
        meeting: { chapterId: { in: chapterIds } },
      },
    }),
    prisma.user.count({
      where: {
        chapterId: { in: chapterIds },
        primaryRole: "INSTRUCTOR",
        archivedAt: null,
        classOfferingsInstructed: { none: {} },
      },
    }),
  ]);

  return {
    chapters,
    partners,
    instructors,
    students,
    offerings,
    enrollments,
    classFeedback,
    parentFeedback,
    pendingPartnerMeetings,
    openFollowUps,
    unassignedInstructors,
  };
}

function snapshotForChapter(
  chapterId: string,
  asOf: Date,
  raw: Awaited<ReturnType<typeof loadChapterRaw>>
): MetricSnapshot {
  const partnerDates = raw.partners.filter((p) => p.chapterId === chapterId).map((p) => p.createdAt);
  const instructorDates = raw.instructors
    .filter((u) => u.chapterId === chapterId)
    .map((u) => u.createdAt);
  const studentDates = raw.students.filter((u) => u.chapterId === chapterId).map((u) => u.createdAt);
  const classDates = raw.offerings
    .filter((o) => o.chapterId === chapterId)
    .map((o) => o.createdAt);
  const enrollments = raw.enrollments
    .filter((e) => e.offering.chapterId === chapterId)
    .map((e) => ({
      enrolledAt: e.enrolledAt,
      droppedAt: e.droppedAt,
      status: e.status,
    }));
  const ratings = [
    ...raw.classFeedback
      .filter((f) => f.offering.chapterId === chapterId)
      .map((f) => ({ rating: f.rating, createdAt: f.createdAt })),
    ...raw.parentFeedback
      .filter((f) => f.chapterId === chapterId)
      .map((f) => ({ rating: f.rating, createdAt: f.createdAt })),
  ];

  return {
    partners: countAsOf(partnerDates, asOf),
    instructors: countAsOf(instructorDates, asOf),
    students: countAsOf(studentDates, asOf),
    classes: countAsOf(classDates, asOf),
    retention: retentionAsOf(enrollments, asOf),
    quality: qualityAsOf(ratings, asOf),
  };
}

function buildPaceCell(
  metric: AnalyticsMetricKey,
  actual: number,
  monthsActive: number,
  discussedOn: string | null
): PaceCell {
  const expected = expectedAtMonth(metric, monthsActive);
  return {
    metric,
    actual,
    expected,
    status: paceStatus(actual, expected),
    display: formatMetricCell(metric, actual, expected),
    percentOfExpected: pacePercent(actual, expected),
    discussedOn,
  };
}

export async function loadChapterAnalyticsOverview(
  chapterId: string,
  opts: { rangeMonths?: AnalyticsRangeMonths; now?: Date } = {}
): Promise<ChapterOverviewModel | null> {
  const now = opts.now ?? new Date();
  const rangeMonths = opts.rangeMonths ?? 6;

  await ensureOperatingChapters();

  const allChapters = await prisma.chapter.findMany({
    where: { archivedAt: null, name: { in: [...OPERATING_CHAPTER_NAMES] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 200,
  });

  const raw = await loadChapterRaw([chapterId]);
  const chapter = raw.chapters[0];
  if (!chapter) return null;

  const launch = chapter.launchedAt ?? chapter.createdAt;
  const monthsActive = monthsActiveAsOf(launch, now);
  const months = lastNMonths(now, rangeMonths);
  const current = snapshotForChapter(chapterId, now, raw);
  const expected = expectedSnapshot(monthsActive);

  const heatmap: MonthlyCategoryCell[] = [];
  const trends: Record<AnalyticsCategoryKey, TrendPoint[]> = {
    students: [],
    instructors: [],
    partners: [],
    quality: [],
  };

  for (const month of months) {
    const asOf = new Date(Date.UTC(month.year, month.monthIndex + 1, 0, 23, 59, 59, 999));
    const snap = snapshotForChapter(chapterId, asOf, raw);
    const monthsThen = monthsActiveAsOf(launch, asOf);

    for (const category of ANALYTICS_CATEGORY_KEYS) {
      const metric = CATEGORY_PRIMARY_METRIC[category];
      const actual = snap[metric];
      const exp = expectedAtMonth(metric, monthsThen);
      const status = paceStatus(actual, exp);
      heatmap.push({
        category,
        monthKey: month.key,
        label: month.label,
        actual,
        expected: exp,
        status,
        display: formatMetricCell(metric, actual, exp),
      });
      trends[category].push({
        monthKey: month.key,
        label: month.label,
        actual,
        expected: exp,
      });
    }
  }

  const instructorReviews = raw.classFeedback
    .filter((f) => f.offering.chapterId === chapterId && f.rating != null)
    .map((f) => f.rating as number);
  const parentReviews = raw.parentFeedback
    .filter((f) => f.chapterId === chapterId && f.rating != null)
    .map((f) => f.rating as number);

  const utilization =
    current.instructors > 0
      ? Math.round(
          (raw.offerings.filter(
            (o) =>
              o.chapterId === chapterId &&
              (o.status === "PUBLISHED" || o.status === "IN_PROGRESS")
          ).length /
            Math.max(1, current.instructors)) *
            100
        )
      : 0;

  return {
    chapterId,
    chapterName: chapter.name,
    launchedAt: launch.toISOString(),
    launchedLabel: new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(launch),
    monthsActive,
    rangeMonths,
    months: months.map((m) => ({ key: m.key, label: m.label })),
    heatmap,
    current,
    expected,
    trends,
    kpis: {
      students: {
        retention: current.retention,
        gap: current.students - expected.students,
      },
      instructors: {
        utilization: Math.min(100, utilization),
        unassignedTrained: raw.unassignedInstructors,
      },
      partners: {
        pendingMeetings: raw.pendingPartnerMeetings,
        gap: current.partners - expected.partners,
      },
      quality: {
        instructorReviewAvg: avg(instructorReviews),
        parentFeedbackAvg: avg(parentReviews),
        retention: current.retention,
        followUpFlagged: raw.openFollowUps,
      },
    },
    chapters: allChapters,
  };
}

export async function loadChapterAnalyticsLeaderboard(
  opts: { asOf?: Date; focusChapterId?: string | null } = {}
): Promise<LeaderboardModel> {
  const asOf = opts.asOf ?? new Date();
  const asOfKey = `${asOf.getUTCFullYear()}-${String(asOf.getUTCMonth() + 1).padStart(2, "0")}`;
  const prior = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 0, 23, 59, 59, 999));

  // Ensure the four operating chapters exist before ranking.
  await ensureOperatingChapters();

  const chapters = await prisma.chapter.findMany({
    where: {
      archivedAt: null,
      name: { in: [...OPERATING_CHAPTER_NAMES] },
    },
    select: { id: true, name: true, launchedAt: true, createdAt: true },
    orderBy: { name: "asc" },
    take: 80,
  });

  if (chapters.length === 0) {
    return {
      asOfLabel: monthLongLabel(asOf.getUTCFullYear(), asOf.getUTCMonth()),
      asOfKey,
      updatedLabel: "Just now",
      rows: [],
      panels: {},
    };
  }

  const chapterIds = chapters.map((c) => c.id);
  const raw = await loadChapterRaw(chapterIds);

  const discussMarkers = await prisma.actionItem.findMany({
    where: {
      chapterId: { in: chapterIds },
      sourceId: { startsWith: "chapter-analytics:discussed:" },
      status: "COMPLETE",
    },
    select: {
      chapterId: true,
      sourceId: true,
      completedAt: true,
      updatedAt: true,
      lead: { select: { name: true } },
    },
    take: 500,
  });

  const discussedMap = new Map<string, { on: string; initials: string }>();
  for (const d of discussMarkers) {
    if (!d.chapterId || !d.sourceId) continue;
    // sourceId = chapter-analytics:discussed:{chapterId}:{metric}:{periodKey}
    const parts = d.sourceId.split(":");
    const metric = parts[3] as AnalyticsMetricKey | undefined;
    const period = parts[4];
    if (!metric || !ANALYTICS_METRIC_KEYS.includes(metric)) continue;
    if (period && period !== asOfKey) continue;
    const on = (d.completedAt ?? d.updatedAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    discussedMap.set(analyticsPanelKey(d.chapterId, metric), {
      on,
      initials: initials(d.lead.name),
    });
  }

  const metricActions = await prisma.actionItem.findMany({
    where: {
      chapterId: { in: chapterIds },
      OR: [
        { sourceId: { startsWith: "chapter-analytics:action:" } },
        { goalCategory: "Chapter analytics" },
      ],
    },
    select: {
      id: true,
      title: true,
      status: true,
      deadlineStart: true,
      completedAt: true,
      chapterId: true,
      sourceId: true,
      relatedEntityId: true,
      lead: { select: { name: true } },
    },
    orderBy: { deadlineStart: "asc" },
    take: 1000,
  });

  const rows: LeaderboardRow[] = [];
  const panels: Record<string, MetricPanelModel> = {};

  for (const chapter of chapters) {
    const launch = chapter.launchedAt ?? chapter.createdAt;
    const monthsActive = monthsActiveAsOf(launch, asOf);
    const snap = snapshotForChapter(chapter.id, asOf, raw);
    const priorSnap = snapshotForChapter(chapter.id, prior, raw);
    const cells = {} as Record<AnalyticsMetricKey, PaceCell>;
    let scoreSum = 0;
    let scoreN = 0;

    for (const metric of ANALYTICS_METRIC_KEYS) {
      const key = analyticsPanelKey(chapter.id, metric);
      const discussed = discussedMap.get(key);
      const cell = buildPaceCell(metric, snap[metric], monthsActive, discussed?.on ?? null);
      cells[metric] = cell;
      if (metric !== "quality" && metric !== "retention") {
        scoreSum += cell.percentOfExpected;
        scoreN += 1;
      }

      const actionsForMetric = metricActions.filter((a) => {
        if (a.chapterId !== chapter.id) return false;
        if (a.sourceId?.includes(`:${metric}:`)) return true;
        if (a.relatedEntityId === `${chapter.id}:${metric}`) return true;
        return false;
      });

      const nowMs = asOf.getTime();
      const completed = actionsForMetric.filter((a) => a.status === "COMPLETE");
      const onTime = completed.filter(
        (a) => !a.completedAt || a.completedAt.getTime() <= a.deadlineStart.getTime() + 86400000
      );
      const late = actionsForMetric.filter(
        (a) =>
          a.status !== "COMPLETE" &&
          a.deadlineStart.getTime() < nowMs
      );

      const lastDone = completed
        .slice()
        .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))[0];

      const gap = cell.actual - cell.expected;
      let warning: string | null = null;
      if (cell.status === "at_risk" || cell.status === "needs_attention") {
        const unit =
          metric === "retention"
            ? "pts"
            : metric === "quality"
              ? "points"
              : METRIC_NOUN[metric];
        warning = `Behind by ${Math.abs(Math.round(gap === 0 ? cell.expected - cell.actual : gap))} ${unit}. At current pace, ${chapter.name} will stay short of the month-adjusted target.`;
      }

      panels[key] = {
        chapterId: chapter.id,
        chapterName: chapter.name,
        metric,
        cell,
        deltaVsPriorMonth: Math.round(snap[metric] - priorSnap[metric]),
        warning,
        actions: actionsForMetric.map((a) => ({
          id: a.id,
          title: a.title,
          status: a.status,
          deadlineStart: a.deadlineStart.toISOString(),
          completedAt: a.completedAt?.toISOString() ?? null,
          leadInitials: initials(a.lead.name),
          leadName: a.lead.name,
          late: a.status !== "COMPLETE" && a.deadlineStart.getTime() < nowMs,
        })),
        actionsCompleted: completed.length,
        actionsOnTime: onTime.length,
        actionsLate: late.length,
        lastCompletedLabel: lastDone
          ? `${(lastDone.completedAt ?? lastDone.deadlineStart).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })} (${lastDone.title})`
          : null,
        discussedOn: discussed?.on ?? null,
        assignedInitials: discussed?.initials ?? (actionsForMetric[0] ? initials(actionsForMetric[0].lead.name) : null),
      };
    }

    rows.push({
      chapterId: chapter.id,
      chapterName: chapter.name,
      monthsActive,
      cells,
      paceScore: scoreN > 0 ? Math.round(scoreSum / scoreN) : 0,
    });
  }

  rows.sort((a, b) => b.paceScore - a.paceScore);

  // Prefer focus chapter near top for CP context without reshuffling ranks —
  // ranking stays global; UI can highlight the row.

  return {
    asOfLabel: monthLongLabel(asOf.getUTCFullYear(), asOf.getUTCMonth()),
    asOfKey,
    updatedLabel: "Just now",
    rows,
    panels,
  };
}

const METRIC_NOUN: Record<Exclude<AnalyticsMetricKey, "retention" | "quality">, string> = {
  partners: "partners",
  instructors: "instructors",
  students: "students",
  classes: "classes",
};
