// Read models for national leadership: the chapter command center (lifecycle +
// signal-based views), the geographic chapter map, and national growth analytics.
// All derived from the live chapter / application / meeting / action data — no
// spreadsheets, no parallel tracking.

import { prisma } from "@/lib/prisma";
import { gatherChapterSignals, healthFromSignals } from "@/lib/chapters/signals";
import {
  CHAPTER_COMMAND_VIEWS,
  resolveChapterCommandView,
  isOperatingStatus,
  isLaunchingStatus,
} from "@/lib/chapters/lifecycle";

const DAY_MS = 24 * 60 * 60 * 1000;

export type ChapterCommandCard = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  partnerSchool: string | null;
  lifecycleStatus: string;
  president: { id: string; name: string } | null;
  health: ReturnType<typeof healthFromSignals>;
  memberCount: number;
  nextStep: string;
  blocker: string | null;
  lastActivityAt: Date;
  upcomingMeetingAt: Date | null;
  // derived view membership
  flags: {
    noUpcomingMeeting: boolean;
    waitingOnCp: boolean;
    waitingOnYpp: boolean;
    recentlyLaunched: boolean;
    highPerforming: boolean;
  };
};

type EnrichedChapter = ChapterCommandCard & { archivedExcluded: true };

async function enrichAllChapters(now: Date): Promise<ChapterCommandCard[]> {
  const chapters = await prisma.chapter.findMany({
    where: { archivedAt: null },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      city: true,
      state: true,
      partnerSchool: true,
      lifecycleStatus: true,
      lifecycleNote: true,
      launchTargetDate: true,
      launchedAt: true,
      launchPlanSubmittedAt: true,
      launchPlanApprovedAt: true,
      updatedAt: true,
      president: { select: { id: true, name: true } },
    },
  });

  const signals = await gatherChapterSignals(
    chapters.map((c) => c.id),
    now
  );

  return chapters.map((c) => {
    const raw = signals.get(c.id) ?? {
      memberCount: 0,
      lastMeetingAt: null,
      nextMeetingAt: null,
      openActions: 0,
      overdueActions: 0,
      openSupportRequests: 0,
      launchTotal: 0,
      launchDone: 0,
    };
    const health = healthFromSignals(raw, c.lifecycleStatus, c.launchTargetDate, now);

    const lastActivityAt =
      raw.lastMeetingAt && raw.lastMeetingAt > c.updatedAt ? raw.lastMeetingAt : c.updatedAt;

    let nextStep: string;
    if (isLaunchingStatus(c.lifecycleStatus)) {
      nextStep =
        raw.launchTotal > 0
          ? `Launch checklist ${raw.launchDone}/${raw.launchTotal}`
          : "Begin launch checklist";
    } else if (health.label === "AT_RISK" || health.label === "NEEDS_SUPPORT") {
      nextStep = health.reasons[0] ?? "Needs a check-in";
    } else if (!raw.nextMeetingAt && isOperatingStatus(c.lifecycleStatus)) {
      nextStep = "Schedule the next meeting";
    } else {
      nextStep = "On track";
    }

    let blocker: string | null = null;
    if (raw.overdueActions > 0) blocker = `${raw.overdueActions} overdue action${raw.overdueActions === 1 ? "" : "s"}`;
    else if (raw.openSupportRequests > 0)
      blocker = `${raw.openSupportRequests} open support request${raw.openSupportRequests === 1 ? "" : "s"}`;

    const recentlyLaunched =
      !!c.launchedAt && now.getTime() - c.launchedAt.getTime() <= 30 * DAY_MS;
    const highPerforming =
      isOperatingStatus(c.lifecycleStatus) &&
      health.label === "ON_TRACK" &&
      raw.memberCount >= 8 &&
      !!raw.nextMeetingAt &&
      raw.overdueActions === 0;
    const waitingOnYpp =
      raw.openSupportRequests > 0 ||
      (!!c.launchPlanSubmittedAt && !c.launchPlanApprovedAt);
    const waitingOnCp =
      isLaunchingStatus(c.lifecycleStatus) && (raw.overdueActions > 0 || raw.launchDone < raw.launchTotal);
    const noUpcomingMeeting = isOperatingStatus(c.lifecycleStatus) && !raw.nextMeetingAt;

    return {
      id: c.id,
      name: c.name,
      city: c.city,
      state: c.state,
      partnerSchool: c.partnerSchool,
      lifecycleStatus: c.lifecycleStatus,
      president: c.president,
      health,
      memberCount: raw.memberCount,
      nextStep,
      blocker,
      lastActivityAt,
      upcomingMeetingAt: raw.nextMeetingAt,
      flags: { noUpcomingMeeting, waitingOnCp, waitingOnYpp, recentlyLaunched, highPerforming },
    };
  });
}

function matchesView(card: ChapterCommandCard, viewKey: string): boolean {
  const view = resolveChapterCommandView(viewKey);
  if (view.signal) {
    switch (view.signal) {
      case "no_upcoming_meeting":
        return card.flags.noUpcomingMeeting;
      case "waiting_on_cp":
        return card.flags.waitingOnCp;
      case "waiting_on_ypp":
        return card.flags.waitingOnYpp;
      case "recently_launched":
        return card.flags.recentlyLaunched;
      case "high_performing":
        return card.flags.highPerforming;
    }
  }
  if (!view.statuses) return true;
  return view.statuses.includes(card.lifecycleStatus as never);
}

export async function loadLeadershipChapters(opts?: { view?: string; state?: string }) {
  const now = new Date();
  const all = await enrichAllChapters(now);

  const viewCounts = CHAPTER_COMMAND_VIEWS.map((v) => ({
    key: v.key,
    label: v.label,
    count: all.filter((c) => matchesView(c, v.key)).length,
  }));

  const requestedView = resolveChapterCommandView(opts?.view);
  let cards = all.filter((c) => matchesView(c, requestedView.key));
  if (opts?.state) cards = cards.filter((c) => c.state === opts.state);

  const states = Array.from(
    new Set(all.map((c) => c.state).filter((s): s is string => !!s))
  ).sort();

  // Headline tiles for the command center.
  const summary = {
    total: all.length,
    launching: all.filter((c) => isLaunchingStatus(c.lifecycleStatus)).length,
    active: all.filter((c) => isOperatingStatus(c.lifecycleStatus)).length,
    needsSupport: all.filter((c) => c.health.label === "NEEDS_SUPPORT").length,
    atRisk: all.filter((c) => c.health.label === "AT_RISK").length,
    noUpcomingMeeting: all.filter((c) => c.flags.noUpcomingMeeting).length,
  };

  return { cards, viewCounts, requestedView: requestedView.key, states, summary };
}

// --- Geographic chapter map --------------------------------------------------

const APPROVED_APP_STATUSES = ["ACCEPTED", "APPROVED", "ONBOARDING", "ACTIVE_CP"];
const OPEN_APP_STATUSES = [
  "SUBMITTED",
  "INITIAL_REVIEW",
  "UNDER_REVIEW",
  "NEEDS_MORE_INFO",
  "INFO_REQUESTED",
  "INTERVIEW_NEEDED",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_COMPLETE",
  "INTERVIEW_COMPLETED",
  "DECISION_NEEDED",
  "RECOMMENDATION_SUBMITTED",
];

export type ChapterMapStateRow = {
  state: string;
  active: number;
  launching: number;
  prospect: number;
  paused: number;
  alumni: number;
  chapters: number;
  openApplicants: number;
};

export async function loadChapterMap() {
  const now = new Date();
  const [chapters, apps] = await Promise.all([
    prisma.chapter.findMany({
      where: { archivedAt: null },
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        partnerSchool: true,
        schoolType: true,
        lifecycleStatus: true,
        president: { select: { id: true, name: true } },
      },
    }),
    prisma.chapterPresidentApplication.findMany({
      where: { archivedAt: null },
      select: { id: true, stateProvince: true, city: true, schoolName: true, status: true },
    }),
  ]);

  const byState = new Map<string, ChapterMapStateRow>();
  const ensure = (state: string) => {
    let row = byState.get(state);
    if (!row) {
      row = { state, active: 0, launching: 0, prospect: 0, paused: 0, alumni: 0, chapters: 0, openApplicants: 0 };
      byState.set(state, row);
    }
    return row;
  };

  for (const c of chapters) {
    const state = c.state || c.city || "Unknown";
    const row = ensure(state);
    row.chapters += 1;
    if (isOperatingStatus(c.lifecycleStatus)) row.active += 1;
    else if (isLaunchingStatus(c.lifecycleStatus)) row.launching += 1;
    else if (c.lifecycleStatus === "PROSPECT") row.prospect += 1;
    else if (c.lifecycleStatus === "PAUSED") row.paused += 1;
    else if (c.lifecycleStatus === "ALUMNI") row.alumni += 1;
  }

  for (const a of apps) {
    if (!OPEN_APP_STATUSES.includes(a.status)) continue;
    const state = a.stateProvince || a.city || "Unknown";
    ensure(state).openApplicants += 1;
  }

  const stateRows = Array.from(byState.values()).sort((a, b) => b.chapters - a.chapters || a.state.localeCompare(b.state));

  const schoolsRepresented = new Set(
    chapters.map((c) => c.partnerSchool).filter((s): s is string => !!s)
  ).size;
  const statesWithActive = stateRows.filter((r) => r.active > 0 || r.launching > 0).map((r) => r.state);
  // Expansion gaps: real demand (open applicants) but no chapter footprint yet.
  const expansionGaps = stateRows
    .filter((r) => r.openApplicants > 0 && r.active === 0 && r.launching === 0)
    .map((r) => ({ state: r.state, openApplicants: r.openApplicants }));

  return {
    chapters,
    stateRows,
    totals: {
      chapters: chapters.length,
      active: chapters.filter((c) => isOperatingStatus(c.lifecycleStatus)).length,
      launching: chapters.filter((c) => isLaunchingStatus(c.lifecycleStatus)).length,
      statesRepresented: statesWithActive.length,
      schoolsRepresented,
      openApplicants: apps.filter((a) => OPEN_APP_STATUSES.includes(a.status)).length,
    },
    expansionGaps,
  };
}

// --- National growth analytics ----------------------------------------------

export async function loadChapterAnalytics() {
  const now = new Date();
  const [apps, chapters, students] = await Promise.all([
    prisma.chapterPresidentApplication.findMany({
      where: { archivedAt: null },
      select: {
        status: true,
        createdAt: true,
        decisionAt: true,
        stateProvince: true,
        city: true,
        schoolName: true,
      },
    }),
    prisma.chapter.findMany({
      where: { archivedAt: null },
      select: { id: true, state: true, lifecycleStatus: true, launchedAt: true },
    }),
    prisma.user.count({ where: { primaryRole: "STUDENT", chapter: { archivedAt: null } } }),
  ]);

  const decided = apps.filter(
    (a) =>
      APPROVED_APP_STATUSES.includes(a.status) ||
      a.status === "DECLINED" ||
      a.status === "REJECTED" ||
      a.status === "WAITLISTED"
  );
  const approved = apps.filter((a) => APPROVED_APP_STATUSES.includes(a.status));
  const approvalRate = decided.length > 0 ? Math.round((approved.length / decided.length) * 100) : null;

  const reviewTimes = decided
    .filter((a) => a.decisionAt)
    .map((a) => (a.decisionAt!.getTime() - a.createdAt.getTime()) / DAY_MS)
    .filter((d) => d >= 0);
  const avgReviewDays =
    reviewTimes.length > 0
      ? Math.round((reviewTimes.reduce((sum, d) => sum + d, 0) / reviewTimes.length) * 10) / 10
      : null;

  const countBy = (rows: Array<string | null>) => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const key = r || "Unknown";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);
  };

  const chaptersPerState = countBy(chapters.map((c) => c.state));
  const applicationsBySchool = countBy(apps.map((a) => a.schoolName)).slice(0, 12);
  const applicationsByCity = countBy(apps.map((a) => a.city)).slice(0, 12);

  // Fastest-growing regions: states with the most chapters launched in 90 days.
  const ninetyDaysAgo = new Date(now.getTime() - 90 * DAY_MS);
  const recentLaunchesByState = countBy(
    chapters.filter((c) => c.launchedAt && c.launchedAt >= ninetyDaysAgo).map((c) => c.state)
  ).slice(0, 8);

  return {
    totals: {
      applications: apps.length,
      openApplications: apps.filter((a) => OPEN_APP_STATUSES.includes(a.status)).length,
      activeChapters: chapters.filter((c) => isOperatingStatus(c.lifecycleStatus)).length,
      launchingChapters: chapters.filter((c) => isLaunchingStatus(c.lifecycleStatus)).length,
      studentsImpacted: students,
      approvalRate,
      avgReviewDays,
    },
    chaptersPerState,
    applicationsBySchool,
    applicationsByCity,
    recentLaunchesByState,
  };
}
