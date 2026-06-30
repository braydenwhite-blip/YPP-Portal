// ============================================================================
// The 12-week Chapter President PLAYBOOK INTERPRETER
// ============================================================================
//
// The existing Chapter OS knows the chapter's WEEK number (`chapterWeekNumber`)
// and a per-week impact-meeting metric set, but nothing tells a CP, in plain
// operational language, "what was supposed to happen by now, and what hasn't."
// This interpreter does exactly that — it encodes the CP guide's 12-week pipeline
// as deterministic EXPECTATIONS (each a predicate over `ChapterFacts` plus an
// evidence string and a due-by week) and reports, for the chapter's current
// week: what is expected, what is done, what is missing, and what is overdue.
//
// This is NOT a health score. It produces operational sentences like:
//   "You are in Week 5. You still need one confirmed partner with logistics in
//    writing."
//
// Pure + deterministic (everything reads `ChapterFacts`, which carries the
// chapter's week) so it is fully unit-testable.

import type { ChapterFacts } from "@/lib/automation/types";
import {
  getPlaybookTargetsForWeek,
  type KpiKey,
  type PlaybookTarget,
} from "@/lib/chapters/chapter-growth";

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------

export const PLAYBOOK_WINDOW_IDS = [
  "weeks_1_2",
  "weeks_3_4",
  "weeks_5_6",
  "weeks_7_8",
  "weeks_9_10",
  "weeks_11_12",
] as const;
export type PlaybookWindowId = (typeof PLAYBOOK_WINDOW_IDS)[number];

export type PlaybookWindow = {
  id: PlaybookWindowId;
  /** Inclusive [startWeek, endWeek]. The last window absorbs weeks > 12. */
  weeks: [number, number];
  label: string;
  focus: string;
};

export const PLAYBOOK_WINDOWS: PlaybookWindow[] = [
  { id: "weeks_1_2", weeks: [1, 2], label: "Weeks 1–2", focus: "Research, partner outreach & instructor recruiting" },
  { id: "weeks_3_4", weeks: [3, 4], label: "Weeks 3–4", focus: "Partner meetings & instructor interviews" },
  { id: "weeks_5_6", weeks: [5, 6], label: "Weeks 5–6", focus: "Close partners, logistics, orientation & curriculum" },
  { id: "weeks_7_8", weeks: [7, 8], label: "Weeks 7–8", focus: "Launch dates, readiness, advertising & enrollment" },
  { id: "weeks_9_10", weeks: [9, 10], label: "Weeks 9–10", focus: "Live operations, observations, attendance & Session 2" },
  { id: "weeks_11_12", weeks: [11, 999], label: "Weeks 11–12", focus: "Finish session, review & plan next session" },
];

/** The window a given (1-based) week falls into. Weeks ≤0 clamp to the first. */
export function playbookWindowForWeek(week: number): PlaybookWindow {
  for (const w of PLAYBOOK_WINDOWS) {
    if (week >= w.weeks[0] && week <= w.weeks[1]) return w;
  }
  return PLAYBOOK_WINDOWS[0];
}

// ---------------------------------------------------------------------------
// Expectations — the deterministic playbook rules
// ---------------------------------------------------------------------------

export type ExpectationEval = {
  done: boolean;
  /** Short progress phrase, e.g. "3 of 5 contacted". */
  progress: string;
  /** Evidence sentence — what the data shows. */
  evidence: string;
};

export type PlaybookExpectation = {
  id: string;
  windowId: PlaybookWindowId;
  /** The (1-based) week this should be complete by. Drives overdue detection. */
  dueByWeek: number;
  /** Imperative label, e.g. "Confirm at least one partner". */
  label: string;
  /** Higher = more important (a confirmed partner outranks a check-in). */
  weight: number;
  /** Evaluate done/progress/evidence from chapter facts. */
  evaluate: (f: ChapterFacts) => ExpectationEval;
};

/** Helpers for terse evidence copy. */
const n = (x: number, s: string) => `${x} ${s}${x === 1 ? "" : "s"}`;

export const PLAYBOOK_EXPECTATIONS: PlaybookExpectation[] = [
  // -------- Weeks 1–2 --------
  {
    id: "partner_research_started",
    windowId: "weeks_1_2",
    dueByWeek: 2,
    label: "Start partner research — add prospective organizations",
    weight: 60,
    evaluate: (f) => ({
      done: f.partnersTotal >= 1,
      progress: `${f.partnersTotal} researched`,
      evidence:
        f.partnersTotal >= 1
          ? `${n(f.partnersTotal, "partner organization")} in the pipeline.`
          : "No partner organizations have been added yet. The CP guide expects research to begin in Week 1.",
    }),
  },
  {
    id: "partner_outreach_started",
    windowId: "weeks_1_2",
    dueByWeek: 2,
    label: "Reach out to at least 5 partner organizations",
    weight: 65,
    evaluate: (f) => ({
      done: f.partnersContacted >= 5,
      progress: `${f.partnersContacted}/5 contacted`,
      evidence:
        f.partnersContacted >= 5
          ? `${n(f.partnersContacted, "organization")} contacted.`
          : `Only ${n(f.partnersContacted, "organization")} contacted — the guide expects broad outreach (≈5+) in Weeks 1–2.`,
    }),
  },
  {
    id: "instructor_recruiting_started",
    windowId: "weeks_1_2",
    dueByWeek: 2,
    // Threshold mirrors WEEK_TARGETS (chapter-growth.ts): 5 applications by Wk2.
    label: "Begin instructor recruiting — reach 5+ applications",
    weight: 55,
    evaluate: (f) => ({
      done: f.instructorApplicants >= 5,
      progress: `${f.instructorApplicants}/5 applicants`,
      evidence:
        f.instructorApplicants >= 5
          ? `${n(f.instructorApplicants, "instructor applicant")} so far.`
          : `Only ${n(f.instructorApplicants, "instructor applicant")} — the guide targets 5–8 by Week 2.`,
    }),
  },

  // -------- Weeks 3–4 --------
  {
    id: "partner_meetings_happening",
    windowId: "weeks_3_4",
    dueByWeek: 4,
    label: "Get partner meetings on the calendar",
    weight: 70,
    evaluate: (f) => {
      const meetings = f.partnersMeetingScheduled + f.partnersMeetingsCompleted;
      return {
        done: meetings >= 1,
        progress: `${meetings} meeting(s)`,
        evidence:
          meetings >= 1
            ? `${n(meetings, "partner meeting")} scheduled or completed.`
            : "No partner meetings yet — Weeks 3–4 are for meeting interested organizations.",
      };
    },
  },
  {
    id: "applicant_pool_growing",
    windowId: "weeks_3_4",
    dueByWeek: 4,
    label: "Grow the applicant pool to ~25",
    weight: 60,
    // Threshold mirrors WEEK_TARGETS (chapter-growth.ts): 25 applicants by Wk4.
    evaluate: (f) => ({
      done: f.instructorApplicants >= 25,
      progress: `${f.instructorApplicants}/25 applicants`,
      evidence:
        f.instructorApplicants >= 25
          ? `${n(f.instructorApplicants, "applicant")} in the pipeline (target ~25).`
          : `${n(f.instructorApplicants, "applicant")} so far — keep recruiting toward the ~25 the guide targets by Week 4.`,
    }),
  },
  {
    id: "interviews_started",
    windowId: "weeks_3_4",
    dueByWeek: 4,
    label: "Start interviewing applicants",
    weight: 60,
    evaluate: (f) => {
      const iv = f.interviewsScheduled + f.interviewsCompleted;
      return {
        done: iv >= 1,
        progress: `${iv} interview(s)`,
        evidence:
          iv >= 1
            ? `${n(iv, "interview")} scheduled or completed.`
            : "No interviews yet — Weeks 3–4 are for interviewing and continued recruiting.",
      };
    },
  },

  // -------- Weeks 5–6 --------
  {
    id: "confirmed_partner",
    windowId: "weeks_5_6",
    dueByWeek: 6,
    label: "Confirm at least one partner",
    weight: 100,
    evaluate: (f) => ({
      done: f.partnersConfirmed >= 1,
      progress: `${f.partnersConfirmed} confirmed`,
      evidence:
        f.partnersConfirmed >= 1
          ? `${n(f.partnersConfirmed, "confirmed partner")}.`
          : "No confirmed partner yet — a chapter cannot launch without one. The guide expects this by Week 6.",
    }),
  },
  {
    id: "logistics_in_writing",
    windowId: "weeks_5_6",
    dueByWeek: 6,
    label: "Lock partner logistics in writing (room, times, supervision)",
    weight: 90,
    evaluate: (f) => {
      const done = f.partnersConfirmed >= 1 && f.partnersConfirmedLogisticsIncomplete === 0;
      return {
        done,
        progress:
          f.partnersConfirmed === 0
            ? "no confirmed partner"
            : `${f.partnersConfirmedLogisticsIncomplete} missing logistics`,
        evidence: done
          ? "Every confirmed partner has complete, written logistics."
          : f.partnersConfirmed === 0
            ? "Confirm a partner first, then lock in room, times and supervision in writing."
            : `${n(f.partnersConfirmedLogisticsIncomplete, "confirmed partner")} still missing written logistics.`,
      };
    },
  },
  {
    id: "instructors_hired",
    windowId: "weeks_5_6",
    dueByWeek: 6,
    label: "Hire instructors (target ~3) and make assignments",
    weight: 75,
    evaluate: (f) => ({
      done: f.instructorsHired >= 1,
      progress: `${f.instructorsHired}/3 hired`,
      evidence:
        f.instructorsHired >= 1
          ? `${n(f.instructorsHired, "instructor")} hired.`
          : "No instructors hired yet — interview decisions and offers are due by Week 6.",
    }),
  },
  {
    id: "curriculum_submitted",
    windowId: "weeks_5_6",
    dueByWeek: 6,
    label: "Collect curriculum submissions from instructors",
    weight: 65,
    evaluate: (f) => ({
      done: f.curriculaSubmitted >= 1,
      progress: `${f.curriculaSubmitted} submitted`,
      evidence:
        f.curriculaSubmitted >= 1
          ? `${n(f.curriculaSubmitted, "curriculum")} submitted.`
          : "No curriculum submitted yet — instructors should submit so reviews can finish before launch.",
    }),
  },
  {
    id: "curriculum_reviews_on_time",
    windowId: "weeks_5_6",
    dueByWeek: 6,
    label: "Review submitted curriculum within 48 hours",
    weight: 70,
    evaluate: (f) => ({
      done: f.curriculaCpReviewOverdue === 0,
      progress: `${f.curriculaCpReviewOverdue} overdue`,
      evidence:
        f.curriculaCpReviewOverdue === 0
          ? "No curriculum reviews are past the 48-hour window."
          : `${n(f.curriculaCpReviewOverdue, "curriculum")} past the 48-hour review SLA.`,
    }),
  },

  // -------- Weeks 7–8 --------
  {
    id: "classes_public",
    windowId: "weeks_7_8",
    dueByWeek: 8,
    label: "Publish public class listings with launch dates",
    weight: 85,
    evaluate: (f) => ({
      done: f.classesPublic >= 1,
      progress: `${f.classesPublic}/${f.classesTotal} public`,
      evidence:
        f.classesPublic >= 1
          ? `${f.classesPublic} of ${n(f.classesTotal, "class")} are public.`
          : f.classesTotal === 0
            ? "No classes created yet — build classes and publish them for students."
            : `${n(f.classesTotal, "class")} planned but none public — students can't enroll until they're listed.`,
    }),
  },
  {
    id: "enrollment_target",
    windowId: "weeks_7_8",
    dueByWeek: 8,
    label: "Drive enrollment (≥10 students)",
    weight: 80,
    evaluate: (f) => ({
      done: f.enrollmentTotal >= 10,
      progress: `${f.enrollmentTotal} enrolled`,
      evidence:
        f.enrollmentTotal >= 10
          ? `${n(f.enrollmentTotal, "student")} enrolled.`
          : `${n(f.enrollmentTotal, "student")} enrolled — keep advertising toward the launch target.`,
    }),
  },
  {
    id: "no_under_enrolled_near_launch",
    windowId: "weeks_7_8",
    dueByWeek: 8,
    label: "Fix under-enrolled classes before launch",
    weight: 75,
    evaluate: (f) => ({
      done: f.classesUnderEnrolled === 0,
      progress: `${f.classesUnderEnrolled} under-enrolled`,
      evidence:
        f.classesUnderEnrolled === 0
          ? "No classes are under-enrolled for their launch window."
          : `${n(f.classesUnderEnrolled, "class")} under-enrolled near launch — intensify advertising or consider combining.`,
    }),
  },

  // -------- Weeks 9–10 --------
  {
    id: "classes_running",
    windowId: "weeks_9_10",
    dueByWeek: 10,
    label: "Classes are live and running",
    weight: 70,
    evaluate: (f) => {
      const live = f.classesRunning + f.classesLaunched;
      return {
        done: live >= 1,
        progress: `${f.classesRunning} running`,
        evidence:
          live >= 1
            ? `${n(f.classesRunning, "class")} running.`
            : "No classes are running yet — by Weeks 9–10 classes should be live.",
      };
    },
  },
  {
    id: "attendance_monitoring",
    windowId: "weeks_9_10",
    dueByWeek: 10,
    label: "Monitor attendance every session",
    weight: 60,
    evaluate: (f) => ({
      done: f.hasAttendanceData,
      progress: f.hasAttendanceData ? `${f.attendancePercent}% attendance` : "no data",
      evidence: f.hasAttendanceData
        ? `Attendance is being tracked (${f.attendancePercent}% present).`
        : "No attendance has been recorded — track it each session to catch retention risk early.",
    }),
  },
  {
    id: "feedback_collection",
    windowId: "weeks_9_10",
    dueByWeek: 10,
    label: "Collect student/parent feedback",
    weight: 55,
    evaluate: (f) => ({
      done: f.feedbackCount >= 1,
      progress: `${f.feedbackCount} responses`,
      evidence:
        f.feedbackCount >= 1
          ? `${n(f.feedbackCount, "feedback response")} collected.`
          : "No feedback collected yet — send a short form after the first sessions.",
    }),
  },

  // -------- Weeks 11–12 --------
  {
    id: "session_review",
    windowId: "weeks_11_12",
    dueByWeek: 12,
    label: "Run a session review (positives, negatives, next-session plan)",
    weight: 60,
    evaluate: (f) => ({
      // No dedicated "review complete" flag exists yet; feedback is the best proxy
      // that the review conversation has the inputs it needs.
      done: f.feedbackCount >= 1 && f.classesLaunched >= 1,
      progress: f.classesLaunched >= 1 ? "session in progress" : "no session yet",
      evidence:
        f.feedbackCount >= 1 && f.classesLaunched >= 1
          ? "You have run sessions and collected feedback — capture the review and next-session plan."
          : "Wrap the session: log what went well, what didn't, and the plan for next session.",
    }),
  },
  {
    id: "session_2_planning",
    windowId: "weeks_11_12",
    dueByWeek: 12,
    label: "Confirm returning instructors and plan Session 2",
    weight: 55,
    evaluate: () => ({
      // Not directly tracked; always surfaced as an action in the final window.
      done: false,
      progress: "plan Session 2",
      evidence: "Ask instructors about returning and begin Session 2 recruiting while momentum is high.",
    }),
  },
];

// ---------------------------------------------------------------------------
// Interpretation
// ---------------------------------------------------------------------------

export type PlaybookExpectationResult = {
  id: string;
  windowId: PlaybookWindowId;
  label: string;
  dueByWeek: number;
  weight: number;
  done: boolean;
  /** Not done AND its due-by week is before the current window. */
  overdue: boolean;
  progress: string;
  evidence: string;
};

export type PlaybookConfidence = "high" | "medium" | "low";

/** A canonical KPI target gap (sourced from chapter-growth WEEK_TARGETS). */
export type PlaybookKpiTarget = {
  key: KpiKey;
  label: string;
  current: number;
  target: number;
  met: boolean;
  note: string;
};

export type PlaybookInterpretation = {
  weekNumber: number;
  currentWindow: PlaybookWindow;
  /** Expectations whose window has begun (dueByWeek ≤ current window end). */
  expected: PlaybookExpectationResult[];
  completed: PlaybookExpectationResult[];
  /** Not done, due in the CURRENT window. */
  missing: PlaybookExpectationResult[];
  /** Not done, due in a PAST window. */
  overdue: PlaybookExpectationResult[];
  /**
   * The canonical numeric playbook targets active this week, straight from
   * `chapter-growth.ts:getPlaybookTargetsForWeek` — reused, not reinvented.
   */
  kpiTargets: PlaybookKpiTarget[];
  evidence: string[];
  confidence: PlaybookConfidence;
  /** "On pace" · "Slightly behind" · "Behind" — operational, not a score. */
  paceLabel: "On pace" | "Slightly behind" | "Behind";
  /** One operational sentence: the single most important next move. */
  recommendedNextAction: string;
};

/** Map a chapter-growth KPI key onto its `ChapterFacts` count. */
export function factKpiValue(facts: ChapterFacts, key: KpiKey): number {
  switch (key) {
    case "partnersContacted": return facts.partnersContacted;
    case "partnerMeetingsScheduled": return facts.partnersMeetingScheduled;
    case "confirmedPartners": return facts.partnersConfirmed;
    case "instructorApplicants": return facts.instructorApplicants;
    case "interviewsCompleted": return facts.interviewsCompleted;
    case "instructorsHired": return facts.instructorsHired;
    case "curriculaSubmitted": return facts.curriculaSubmitted;
    case "curriculaApproved": return facts.curriculaApproved;
    case "classesCreated": return facts.classesTotal;
    case "classesReady": return facts.classesReady;
    case "studentsEnrolled": return facts.enrollmentTotal;
    case "attendancePercent": return facts.attendancePercent;
    case "retentionPercent": return facts.retentionPercent;
    case "feedbackCollected": return facts.feedbackCount;
    case "unresolvedBlockers": return facts.unresolvedBlockers;
    default: return 0;
  }
}

function buildKpiTargets(facts: ChapterFacts, week: number): PlaybookKpiTarget[] {
  return getPlaybookTargetsForWeek(week)
    .filter((t: PlaybookTarget) => t.key !== "unresolvedBlockers")
    .map((t: PlaybookTarget) => {
      const current = factKpiValue(facts, t.key);
      return { key: t.key, label: t.label, current, target: t.target, met: current >= t.target, note: t.note };
    });
}

function toResult(
  exp: PlaybookExpectation,
  e: ExpectationEval,
  currentWindow: PlaybookWindow
): PlaybookExpectationResult {
  const overdue = !e.done && exp.dueByWeek < currentWindow.weeks[0];
  return {
    id: exp.id,
    windowId: exp.windowId,
    label: exp.label,
    dueByWeek: exp.dueByWeek,
    weight: exp.weight,
    done: e.done,
    overdue,
    progress: e.progress,
    evidence: e.evidence,
  };
}

/**
 * Interpret the playbook for a chapter's current week. Returns the operational
 * picture: what is expected by now, what is done, what is missing this window,
 * and what is overdue from earlier windows — each with real evidence.
 */
export function interpretPlaybook(facts: ChapterFacts, opts: { dataConfident?: boolean } = {}): PlaybookInterpretation {
  const week = Math.max(1, facts.weekNumber);
  const currentWindow = playbookWindowForWeek(week);
  const currentEnd = currentWindow.weeks[1];

  // Everything whose window has started by now is "in scope".
  const inScope = PLAYBOOK_EXPECTATIONS.filter((exp) => exp.dueByWeek <= Math.max(currentEnd, week));

  const expected = inScope.map((exp) => toResult(exp, exp.evaluate(facts), currentWindow));
  const completed = expected.filter((r) => r.done);
  const overdue = expected.filter((r) => r.overdue).sort((a, b) => b.weight - a.weight);
  const missing = expected
    .filter((r) => !r.done && !r.overdue)
    .sort((a, b) => b.weight - a.weight);

  // Confidence: if the cycle isn't dated, the week is a guess (defaults to 1).
  let confidence: PlaybookConfidence = "high";
  if (!facts.cycleStartISO) confidence = "low";
  else if (opts.dataConfident === false) confidence = "medium";

  // Pace: overdue blocking work → Behind; any overdue → Slightly behind.
  const hasCriticalOverdue = overdue.some((r) => r.weight >= 85);
  const paceLabel: PlaybookInterpretation["paceLabel"] = hasCriticalOverdue
    ? "Behind"
    : overdue.length > 0
      ? "Slightly behind"
      : "On pace";

  const recommendedNextAction = buildRecommendation(week, currentWindow, overdue, missing);

  const evidence = [...overdue, ...missing].slice(0, 6).map((r) => r.evidence);
  const kpiTargets = buildKpiTargets(facts, week);

  return {
    weekNumber: week,
    currentWindow,
    expected,
    completed,
    missing,
    overdue,
    kpiTargets,
    evidence,
    confidence,
    paceLabel,
    recommendedNextAction,
  };
}

function buildRecommendation(
  week: number,
  window: PlaybookWindow,
  overdue: PlaybookExpectationResult[],
  missing: PlaybookExpectationResult[]
): string {
  const top = overdue[0] ?? missing[0];
  if (!top) {
    return `You are in Week ${week} (${window.label}). You're on pace — keep ${window.focus.toLowerCase()} moving.`;
  }
  const lead = overdue.length > 0 ? "You're behind on" : "This week, focus on";
  return `You are in Week ${week}. ${lead}: ${lowerFirst(top.label)}. ${top.evidence}`;
}

function lowerFirst(s: string): string {
  return s.length ? s[0].toLowerCase() + s.slice(1) : s;
}
