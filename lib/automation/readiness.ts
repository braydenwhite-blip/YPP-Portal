// ============================================================================
// CHAPTER LAUNCH READINESS ENGINE (Phase 8)
// ============================================================================
//
// A deterministic chapter-wide launch CHECKLIST (not a score). It composes the
// five readiness areas the CP guide names — partner, instructor, curriculum,
// class, student — from `ChapterFacts` (which is built from the existing OS
// reads), and reports what is ready, the blocking gaps, non-blocking warnings,
// the required next actions, launch-risk reasons, and days until launch.
//
// Per-class launch readiness still lives in `lib/chapters/launch-readiness.ts`
// (reused by the OS); this aggregates to the CHAPTER level the audit flagged as
// missing. Pure (pass `now`).

import type { ChapterFacts } from "@/lib/automation/types";
import { daysUntil, toDate } from "@/lib/automation/date-helpers";

export type ReadinessItem = {
  label: string;
  done: boolean;
  /** A blocking item must be done for the chapter to be launch-ready. */
  blocking: boolean;
  /** Evidence / what's missing. */
  detail: string;
};

export type ReadinessAreaKey = "partner" | "instructor" | "curriculum" | "class" | "student";

export type ReadinessArea = {
  key: ReadinessAreaKey;
  label: string;
  items: ReadinessItem[];
  done: number;
  total: number;
  ready: boolean;
};

export type ChapterReadiness = {
  ready: boolean;
  areas: ReadinessArea[];
  readyAreas: number;
  totalAreas: number;
  blockingGaps: string[];
  warnings: string[];
  requiredNextActions: string[];
  launchRiskReasons: string[];
  /** Calendar days until the chapter's launch target (null = none set). */
  daysUntilLaunch: number | null;
};

function area(key: ReadinessAreaKey, label: string, items: ReadinessItem[]): ReadinessArea {
  const done = items.filter((i) => i.done).length;
  return { key, label, items, done, total: items.length, ready: done === items.length };
}

export function computeChapterReadiness(facts: ChapterFacts, now: Date): ChapterReadiness {
  const f = facts;

  const partner = area("partner", "Partner readiness", [
    {
      label: "At least one confirmed partner",
      done: f.partnersConfirmed >= 1,
      blocking: true,
      detail: f.partnersConfirmed >= 1 ? `${f.partnersConfirmed} confirmed` : "No confirmed partner — a chapter cannot launch without one.",
    },
    {
      label: "Logistics confirmed in writing (room, times, supervision)",
      done: f.partnersConfirmed >= 1 && f.partnersConfirmedLogisticsIncomplete === 0,
      blocking: true,
      detail:
        f.partnersConfirmed === 0
          ? "Confirm a partner first."
          : f.partnersConfirmedLogisticsIncomplete === 0
            ? "All confirmed partners have written logistics."
            : `${f.partnersConfirmedLogisticsIncomplete} confirmed partner(s) missing written logistics.`,
    },
  ]);

  const instructor = area("instructor", "Instructor readiness", [
    {
      label: "Instructors hired",
      done: f.instructorsHired >= 1,
      blocking: true,
      detail: f.instructorsHired >= 1 ? `${f.instructorsHired} hired` : "No instructors hired yet.",
    },
    {
      label: "Interview decisions current",
      done: f.interviewDecisionsOverdue === 0,
      blocking: false,
      detail: f.interviewDecisionsOverdue === 0 ? "No overdue decisions." : `${f.interviewDecisionsOverdue} interview decision(s) overdue.`,
    },
    {
      label: "Enough instructors for planned classes",
      done: f.classesTotal === 0 || f.instructorsHired >= f.classesTotal,
      blocking: false,
      detail:
        f.classesTotal === 0
          ? "No classes planned yet."
          : f.instructorsHired >= f.classesTotal
            ? `${f.instructorsHired} hired for ${f.classesTotal} class(es).`
            : `${f.instructorsHired} hired for ${f.classesTotal} planned class(es).`,
    },
  ]);

  const curriculum = area("curriculum", "Curriculum readiness", [
    {
      label: "Curriculum submitted",
      done: f.curriculaSubmitted >= 1,
      blocking: false,
      detail: f.curriculaSubmitted >= 1 ? `${f.curriculaSubmitted} submitted` : "No curriculum submitted.",
    },
    {
      label: "Curriculum fully approved (CP + global)",
      done: f.curriculaApproved >= 1,
      blocking: true,
      detail: f.curriculaApproved >= 1 ? `${f.curriculaApproved} fully approved` : "No curriculum has cleared global approval.",
    },
    {
      label: "No overdue curriculum reviews",
      done: f.curriculaCpReviewOverdue === 0,
      blocking: false,
      detail: f.curriculaCpReviewOverdue === 0 ? "Reviews are on time." : `${f.curriculaCpReviewOverdue} review(s) past the 48-hour SLA.`,
    },
  ]);

  const klass = area("class", "Class readiness", [
    {
      label: "Classes created",
      done: f.classesTotal >= 1,
      blocking: true,
      detail: f.classesTotal >= 1 ? `${f.classesTotal} class(es) planned` : "No classes created yet.",
    },
    {
      label: "Public listings published",
      done: f.classesPublic >= 1,
      blocking: true,
      detail: f.classesPublic >= 1 ? `${f.classesPublic} public` : "No public class listings — students can't enroll.",
    },
    {
      label: "No classes launching with readiness gaps",
      done: f.classesLaunchingSoonNotReady === 0,
      blocking: true,
      detail:
        f.classesLaunchingSoonNotReady === 0
          ? "Every class launching soon is ready."
          : `${f.classesLaunchingSoonNotReady} class(es) launching soon aren't ready.`,
    },
  ]);

  const student = area("student", "Student readiness", [
    {
      label: "Enrollment target reached (≥10)",
      done: f.enrollmentTotal >= 10,
      blocking: false,
      detail: `${f.enrollmentTotal} enrolled`,
    },
    {
      label: "No under-enrolled classes",
      done: f.classesUnderEnrolled === 0,
      blocking: true,
      detail: f.classesUnderEnrolled === 0 ? "No under-enrolled classes." : `${f.classesUnderEnrolled} under-enrolled class(es).`,
    },
  ]);

  const areas = [partner, instructor, curriculum, klass, student];

  const blockingGaps: string[] = [];
  const warnings: string[] = [];
  for (const a of areas) {
    for (const item of a.items) {
      if (item.done) continue;
      if (item.blocking) blockingGaps.push(`${a.label}: ${item.label} — ${item.detail}`);
      else warnings.push(`${a.label}: ${item.label} — ${item.detail}`);
    }
  }

  const daysUntilLaunch = daysUntil(toDate(facts.launchTargetISO), now);

  const launchRiskReasons: string[] = [];
  if (daysUntilLaunch != null && daysUntilLaunch <= 14 && blockingGaps.length > 0) {
    launchRiskReasons.push(
      `Launch is ${daysUntilLaunch <= 0 ? "here" : `in ${daysUntilLaunch} day(s)`} with ${blockingGaps.length} blocking gap(s).`
    );
    launchRiskReasons.push(...blockingGaps.slice(0, 3));
  }

  const requiredNextActions = blockingGaps.slice(0, 4);

  return {
    ready: blockingGaps.length === 0,
    areas,
    readyAreas: areas.filter((a) => a.ready).length,
    totalAreas: areas.length,
    blockingGaps,
    warnings,
    requiredNextActions,
    launchRiskReasons,
    daysUntilLaunch,
  };
}
