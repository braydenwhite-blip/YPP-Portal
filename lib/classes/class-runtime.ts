// Class Runtime OS (Phase 5) — the living lifecycle of a class once it is built.
//
// Phase 4's `lib/chapters/launch-readiness.ts` answers "is this class ready to
// LAUNCH?" (Draft → Launch Ready). This module EXTENDS that with the runtime that
// begins once a class goes live: attendance, feedback, retention, intervention,
// completion, and renewal. It is pure + deterministic (pass `now`) so the whole
// lifecycle is unit-testable, and it derives every stage from REAL records — no
// invented data. The chapter loaders map DB rows onto `ClassRuntimeInput`; this
// computes the stage, health, blockers, next step, interventions, and renewal.

import {
  computeClassLaunchReadiness,
  classHasLaunched,
  enrollmentHealth,
  type ClassLaunchRecord,
} from "@/lib/chapters/launch-readiness";

/** Attendance-percentage health bands (whole percent). */
export const ATTENDANCE_HEALTHY = 85;
export const ATTENDANCE_WATCH = 75;
export const ATTENDANCE_INTERVENTION = 60; // below this, while live → intervention
/** Retention (active ÷ ever-enrolled) below this, with real dropouts, is a risk. */
export const RETENTION_RISK_PERCENT = 75;
/** A feedback rating ≤ this (1–5 scale) counts as negative. */
export const NEGATIVE_RATING = 2;
/** Average rating below this (with feedback present) is a quality concern. */
export const WEAK_AVG_RATING = 3;

export const CLASS_RUNTIME_STAGES = [
  "draft",
  "needs_approval",
  "advertisable",
  "enrolling",
  "launch_ready",
  "live",
  "attendance_missing",
  "feedback_missing",
  "retention_risk",
  "needs_intervention",
  "healthy",
  "completed",
  "renewal_candidate",
  "archived",
] as const;
export type ClassRuntimeStage = (typeof CLASS_RUNTIME_STAGES)[number];

export const CLASS_RUNTIME_STAGE_LABELS: Record<ClassRuntimeStage, string> = {
  draft: "Draft",
  needs_approval: "Needs Approval",
  advertisable: "Advertisable",
  enrolling: "Enrolling",
  launch_ready: "Launch Ready",
  live: "Live",
  attendance_missing: "Attendance Missing",
  feedback_missing: "Feedback Missing",
  retention_risk: "Retention Risk",
  needs_intervention: "Needs Intervention",
  healthy: "Healthy",
  completed: "Completed",
  renewal_candidate: "Renewal Candidate",
  archived: "Archived",
};

/** Which broad phase a stage belongs to (for grouping / colour). */
export type ClassRuntimePhase = "setup" | "enrolling" | "live" | "closed";
export const STAGE_PHASE: Record<ClassRuntimeStage, ClassRuntimePhase> = {
  draft: "setup",
  needs_approval: "setup",
  advertisable: "setup",
  enrolling: "enrolling",
  launch_ready: "enrolling",
  live: "live",
  attendance_missing: "live",
  feedback_missing: "live",
  retention_risk: "live",
  needs_intervention: "live",
  healthy: "live",
  completed: "closed",
  renewal_candidate: "closed",
  archived: "closed",
};

export type ClassRuntimeHealth = "healthy" | "watch" | "at_risk" | "critical" | "unknown";

/** One scheduled meeting, reduced to what the runtime needs. */
export type ClassRuntimeSession = {
  id: string;
  date: Date;
  isCancelled: boolean;
  /** Any attendance record exists for this session. */
  attendanceRecorded: boolean;
  /** A post-session instructor reflection exists. */
  reflectionDone: boolean;
};

/**
 * Everything the runtime model needs, on top of the launch-readiness fields.
 * Live metrics are nullable where "no data yet" must be distinguished from "0".
 */
export type ClassRuntimeInput = ClassLaunchRecord & {
  /** Enrollment is open on the offering (publish gate is `publiclyVisible`). */
  enrollmentOpen: boolean;
  /** Students dropped since enrolling (for retention). */
  droppedCount: number;
  sessions: ClassRuntimeSession[];
  /** Attendance % across recorded sessions, or null when none recorded. */
  attendancePercent: number | null;
  feedbackCount: number;
  /** Average rating (1–5), or null when no feedback. */
  averageRating: number | null;
  /** Feedback rows with a rating ≤ NEGATIVE_RATING. */
  negativeFeedbackCount: number;
  /** Open issues/escalations linked to the class. */
  openIssueCount: number;
  /** Instructor flagged "needs CP help" via a reflection. */
  needsHelp: boolean;
  /** Curriculum has been submitted for review (vs. never started). */
  curriculumSubmitted: boolean;
};

// --- Derived sub-facts (pure) ----------------------------------------------

function pastSessions(input: ClassRuntimeInput, now: Date): ClassRuntimeSession[] {
  return input.sessions.filter((s) => !s.isCancelled && s.date.getTime() <= now.getTime());
}

/** A past session that has no attendance recorded — the clearest live blocker. */
export function hasUnrecordedPastSession(input: ClassRuntimeInput, now: Date): boolean {
  return pastSessions(input, now).some((s) => !s.attendanceRecorded);
}

/** A past session that has no instructor reflection. */
export function hasUnreflectedPastSession(input: ClassRuntimeInput, now: Date): boolean {
  return pastSessions(input, now).some((s) => !s.reflectionDone);
}

/** Retention = active ÷ ever-enrolled (whole %), or null when nobody enrolled. */
export function retentionPercent(input: ClassRuntimeInput): number | null {
  const ever = input.enrolledCount + input.droppedCount;
  if (ever <= 0) return null;
  return Math.round((input.enrolledCount / ever) * 100);
}

export function retentionAtRisk(input: ClassRuntimeInput): boolean {
  const r = retentionPercent(input);
  if (r == null) return false;
  return input.droppedCount >= 2 && r < RETENTION_RISK_PERCENT;
}

export function feedbackIsNegative(input: ClassRuntimeInput): boolean {
  if (input.feedbackCount === 0) return false;
  if (input.negativeFeedbackCount > 0) return true;
  return input.averageRating != null && input.averageRating < WEAK_AVG_RATING;
}

/** Live + past the first session + no feedback collected yet. */
export function feedbackIsMissing(input: ClassRuntimeInput, now: Date): boolean {
  return pastSessions(input, now).length >= 1 && input.feedbackCount === 0;
}

/** A class is "advertisable" when it is genuinely safe to show families. */
export function isAdvertisable(input: ClassRuntimeInput): boolean {
  return (
    input.status !== "CANCELLED" &&
    input.curriculumApproved &&
    input.hasInstructor &&
    input.hasTimes &&
    input.startDate != null &&
    (input.hasRoom || true) && // virtual classes have no room; schedule+curriculum carry it
    input.title.trim().length > 0
  );
}

/**
 * Completion is the authoritative `status === "COMPLETED"`, NOT a "all logged
 * sessions are past" heuristic — future sessions are often not created yet, so
 * that heuristic would wrongly retire a live class mid-run.
 */
function isCompleted(input: ClassRuntimeInput): boolean {
  return input.status === "COMPLETED";
}

// --- Health ----------------------------------------------------------------

export function classRuntimeHealth(input: ClassRuntimeInput, now: Date): ClassRuntimeHealth {
  if (input.status === "CANCELLED") return "unknown";
  const live = classHasLaunched(input, now);

  if (!live) {
    // Pre-live: health tracks readiness + enrollment.
    const r = computeClassLaunchReadiness(input, now);
    if (r.underEnrolled) return "at_risk";
    if (r.ready) return "healthy";
    const pct = r.total ? r.done / r.total : 0;
    return pct >= 0.6 ? "watch" : "at_risk";
  }

  // Live: attendance + feedback + retention + issues.
  if (hasUnrecordedPastSession(input, now)) return "at_risk";
  if (feedbackIsNegative(input) || retentionAtRisk(input) || input.openIssueCount > 0 || input.needsHelp) {
    return "critical";
  }
  if (input.attendancePercent != null) {
    if (input.attendancePercent < ATTENDANCE_INTERVENTION) return "critical";
    if (input.attendancePercent < ATTENDANCE_WATCH) return "at_risk";
    if (input.attendancePercent < ATTENDANCE_HEALTHY) return "watch";
  }
  if (feedbackIsMissing(input, now)) return "watch";
  return "healthy";
}

// --- Stage derivation (the spine) ------------------------------------------

/**
 * The single authoritative runtime stage. A deterministic ladder, most-terminal
 * and most-urgent first, so the same inputs always yield the same stage.
 */
export function deriveClassRuntimeStage(input: ClassRuntimeInput, now: Date): ClassRuntimeStage {
  if (input.status === "CANCELLED") return "archived";

  if (isCompleted(input)) {
    return renewalPotential(input) === "strong" ? "renewal_candidate" : "completed";
  }

  if (classHasLaunched(input, now)) {
    // Live health sub-stages, most urgent first.
    if (hasUnrecordedPastSession(input, now)) return "attendance_missing";
    if (retentionAtRisk(input)) return "retention_risk";
    if (
      feedbackIsNegative(input) ||
      input.openIssueCount > 0 ||
      input.needsHelp ||
      (input.attendancePercent != null && input.attendancePercent < ATTENDANCE_INTERVENTION)
    ) {
      return "needs_intervention";
    }
    if (feedbackIsMissing(input, now)) return "feedback_missing";
    return "healthy";
  }

  // Pre-live ladder.
  if (computeClassLaunchReadiness(input, now).ready) return "launch_ready";
  if (input.publiclyVisible && input.enrollmentOpen) return "enrolling";
  if (isAdvertisable(input)) return "advertisable";
  if (!input.curriculumApproved && input.curriculumSubmitted) return "needs_approval";
  return "draft";
}

// --- Renewal potential -----------------------------------------------------

export type RenewalPotential = "strong" | "possible" | "unlikely" | "unknown";

/** Would we run this again? Based on real attendance, feedback, and retention. */
export function renewalPotential(input: ClassRuntimeInput): RenewalPotential {
  const hasSignal = input.attendancePercent != null || input.feedbackCount > 0;
  if (!hasSignal) return "unknown";
  const att = input.attendancePercent ?? 0;
  const ret = retentionPercent(input) ?? 100;
  const positive = input.averageRating == null ? true : input.averageRating >= WEAK_AVG_RATING;

  if (att >= ATTENDANCE_HEALTHY && ret >= RETENTION_RISK_PERCENT && positive && !feedbackIsNegative(input)) {
    return "strong";
  }
  if (att < ATTENDANCE_INTERVENTION || feedbackIsNegative(input) || ret < 50) return "unlikely";
  return "possible";
}

// --- Blockers + next step --------------------------------------------------

export type ClassRuntimeBlocker = {
  key: string;
  label: string;
  severity: "critical" | "warning" | "info";
};

/** Concrete, evidence-backed blockers for the class's current stage. */
export function classRuntimeBlockers(input: ClassRuntimeInput, now: Date): ClassRuntimeBlocker[] {
  const out: ClassRuntimeBlocker[] = [];
  const live = classHasLaunched(input, now);

  if (input.status === "CANCELLED") return out;

  if (!live && !isCompleted(input)) {
    if (!input.curriculumApproved) {
      out.push({
        key: "curriculum",
        label: input.curriculumSubmitted ? "Curriculum is awaiting full approval" : "Curriculum not submitted",
        severity: "warning",
      });
    }
    if (!input.hasInstructor) out.push({ key: "instructor", label: "No instructor assigned", severity: "warning" });
    if (!input.hasTimes || input.startDate == null) out.push({ key: "schedule", label: "Schedule not confirmed", severity: "warning" });
    if (!input.publiclyVisible && isAdvertisable(input)) {
      out.push({ key: "publish", label: "Ready to advertise — not yet published", severity: "info" });
    }
    const eh = enrollmentHealth(input, now);
    if (eh.underEnrolled && eh.enrollmentWarning) {
      out.push({ key: "enrollment", label: eh.enrollmentWarning, severity: "warning" });
    }
  }

  if (live && !isCompleted(input)) {
    if (hasUnrecordedPastSession(input, now)) out.push({ key: "attendance", label: "Attendance not recorded for a past session", severity: "critical" });
    if (input.attendancePercent != null && input.attendancePercent < ATTENDANCE_INTERVENTION) {
      out.push({ key: "attendance_low", label: `Attendance is low (${input.attendancePercent}%)`, severity: "critical" });
    }
    if (retentionAtRisk(input)) out.push({ key: "retention", label: `${input.droppedCount} student${input.droppedCount === 1 ? "" : "s"} dropped`, severity: "warning" });
    if (feedbackIsNegative(input)) out.push({ key: "feedback_negative", label: "Negative feedback received", severity: "warning" });
    if (feedbackIsMissing(input, now)) out.push({ key: "feedback_missing", label: "No feedback collected yet", severity: "info" });
    if (input.needsHelp) out.push({ key: "help", label: "Instructor requested help", severity: "warning" });
    if (input.openIssueCount > 0) out.push({ key: "issues", label: `${input.openIssueCount} open issue${input.openIssueCount === 1 ? "" : "s"}`, severity: "warning" });
    if (hasUnreflectedPastSession(input, now)) out.push({ key: "reflection", label: "Post-session reflection due", severity: "info" });
  }

  const rank = { critical: 0, warning: 1, info: 2 } as const;
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

export type ClassRuntimeNextStep = { text: string; actor: "instructor" | "chapter_president" | "family" | "none" };

/** The single most useful next operational move for this class. */
export function classRuntimeNextStep(input: ClassRuntimeInput, now: Date): ClassRuntimeNextStep {
  const stage = deriveClassRuntimeStage(input, now);
  switch (stage) {
    case "draft":
      return { text: "Finish setup: curriculum, schedule, and instructor", actor: "chapter_president" };
    case "needs_approval":
      return { text: "Get the curriculum fully approved", actor: "chapter_president" };
    case "advertisable":
      return { text: "Publish the class so families can enroll", actor: "chapter_president" };
    case "enrolling":
      return { text: "Drive enrollment toward the launch minimum", actor: "chapter_president" };
    case "launch_ready":
      return { text: "Confirm logistics and send the pre-launch reminder", actor: "instructor" };
    case "live":
      return { text: "Run the next session", actor: "instructor" };
    case "attendance_missing":
      return { text: "Record attendance for the last session", actor: "instructor" };
    case "retention_risk":
      return { text: "Re-engage students who have dropped or stopped attending", actor: "chapter_president" };
    case "needs_intervention":
      return { text: "Review the class signals and intervene", actor: "chapter_president" };
    case "feedback_missing":
      return { text: "Collect student/family feedback after the session", actor: "instructor" };
    case "healthy":
      return { text: "Keep momentum — run the next session", actor: "instructor" };
    case "completed":
      return { text: "Capture the completion outcome and reflection", actor: "instructor" };
    case "renewal_candidate":
      return { text: "Plan a repeat — this class performed well", actor: "chapter_president" };
    case "archived":
      return { text: "Archived — no action needed", actor: "none" };
  }
}

// --- The composed runtime model --------------------------------------------

export type ClassRuntimeEvidence = {
  enrolled: number;
  capacity: number;
  sessionsTotal: number;
  sessionsHeld: number;
  attendancePercent: number | null;
  retentionPercent: number | null;
  feedbackCount: number;
  averageRating: number | null;
};

export type ClassRuntime = {
  id: string;
  title: string;
  stage: ClassRuntimeStage;
  stageLabel: string;
  phase: ClassRuntimePhase;
  health: ClassRuntimeHealth;
  isLive: boolean;
  isCompleted: boolean;
  interventionNeeded: boolean;
  renewalPotential: RenewalPotential;
  blockers: ClassRuntimeBlocker[];
  nextStep: ClassRuntimeNextStep;
  evidence: ClassRuntimeEvidence;
};

/** Compute the full runtime model for one class. Pure + deterministic. */
export function computeClassRuntime(input: ClassRuntimeInput, now: Date): ClassRuntime {
  const stage = deriveClassRuntimeStage(input, now);
  const blockers = classRuntimeBlockers(input, now);
  const completed = isCompleted(input);
  return {
    id: input.id,
    title: input.title,
    stage,
    stageLabel: CLASS_RUNTIME_STAGE_LABELS[stage],
    phase: STAGE_PHASE[stage],
    health: classRuntimeHealth(input, now),
    isLive: classHasLaunched(input, now) && !completed,
    isCompleted: completed,
    interventionNeeded: stage === "attendance_missing" || stage === "retention_risk" || stage === "needs_intervention",
    renewalPotential: renewalPotential(input),
    blockers,
    nextStep: classRuntimeNextStep(input, now),
    evidence: {
      enrolled: input.enrolledCount,
      capacity: input.capacity,
      sessionsTotal: input.sessions.filter((s) => !s.isCancelled).length,
      sessionsHeld: pastSessions(input, now).length,
      attendancePercent: input.attendancePercent,
      retentionPercent: retentionPercent(input),
      feedbackCount: input.feedbackCount,
      averageRating: input.averageRating,
    },
  };
}
