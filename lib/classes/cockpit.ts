// Class Runtime OS (Phase 5) — pure helpers + aggregation for the Instructor
// Cockpit. The loader builds `CockpitClass[]` (computing runtime + signals); this
// module picks the next/overdue session, derives the due flags, and rolls the
// classes into the cockpit's Today / Needs You / summary. Prisma-free + testable.

import type {
  ClassRuntimeStage,
  ClassRuntimeHealth,
  ClassRuntimeNextStep,
} from "@/lib/classes/class-runtime";

export type CockpitSessionLite = {
  id: string;
  date: Date;
  isCancelled: boolean;
  attendanceRecorded: boolean;
  reflectionDone: boolean;
};

function startOfUtcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function isSameUtcDay(a: Date, b: Date): boolean {
  return startOfUtcDay(a) === startOfUtcDay(b);
}

/** The next upcoming (today or later) non-cancelled session. */
export function pickNextSession<T extends CockpitSessionLite>(sessions: T[], now: Date): T | null {
  const today = startOfUtcDay(now);
  return (
    sessions
      .filter((s) => !s.isCancelled && startOfUtcDay(s.date) >= today)
      .sort((a, b) => a.date.getTime() - b.date.getTime())[0] ?? null
  );
}

/** The most recent past non-cancelled session whose attendance isn't recorded. */
export function pickLastUnrecordedSession<T extends CockpitSessionLite>(sessions: T[], now: Date): T | null {
  return (
    sessions
      .filter((s) => !s.isCancelled && s.date.getTime() <= now.getTime() && !s.attendanceRecorded)
      .sort((a, b) => b.date.getTime() - a.date.getTime())[0] ?? null
  );
}

/** The most recent past non-cancelled session whose reflection isn't done. */
export function pickReflectionDueSession<T extends CockpitSessionLite>(sessions: T[], now: Date): T | null {
  return (
    sessions
      .filter((s) => !s.isCancelled && s.date.getTime() <= now.getTime() && s.attendanceRecorded && !s.reflectionDone)
      .sort((a, b) => b.date.getTime() - a.date.getTime())[0] ?? null
  );
}

export type CockpitSession = CockpitSessionLite & { sessionNumber: number; topic: string };

export type CockpitClass = {
  id: string;
  title: string;
  stage: ClassRuntimeStage;
  stageLabel: string;
  health: ClassRuntimeHealth;
  isLive: boolean;
  scheduleLabel: string;
  locationLabel: string;
  rosterCount: number;
  nextSession: CockpitSession | null;
  attendanceDueSession: CockpitSession | null;
  reflectionDueSession: CockpitSession | null;
  atRiskCount: number;
  feedbackCount: number;
  interventionCount: number;
  nextStep: ClassRuntimeNextStep;
};

const HEALTH_RANK: Record<ClassRuntimeHealth, number> = {
  critical: 0,
  at_risk: 1,
  watch: 2,
  healthy: 3,
  unknown: 4,
};

export type InstructorCockpit = {
  classes: CockpitClass[];
  today: CockpitClass[];
  needsYou: CockpitClass[];
  summary: {
    total: number;
    live: number;
    attendanceDue: number;
    reflectionDue: number;
    atRisk: number;
  };
};

function needsYou(c: CockpitClass): boolean {
  return (
    c.attendanceDueSession != null ||
    c.reflectionDueSession != null ||
    c.interventionCount > 0 ||
    c.atRiskCount > 0
  );
}

/** Roll the instructor's classes into Today / Needs You / summary. */
export function buildInstructorCockpit(classes: CockpitClass[], now: Date): InstructorCockpit {
  const today = classes.filter((c) => c.nextSession != null && isSameUtcDay(c.nextSession.date, now));

  const needs = classes
    .filter(needsYou)
    .sort((a, b) => HEALTH_RANK[a.health] - HEALTH_RANK[b.health]);

  return {
    classes,
    today,
    needsYou: needs,
    summary: {
      total: classes.length,
      live: classes.filter((c) => c.isLive).length,
      attendanceDue: classes.filter((c) => c.attendanceDueSession != null).length,
      reflectionDue: classes.filter((c) => c.reflectionDueSession != null).length,
      atRisk: classes.filter((c) => c.atRiskCount > 0).length,
    },
  };
}
