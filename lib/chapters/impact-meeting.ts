// Impact Meeting Prep — the deterministic weekly-metrics generator for a Chapter
// President's mandatory weekly impact meeting with YPP leadership. The playbook
// spells out exact numbers to bring each week (Weeks 1–10). This module computes
// those numbers from real chapter data and assembles the week-appropriate metric
// groups, the open blockers, and the three narrative prompts the CP fills in.
//
// IMPORTANT (product principle): this is NOT AI-generated and NOT a vague health
// score. Every number is a real count; the only free text is the CP's own
// narrative. Pure + deterministic (pass `now`) so it is fully unit testable.

import { weekStartFor, weekKey, weekLabel } from "@/lib/weekly-meetings/week";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Which week of the launch cycle a chapter is in (1-based), from a baseline
 * start date. Clamped to ≥1; uncapped above so an operating chapter keeps
 * counting. `startDate` null ⇒ week 1 (the cycle hasn't been dated yet).
 */
export function chapterWeekNumber(startDate: Date | null, now: Date): number {
  if (!startDate) return 1;
  const days = Math.floor((now.getTime() - startDate.getTime()) / DAY_MS);
  if (days < 0) return 1;
  return Math.floor(days / 7) + 1;
}

/** Real, denormalized chapter metrics the prep builder reads (loader fills these). */
export type ChapterImpactMetrics = {
  // Partners
  partnersTotal: number;
  partnersContacted: number; // reached out or further
  partnersResponded: number; // interested / in conversation
  partnersMeetingScheduled: number;
  partnersMeetingsCompleted: number;
  partnersInConversation: number; // interested + final conversation
  partnersConfirmed: number;
  partnersClosed: number;
  // Instructors
  instructorApplicants: number;
  instructorsUnderReview: number;
  interviewsScheduled: number;
  interviewsCompleted: number;
  instructorsHired: number;
  // Curriculum
  curriculaSubmitted: number;
  curriculaApproved: number;
  curriculaNeedsRevision: number;
  // Classes / launch / operations
  classesTotal: number;
  classesPublic: number;
  classesLaunched: number;
  classesRunning: number;
  enrollmentTotal: number;
  underEnrolledClasses: number;
};

export type ImpactMetric = {
  label: string;
  value: string | number;
  /** Concrete qualifier ("goal: 25", "of 8 classes"). */
  detail?: string;
  /** When true the value is below a playbook target — render as attention. */
  attention?: boolean;
};

export type ImpactMetricGroup = { title: string; metrics: ImpactMetric[] };

export type ImpactMeetingPrep = {
  weekNumber: number;
  weekStartISO: string;
  weekLabel: string;
  focus: string;
  groups: ImpactMetricGroup[];
  blockers: string[];
  narrativePrompts: string[];
};

/** The three narrative prompts the CP fills in (the only free text in prep). */
export const IMPACT_NARRATIVE_PROMPTS = [
  "What is not going as expected?",
  "What is the plan to fix it?",
  "What do you need from global leadership?",
];

const WEEK_FOCUS: Record<number, string> = {
  1: "Partner outreach",
  2: "Instructor recruiting",
  3: "Partner meetings & interviews",
  4: "Confirm partners & hire instructors",
  5: "Logistics, orientation & curriculum",
  6: "Curriculum approvals & written logistics",
  7: "Launch dates & enrollment",
  8: "Pre-launch & first sessions",
  9: "Running classes & observations",
  10: "Retention & Session 2",
};

function pipelineSnapshot(m: ChapterImpactMetrics): ImpactMetricGroup {
  return {
    title: "Pipeline snapshot",
    metrics: [
      { label: "Partners", value: m.partnersTotal, detail: `${m.partnersConfirmed} confirmed` },
      { label: "Applicants", value: m.instructorApplicants, detail: `${m.instructorsHired} hired` },
      { label: "Curricula approved", value: m.curriculaApproved, detail: `${m.curriculaSubmitted} awaiting review` },
      { label: "Classes", value: m.classesTotal, detail: `${m.classesPublic} public` },
    ],
  };
}

/**
 * Build the week-appropriate metric groups. Always leads with the week's
 * headline numbers, then the pipeline snapshot so the meeting is useful in any
 * week. Targets that aren't met are flagged `attention` (a real, explainable
 * signal — not a hidden score).
 */
export function weeklyMetricGroups(week: number, m: ChapterImpactMetrics): ImpactMetricGroup[] {
  const groups: ImpactMetricGroup[] = [];

  if (week <= 1) {
    groups.push({
      title: "Week 1 — Partner outreach",
      metrics: [
        { label: "Orgs researched", value: m.partnersTotal },
        { label: "Contacted", value: m.partnersContacted },
        { label: "Responses", value: m.partnersResponded },
        { label: "Meetings scheduled", value: m.partnersMeetingScheduled },
      ],
    });
  } else if (week === 2) {
    groups.push({
      title: "Week 2 — Instructor recruiting",
      metrics: [
        { label: "Applicants", value: m.instructorApplicants },
        { label: "Interviews set up", value: m.interviewsScheduled },
        { label: "Partner outreach", value: m.partnersContacted },
        { label: "Responses", value: m.partnersResponded },
      ],
    });
  } else if (week === 3) {
    groups.push({
      title: "Week 3 — Meetings & interviews",
      metrics: [
        { label: "Partner meetings done", value: m.partnersMeetingsCompleted },
        { label: "Meetings scheduled", value: m.partnersMeetingScheduled },
        { label: "Interviews completed", value: m.interviewsCompleted },
        { label: "Interviews scheduled", value: m.interviewsScheduled },
      ],
    });
  } else if (week === 4) {
    groups.push({
      title: "Week 4 — Confirm & hire (targets)",
      metrics: [
        { label: "Confirmed partners", value: m.partnersConfirmed, detail: "goal: ≥1", attention: m.partnersConfirmed < 1 },
        { label: "In conversation", value: m.partnersInConversation },
        { label: "Applicants", value: m.instructorApplicants, detail: "goal: 25", attention: m.instructorApplicants < 25 },
        { label: "Instructors hired", value: m.instructorsHired, detail: "goal: ≥3", attention: m.instructorsHired < 3 },
      ],
    });
  } else if (week === 5) {
    groups.push({
      title: "Week 5 — Logistics, orientation & curriculum",
      metrics: [
        { label: "Confirmed partners", value: m.partnersConfirmed },
        { label: "Curricula submitted", value: m.curriculaSubmitted },
        { label: "Curricula approved", value: m.curriculaApproved },
        { label: "Needs revision", value: m.curriculaNeedsRevision },
      ],
    });
  } else if (week === 6) {
    groups.push({
      title: "Week 6 — Approvals & written logistics",
      metrics: [
        { label: "Curricula approved", value: m.curriculaApproved },
        { label: "Needs major revision", value: m.curriculaNeedsRevision, attention: m.curriculaNeedsRevision > 0 },
        { label: "Confirmed partners", value: m.partnersConfirmed },
        { label: "Classes ready", value: m.classesPublic },
      ],
    });
  } else if (week === 7) {
    groups.push({
      title: "Week 7 — Launch dates & enrollment",
      metrics: [
        { label: "Classes public", value: m.classesPublic, detail: `of ${m.classesTotal}` },
        { label: "Total enrollment", value: m.enrollmentTotal },
        { label: "Under-enrolled", value: m.underEnrolledClasses, attention: m.underEnrolledClasses > 0 },
        { label: "Instructors hired", value: m.instructorsHired },
      ],
    });
  } else if (week === 8) {
    groups.push({
      title: "Week 8 — Pre-launch & first sessions",
      metrics: [
        { label: "Total enrollment", value: m.enrollmentTotal },
        { label: "Under-enrolled", value: m.underEnrolledClasses, attention: m.underEnrolledClasses > 0 },
        { label: "Classes launched", value: m.classesLaunched },
        { label: "Classes public", value: m.classesPublic },
      ],
    });
  } else if (week === 9) {
    groups.push({
      title: "Week 9 — Running classes",
      metrics: [
        { label: "Classes running", value: m.classesRunning },
        { label: "Total enrollment", value: m.enrollmentTotal },
        { label: "Confirmed partners", value: m.partnersConfirmed },
        { label: "Under-enrolled", value: m.underEnrolledClasses, attention: m.underEnrolledClasses > 0 },
      ],
    });
  } else {
    groups.push({
      title: "Week 10+ — Retention & Session 2",
      metrics: [
        { label: "Classes running", value: m.classesRunning },
        { label: "Total enrollment", value: m.enrollmentTotal },
        { label: "Confirmed partners", value: m.partnersConfirmed },
        { label: "Classes launched", value: m.classesLaunched },
      ],
    });
  }

  groups.push(pipelineSnapshot(m));
  return groups;
}

/** Assemble the full prep payload for the chapter's current week. */
export function buildImpactMeetingPrep(input: {
  metrics: ChapterImpactMetrics;
  startDate: Date | null;
  now: Date;
  blockers?: string[];
}): ImpactMeetingPrep {
  const { metrics, startDate, now } = input;
  const weekNumber = chapterWeekNumber(startDate, now);
  const ws = weekStartFor(now);
  return {
    weekNumber,
    weekStartISO: weekKey(ws),
    weekLabel: weekLabel(ws),
    focus: WEEK_FOCUS[weekNumber] ?? WEEK_FOCUS[10],
    groups: weeklyMetricGroups(weekNumber, metrics),
    blockers: input.blockers ?? [],
    narrativePrompts: IMPACT_NARRATIVE_PROMPTS,
  };
}
