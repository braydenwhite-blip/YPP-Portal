// Per-class LAUNCH readiness — the Chapter President playbook's "is this class
// actually ready to run?" checklist. This is DISTINCT from the existing
// `lib/class-publish-readiness.ts` (an 8-item technical gate to flip a class
// PUBLISHED) and from `lib/chapters/launch-checklist.ts` (the 11-item *chapter*
// founding checklist). This is the 12-item, per-class, partner+curriculum+
// enrollment launch checklist the playbook spells out.
//
// Pure + deterministic (pass `now`) so it is fully unit testable.

import { shortDate } from "./format";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Enrollment targets from the playbook. */
export const MIN_ENROLLMENT_PRELAUNCH = 5; // ≥5 about two weeks out
export const MIN_ENROLLMENT_LAUNCH = 10; // 10+ by launch
/** "Near launch" window the under-enrollment warning starts firing in. */
export const PRELAUNCH_WINDOW_DAYS = 14;

export type LaunchChecklistKey =
  | "partner"
  | "room"
  | "time"
  | "launch_date"
  | "instructor"
  | "instructor_confirmed"
  | "curriculum"
  | "public"
  | "enrollment"
  | "instructor_ready"
  | "reminder"
  | "logistics_written";

export type ClassLaunchItem = {
  key: LaunchChecklistKey;
  label: string;
  done: boolean;
};

/** The minimal class shape the launch-readiness checker needs. */
export type ClassLaunchRecord = {
  id: string;
  title: string;
  /** Target age band from the template, e.g. "12-14". Shown under the title. */
  ageRange: string | null;
  startDate: Date | null;
  status: string; // ClassOfferingStatus
  partnerConfirmed: boolean;
  hasRoom: boolean;
  hasTimes: boolean;
  hasInstructor: boolean;
  instructorConfirmed: boolean;
  curriculumApproved: boolean;
  publiclyVisible: boolean;
  enrolledCount: number;
  capacity: number;
  instructorReady: boolean;
  preLaunchReminderSent: boolean;
  logisticsInWriting: boolean;
};

export type ClassLaunchReadiness = {
  id: string;
  title: string;
  items: ClassLaunchItem[];
  done: number;
  total: number;
  ready: boolean;
  missing: string[];
  /** Days until launch (negative = already started/past). null = no date set. */
  daysToLaunch: number | null;
  /** Has launched (start date is today/past or status is live/completed). */
  hasLaunched: boolean;
  underEnrolled: boolean;
  /** Concrete enrollment warning, e.g. "Only 3 enrolled — needs 5 before launch". */
  enrollmentWarning: string | null;
};

function daysUntil(date: Date | null, now: Date): number | null {
  if (!date) return null;
  return Math.ceil((date.getTime() - now.getTime()) / DAY_MS);
}

/**
 * Compute the 12-item launch checklist + enrollment health for one class. The
 * enrollment threshold steps up as launch approaches: ≥5 within two weeks, ≥10
 * once it has launched.
 */
export function computeClassLaunchReadiness(c: ClassLaunchRecord, now: Date): ClassLaunchReadiness {
  // Checklist item uses a stable baseline ("a viable class has ≥5 signed up");
  // the time-sensitive escalation (≥5 near launch, ≥10 at launch) drives the
  // under-enrollment WARNING below, not the checklist tick.
  const enrolledMeetsBar = c.enrolledCount >= MIN_ENROLLMENT_PRELAUNCH;
  const items: ClassLaunchItem[] = [
    { key: "partner", label: "Confirmed partner", done: c.partnerConfirmed },
    { key: "room", label: "Confirmed room / space", done: c.hasRoom },
    { key: "time", label: "Confirmed day & time", done: c.hasTimes },
    { key: "launch_date", label: "Confirmed launch date", done: c.startDate != null },
    { key: "instructor", label: "Assigned instructor", done: c.hasInstructor },
    { key: "instructor_confirmed", label: "Instructor confirmed assignment", done: c.instructorConfirmed },
    { key: "curriculum", label: "Curriculum fully approved", done: c.curriculumApproved },
    { key: "public", label: "Class visible publicly", done: c.publiclyVisible },
    { key: "enrollment", label: "Enrollment at minimum", done: enrolledMeetsBar },
    { key: "instructor_ready", label: "Instructor readiness check", done: c.instructorReady },
    { key: "reminder", label: "Pre-launch reminder sent", done: c.preLaunchReminderSent },
    { key: "logistics_written", label: "Logistics confirmed in writing", done: c.logisticsInWriting },
  ];

  const done = items.filter((i) => i.done).length;
  const daysToLaunch = daysUntil(c.startDate, now);
  const hasLaunched = classHasLaunched(c, now);
  const { underEnrolled, enrollmentWarning } = enrollmentHealth(c, now);

  return {
    id: c.id,
    title: c.title,
    items,
    done,
    total: items.length,
    ready: done === items.length,
    missing: items.filter((i) => !i.done).map((i) => i.label),
    daysToLaunch,
    hasLaunched,
    underEnrolled,
    enrollmentWarning,
  };
}

/** Has the class already launched? (live/completed status, or start date reached.) */
export function classHasLaunched(c: ClassLaunchRecord, now: Date): boolean {
  if (c.status === "IN_PROGRESS" || c.status === "COMPLETED") return true;
  if (c.startDate && c.startDate.getTime() <= now.getTime()) return true;
  return false;
}

/** The minimum-enrollment bar this class must clear right now. */
export function enrollmentBar(c: ClassLaunchRecord, now: Date): number {
  if (classHasLaunched(c, now)) return MIN_ENROLLMENT_LAUNCH;
  const days = daysUntil(c.startDate, now);
  if (days != null && days <= PRELAUNCH_WINDOW_DAYS) return MIN_ENROLLMENT_PRELAUNCH;
  return 0; // far out — no bar yet
}

export type EnrollmentHealth = { underEnrolled: boolean; enrollmentWarning: string | null };

/**
 * Under-enrollment detection: a class is under-enrolled if it is within the
 * pre-launch window (or already launched) and below the relevant threshold.
 */
export function enrollmentHealth(c: ClassLaunchRecord, now: Date): EnrollmentHealth {
  const bar = enrollmentBar(c, now);
  if (bar === 0) return { underEnrolled: false, enrollmentWarning: null };
  if (c.enrolledCount >= bar) return { underEnrolled: false, enrollmentWarning: null };
  const when = classHasLaunched(c, now) ? "at launch" : "before launch";
  return {
    underEnrolled: true,
    enrollmentWarning: `Only ${c.enrolledCount} enrolled — needs ${bar} ${when}`,
  };
}

export type LaunchReadinessSummary = {
  classes: ClassLaunchReadiness[];
  total: number;
  ready: number;
  notReady: number;
  underEnrolled: number;
  /** Classes launching within the pre-launch window that aren't ready. */
  launchingSoonNotReady: number;
};

/** Roll per-class readiness into the chapter launch headline. */
export function summarizeLaunchReadiness(
  classes: ClassLaunchRecord[],
  now: Date
): LaunchReadinessSummary {
  const computed = classes.map((c) => computeClassLaunchReadiness(c, now));
  return {
    classes: computed,
    total: computed.length,
    ready: computed.filter((c) => c.ready).length,
    notReady: computed.filter((c) => !c.ready).length,
    underEnrolled: computed.filter((c) => c.underEnrolled).length,
    launchingSoonNotReady: computed.filter(
      (c) => !c.ready && !c.hasLaunched && c.daysToLaunch != null && c.daysToLaunch <= PRELAUNCH_WINDOW_DAYS
    ).length,
  };
}

// --- Class evidence rows (the Deliberable table) ---------------------------

/** Health of a single class in the launch evidence table. */
export type ClassEvidenceStatus = "ready" | "needs_attention" | "not_ready";

export type ClassEvidenceRow = {
  id: string;
  title: string;
  /** "Ages 12–14" or null. */
  subtitle: string | null;
  /** "Jun 15, 2025" or "TBD". */
  launchDate: string;
  enrolled: number;
  capacity: number;
  /** Launch-checklist completion 0–100, the table's Readiness bar. */
  readinessPct: number;
  status: ClassEvidenceStatus;
};

function readinessPercent(r: ClassLaunchReadiness): number {
  return r.total ? Math.round((r.done / r.total) * 100) : 0;
}

/**
 * A class's launch health. A fully-checklisted, adequately-enrolled class is
 * "ready"; otherwise it bands by checklist completion, and under-enrollment
 * pulls an otherwise-strong class down to "needs attention".
 */
export function classEvidenceStatus(r: ClassLaunchReadiness): ClassEvidenceStatus {
  if (r.ready && !r.underEnrolled) return "ready";
  const pct = readinessPercent(r);
  if (pct < 50) return "not_ready";
  if (pct >= 75 && !r.underEnrolled) return "ready";
  return "needs_attention";
}

/** Build one class evidence row. */
export function classEvidenceRow(c: ClassLaunchRecord, now: Date): ClassEvidenceRow {
  const readiness = computeClassLaunchReadiness(c, now);
  return {
    id: c.id,
    title: c.title,
    subtitle: c.ageRange && c.ageRange.trim() ? `Ages ${c.ageRange.trim().replace(/-/g, "–")}` : null,
    launchDate: shortDate(c.startDate),
    enrolled: c.enrolledCount,
    capacity: c.capacity,
    readinessPct: readinessPercent(readiness),
    status: classEvidenceStatus(readiness),
  };
}

/** The class-launch Deliberable's one recommended next step. */
export function launchReadinessRecommendation(summary: LaunchReadinessSummary): string {
  if (summary.total === 0) return "No classes planned yet — build one to start its launch checklist.";
  const cls = (x: number) => (x === 1 ? "class" : "classes");
  if (summary.launchingSoonNotReady > 0) {
    return `Unblock ${summary.launchingSoonNotReady} ${cls(
      summary.launchingSoonNotReady
    )} launching soon that ${summary.launchingSoonNotReady === 1 ? "isn't" : "aren't"} ready yet.`;
  }
  if (summary.underEnrolled > 0) {
    return `Focus on ${summary.underEnrolled} under-enrolled ${cls(
      summary.underEnrolled
    )} to meet the ${MIN_ENROLLMENT_PRELAUNCH}-student threshold before launch.`;
  }
  if (summary.notReady > 0) {
    return `Finish the launch checklist for ${summary.notReady} ${cls(summary.notReady)}.`;
  }
  return "Your classes are on track to launch.";
}
