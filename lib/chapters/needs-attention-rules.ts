// Chapter "Needs Attention" — the deterministic blocker generator. Turns the
// Chapter President playbook's list of concrete problems into a flat, ranked set
// of attention items, each pointing at the existing workflow that resolves it.
// These are CONCRETE problems with evidence, never a vague health score.
//
// Each blocker carries a stable `key` (so it can be tracked as a single, deduped
// ActionItem via lib/chapters/operating-actions.ts) and an optional entity link
// (so a tracked action shows on Partner / Applicant / Class 360). Pure +
// deterministic (pass `now`) so it is fully unit testable.

import {
  type PartnerRecord,
  type InstructorApplicantRecord,
  partnerFollowUp,
  partnerPlaybookStatus,
  partnerIsConfirmed,
  partnerLogistics,
  instructorWaitingForReview,
  instructorInterviewReadyNotScheduled,
  instructorDecisionOverdue,
  instructorMissingMaterials,
  businessDaysBetween,
} from "@/lib/chapters/pipeline";
import {
  type CurriculumRecord,
  curriculumReviewOverdue,
  curriculumGlobalReviewOverdue,
  curriculumPlaybookStatus,
  curriculumHoursWaiting,
} from "@/lib/chapters/curriculum-review";
import {
  type ClassLaunchRecord,
  computeClassLaunchReadiness,
  classHasLaunched,
  enrollmentHealth,
  PRELAUNCH_WINDOW_DAYS,
} from "@/lib/chapters/launch-readiness";

/** No-response window before the playbook says "try another contact". */
export const PARTNER_NO_RESPONSE_BUSINESS_DAYS = 7;

export type ChapterLane = "partners" | "instructors" | "curriculum" | "classes";
export type BlockerSeverity = "critical" | "warning" | "info";

export type ChapterBlocker = {
  /** Stable per (rule, subject) — used to dedupe a tracked ActionItem. */
  key: string;
  lane: ChapterLane;
  severity: BlockerSeverity;
  /** Plain-language problem statement. */
  title: string;
  detail?: string;
  /** Where the CP goes to resolve it. */
  href: string;
  /** Title to use if the CP tracks this as an ActionItem. */
  suggestedAction: string;
  entityType?: "PARTNER" | "INSTRUCTOR_APPLICATION" | "CLASS_OFFERING";
  entityId?: string;
};

export type ChapterBlockerInput = {
  partners: PartnerRecord[];
  applicants: InstructorApplicantRecord[];
  curricula: CurriculumRecord[];
  classes: ClassLaunchRecord[];
};

const SEVERITY_RANK: Record<BlockerSeverity, number> = { critical: 0, warning: 1, info: 2 };

// ---------------------------------------------------------------------------
// Per-lane rules
// ---------------------------------------------------------------------------

function partnerBlockers(partners: PartnerRecord[], now: Date): ChapterBlocker[] {
  const out: ChapterBlocker[] = [];
  for (const p of partners) {
    const status = partnerPlaybookStatus(p.stage);

    const fu = partnerFollowUp(p, now);
    if (fu.needed) {
      const overdue = !!p.nextFollowUpAt && p.nextFollowUpAt.getTime() < now.getTime();
      out.push({
        key: `partner-followup:${p.id}`,
        lane: "partners",
        severity: overdue ? "warning" : "info",
        title: `${p.name}: ${fu.reason}`,
        detail: "Log a touchpoint and set the next follow-up date.",
        href: `/partners/${p.id}`,
        suggestedAction: `Follow up with ${p.name}`,
        entityType: "PARTNER",
        entityId: p.id,
      });
    }

    // Contacted 7+ business days ago with no response → try another contact.
    if (
      p.stage === "REACHED_OUT" &&
      p.lastContactedAt &&
      businessDaysBetween(p.lastContactedAt, now) >= PARTNER_NO_RESPONSE_BUSINESS_DAYS
    ) {
      out.push({
        key: `partner-no-response:${p.id}`,
        lane: "partners",
        severity: "warning",
        title: `${p.name}: no response in ${PARTNER_NO_RESPONSE_BUSINESS_DAYS}+ business days`,
        detail: "Send a follow-up or try another contact.",
        href: `/partners/${p.id}`,
        suggestedAction: `Re-engage ${p.name} (no response)`,
        entityType: "PARTNER",
        entityId: p.id,
      });
    }

    // Interested but no meeting on the calendar.
    if (status === "interested") {
      out.push({
        key: `partner-no-meeting:${p.id}`,
        lane: "partners",
        severity: "info",
        title: `${p.name}: interested but no meeting scheduled`,
        detail: "Get a partner meeting on the calendar.",
        href: `/partners/${p.id}`,
        suggestedAction: `Schedule a meeting with ${p.name}`,
        entityType: "PARTNER",
        entityId: p.id,
      });
    }

    // Confirmed partner missing locked-in logistics.
    if (partnerIsConfirmed(p.stage)) {
      const log = partnerLogistics(p);
      if (!log.complete) {
        out.push({
          key: `partner-logistics:${p.id}`,
          lane: "partners",
          severity: "warning",
          title: `${p.name}: confirmed but logistics incomplete`,
          detail: `Still needed: ${log.missing.join(", ")}.`,
          href: `/partners/${p.id}`,
          suggestedAction: `Lock in logistics for ${p.name}`,
          entityType: "PARTNER",
          entityId: p.id,
        });
      }
    }
  }
  return out;
}

function instructorBlockers(applicants: InstructorApplicantRecord[], now: Date): ChapterBlocker[] {
  const out: ChapterBlocker[] = [];
  for (const a of applicants) {
    if (instructorWaitingForReview(a)) {
      out.push({
        key: `applicant-review:${a.id}`,
        lane: "instructors",
        severity: "warning",
        title: `${a.name}: application waiting for review`,
        detail: "Assign a reviewer and review the application.",
        href: `/chapter/recruiting?tab=candidates`,
        suggestedAction: `Review ${a.name}'s application`,
        entityType: "INSTRUCTOR_APPLICATION",
        entityId: a.id,
      });
    }
    if (instructorInterviewReadyNotScheduled(a)) {
      out.push({
        key: `applicant-interview:${a.id}`,
        lane: "instructors",
        severity: "warning",
        title: `${a.name}: ready for interview, none scheduled`,
        detail: "Assign a co-interviewer and schedule the interview.",
        href: `/chapter/recruiting?tab=candidates`,
        suggestedAction: `Schedule ${a.name}'s interview`,
        entityType: "INSTRUCTOR_APPLICATION",
        entityId: a.id,
      });
    }
    if (instructorDecisionOverdue(a, now)) {
      out.push({
        key: `applicant-decision:${a.id}`,
        lane: "instructors",
        severity: "critical",
        title: `${a.name}: interview done, decision overdue`,
        detail: "Submit the hire/deny decision (due within 12 hours).",
        href: `/chapter/recruiting?tab=candidates`,
        suggestedAction: `Decide on ${a.name}`,
        entityType: "INSTRUCTOR_APPLICATION",
        entityId: a.id,
      });
    }
    if (instructorMissingMaterials(a)) {
      out.push({
        key: `applicant-materials:${a.id}`,
        lane: "instructors",
        severity: "info",
        title: `${a.name}: missing pre-interview materials`,
        detail: "Course description and a sample lesson plan are required before interviewing.",
        href: `/chapter/recruiting?tab=candidates`,
        suggestedAction: `Request materials from ${a.name}`,
        entityType: "INSTRUCTOR_APPLICATION",
        entityId: a.id,
      });
    }
  }
  return out;
}

function curriculumBlockers(curricula: CurriculumRecord[], now: Date): ChapterBlocker[] {
  const out: ChapterBlocker[] = [];
  for (const c of curricula) {
    const status = curriculumPlaybookStatus(c);

    // Stage 1 — CP owes a review (48-hour SLA). entityId carries the template id
    // so the room can offer an inline "Mark CP approved" action.
    if (status === "cp_review") {
      const overdue = curriculumReviewOverdue(c, now);
      const hrs = curriculumHoursWaiting(c, now);
      out.push({
        key: `curriculum-review:${c.id}`,
        lane: "curriculum",
        severity: overdue ? "critical" : "warning",
        title: `${c.title}: ${overdue ? "CP review overdue" : "CP review needed"}`,
        detail: overdue
          ? `Submitted ${Math.floor(hrs / 24)}d ago — review within 48h: approve or request a revision.`
          : "Review within 48 hours: approve or request a revision.",
        href: `/admin/curricula`,
        suggestedAction: `Review curriculum: ${c.title}`,
        entityId: c.id,
      });
    }

    // CP approved — the next move is escalating to global review. This is the
    // action that was honestly disabled in Phase 3; now it is real.
    if (status === "cp_approved") {
      out.push({
        key: `curriculum-send-global:${c.id}`,
        lane: "curriculum",
        severity: "info",
        title: `${c.title}: CP approved — send to global review`,
        detail: "Escalate this CP-approved curriculum to global leadership for final sign-off.",
        href: `/admin/curricula`,
        suggestedAction: `Send to global review: ${c.title}`,
        entityId: c.id,
      });
    }

    // Stage 2 — escalated; global leadership owes the final sign-off.
    if (status === "global_review") {
      const overdue = curriculumGlobalReviewOverdue(c, now);
      out.push({
        key: `curriculum-global-review:${c.id}`,
        lane: "curriculum",
        severity: overdue ? "warning" : "info",
        title: `${c.title}: ${overdue ? "global review overdue" : "awaiting global review"}`,
        detail: overdue
          ? "Past the 48-hour global review window — global leadership should sign off or send it back."
          : "With global leadership for the final approval that satisfies launch readiness.",
        href: `/admin/curricula`,
        suggestedAction: `Global review: ${c.title}`,
        entityId: c.id,
      });
    }
  }
  return out;
}

function classBlockers(classes: ClassLaunchRecord[], now: Date): ChapterBlocker[] {
  const out: ChapterBlocker[] = [];
  for (const c of classes) {
    const r = computeClassLaunchReadiness(c, now);
    const launchingSoon = !r.hasLaunched && r.daysToLaunch != null && r.daysToLaunch <= PRELAUNCH_WINDOW_DAYS;

    if (!c.hasInstructor) {
      out.push(classBlocker(c, "class-no-instructor", "warning", "missing an instructor", "Assign an instructor."));
    }
    if (!c.partnerConfirmed) {
      out.push(classBlocker(c, "class-no-partner", "warning", "missing a partner / location", "Link a confirmed partner and location."));
    }
    if (!c.curriculumApproved) {
      out.push(classBlocker(c, "class-no-curriculum", "warning", "has unapproved curriculum", "Get the curriculum fully approved before launch."));
    }
    if (launchingSoon && !c.publiclyVisible) {
      out.push(classBlocker(c, "class-not-public", "warning", "not public but launching soon", "Publish the class so students can sign up."));
    }

    const eh = enrollmentHealth(c, now);
    if (eh.underEnrolled) {
      out.push(
        classBlocker(
          c,
          "class-under-enrolled",
          classHasLaunched(c, now) ? "critical" : "warning",
          "is under-enrolled",
          "Make a plan to drive signups.",
          eh.enrollmentWarning ?? undefined
        )
      );
    }

    // Pre-launch reminder not sent within 48h of launch.
    if (launchingSoon && r.daysToLaunch != null && r.daysToLaunch <= 2 && !c.preLaunchReminderSent) {
      out.push(classBlocker(c, "class-no-reminder", "warning", "pre-launch reminder not sent", "Send the instructor the 48-hour pre-launch reminder."));
    }

    if (launchingSoon && !c.instructorReady) {
      out.push(classBlocker(c, "class-instructor-not-ready", "info", "instructor readiness not logged", "Run the instructor readiness check."));
    }
  }
  return out;
}

function classBlocker(
  c: ClassLaunchRecord,
  rule: string,
  severity: BlockerSeverity,
  problem: string,
  action: string,
  detailOverride?: string
): ChapterBlocker {
  return {
    key: `${rule}:${c.id}`,
    lane: "classes",
    severity,
    title: `${c.title}: ${problem}`,
    detail: detailOverride ?? action,
    href: `/admin/classes/${c.id}`,
    suggestedAction: `${c.title}: ${action}`,
    entityType: "CLASS_OFFERING",
    entityId: c.id,
  };
}

// ---------------------------------------------------------------------------
// Compose + summarize
// ---------------------------------------------------------------------------

/** Derive every chapter blocker, ranked critical → warning → info. */
export function deriveChapterBlockers(input: ChapterBlockerInput, now: Date): ChapterBlocker[] {
  const all = [
    ...partnerBlockers(input.partners, now),
    ...instructorBlockers(input.applicants, now),
    ...curriculumBlockers(input.curricula, now),
    ...classBlockers(input.classes, now),
  ];
  return all.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

export type BlockerSummary = {
  total: number;
  critical: number;
  warning: number;
  info: number;
  byLane: Record<ChapterLane, number>;
};

/** Headline counts for the "What needs you" banner. */
export function summarizeBlockers(blockers: ChapterBlocker[]): BlockerSummary {
  const byLane: Record<ChapterLane, number> = { partners: 0, instructors: 0, curriculum: 0, classes: 0 };
  let critical = 0;
  let warning = 0;
  let info = 0;
  for (const b of blockers) {
    byLane[b.lane] += 1;
    if (b.severity === "critical") critical += 1;
    else if (b.severity === "warning") warning += 1;
    else info += 1;
  }
  return { total: blockers.length, critical, warning, info, byLane };
}
