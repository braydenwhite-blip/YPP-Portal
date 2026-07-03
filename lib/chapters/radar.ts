// Global chapter radar — the pure needs-attention logic behind the leadership
// Chapter Command. Turns per-chapter operating counts into plain, explainable
// signals: pipeline bottlenecks (partners / instructors / classes / students),
// missing weekly updates, decisions waiting on leadership, stalled activity,
// and the "ready to scale" flag. Every signal is a concrete count with a plain
// label — never a hidden score. Pure + deterministic, fully unit testable.

import { isOperatingStatus } from "@/lib/chapters/lifecycle";
import {
  summarizeChapterExpectations,
  type ChapterExpectationsSummary,
} from "@/lib/chapters/expectations";
import type { ChapterHealthLabel } from "@/lib/chapters/health";

/** Days with no chapter activity before leadership should check in. */
export const STALLED_ACTIVITY_DAYS = 14;

export type ChapterRadarCounts = {
  confirmedPartners: number;
  partnersInFlight: number;
  partnerFollowUpsOverdue: number;
  instructorApplicants: number;
  instructorsHired: number;
  studentsEnrolled: number;
  classesTotal: number;
  classesRunning: number;
  overdueActions: number;
  openSupportRequests: number;
  decisionsNeeded: number;
};

export function emptyRadarCounts(): ChapterRadarCounts {
  return {
    confirmedPartners: 0,
    partnersInFlight: 0,
    partnerFollowUpsOverdue: 0,
    instructorApplicants: 0,
    instructorsHired: 0,
    studentsEnrolled: 0,
    classesTotal: 0,
    classesRunning: 0,
    overdueActions: 0,
    openSupportRequests: 0,
    decisionsNeeded: 0,
  };
}

export type WeeklyUpdateState = "SUBMITTED" | "DRAFT" | "MISSING";

export type ChapterRadarInput = {
  id: string;
  lifecycleStatus: string;
  healthLabel: ChapterHealthLabel;
  counts: ChapterRadarCounts;
  weeklyUpdate: WeeklyUpdateState;
  /** Whole days since the last recorded chapter activity. */
  daysSinceActivity: number;
};

export type BottleneckKey = "partners" | "instructors" | "classes" | "students";

export type ChapterBottleneck = {
  key: BottleneckKey;
  /** Plain operational label, e.g. "Needs partner follow-up". */
  label: string;
  detail: string;
};

/**
 * Detect pipeline bottlenecks for an OPERATING chapter. Launching chapters are
 * paced by the launch checklist instead, so only follow-up pile-ups apply.
 */
export function deriveChapterBottlenecks(input: ChapterRadarInput): ChapterBottleneck[] {
  const { counts } = input;
  const operating = isOperatingStatus(input.lifecycleStatus);
  const out: ChapterBottleneck[] = [];

  if (counts.partnerFollowUpsOverdue >= 3) {
    out.push({
      key: "partners",
      label: "Needs partner follow-up",
      detail: `${counts.partnerFollowUpsOverdue} partner follow-ups overdue`,
    });
  } else if (operating && counts.confirmedPartners === 0) {
    out.push({
      key: "partners",
      label: "No confirmed partners",
      detail:
        counts.partnersInFlight > 0
          ? `${counts.partnersInFlight} in conversation, none confirmed yet`
          : "Partner outreach has not produced a confirmed partner",
    });
  }

  if (operating && counts.instructorsHired === 0 && counts.classesTotal > 0) {
    out.push({
      key: "instructors",
      label: "Classes need instructors",
      detail: `${counts.classesTotal} classes planned with no instructors hired`,
    });
  } else if (operating && counts.instructorApplicants < 5 && counts.instructorsHired < 3) {
    out.push({
      key: "instructors",
      label: "Instructor pipeline thin",
      detail: `${counts.instructorApplicants} applicants, ${counts.instructorsHired} hired`,
    });
  }

  if (operating && counts.classesTotal === 0) {
    out.push({
      key: "classes",
      label: "No classes planned",
      detail: "Chapter is active with no classes created",
    });
  } else if (
    operating &&
    counts.classesRunning === 0 &&
    counts.confirmedPartners > 0 &&
    counts.instructorsHired > 0
  ) {
    out.push({
      key: "classes",
      label: "Classes not running yet",
      detail: "Partners and instructors are ready but no class is live",
    });
  }

  if (operating && counts.studentsEnrolled === 0 && counts.classesTotal > 0) {
    out.push({
      key: "students",
      label: "No students enrolled",
      detail: `${counts.classesTotal} classes with zero enrollment`,
    });
  }

  return out;
}

export type ChapterRadarRow = {
  id: string;
  bottlenecks: ChapterBottleneck[];
  /** Plain reasons this chapter needs leadership attention (may be empty). */
  attentionReasons: string[];
  needsAttention: boolean;
  readyToScale: boolean;
  weeklyUpdate: WeeklyUpdateState;
  decisionsNeeded: number;
  expectations: ChapterExpectationsSummary;
};

/** Assemble the full radar row for one chapter. */
export function buildChapterRadarRow(input: ChapterRadarInput): ChapterRadarRow {
  const { counts } = input;
  const bottlenecks = deriveChapterBottlenecks(input);
  const expectations = summarizeChapterExpectations({
    confirmedPartners: counts.confirmedPartners,
    instructorApplicants: counts.instructorApplicants,
    instructorsHired: counts.instructorsHired,
    studentsEnrolled: counts.studentsEnrolled,
    classesRunning: counts.classesRunning,
  });

  const reasons: string[] = [];
  if (input.weeklyUpdate === "MISSING") reasons.push("Missing weekly update");
  else if (input.weeklyUpdate === "DRAFT") reasons.push("Weekly update not submitted");
  if (counts.decisionsNeeded > 0) {
    reasons.push(
      counts.decisionsNeeded === 1 ? "1 decision needed" : `${counts.decisionsNeeded} decisions needed`
    );
  }
  if (counts.overdueActions > 0) {
    reasons.push(
      counts.overdueActions === 1 ? "1 overdue action" : `${counts.overdueActions} overdue actions`
    );
  }
  if (counts.openSupportRequests > 0) {
    reasons.push("Support needed from Global");
  }
  if (input.daysSinceActivity > STALLED_ACTIVITY_DAYS) {
    reasons.push(`No recent activity (${input.daysSinceActivity} days)`);
  }
  for (const b of bottlenecks) reasons.push(b.label);

  const unhealthy = input.healthLabel === "NEEDS_SUPPORT" || input.healthLabel === "AT_RISK";
  const needsAttention = unhealthy || reasons.length > 0;

  const readyToScale =
    isOperatingStatus(input.lifecycleStatus) &&
    input.healthLabel === "ON_TRACK" &&
    expectations.readyToScale &&
    counts.overdueActions === 0 &&
    input.weeklyUpdate === "SUBMITTED";

  return {
    id: input.id,
    bottlenecks,
    attentionReasons: reasons,
    needsAttention,
    readyToScale,
    weeklyUpdate: input.weeklyUpdate,
    decisionsNeeded: counts.decisionsNeeded,
    expectations,
  };
}

export type ChapterRadarSummary = {
  needsAttention: number;
  missingWeeklyUpdate: number;
  decisionsNeeded: number;
  partnerBottlenecks: number;
  instructorBottlenecks: number;
  classBottlenecks: number;
  studentBottlenecks: number;
  overdueWork: number;
  readyToScale: number;
};

/** National roll-up of the radar rows for the command-center tiles. */
export function summarizeChapterRadar(
  rows: Array<Pick<ChapterRadarRow, "bottlenecks" | "needsAttention" | "readyToScale" | "weeklyUpdate" | "decisionsNeeded">>,
  countsById?: Map<string, ChapterRadarCounts>
): ChapterRadarSummary {
  const has = (row: { bottlenecks: ChapterBottleneck[] }, key: BottleneckKey) =>
    row.bottlenecks.some((b) => b.key === key);
  let overdueWork = 0;
  if (countsById) {
    for (const c of countsById.values()) if (c.overdueActions > 0) overdueWork += 1;
  }
  return {
    needsAttention: rows.filter((r) => r.needsAttention).length,
    missingWeeklyUpdate: rows.filter((r) => r.weeklyUpdate !== "SUBMITTED").length,
    decisionsNeeded: rows.filter((r) => r.decisionsNeeded > 0).length,
    partnerBottlenecks: rows.filter((r) => has(r, "partners")).length,
    instructorBottlenecks: rows.filter((r) => has(r, "instructors")).length,
    classBottlenecks: rows.filter((r) => has(r, "classes")).length,
    studentBottlenecks: rows.filter((r) => has(r, "students")).length,
    overdueWork,
    readyToScale: rows.filter((r) => r.readyToScale).length,
  };
}
