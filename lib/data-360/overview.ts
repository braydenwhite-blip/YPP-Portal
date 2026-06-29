import { prisma } from "@/lib/prisma";
import { partnerIsActive } from "@/lib/operations/attention";

import { buildKpis, type OverviewCounts } from "./metrics";
import { rangeWhere } from "./range";
import { buildMonthlyCumulative, seriesWindowStart } from "./timeseries";
import type {
  CategoryBreakdown,
  CategoryDatum,
  Data360Overview,
  RecentActivityItem,
  ResolvedRange,
  SearchEntry,
  TimeSeries,
} from "./types";

/**
 * Data 360 — the Overview loader.
 *
 * Pure, read-only aggregation over existing portal data. Every query is
 * individually fail-soft (a failed slice degrades to empty/zero, never a page
 * crash) and they all run in parallel. No mutations, no synthetic scores — see
 * `docs/DATA_360_ROADMAP.md`.
 */

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

function humanize(value: string | null | undefined): string {
  if (!value) return "Uncategorized";
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

const ACTIVE_CLASS_STATUSES = ["PUBLISHED", "IN_PROGRESS"] as const;
const APP_TERMINAL_STATUSES = ["APPROVED", "REJECTED", "WITHDRAWN"] as const;
const OPEN_ACTION_STATUSES = ["NOT_STARTED", "IN_PROGRESS"] as const;

const ROLE_DRILLDOWN: Record<string, string> = {
  STUDENT: "/admin/students",
  INSTRUCTOR: "/admin/instructors",
};

export async function loadData360Overview(
  range: ResolvedRange,
  now: Date
): Promise<Data360Overview> {
  const addedWhere = rangeWhere(range);
  const windowStart = seriesWindowStart(now, 12);

  const [
    peopleByRole,
    studentsAdded,
    instructorsAdded,
    activeStudentRows,
    activeInstructorRows,
    activeMentorships,
    activeClasses,
    completedClasses,
    activePrograms,
    totalEnrollments,
    chaptersByStatus,
    chaptersByState,
    chaptersAdded,
    applicationsPipeline,
    applicationsAwaitingReview,
    openActions,
    overdueActions,
    completedActions,
    meetingsCompleted,
    partners,
    classCategoryRows,
    studentBaseline,
    studentDates,
    chapterBaseline,
    chapterDates,
    recentChapters,
    recentPartners,
    recentApplications,
    searchChapters,
    searchPrograms,
  ] = await Promise.all([
    safe(
      prisma.user.groupBy({
        by: ["primaryRole"],
        where: { archivedAt: null },
        _count: { _all: true },
      }),
      []
    ),
    addedWhere
      ? safe(
          prisma.user.count({
            where: { primaryRole: "STUDENT", archivedAt: null, createdAt: addedWhere },
          }),
          0
        )
      : Promise.resolve(0),
    addedWhere
      ? safe(
          prisma.user.count({
            where: { primaryRole: "INSTRUCTOR", archivedAt: null, createdAt: addedWhere },
          }),
          0
        )
      : Promise.resolve(0),
    safe(
      prisma.classEnrollment.groupBy({ by: ["studentId"], where: { status: "ENROLLED" } }),
      []
    ),
    safe(
      prisma.classOffering.groupBy({
        by: ["instructorId"],
        where: { status: { in: [...ACTIVE_CLASS_STATUSES] } },
      }),
      []
    ),
    safe(prisma.mentorship.count({ where: { status: "ACTIVE" } }), 0),
    safe(
      prisma.classOffering.count({ where: { status: { in: [...ACTIVE_CLASS_STATUSES] } } }),
      0
    ),
    safe(prisma.classOffering.count({ where: { status: "COMPLETED" } }), 0),
    safe(prisma.specialProgram.count({ where: { isActive: true } }), 0),
    safe(prisma.classEnrollment.count({ where: { status: "ENROLLED" } }), 0),
    safe(
      prisma.chapter.groupBy({
        by: ["lifecycleStatus"],
        where: { archivedAt: null },
        _count: { _all: true },
      }),
      []
    ),
    safe(
      prisma.chapter.groupBy({
        by: ["state"],
        where: { archivedAt: null },
        _count: { _all: true },
      }),
      []
    ),
    addedWhere
      ? safe(prisma.chapter.count({ where: { archivedAt: null, createdAt: addedWhere } }), 0)
      : Promise.resolve(0),
    safe(
      prisma.instructorApplication.count({
        where: { status: { notIn: [...APP_TERMINAL_STATUSES] } },
      }),
      0
    ),
    safe(
      prisma.instructorApplication.count({
        where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
      }),
      0
    ),
    safe(prisma.actionItem.count({ where: { status: { in: [...OPEN_ACTION_STATUSES] } } }), 0),
    safe(
      prisma.actionItem.count({
        where: {
          OR: [
            { status: "OVERDUE" },
            { status: { in: [...OPEN_ACTION_STATUSES] }, deadlineEnd: { lt: now } },
          ],
        },
      }),
      0
    ),
    safe(
      prisma.actionItem.count({ where: { status: "COMPLETE", completedAt: addedWhere } }),
      0
    ),
    safe(
      prisma.meeting.count({ where: { status: "COMPLETED", scheduledAt: addedWhere } }),
      0
    ),
    safe(
      prisma.partner.findMany({
        where: { archivedAt: null },
        select: {
          id: true,
          name: true,
          stage: true,
          nextFollowUpAt: true,
          lastContactedAt: true,
          createdAt: true,
        },
      }),
      []
    ),
    safe(
      prisma.classOffering.findMany({
        where: { status: { in: ["PUBLISHED", "IN_PROGRESS", "COMPLETED"] } },
        select: { template: { select: { interestArea: true } } },
      }),
      []
    ),
    safe(
      prisma.user.count({
        where: { primaryRole: "STUDENT", archivedAt: null, createdAt: { lt: windowStart } },
      }),
      0
    ),
    safe(
      prisma.user.findMany({
        where: { primaryRole: "STUDENT", archivedAt: null, createdAt: { gte: windowStart } },
        select: { createdAt: true },
      }),
      []
    ),
    safe(
      prisma.chapter.count({ where: { archivedAt: null, createdAt: { lt: windowStart } } }),
      0
    ),
    safe(
      prisma.chapter.findMany({
        where: { archivedAt: null, createdAt: { gte: windowStart } },
        select: { createdAt: true },
      }),
      []
    ),
    safe(
      prisma.chapter.findMany({
        where: { archivedAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, name: true, state: true, createdAt: true, lifecycleStatus: true },
      }),
      []
    ),
    safe(
      prisma.partner.findMany({
        where: { archivedAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, name: true, stage: true, createdAt: true },
      }),
      []
    ),
    safe(
      prisma.instructorApplication.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          preferredFirstName: true,
          lastName: true,
          legalName: true,
          status: true,
          createdAt: true,
        },
      }),
      []
    ),
    safe(
      prisma.chapter.findMany({
        where: { archivedAt: null },
        orderBy: { name: "asc" },
        take: 400,
        select: { id: true, name: true, state: true },
      }),
      []
    ),
    safe(
      prisma.specialProgram.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        take: 200,
        select: { id: true, name: true, type: true },
      }),
      []
    ),
  ]);

  // --- derive counts from the grouped reads -----------------------------------
  const roleCount = (role: string): number =>
    peopleByRole.find((r) => r.primaryRole === role)?._count._all ?? 0;
  const totalStudents = roleCount("STUDENT");
  const totalInstructors = roleCount("INSTRUCTOR");

  const totalChapters = chaptersByStatus.reduce((sum, r) => sum + r._count._all, 0);
  const activeChapters =
    chaptersByStatus.find((r) => r.lifecycleStatus === "ACTIVE")?._count._all ?? 0;

  const activePartnerList = partners.filter((p) =>
    partnerIsActive({
      id: p.id,
      name: p.name,
      stage: p.stage,
      nextFollowUpAt: p.nextFollowUpAt,
      lastContactedAt: p.lastContactedAt,
      relationshipLeadName: null,
    })
  );
  const partnersNeedFollowup = activePartnerList.filter(
    (p) => !p.nextFollowUpAt || p.nextFollowUpAt.getTime() < now.getTime()
  ).length;

  const counts: OverviewCounts = {
    totalStudents,
    studentsAdded,
    activeStudents: activeStudentRows.length,
    totalInstructors,
    instructorsAdded,
    activeInstructors: activeInstructorRows.length,
    activeMentorships,
    activeClasses,
    completedClasses,
    activePrograms,
    totalEnrollments,
    totalChapters,
    activeChapters,
    chaptersAdded,
    applicationsPipeline,
    applicationsAwaitingReview,
    openActions,
    overdueActions,
    completedActions,
    meetingsCompleted,
    activePartners: activePartnerList.length,
    partnersNeedFollowup,
  };

  // --- time series ------------------------------------------------------------
  const series: TimeSeries[] = [
    buildMonthlyCumulative({
      key: "students_over_time",
      label: "Students over time",
      href: "/admin/students",
      baseline: studentBaseline,
      dates: studentDates.map((r) => r.createdAt),
      now,
    }),
    buildMonthlyCumulative({
      key: "chapters_over_time",
      label: "Chapters over time",
      href: "/admin/chapters",
      baseline: chapterBaseline,
      dates: chapterDates.map((r) => r.createdAt),
      now,
    }),
  ];

  // --- breakdowns -------------------------------------------------------------
  const peopleByRoleData: CategoryDatum[] = peopleByRole
    .filter((r) => r.primaryRole && r._count._all > 0)
    .map((r) => ({
      key: r.primaryRole,
      label: humanize(r.primaryRole),
      value: r._count._all,
      href: ROLE_DRILLDOWN[r.primaryRole] ?? null,
    }))
    .sort((a, b) => b.value - a.value);

  const categoryMap = new Map<string, number>();
  for (const row of classCategoryRows) {
    const area = row.template?.interestArea?.trim() || "Uncategorized";
    categoryMap.set(area, (categoryMap.get(area) ?? 0) + 1);
  }
  const classesByCategoryData: CategoryDatum[] = Array.from(categoryMap.entries())
    .map(([key, value]) => ({ key, label: key, value, href: "/admin/classes" }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const chaptersByStatusData: CategoryDatum[] = chaptersByStatus
    .filter((r) => r.lifecycleStatus && r._count._all > 0)
    .map((r) => ({
      key: r.lifecycleStatus,
      label: humanize(r.lifecycleStatus),
      value: r._count._all,
      href: "/admin/chapters",
    }))
    .sort((a, b) => b.value - a.value);

  const partnerStageMap = new Map<string, number>();
  for (const p of activePartnerList) {
    const stage = p.stage ?? "UNKNOWN";
    partnerStageMap.set(stage, (partnerStageMap.get(stage) ?? 0) + 1);
  }
  const partnersByStageData: CategoryDatum[] = Array.from(partnerStageMap.entries())
    .map(([key, value]) => ({ key, label: humanize(key), value, href: "/partners" }))
    .sort((a, b) => b.value - a.value);

  const chaptersByStateData: CategoryDatum[] = chaptersByState
    .filter((r) => r._count._all > 0)
    .map((r) => ({
      key: r.state ?? "—",
      label: r.state?.trim() ? r.state : "Unknown",
      value: r._count._all,
      href: "/admin/chapters",
    }))
    .sort((a, b) => b.value - a.value);

  const breakdowns: CategoryBreakdown[] = [
    {
      key: "people_by_role",
      label: "People by role",
      data: peopleByRoleData,
      total: peopleByRoleData.reduce((s, d) => s + d.value, 0),
    },
    {
      key: "classes_by_category",
      label: "Classes by category",
      data: classesByCategoryData,
      total: classesByCategoryData.reduce((s, d) => s + d.value, 0),
    },
    {
      key: "chapters_by_status",
      label: "Chapters by lifecycle",
      data: chaptersByStatusData,
      total: totalChapters,
    },
    {
      key: "partners_by_stage",
      label: "Partners by stage",
      data: partnersByStageData,
      total: activePartnerList.length,
    },
    {
      key: "chapters_by_state",
      label: "Chapters by state",
      data: chaptersByStateData,
      total: totalChapters,
    },
  ];

  // --- recent activity --------------------------------------------------------
  const recent: RecentActivityItem[] = [
    ...recentChapters.map((c) => ({
      id: `chapter:${c.id}`,
      kind: "Chapter",
      title: c.name,
      detail: `${humanize(c.lifecycleStatus)}${c.state ? ` · ${c.state}` : ""}`,
      atISO: c.createdAt.toISOString(),
      href: "/admin/chapters",
    })),
    ...recentPartners.map((p) => ({
      id: `partner:${p.id}`,
      kind: "Partner",
      title: p.name,
      detail: p.stage ? humanize(p.stage) : "New partner",
      atISO: p.createdAt.toISOString(),
      href: "/partners",
    })),
    ...recentApplications.map((a) => ({
      id: `application:${a.id}`,
      kind: "Applicant",
      title:
        [a.preferredFirstName, a.lastName].filter(Boolean).join(" ").trim() ||
        a.legalName ||
        "Applicant",
      detail: humanize(a.status),
      atISO: a.createdAt.toISOString(),
      href: "/admin/instructor-applicants",
    })),
  ]
    .sort((a, b) => b.atISO.localeCompare(a.atISO))
    .slice(0, 9);

  // --- search index -----------------------------------------------------------
  const search: SearchEntry[] = [
    ...searchChapters.map((c) => ({
      id: `s:chapter:${c.id}`,
      label: c.name,
      sub: c.state?.trim() ? `Chapter · ${c.state}` : "Chapter",
      kind: "Chapter",
      href: "/admin/chapters",
    })),
    ...activePartnerList.map((p) => ({
      id: `s:partner:${p.id}`,
      label: p.name,
      sub: p.stage ? `Partner · ${humanize(p.stage)}` : "Partner",
      kind: "Partner",
      href: "/partners",
    })),
    ...searchPrograms.map((p) => ({
      id: `s:program:${p.id}`,
      label: p.name,
      sub: `Program · ${humanize(p.type)}`,
      kind: "Program",
      href: "/programs",
    })),
  ];

  return {
    generatedAtISO: now.toISOString(),
    range,
    kpis: buildKpis(counts, range),
    series,
    breakdowns,
    recent,
    search,
  };
}
