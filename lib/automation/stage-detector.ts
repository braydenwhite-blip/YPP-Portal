// ============================================================================
// CHAPTER STAGE DETECTOR
// ============================================================================
//
// The Chapter model has a single coarse `lifecycleStatus`, and the OS computes a
// health label — but neither answers "what operational stage(s) is this chapter
// actually in right now?" A real chapter is usually in SEVERAL stages at once
// (e.g. closing a partner while building curriculum while recruiting students).
//
// This detector reads `ChapterFacts` and returns every ACTIVE stage with its
// evidence, the BLOCKING gaps holding the chapter back, the requirements to
// advance, and a single PRIMARY stage to anchor the CP's attention. Pure +
// deterministic → unit-testable.

import type { ChapterFacts } from "@/lib/automation/types";

export const CHAPTER_STAGES = [
  "NEW_CHAPTER",
  "PARTNER_RESEARCH",
  "PARTNER_OUTREACH",
  "PARTNER_MEETINGS",
  "PARTNER_CLOSING",
  "INSTRUCTOR_RECRUITING",
  "INSTRUCTOR_INTERVIEWS",
  "CURRICULUM_BUILDING",
  "LOGISTICS_CONFIRMATION",
  "STUDENT_RECRUITMENT",
  "PRE_LAUNCH",
  "LIVE_CLASSES",
  "SESSION_REVIEW",
  "NEXT_SESSION_PLANNING",
] as const;
export type ChapterStage = (typeof CHAPTER_STAGES)[number];

export const CHAPTER_STAGE_LABELS: Record<ChapterStage, string> = {
  NEW_CHAPTER: "New Chapter",
  PARTNER_RESEARCH: "Partner Research",
  PARTNER_OUTREACH: "Partner Outreach",
  PARTNER_MEETINGS: "Partner Meetings",
  PARTNER_CLOSING: "Partner Closing",
  INSTRUCTOR_RECRUITING: "Instructor Recruiting",
  INSTRUCTOR_INTERVIEWS: "Instructor Interviews",
  CURRICULUM_BUILDING: "Curriculum Building",
  LOGISTICS_CONFIRMATION: "Logistics Confirmation",
  STUDENT_RECRUITMENT: "Student Recruitment",
  PRE_LAUNCH: "Pre-Launch",
  LIVE_CLASSES: "Live Classes",
  SESSION_REVIEW: "Session Review",
  NEXT_SESSION_PLANNING: "Next-Session Planning",
};

type StageSpec = {
  stage: ChapterStage;
  /** Pipeline order (earlier = more foundational). */
  order: number;
  /** Is the chapter currently working in this stage? */
  isActive: (f: ChapterFacts) => boolean;
  /** Why it's active (evidence). */
  reason: (f: ChapterFacts) => string;
  /** Gaps that BLOCK the chapter from progressing past this stage. */
  blockingGaps: (f: ChapterFacts) => string[];
  /** What must be true to consider this stage "done". */
  nextRequirements: (f: ChapterFacts) => string[];
};

const HIRE_TARGET = 3;

const STAGE_SPECS: StageSpec[] = [
  {
    stage: "NEW_CHAPTER",
    order: 0,
    isActive: (f) => f.partnersTotal === 0 && f.instructorApplicants === 0 && f.classesTotal === 0,
    reason: () => "Nothing has been started yet — no partners, applicants, or classes.",
    blockingGaps: () => ["No partner research or instructor recruiting has begun."],
    nextRequirements: () => ["Add prospective partner organizations", "Open instructor applications"],
  },
  {
    stage: "PARTNER_RESEARCH",
    order: 1,
    isActive: (f) => f.partnersTotal >= 1 && f.partnersContacted === 0 && f.partnersConfirmed === 0,
    reason: (f) => `${f.partnersTotal} organization(s) researched, none contacted yet.`,
    blockingGaps: () => [],
    nextRequirements: () => ["Send first outreach to researched organizations"],
  },
  {
    stage: "PARTNER_OUTREACH",
    order: 2,
    isActive: (f) =>
      f.partnersContacted >= 1 &&
      f.partnersMeetingScheduled + f.partnersMeetingsCompleted === 0 &&
      f.partnersConfirmed === 0,
    reason: (f) => `${f.partnersContacted} organization(s) contacted, awaiting responses/meetings.`,
    blockingGaps: (f) =>
      f.partnerFollowUpsDue > 0 ? [`${f.partnerFollowUpsDue} partner follow-up(s) overdue.`] : [],
    nextRequirements: () => ["Convert outreach into scheduled partner meetings"],
  },
  {
    stage: "PARTNER_MEETINGS",
    order: 3,
    isActive: (f) =>
      f.partnersMeetingScheduled + f.partnersMeetingsCompleted >= 1 && f.partnersConfirmed === 0,
    reason: (f) =>
      `${f.partnersMeetingScheduled + f.partnersMeetingsCompleted} partner meeting(s) in progress; none confirmed yet.`,
    blockingGaps: (f) =>
      f.weekNumber >= 6 && f.partnersConfirmed === 0 ? ["No partner confirmed by Week 6."] : [],
    nextRequirements: () => ["Close at least one partner"],
  },
  {
    stage: "PARTNER_CLOSING",
    order: 4,
    isActive: (f) => f.partnersConfirmed >= 1 && f.partnersConfirmedLogisticsIncomplete > 0,
    reason: (f) =>
      `${f.partnersConfirmed} partner(s) confirmed; ${f.partnersConfirmedLogisticsIncomplete} still need written logistics.`,
    blockingGaps: (f) => [`${f.partnersConfirmedLogisticsIncomplete} confirmed partner(s) missing written logistics.`],
    nextRequirements: () => ["Lock room, times, supervision and written confirmation"],
  },
  {
    stage: "INSTRUCTOR_RECRUITING",
    order: 5,
    isActive: (f) => f.instructorApplicants >= 1 && f.instructorsHired < HIRE_TARGET,
    reason: (f) => `${f.instructorApplicants} applicant(s), ${f.instructorsHired} hired (target ~${HIRE_TARGET}).`,
    blockingGaps: (f) =>
      f.instructorApplicationsAwaitingReview > 0
        ? [`${f.instructorApplicationsAwaitingReview} application(s) waiting for review.`]
        : [],
    nextRequirements: () => ["Review applications and advance candidates to interview"],
  },
  {
    stage: "INSTRUCTOR_INTERVIEWS",
    order: 6,
    isActive: (f) =>
      f.interviewsScheduled + f.interviewsCompleted >= 1 &&
      (f.instructorsHired < HIRE_TARGET || f.interviewDecisionsOverdue > 0),
    reason: (f) =>
      `${f.interviewsCompleted} interview(s) completed, ${f.interviewsScheduled} scheduled.`,
    blockingGaps: (f) =>
      f.interviewDecisionsOverdue > 0 ? [`${f.interviewDecisionsOverdue} interview decision(s) overdue.`] : [],
    nextRequirements: () => ["Submit interview decisions and make hires"],
  },
  {
    stage: "CURRICULUM_BUILDING",
    order: 7,
    isActive: (f) => f.curriculaSubmitted >= 1 && f.curriculaApproved < f.curriculaSubmitted,
    reason: (f) =>
      `${f.curriculaApproved}/${f.curriculaSubmitted} curricula fully approved.`,
    blockingGaps: (f) =>
      f.curriculaCpReviewOverdue > 0 ? [`${f.curriculaCpReviewOverdue} curriculum review(s) overdue.`] : [],
    nextRequirements: () => ["Finish CP and global curriculum reviews"],
  },
  {
    stage: "LOGISTICS_CONFIRMATION",
    order: 8,
    isActive: (f) =>
      f.classesTotal >= 1 && f.classesLaunched === 0 && f.classesLaunchingSoonNotReady > 0,
    reason: (f) => `${f.classesLaunchingSoonNotReady} class(es) launching soon aren't ready.`,
    blockingGaps: (f) => [`${f.classesLaunchingSoonNotReady} class(es) launching soon still have readiness gaps.`],
    nextRequirements: () => ["Confirm instructor, location, time and curriculum for each class"],
  },
  {
    stage: "STUDENT_RECRUITMENT",
    order: 9,
    isActive: (f) => f.classesPublic >= 1 && f.classesLaunched === 0,
    reason: (f) => `${f.classesPublic} class(es) public; ${f.enrollmentTotal} student(s) enrolled, recruiting toward launch.`,
    blockingGaps: (f) =>
      f.classesUnderEnrolled > 0 ? [`${f.classesUnderEnrolled} class(es) under-enrolled.`] : [],
    nextRequirements: () => ["Reach enrollment targets before launch"],
  },
  {
    stage: "PRE_LAUNCH",
    order: 10,
    isActive: (f) =>
      f.classesPublic >= 1 && f.classesLaunched === 0 && f.weekNumber >= 7,
    reason: (f) => `Classes are public and launch is approaching (Week ${f.weekNumber}).`,
    blockingGaps: (f) =>
      f.classesLaunchingSoonNotReady > 0 ? [`${f.classesLaunchingSoonNotReady} class(es) not launch-ready.`] : [],
    nextRequirements: () => ["Send pre-launch reminders and confirm instructor readiness"],
  },
  {
    stage: "LIVE_CLASSES",
    order: 11,
    isActive: (f) => f.classesRunning >= 1 || f.classesLaunched >= 1,
    reason: (f) => `${f.classesRunning} class(es) running, ${f.classesLaunched} launched.`,
    blockingGaps: (f) => {
      const gaps: string[] = [];
      if (f.consecutiveAbsentees > 0) gaps.push(`${f.consecutiveAbsentees} student(s) on an absence streak.`);
      if (f.decliningClasses > 0) gaps.push(`${f.decliningClasses} class(es) with declining attendance.`);
      return gaps;
    },
    nextRequirements: () => ["Run weekly check-ins, observations and attendance monitoring"],
  },
  {
    stage: "SESSION_REVIEW",
    order: 12,
    isActive: (f) => f.weekNumber >= 11 && f.classesLaunched >= 1,
    reason: (f) => `Week ${f.weekNumber} — the session is wrapping up.`,
    blockingGaps: () => [],
    nextRequirements: () => ["Log positives/negatives and a next-session plan"],
  },
  {
    stage: "NEXT_SESSION_PLANNING",
    order: 13,
    isActive: (f) => f.weekNumber >= 11,
    reason: (f) => `Week ${f.weekNumber} — time to plan Session 2.`,
    blockingGaps: () => [],
    nextRequirements: () => ["Confirm returning instructors and start Session 2 recruiting"],
  },
];

export type StageReason = { stage: ChapterStage; label: string; reason: string };

export type ChapterStageDetection = {
  primaryStage: ChapterStage;
  primaryStageLabel: string;
  activeStages: ChapterStage[];
  stageReasons: StageReason[];
  blockingGaps: string[];
  nextStageRequirements: string[];
};

/**
 * Detect the chapter's operational stages. A chapter is typically in several at
 * once; `primaryStage` is the one the CP should anchor on:
 *   • if any active stage has a blocking gap, the EARLIEST such stage (fix the
 *     foundation first);
 *   • otherwise the LATEST active stage (the chapter's forward edge).
 */
export function detectChapterStages(facts: ChapterFacts): ChapterStageDetection {
  const active = STAGE_SPECS.filter((s) => s.isActive(facts));

  // Fallback: a chapter that matches nothing (e.g. some partners but no other
  // signal) anchors on the earliest unmet foundational stage.
  if (active.length === 0) {
    const fallback =
      facts.partnersConfirmed === 0
        ? STAGE_SPECS.find((s) => s.stage === "PARTNER_OUTREACH")!
        : STAGE_SPECS.find((s) => s.stage === "LIVE_CLASSES")!;
    return {
      primaryStage: fallback.stage,
      primaryStageLabel: CHAPTER_STAGE_LABELS[fallback.stage],
      activeStages: [fallback.stage],
      stageReasons: [{ stage: fallback.stage, label: CHAPTER_STAGE_LABELS[fallback.stage], reason: fallback.reason(facts) }],
      blockingGaps: fallback.blockingGaps(facts),
      nextStageRequirements: fallback.nextRequirements(facts),
    };
  }

  const withGaps = active
    .map((s) => ({ spec: s, gaps: s.blockingGaps(facts) }))
    .filter((x) => x.gaps.length > 0)
    .sort((a, b) => a.spec.order - b.spec.order);

  const primarySpec = withGaps.length > 0
    ? withGaps[0].spec
    : [...active].sort((a, b) => b.order - a.order)[0];

  const stageReasons: StageReason[] = active
    .sort((a, b) => a.order - b.order)
    .map((s) => ({ stage: s.stage, label: CHAPTER_STAGE_LABELS[s.stage], reason: s.reason(facts) }));

  // De-duplicate blocking gaps across all active stages, primary first.
  const blockingGaps = Array.from(
    new Set([...primarySpec.blockingGaps(facts), ...active.flatMap((s) => s.blockingGaps(facts))])
  );

  return {
    primaryStage: primarySpec.stage,
    primaryStageLabel: CHAPTER_STAGE_LABELS[primarySpec.stage],
    activeStages: active.sort((a, b) => a.order - b.order).map((s) => s.stage),
    stageReasons,
    blockingGaps,
    nextStageRequirements: primarySpec.nextRequirements(facts),
  };
}
