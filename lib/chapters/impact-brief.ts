// Chapter Impact Meeting brief — the deterministic weekly brief a Chapter
// President can open DURING the impact meeting and speak from. It assembles,
// from data the chapter already records: what changed since last week, current
// numbers vs. chapter expectations, per-lane updates (partners / instructors /
// students / classes), weekly wins, open work (completed · overdue · waiting),
// risks, support requests, decisions needed from leadership, proposed next-week
// commitments, and an explicit missing-data checklist. Nothing is invented:
// where data is missing, the brief says exactly what is missing and where to
// fill it. Pure + deterministic (pass `now`) so it is fully unit testable —
// the DB loader lives in lib/chapters/impact-brief-server.ts.

import type {
  ChapterGrowthSummary,
  ChapterGrowthStatus,
  KpiKey,
} from "@/lib/chapters/chapter-growth";
import type { ChapterExpectationsSummary } from "@/lib/chapters/expectations";
import {
  IMPACT_NARRATIVE_PROMPTS,
  type ChapterImpactMetrics,
} from "@/lib/chapters/impact-meeting";
import type { ChapterBlocker } from "@/lib/chapters/needs-attention-rules";

const DAY_MS = 24 * 60 * 60 * 1000;
const NEXT_WEEK_WINDOW_DAYS = 7;

// ---------------------------------------------------------------------------
// Input records (plain, serializable — the loader maps DB rows to these)
// ---------------------------------------------------------------------------

/** A chapter-scoped ActionItem in the shape the brief needs. */
export type BriefActionRecord = {
  id: string;
  title: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE" | "OVERDUE" | "BLOCKED" | "DROPPED";
  dueAt: Date | null;
  completedAt: Date | null;
  leadName: string | null;
  blockedReason: string | null;
};

export type BriefSupportRequest = {
  id: string;
  title: string;
  category: string;
  priority: string;
  createdAt: Date;
  assignedToName: string | null;
};

/** A Weekly Impact row the author flagged "decision needed" this week. */
export type BriefDecisionRow = {
  id: string;
  title: string;
  detail: string | null;
};

export type BriefMeetingInfo = {
  id: string;
  scheduledAt: Date;
  status: string;
  /** True when the meeting's reporting week matches this brief's week. */
  isThisWeek: boolean;
};

export type WeeklyEntryState = "SUBMITTED" | "DRAFT" | "MISSING";

export type BriefStudentMetrics = {
  enrolledCount: number;
  attendancePercent: number;
  hasAttendanceData: boolean;
  retentionPercent: number;
  feedbackCount: number;
  unresolvedConcerns: number;
};

export type BriefStudentNeed = {
  title: string;
  severity: "critical" | "warning" | "info";
  href: string;
};

export type ChapterImpactBriefInput = {
  chapter: { id: string; name: string; lifecycleLabel: string; presidentName: string | null };
  weekNumber: number;
  focus: string;
  /** Monday 00:00 UTC of the reporting week. */
  weekStart: Date;
  weekLabel: string;
  now: Date;
  growth: ChapterGrowthSummary;
  expectations: ChapterExpectationsSummary;
  metrics: ChapterImpactMetrics;
  studentMetrics: BriefStudentMetrics;
  studentNeeds: BriefStudentNeed[];
  blockers: ChapterBlocker[];
  /** All chapter-scoped actions in a recent window (the builder classifies). */
  actions: BriefActionRecord[];
  supportRequests: BriefSupportRequest[];
  decisionRows: BriefDecisionRow[];
  weeklyEntry: WeeklyEntryState;
  meeting: BriefMeetingInfo | null;
  attendanceRecordedThisWeek: boolean;
  snapshotSavedThisWeek: boolean;
  /** Partner follow-ups due now (from the partner pipeline summary). */
  partnerFollowUpsDue: number;
};

// ---------------------------------------------------------------------------
// Output shape
// ---------------------------------------------------------------------------

export type BriefReadinessState = "ready" | "almost" | "not_ready";

export type MissingDataItem = {
  key: string;
  /** What is missing, in plain language. */
  label: string;
  /** The next action that fills it. */
  action: string;
  href: string;
};

export type BriefLaneKey = "partners" | "instructors" | "students" | "classes";

export type BriefLaneUpdate = {
  key: BriefLaneKey;
  title: string;
  /** Compact current numbers, e.g. "3 confirmed · 2 in conversation". */
  headline: string;
  /** Week-over-week movement lines for this lane (may be empty). */
  changed: string[];
  /** The lane's single next step, in plain language. */
  nextStep: string;
  /** Count of open blockers in this lane. */
  attentionCount: number;
  href: string;
};

export type BriefRisk = {
  title: string;
  detail: string | null;
  severity: "critical" | "warning";
  href: string;
};

export type BriefDecision = {
  key: string;
  title: string;
  detail: string | null;
  source: "impact_row" | "blocker" | "support_request";
  href: string;
};

export type BriefCommitment = {
  text: string;
  source: "overdue_action" | "growth" | "blocker";
  href: string;
};

export type BriefOpenWork = {
  completedThisWeek: BriefActionRecord[];
  overdue: BriefActionRecord[];
  waiting: BriefActionRecord[];
  dueNextWeek: BriefActionRecord[];
  openCount: number;
};

export type ChapterImpactBrief = {
  chapter: ChapterImpactBriefInput["chapter"];
  weekNumber: number;
  weekLabel: string;
  focus: string;
  readiness: { state: BriefReadinessState; label: string };
  headline: string;
  whatChanged: {
    status: ChapterGrowthStatus;
    improvements: string[];
    regressions: string[];
  };
  expectations: ChapterExpectationsSummary;
  lanes: BriefLaneUpdate[];
  wins: string[];
  openWork: BriefOpenWork;
  risks: BriefRisk[];
  supportRequests: BriefSupportRequest[];
  decisionsNeeded: BriefDecision[];
  commitments: BriefCommitment[];
  missingData: MissingDataItem[];
  narrativePrompts: string[];
  meeting: BriefMeetingInfo | null;
};

// ---------------------------------------------------------------------------
// Open-work classification
// ---------------------------------------------------------------------------

const OPEN_ACTION_STATUSES = new Set(["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "OVERDUE"]);

/** Split chapter actions into the brief's open-work groups. */
export function classifyBriefActions(
  actions: BriefActionRecord[],
  weekStart: Date,
  now: Date
): BriefOpenWork {
  const completedThisWeek: BriefActionRecord[] = [];
  const overdue: BriefActionRecord[] = [];
  const waiting: BriefActionRecord[] = [];
  const dueNextWeek: BriefActionRecord[] = [];
  let openCount = 0;

  const nextWeekCutoff = now.getTime() + NEXT_WEEK_WINDOW_DAYS * DAY_MS;

  for (const a of actions) {
    if (a.status === "COMPLETE") {
      if (a.completedAt && a.completedAt.getTime() >= weekStart.getTime()) completedThisWeek.push(a);
      continue;
    }
    if (!OPEN_ACTION_STATUSES.has(a.status)) continue;
    openCount += 1;
    const isOverdue = a.dueAt != null && a.dueAt.getTime() < now.getTime();
    if (isOverdue) overdue.push(a);
    else if (a.dueAt != null && a.dueAt.getTime() <= nextWeekCutoff) dueNextWeek.push(a);
    if (a.status === "BLOCKED") waiting.push(a);
  }

  const byDue = (x: BriefActionRecord, y: BriefActionRecord) =>
    (x.dueAt?.getTime() ?? Infinity) - (y.dueAt?.getTime() ?? Infinity);
  overdue.sort(byDue);
  dueNextWeek.sort(byDue);
  completedThisWeek.sort(
    (x, y) => (y.completedAt?.getTime() ?? 0) - (x.completedAt?.getTime() ?? 0)
  );

  return { completedThisWeek, overdue, waiting, dueNextWeek, openCount };
}

// ---------------------------------------------------------------------------
// Lanes
// ---------------------------------------------------------------------------

const LANE_KPIS: Record<BriefLaneKey, KpiKey[]> = {
  partners: ["partnersContacted", "partnerMeetingsScheduled", "confirmedPartners"],
  instructors: ["instructorApplicants", "interviewsCompleted", "instructorsHired"],
  students: ["studentsEnrolled", "attendancePercent", "retentionPercent", "feedbackCollected"],
  classes: ["curriculaSubmitted", "curriculaApproved", "classesCreated", "classesReady"],
};

const BLOCKER_LANE_TO_BRIEF: Record<string, BriefLaneKey> = {
  partners: "partners",
  instructors: "instructors",
  curriculum: "classes",
  classes: "classes",
};

const SEVERITY_RANK = { critical: 0, warning: 1, info: 2 } as const;

function laneChangedLines(growth: ChapterGrowthSummary, lane: BriefLaneKey): string[] {
  const keys = new Set<KpiKey>(LANE_KPIS[lane]);
  return growth.changes
    .filter((c) => keys.has(c.key) && c.delta != null && c.delta !== 0)
    .map((c) => `${c.label} ${c.delta! > 0 ? "up" : "down"} ${Math.abs(c.delta!)} (${c.previous} → ${c.current})`);
}

function topLaneBlocker(blockers: ChapterBlocker[], lane: BriefLaneKey): ChapterBlocker | null {
  const inLane = blockers
    .filter((b) => BLOCKER_LANE_TO_BRIEF[b.lane] === lane)
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  return inLane[0] ?? null;
}

function buildLanes(input: ChapterImpactBriefInput): BriefLaneUpdate[] {
  const m = input.metrics;
  const s = input.studentMetrics;

  const laneBlockerCount = (lane: BriefLaneKey) =>
    input.blockers.filter((b) => BLOCKER_LANE_TO_BRIEF[b.lane] === lane).length;

  const laneNextStep = (lane: BriefLaneKey, fallback: string) => {
    const top = topLaneBlocker(input.blockers, lane);
    return top ? top.suggestedAction : fallback;
  };

  const studentTopNeed = [...input.studentNeeds].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
  )[0];

  const partnersHeadline = [
    `${m.partnersConfirmed} confirmed`,
    `${m.partnersInConversation} in conversation`,
    input.partnerFollowUpsDue > 0 ? `${input.partnerFollowUpsDue} follow-ups due` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const instructorsHeadline = [
    `${m.instructorApplicants} applicants`,
    `${m.interviewsScheduled} interviews scheduled`,
    `${m.instructorsHired} hired`,
  ].join(" · ");

  const studentsHeadline = [
    `${s.enrolledCount} enrolled`,
    s.hasAttendanceData ? `attendance ${s.attendancePercent}%` : "no attendance data yet",
    s.unresolvedConcerns > 0 ? `${s.unresolvedConcerns} concerns open` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const classesHeadline = [
    `${m.classesTotal} planned`,
    `${m.classesRunning} running`,
    m.underEnrolledClasses > 0 ? `${m.underEnrolledClasses} under-enrolled` : null,
    `${m.curriculaApproved} curricula approved`,
  ]
    .filter(Boolean)
    .join(" · ");

  return [
    {
      key: "partners",
      title: "Partners",
      headline: partnersHeadline,
      changed: laneChangedLines(input.growth, "partners"),
      nextStep: laneNextStep(
        "partners",
        m.partnersConfirmed === 0 ? "Keep partner outreach moving" : "Partner pipeline on track"
      ),
      attentionCount: laneBlockerCount("partners"),
      href: "/partners",
    },
    {
      key: "instructors",
      title: "Instructors",
      headline: instructorsHeadline,
      changed: laneChangedLines(input.growth, "instructors"),
      nextStep: laneNextStep(
        "instructors",
        m.instructorApplicants === 0 ? "Start instructor recruiting" : "Instructor pipeline on track"
      ),
      attentionCount: laneBlockerCount("instructors"),
      href: "/chapter/recruiting?tab=candidates",
    },
    {
      key: "students",
      title: "Students",
      headline: studentsHeadline,
      changed: laneChangedLines(input.growth, "students"),
      nextStep: studentTopNeed
        ? studentTopNeed.title
        : s.enrolledCount === 0
          ? "Open enrollment and recruit students"
          : "Student community on track",
      attentionCount: input.studentNeeds.length,
      href: "/chapter/students",
    },
    {
      key: "classes",
      title: "Classes",
      headline: classesHeadline,
      changed: laneChangedLines(input.growth, "classes"),
      nextStep: laneNextStep(
        "classes",
        m.classesTotal === 0 ? "Create the first class" : "Classes on track"
      ),
      attentionCount: laneBlockerCount("classes"),
      href: "/chapter",
    },
  ];
}

// ---------------------------------------------------------------------------
// Missing data + readiness
// ---------------------------------------------------------------------------

function buildMissingData(input: ChapterImpactBriefInput): MissingDataItem[] {
  const out: MissingDataItem[] = [];

  if (input.weeklyEntry === "MISSING") {
    out.push({
      key: "weekly_update",
      label: "Weekly impact update not started",
      action: "Fill in your Weekly Impact form for this week",
      href: "/my-weekly-impact",
    });
  } else if (input.weeklyEntry === "DRAFT") {
    out.push({
      key: "weekly_update",
      label: "Weekly impact update drafted but not submitted",
      action: "Submit your Weekly Impact form",
      href: "/my-weekly-impact",
    });
  }

  if (!input.meeting || !input.meeting.isThisWeek) {
    out.push({
      key: "meeting",
      label: "No Impact Meeting scheduled for this week",
      action: "Schedule this week's Chapter Impact meeting",
      href: "/meetings/new",
    });
  }

  if (input.metrics.classesRunning > 0 && !input.attendanceRecordedThisWeek) {
    out.push({
      key: "attendance",
      label: "No attendance recorded this week",
      action: "Record attendance for this week's sessions",
      href: "/chapter",
    });
  }

  if (!input.snapshotSavedThisWeek && input.weeklyEntry !== "SUBMITTED") {
    out.push({
      key: "snapshot",
      label: "This week's KPI snapshot not saved yet",
      action: "Submitting your weekly update saves it automatically",
      href: "/my-weekly-impact",
    });
  }

  return out;
}

function buildReadiness(
  weeklyEntry: WeeklyEntryState,
  missing: MissingDataItem[]
): { state: BriefReadinessState; label: string } {
  if (weeklyEntry !== "SUBMITTED") {
    return {
      state: "not_ready",
      label: weeklyEntry === "MISSING" ? "Missing weekly update" : "Weekly update not submitted",
    };
  }
  if (missing.length > 0) return { state: "almost", label: "Almost ready — fill the gaps" };
  return { state: "ready", label: "Ready for Impact Meeting" };
}

// ---------------------------------------------------------------------------
// Wins, decisions, commitments, headline
// ---------------------------------------------------------------------------

function buildWins(input: ChapterImpactBriefInput, openWork: BriefOpenWork): string[] {
  const wins: string[] = [...input.growth.signals.growth];
  if (openWork.completedThisWeek.length > 0) {
    wins.push(
      openWork.completedThisWeek.length === 1
        ? "1 action completed this week"
        : `${openWork.completedThisWeek.length} actions completed this week`
    );
  }
  return wins.slice(0, 6);
}

function buildDecisions(input: ChapterImpactBriefInput): BriefDecision[] {
  const out: BriefDecision[] = [];
  const seen = new Set<string>();
  const push = (d: BriefDecision) => {
    if (seen.has(d.key)) return;
    seen.add(d.key);
    out.push(d);
  };

  for (const r of input.decisionRows) {
    push({
      key: `impact-row:${r.id}`,
      title: r.title,
      detail: r.detail,
      source: "impact_row",
      href: "/my-weekly-impact",
    });
  }
  for (const b of input.blockers.filter((x) => x.severity === "critical")) {
    push({
      key: `blocker:${b.key}`,
      title: b.title,
      detail: b.detail ?? null,
      source: "blocker",
      href: b.href,
    });
  }
  for (const s of input.supportRequests.filter(
    (x) => x.priority === "URGENT" || x.priority === "HIGH"
  )) {
    push({
      key: `support:${s.id}`,
      title: `Support request: ${s.title}`,
      detail: s.assignedToName ? `Assigned to ${s.assignedToName}` : "Unassigned — needs a Global owner",
      source: "support_request",
      href: "/chapter",
    });
  }
  return out.slice(0, 8);
}

function buildCommitments(
  input: ChapterImpactBriefInput,
  openWork: BriefOpenWork
): BriefCommitment[] {
  const out: BriefCommitment[] = [];
  const seen = new Set<string>();
  const push = (c: BriefCommitment) => {
    if (seen.has(c.text) || out.length >= 5) return;
    seen.add(c.text);
    out.push(c);
  };

  for (const a of openWork.overdue.slice(0, 3)) {
    push({ text: `Clear overdue: ${a.title}`, source: "overdue_action", href: `/actions/${a.id}` });
  }
  push({ text: input.growth.nextAction, source: "growth", href: "/chapter?lane=meetings" });
  const topBlocker = [...input.blockers].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
  )[0];
  if (topBlocker) {
    push({ text: topBlocker.suggestedAction, source: "blocker", href: topBlocker.href });
  }
  return out;
}

const GROWTH_STATUS_PHRASE: Record<ChapterGrowthStatus, string> = {
  Strong: "Chapter is strengthening",
  Improving: "Chapter is improving",
  Flat: "Chapter held steady",
  Slipping: "Chapter slipped this week",
  Critical: "Chapter needs immediate attention",
  "No Baseline Yet": "First full week — the baseline is being set",
};

function buildHeadline(
  input: ChapterImpactBriefInput,
  openWork: BriefOpenWork,
  wins: string[],
  decisions: BriefDecision[]
): string {
  const parts = [GROWTH_STATUS_PHRASE[input.growth.status]];
  const facts: string[] = [];
  if (wins.length > 0) facts.push(wins.length === 1 ? "1 win" : `${wins.length} wins`);
  if (openWork.overdue.length > 0)
    facts.push(openWork.overdue.length === 1 ? "1 overdue action" : `${openWork.overdue.length} overdue actions`);
  if (decisions.length > 0)
    facts.push(decisions.length === 1 ? "1 decision needed" : `${decisions.length} decisions needed`);
  if (facts.length > 0) parts.push(facts.join(" · "));
  return parts.join(". ") + ".";
}

// ---------------------------------------------------------------------------
// Assemble
// ---------------------------------------------------------------------------

/** Build the full Impact Meeting brief from real chapter data. */
export function buildChapterImpactBrief(input: ChapterImpactBriefInput): ChapterImpactBrief {
  const openWork = classifyBriefActions(input.actions, input.weekStart, input.now);
  const wins = buildWins(input, openWork);
  const decisions = buildDecisions(input);
  const missing = buildMissingData(input);
  const readiness = buildReadiness(input.weeklyEntry, missing);

  const risks: BriefRisk[] = input.blockers
    .filter((b) => b.severity !== "info")
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    .slice(0, 8)
    .map((b) => ({
      title: b.title,
      detail: b.detail ?? null,
      severity: b.severity as "critical" | "warning",
      href: b.href,
    }));

  return {
    chapter: input.chapter,
    weekNumber: input.weekNumber,
    weekLabel: input.weekLabel,
    focus: input.focus,
    readiness,
    headline: buildHeadline(input, openWork, wins, decisions),
    whatChanged: {
      status: input.growth.status,
      improvements: input.growth.signals.growth,
      regressions: input.growth.signals.regression,
    },
    expectations: input.expectations,
    lanes: buildLanes(input),
    wins,
    openWork,
    risks,
    supportRequests: input.supportRequests,
    decisionsNeeded: decisions,
    commitments: buildCommitments(input, openWork),
    missingData: missing,
    narrativePrompts: [...IMPACT_NARRATIVE_PROMPTS],
    meeting: input.meeting,
  };
}
