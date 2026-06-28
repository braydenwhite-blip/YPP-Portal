// Class Runtime OS (Phase 5) — the intervention system. Detects, from REAL
// runtime + student signals, the moments a class needs a human: attendance not
// recorded, attendance too low, students slipping, negative feedback, the
// instructor asking for help, unresolved issues, under-enrollment, missing
// reflection, or no feedback after the first session.
//
// Each intervention carries severity, evidence, the owner who should act, a
// recommended action, a stable key (so it dedups when tracked as an ActionItem,
// matching lib/chapters/needs-attention-rules.ts), and a deep link. Pure +
// deterministic so it is fully unit-testable; the chapter loaders feed these
// into the Live Classes / Student Community rooms, Needs You, and the Action
// Tracker bridge.

import {
  computeClassRuntime,
  classRuntimeHealth,
  hasUnrecordedPastSession,
  hasUnreflectedPastSession,
  feedbackIsNegative,
  feedbackIsMissing,
  retentionAtRisk,
  retentionPercent,
  ATTENDANCE_INTERVENTION,
  type ClassRuntimeInput,
} from "@/lib/classes/class-runtime";
import { enrollmentHealth, classHasLaunched } from "@/lib/chapters/launch-readiness";
import { summarizeClassStudentSignals, type StudentSignalInput } from "@/lib/classes/student-signals";

export type InterventionSeverity = "critical" | "warning" | "info";
export type InterventionOwner = "instructor" | "chapter_president";

export type ClassIntervention = {
  /** Stable per (rule, class[, student]) — dedups a tracked ActionItem. */
  key: string;
  classId: string;
  className: string;
  /** Machine trigger code. */
  trigger: string;
  severity: InterventionSeverity;
  title: string;
  /** The concrete evidence behind the trigger. */
  evidence: string;
  owner: InterventionOwner;
  recommendedAction: string;
  href: string;
  studentId?: string;
  studentName?: string;
};

const SEVERITY_RANK: Record<InterventionSeverity, number> = { critical: 0, warning: 1, info: 2 };

/**
 * Derive every intervention for one class from its runtime input + student
 * signals. Returns them ranked critical → warning → info.
 */
export function deriveClassInterventions(
  input: ClassRuntimeInput,
  students: StudentSignalInput[],
  now: Date
): ClassIntervention[] {
  const out: ClassIntervention[] = [];
  const cpHref = `/admin/classes/${input.id}`;
  const live = classHasLaunched(input, now);
  const name = input.title;

  if (input.status === "CANCELLED") return out;

  // --- Enrollment (pre-live) ------------------------------------------------
  if (!live) {
    const eh = enrollmentHealth(input, now);
    if (eh.underEnrolled && eh.enrollmentWarning) {
      out.push({
        key: `class-under-enrolled:${input.id}`,
        classId: input.id,
        className: name,
        trigger: "ENROLLMENT_BELOW_TARGET",
        severity: classHasLaunched(input, now) ? "critical" : "warning",
        title: `${name} is under-enrolled`,
        evidence: eh.enrollmentWarning,
        owner: "chapter_president",
        recommendedAction: "Drive signups before launch",
        href: cpHref,
      });
    }
  }

  // --- Live interventions ---------------------------------------------------
  if (live) {
    if (hasUnrecordedPastSession(input, now)) {
      out.push({
        key: `class-attendance-missing:${input.id}`,
        classId: input.id,
        className: name,
        trigger: "ATTENDANCE_MISSING",
        severity: "critical",
        title: `${name}: attendance not recorded`,
        evidence: "A past session has no attendance recorded.",
        owner: "instructor",
        recommendedAction: "Record attendance for the last session",
        href: cpHref,
      });
    }

    if (input.attendancePercent != null && input.attendancePercent < ATTENDANCE_INTERVENTION) {
      out.push({
        key: `class-attendance-low:${input.id}`,
        classId: input.id,
        className: name,
        trigger: "ATTENDANCE_BELOW_THRESHOLD",
        severity: "critical",
        title: `${name}: attendance is low`,
        evidence: `Attendance is ${input.attendancePercent}% (below ${ATTENDANCE_INTERVENTION}%).`,
        owner: "chapter_president",
        recommendedAction: "Diagnose why students aren't showing up",
        href: cpHref,
      });
    }

    if (retentionAtRisk(input)) {
      out.push({
        key: `class-retention:${input.id}`,
        classId: input.id,
        className: name,
        trigger: "RETENTION_RISK",
        severity: "warning",
        title: `${name}: retention slipping`,
        evidence: `${input.droppedCount} dropped — ${retentionPercent(input)}% retained.`,
        owner: "chapter_president",
        recommendedAction: "Re-engage students who have dropped",
        href: cpHref,
      });
    }

    if (feedbackIsNegative(input)) {
      out.push({
        key: `class-negative-feedback:${input.id}`,
        classId: input.id,
        className: name,
        trigger: "NEGATIVE_FEEDBACK",
        severity: "warning",
        title: `${name}: negative feedback`,
        evidence:
          input.averageRating != null
            ? `Average rating ${input.averageRating.toFixed(1)}/5 across ${input.feedbackCount} response${input.feedbackCount === 1 ? "" : "s"}.`
            : "A student rated the class poorly.",
        owner: "chapter_president",
        recommendedAction: "Talk with the instructor about the feedback",
        href: cpHref,
      });
    }

    if (input.needsHelp) {
      out.push({
        key: `class-needs-help:${input.id}`,
        classId: input.id,
        className: name,
        trigger: "INSTRUCTOR_NEEDS_HELP",
        severity: "warning",
        title: `${name}: instructor asked for help`,
        evidence: "The instructor flagged that they need support.",
        owner: "chapter_president",
        recommendedAction: "Reach out to the instructor",
        href: cpHref,
      });
    }

    if (input.openIssueCount > 0) {
      out.push({
        key: `class-open-issue:${input.id}`,
        classId: input.id,
        className: name,
        trigger: "UNRESOLVED_ISSUE",
        severity: "warning",
        title: `${name}: unresolved issue`,
        evidence: `${input.openIssueCount} open issue${input.openIssueCount === 1 ? "" : "s"} on this class.`,
        owner: "chapter_president",
        recommendedAction: "Resolve or escalate the open issue",
        href: cpHref,
      });
    }

    if (feedbackIsMissing(input, now)) {
      out.push({
        key: `class-no-feedback:${input.id}`,
        classId: input.id,
        className: name,
        trigger: "NO_FEEDBACK_AFTER_FIRST_SESSION",
        severity: "info",
        title: `${name}: no feedback yet`,
        evidence: "The class has met but no feedback has been collected.",
        owner: "instructor",
        recommendedAction: "Collect student/family feedback",
        href: cpHref,
      });
    }

    if (hasUnreflectedPastSession(input, now)) {
      out.push({
        key: `class-reflection-due:${input.id}`,
        classId: input.id,
        className: name,
        trigger: "REFLECTION_NOT_SUBMITTED",
        severity: "info",
        title: `${name}: reflection due`,
        evidence: "A past session has no instructor reflection.",
        owner: "instructor",
        recommendedAction: "Submit the post-session reflection",
        href: cpHref,
      });
    }

    // --- Per-student interventions (from signals) --------------------------
    const signals = summarizeClassStudentSignals(students);
    for (const s of signals.atRiskStudents) {
      const p = s.primary;
      if (!p) continue;
      // Only the clearest student-level triggers become interventions.
      if (p.key === "never_attended" || p.key === "missed_two_in_a_row") {
        out.push({
          key: `student-${p.key}:${input.id}:${s.studentId}`,
          classId: input.id,
          className: name,
          trigger: p.key === "never_attended" ? "STUDENT_NEVER_ATTENDED" : "STUDENT_MISSED_TWO",
          severity: "warning",
          title: `${s.studentName}: ${p.label.toLowerCase()} in ${name}`,
          evidence: p.key === "never_attended" ? "Enrolled but has never attended a session." : "Absent for the last two sessions.",
          owner: "instructor",
          recommendedAction: "Check in with the student and family",
          href: cpHref,
          studentId: s.studentId,
          studentName: s.studentName,
        });
      }
    }
  }

  return out.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

/** Whether a class needs any intervention at all (cheap headline check). */
export function classNeedsIntervention(
  input: ClassRuntimeInput,
  students: StudentSignalInput[],
  now: Date
): boolean {
  return deriveClassInterventions(input, students, now).length > 0;
}

/** Summarize interventions across many classes (for the chapter headline). */
export type InterventionSummary = {
  total: number;
  critical: number;
  warning: number;
  info: number;
  byTrigger: Record<string, number>;
};

export function summarizeInterventions(interventions: ClassIntervention[]): InterventionSummary {
  const byTrigger: Record<string, number> = {};
  let critical = 0;
  let warning = 0;
  let info = 0;
  for (const i of interventions) {
    byTrigger[i.trigger] = (byTrigger[i.trigger] ?? 0) + 1;
    if (i.severity === "critical") critical += 1;
    else if (i.severity === "warning") warning += 1;
    else info += 1;
  }
  return { total: interventions.length, critical, warning, info, byTrigger };
}

// re-export for callers that compute health alongside interventions
export { computeClassRuntime, classRuntimeHealth };
