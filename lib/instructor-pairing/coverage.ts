// Instructor Pairing — deterministic coverage logic.
//
// Pure functions over a normalised PairingUnit. Coverage is driven by the
// RegularInstructorAssignment confirmation lifecycle; a legacy-only lead reads
// as covered unless the class is starting soon and still unconfirmed (so the
// cockpit stays useful without flagging every legacy class).

import type {
  CoverageStatus,
  PairingLane,
  PairingTone,
  PairingUnit,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
/** A class starting within this window is "starts soon". */
export const STARTS_SOON_DAYS = 21;

const ACTIVE_STATUSES = new Set([
  "OFFERED",
  "INSTRUCTOR_CONFIRMED",
  "CHAPTER_CONFIRMED",
  "FULLY_CONFIRMED",
]);
const SUGGESTED_STATUSES = new Set(["SUGGESTED", "PENDING_REVIEW"]);
const TRAINING_STATUSES = new Set(["NEEDS_TRAINING", "NEEDS_CURRICULUM"]);

export type UnitCoverage = {
  status: CoverageStatus;
  label: string;
  tone: PairingTone;
  lane: PairingLane;
  /** The assignment a confirm/training action should target. */
  primaryAssignmentId: string | null;
  /** Next status for the primary confirm action, if any. */
  confirmNextStatus: string | null;
  needsOwner: boolean;
  startsSoon: boolean;
  daysUntilStart: number | null;
  reason: string;
  nextAction: string;
};

function daysUntil(date: Date | null, now: Date): number | null {
  if (!date) return null;
  return Math.round((date.getTime() - now.getTime()) / DAY_MS);
}

function startLabel(days: number | null): string {
  if (days === null) return "no start date set";
  if (days < 0) return `started ${Math.abs(days)}d ago`;
  if (days === 0) return "starts today";
  return `starts in ${days}d`;
}

/**
 * Derive the coverage state + the single lane a unit belongs in. Priority
 * order guarantees each unit lands in exactly one lane (de-duplicated cockpit).
 */
export function deriveUnitCoverage(unit: PairingUnit, now: Date = new Date()): UnitCoverage {
  const days = daysUntil(unit.startDate, now);
  const startsSoon = days !== null && days <= STARTS_SOON_DAYS && days >= -3;
  const needsOwner = Boolean(unit.partnerId) && !unit.ownerId;

  const active = unit.assignments.filter((a) => ACTIVE_STATUSES.has(a.status));
  const suggested = unit.assignments.filter((a) => SUGGESTED_STATUSES.has(a.status));
  const training = unit.assignments.filter((a) => TRAINING_STATUSES.has(a.status));
  const lead = (rows: typeof unit.assignments) =>
    rows.find((a) => a.role === "LEAD") ?? rows[0] ?? null;

  const slotsNeeded = Math.max(1, unit.slotsNeeded || 1);
  const confirmedCount = active.filter((a) => a.status === "FULLY_CONFIRMED").length;
  const fullyCovered = confirmedCount >= slotsNeeded;
  const hasInstructorConfirmed = active.some((a) => a.status === "INSTRUCTOR_CONFIRMED");
  const hasChapterConfirmed = active.some((a) => a.status === "CHAPTER_CONFIRMED");
  const hasOffered = active.some((a) => a.status === "OFFERED");

  const startSuffix = startLabel(days);

  if (fullyCovered) {
    const a = lead(active);
    return {
      status: "FULLY_COVERED",
      label: "Fully covered",
      tone: "success",
      lane: "fully_covered",
      primaryAssignmentId: a?.id ?? null,
      confirmNextStatus: null,
      needsOwner,
      startsSoon,
      daysUntilStart: days,
      reason: `Confirmed instructor in place${a ? ` — ${a.instructorName}` : ""}.`,
      nextAction: "Covered. No action needed.",
    };
  }

  if (training.length > 0) {
    const a = lead(training);
    return {
      status: "TRAINING_NEEDED",
      label: "Training needed",
      tone: "warning",
      lane: "needs_training",
      primaryAssignmentId: a?.id ?? null,
      confirmNextStatus: "FULLY_CONFIRMED",
      needsOwner,
      startsSoon,
      daysUntilStart: days,
      reason: `${a?.instructorName ?? "Instructor"} needs training/onboarding before placement (${startSuffix}).`,
      nextAction: "Schedule training, then confirm the placement.",
    };
  }

  if (hasInstructorConfirmed) {
    const a = active.find((x) => x.status === "INSTRUCTOR_CONFIRMED") ?? lead(active);
    return {
      status: "PARTNER_CONFIRMATION_NEEDED",
      label: "Partner confirmation needed",
      tone: "warning",
      lane: "waiting_partner",
      primaryAssignmentId: a?.id ?? null,
      confirmNextStatus: "FULLY_CONFIRMED",
      needsOwner,
      startsSoon,
      daysUntilStart: days,
      reason: `${a?.instructorName ?? "Instructor"} accepted; partner/chapter confirmation is still missing (${startSuffix}).`,
      nextAction: "Confirm with the partner/chapter to lock it in.",
    };
  }

  if (hasChapterConfirmed || hasOffered) {
    const a =
      active.find((x) => x.status === "CHAPTER_CONFIRMED" || x.status === "OFFERED") ??
      lead(active);
    return {
      status: "INSTRUCTOR_CONTACTED",
      label: "Waiting on instructor",
      tone: "info",
      lane: "waiting_instructor",
      primaryAssignmentId: a?.id ?? null,
      confirmNextStatus: hasChapterConfirmed ? "FULLY_CONFIRMED" : "INSTRUCTOR_CONFIRMED",
      needsOwner,
      startsSoon,
      daysUntilStart: days,
      reason: `${a?.instructorName ?? "Instructor"} was offered the class but hasn't confirmed yet (${startSuffix}).`,
      nextAction: "Nudge the instructor, then mark confirmed.",
    };
  }

  if (suggested.length > 0) {
    const a = lead(suggested);
    return {
      status: "SUGGESTED_MATCH",
      label: "Suggested match",
      tone: "brand",
      lane: "suggested_matches",
      primaryAssignmentId: a?.id ?? null,
      confirmNextStatus: "OFFERED",
      needsOwner,
      startsSoon,
      daysUntilStart: days,
      reason: `${a?.instructorName ?? "A candidate"} is shortlisted but hasn't been offered the class yet (${startSuffix}).`,
      nextAction: "Send the offer to the suggested instructor.",
    };
  }

  // No active/suggested assignment rows.
  const legacyOnly = unit.assignments.length === 0 && Boolean(unit.legacyLeadId);

  if (legacyOnly) {
    if (startsSoon) {
      return {
        status: "NEEDS_CONFIRMATION",
        label: "Confirm instructor",
        tone: "warning",
        lane: "starts_soon",
        primaryAssignmentId: null,
        confirmNextStatus: null,
        needsOwner,
        startsSoon,
        daysUntilStart: days,
        reason: `${unit.legacyLeadName ?? "An instructor"} is the listed lead, but the placement isn't confirmed and the class ${startSuffix}.`,
        nextAction: "Confirm the instructor through pairing before it starts.",
      };
    }
    return {
      status: "FULLY_COVERED",
      label: "Instructor assigned",
      tone: "success",
      lane: "fully_covered",
      primaryAssignmentId: null,
      confirmNextStatus: null,
      needsOwner,
      startsSoon,
      daysUntilStart: days,
      reason: `${unit.legacyLeadName ?? "An instructor"} is assigned as lead.`,
      nextAction: "Covered. Confirm in pairing when ready.",
    };
  }

  // Truly uncovered.
  if (needsOwner) {
    return {
      status: "NEEDS_OWNER",
      label: "Needs owner",
      tone: "danger",
      lane: "cp_follow_up",
      primaryAssignmentId: null,
      confirmNextStatus: null,
      needsOwner,
      startsSoon,
      daysUntilStart: days,
      reason: `${unit.partnerName ?? "This partner"} has no relationship lead, so coverage is unowned.`,
      nextAction: "Assign an owner before pairing an instructor.",
    };
  }

  if (startsSoon) {
    return {
      status: "NEEDS_INSTRUCTOR",
      label: "Needs instructor",
      tone: "danger",
      lane: "starts_soon",
      primaryAssignmentId: null,
      confirmNextStatus: null,
      needsOwner,
      startsSoon,
      daysUntilStart: days,
      reason: `No confirmed instructor and the class ${startSuffix}.`,
      nextAction: "Pair an instructor now — this is time-critical.",
    };
  }

  const hasSuggestions = unit.suggestions.length > 0;
  return {
    status: hasSuggestions ? "SUGGESTED_MATCH" : "NEEDS_INSTRUCTOR",
    label: hasSuggestions ? "Match ready" : "Needs instructor",
    tone: hasSuggestions ? "brand" : "danger",
    lane: hasSuggestions ? "suggested_matches" : "needs_instructor",
    primaryAssignmentId: null,
    confirmNextStatus: null,
    needsOwner,
    startsSoon,
    daysUntilStart: days,
    reason: hasSuggestions
      ? `No instructor yet — ${unit.suggestions[0].instructorName} looks like a strong match.`
      : "No instructor assigned yet.",
    nextAction: hasSuggestions
      ? "Review the suggested match and send an offer."
      : "Pair an instructor or create a coverage action.",
  };
}
