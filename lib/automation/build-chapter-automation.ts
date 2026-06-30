// ============================================================================
// The Automation Brain server loader
// ============================================================================
//
// Thin server wrapper around the pure core (`assemble.ts`): ONE call to the
// existing `loadChapterOS` (zero new DB reads), map its model into `ChapterFacts`,
// then `assembleChapterAutomation`. The pure assembly + the contract types live
// in `assemble.ts` so they can be unit-tested without Prisma.

import "server-only";

import type { ChapterFacts } from "@/lib/automation/types";
import {
  assembleChapterAutomation,
  type ChapterAutomation,
  type AssembleInput,
  type AutomationDismissalOverlay,
} from "@/lib/automation/assemble";
import { loadChapterOS } from "@/lib/chapters/chapter-os";

export {
  assembleChapterAutomation,
  type ChapterAutomation,
  type AssembleInput,
  type AutomationDismissalOverlay,
};

type ChapterOSModel = NonNullable<Awaited<ReturnType<typeof loadChapterOS>>>;

/** Build `ChapterFacts` purely from the loaded Chapter OS model. */
export function chapterFactsFromModel(model: ChapterOSModel): ChapterFacts {
  const m = model.metrics;
  const p = model.partners;
  const i = model.instructors;
  const c = model.curriculum;
  const l = model.launch;
  const sc = model.studentCommunity.metrics;

  return {
    chapterId: model.chapter.id,
    chapterName: model.chapter.name,
    weekNumber: model.weekNumber,
    cycleStartISO: model.chapter.cycleStartISO ?? null,
    launchTargetISO: model.chapter.launchTargetISO ?? null,
    lifecycleStatus: model.chapter.lifecycleStatus,
    presidentId: model.chapter.president?.id ?? null,

    partnersTotal: m.partnersTotal,
    partnersContacted: m.partnersContacted,
    partnersResponded: m.partnersResponded,
    partnersMeetingScheduled: m.partnersMeetingScheduled,
    partnersMeetingsCompleted: m.partnersMeetingsCompleted,
    partnersConfirmed: m.partnersConfirmed,
    partnerFollowUpsDue: p.followUpNeeded,
    partnersConfirmedLogisticsIncomplete: p.confirmedWithIncompleteLogistics,

    instructorApplicants: m.instructorApplicants,
    instructorsUnderReview: m.instructorsUnderReview,
    instructorApplicationsAwaitingReview: i.waitingForReview,
    interviewsScheduled: m.interviewsScheduled,
    interviewsCompleted: m.interviewsCompleted,
    interviewDecisionsOverdue: i.decisionOverdue,
    instructorsHired: m.instructorsHired,

    curriculaSubmitted: m.curriculaSubmitted,
    curriculaApproved: m.curriculaApproved,
    curriculaCpReviewNeeded: c.cpReviewNeeded,
    curriculaCpReviewOverdue: c.cpReviewOverdue,
    curriculaNeedsRevision: m.curriculaNeedsRevision,

    classesTotal: m.classesTotal,
    classesPublic: m.classesPublic,
    classesLaunched: m.classesLaunched,
    classesRunning: m.classesRunning,
    classesReady: l.ready,
    classesUnderEnrolled: m.underEnrolledClasses,
    classesLaunchingSoonNotReady: l.launchingSoonNotReady,

    enrollmentTotal: m.enrollmentTotal,
    hasAttendanceData: sc.hasAttendanceData,
    attendancePercent: sc.attendancePercent,
    retentionPercent: sc.retentionPercent,
    retentionBase: sc.retentionBase,
    consecutiveAbsentees: sc.consecutiveAbsentees,
    decliningClasses: sc.decliningClasses,
    feedbackCount: sc.feedbackCount,

    unresolvedBlockers: model.blockerSummary.total,
  };
}

/**
 * Load the full automation read model for a chapter. Caller authorizes
 * (e.g. `requireChapterManager(chapterId)`). Returns null if the chapter is
 * missing. Reuses `loadChapterOS` — no new DB queries are introduced.
 */
export async function loadChapterAutomations(
  chapterId: string,
  opts: { dismissals?: AutomationDismissalOverlay[] } = {}
): Promise<ChapterAutomation | null> {
  const model = await loadChapterOS(chapterId);
  if (!model) return null;

  const input: AssembleInput = {
    facts: chapterFactsFromModel(model),
    blockers: model.blockers,
    studentNeeds: model.studentCommunity.needsAttention,
    impactPrep: model.impact,
    now: new Date(),
    weekAnchored: model.chapter.weekAnchored,
    dismissals: opts.dismissals,
  };
  return assembleChapterAutomation(input);
}
