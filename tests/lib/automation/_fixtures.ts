// Shared fixtures for the Automation Brain tests. Deterministic — every test
// passes a fixed NOW so the pure logic is fully reproducible.

import type { ChapterFacts } from "@/lib/automation/types";
import type { ImpactMeetingPrep } from "@/lib/chapters/impact-meeting";
import type { ChapterBlocker } from "@/lib/chapters/needs-attention-rules";
import type { StudentCommunityNeed } from "@/lib/chapters/student-community";

export const NOW = new Date("2026-06-24T12:00:00.000Z");

/** A fresh week-1 chapter (everything at zero) with overrides. */
export function facts(overrides: Partial<ChapterFacts> = {}): ChapterFacts {
  return {
    chapterId: "chap_1",
    chapterName: "Scarsdale",
    weekNumber: 1,
    cycleStartISO: null,
    launchTargetISO: null,
    lifecycleStatus: "LAUNCHING",
    presidentId: "user_cp",

    partnersTotal: 0,
    partnersContacted: 0,
    partnersResponded: 0,
    partnersMeetingScheduled: 0,
    partnersMeetingsCompleted: 0,
    partnersConfirmed: 0,
    partnerFollowUpsDue: 0,
    partnersConfirmedLogisticsIncomplete: 0,

    instructorApplicants: 0,
    instructorsUnderReview: 0,
    instructorApplicationsAwaitingReview: 0,
    interviewsScheduled: 0,
    interviewsCompleted: 0,
    interviewDecisionsOverdue: 0,
    instructorsHired: 0,

    curriculaSubmitted: 0,
    curriculaApproved: 0,
    curriculaCpReviewNeeded: 0,
    curriculaCpReviewOverdue: 0,
    curriculaNeedsRevision: 0,

    classesTotal: 0,
    classesPublic: 0,
    classesLaunched: 0,
    classesRunning: 0,
    classesReady: 0,
    classesUnderEnrolled: 0,
    classesLaunchingSoonNotReady: 0,

    enrollmentTotal: 0,
    hasAttendanceData: false,
    attendancePercent: 0,
    retentionPercent: 0,
    retentionBase: 0,
    consecutiveAbsentees: 0,
    decliningClasses: 0,
    feedbackCount: 0,

    unresolvedBlockers: 0,
    ...overrides,
  };
}

/** A chapter that has cleared the Weeks 1–6 foundations. */
export function midCycleFacts(overrides: Partial<ChapterFacts> = {}): ChapterFacts {
  return facts({
    weekNumber: 6,
    cycleStartISO: "2026-05-12T00:00:00.000Z",
    partnersTotal: 6,
    partnersContacted: 6,
    partnersResponded: 4,
    partnersMeetingScheduled: 2,
    partnersMeetingsCompleted: 2,
    partnersConfirmed: 1,
    instructorApplicants: 25,
    interviewsScheduled: 3,
    interviewsCompleted: 3,
    instructorsHired: 3,
    curriculaSubmitted: 3,
    curriculaApproved: 2,
    classesTotal: 2,
    ...overrides,
  });
}

export function blocker(overrides: Partial<ChapterBlocker> = {}): ChapterBlocker {
  return {
    key: "partner-followup:p1",
    lane: "partners",
    severity: "warning",
    title: "Bronxville Library: Follow-up overdue by 4 days",
    detail: "Log a touchpoint and set the next follow-up date.",
    href: "/partners/p1",
    suggestedAction: "Follow up with Bronxville Library",
    entityType: "PARTNER",
    entityId: "p1",
    ...overrides,
  };
}

export function studentNeed(overrides: Partial<StudentCommunityNeed> = {}): StudentCommunityNeed {
  return {
    key: "student-absences:s1:o1",
    title: "Maya: missed 3 classes in a row",
    detail: "In Intro to Python. A quick check-in keeps them from dropping.",
    severity: "critical",
    href: "/admin/classes/o1",
    entityType: "CLASS_OFFERING",
    entityId: "o1",
    ...overrides,
  };
}

export function impactPrep(overrides: Partial<ImpactMeetingPrep> = {}): ImpactMeetingPrep {
  return {
    weekNumber: 6,
    weekStartISO: "2026-06-22",
    weekLabel: "Week of Jun 22",
    focus: "Curriculum approvals & written logistics",
    groups: [
      {
        title: "Week 6 — Approvals & written logistics",
        metrics: [
          { label: "Curricula approved", value: 1 },
          { label: "Needs major revision", value: 2, attention: true },
          { label: "Confirmed partners", value: 1 },
          { label: "Classes ready", value: 0, detail: "of 2", attention: true },
        ],
      },
    ],
    blockers: ["Bronxville Library: confirmed but logistics incomplete"],
    narrativePrompts: ["What is not going as expected?"],
    ...overrides,
  };
}
