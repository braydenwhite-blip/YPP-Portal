/**
 * Workshop Proposal — shared constants, types, and shape validators.
 *
 * Sister module to /lib/training-constants.ts. Centralizes anything that
 * would otherwise drift between the applicant studio, the admin library,
 * the reviewer queue, and the readiness aggregator.
 */

import type {
  WorkshopProposalDifficulty,
  WorkshopProposalReviewRecommendation,
  WorkshopProposalSourceType,
  WorkshopProposalSubmissionStatus,
  WorkshopProposalTemplateStatus,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Custom workshop payload (CUSTOM_DESIGN sourceType)
// ---------------------------------------------------------------------------

/**
 * Workshop format. Summer Workshops are "mostly in-person"; the field is
 * required so reviewers see logistics expectations up front instead of
 * inferring them from a free-text address blob.
 */
export type WorkshopFormat = "IN_PERSON" | "VIRTUAL" | "HYBRID";

export const WORKSHOP_FORMATS: WorkshopFormat[] = [
  "IN_PERSON",
  "VIRTUAL",
  "HYBRID",
];

export function workshopFormatLabel(format: WorkshopFormat | "" | null | undefined): string {
  switch (format) {
    case "IN_PERSON":
      return "In person";
    case "VIRTUAL":
      return "Virtual";
    case "HYBRID":
      return "Hybrid (in person + virtual)";
    default:
      return "Not specified";
  }
}

/**
 * Shape stored in `WorkshopProposalSubmission.customWorkshop` (Json).
 * Mirrors the Workshop Design Studio form fields. Nullable strings stay as
 * empty strings so the form can autosave incomplete drafts without losing
 * the user's typing.
 *
 * The `format` / `locationNotes` / `capacity` / `availability` / `safetyNotes`
 * fields capture the in-person logistics admins need to make a real call.
 * They live on the same JSON blob (no schema change required) and default
 * to empty for legacy rows authored before they existed; validation only
 * blocks the submit button, so existing drafts keep loading cleanly.
 */
export type CustomWorkshopPayload = {
  title: string;
  targetAgeGroup: string;
  lengthMinutes: number;
  category: string;
  learningObjective: string;
  materials: string[];
  openingHook: string;
  mainActivity: string;
  participationPlan: string;
  wrapUp: string;
  backupPlan: string;
  format: WorkshopFormat | "";
  locationNotes: string;
  capacity: number;
  availability: string;
  safetyNotes: string;
};

export const EMPTY_CUSTOM_WORKSHOP: CustomWorkshopPayload = {
  title: "",
  targetAgeGroup: "",
  lengthMinutes: 0,
  category: "",
  learningObjective: "",
  materials: [],
  openingHook: "",
  mainActivity: "",
  participationPlan: "",
  wrapUp: "",
  backupPlan: "",
  format: "",
  locationNotes: "",
  capacity: 0,
  availability: "",
  safetyNotes: "",
};

// ---------------------------------------------------------------------------
// Reflection payload (TEMPLATE_SELECTION sourceType, also captured for
// CUSTOM_DESIGN at submit time so reviewers see "why I built this")
// ---------------------------------------------------------------------------

export type WorkshopReflectionPayload = {
  whyChosen: string;
  audienceAdaptation: string;
  hardestPart: string;
  engagementPlan: string;
};

export const EMPTY_REFLECTION: WorkshopReflectionPayload = {
  whyChosen: "",
  audienceAdaptation: "",
  hardestPart: "",
  engagementPlan: "",
};

// ---------------------------------------------------------------------------
// Validation thresholds — quality bar before submit
// ---------------------------------------------------------------------------

export const MIN_LEARNING_OBJECTIVE_CHARS = 30;
export const MIN_MAIN_ACTIVITY_CHARS = 80;
export const MIN_REFLECTION_CHARS = 40;
export const MIN_WORKSHOP_LENGTH_MIN = 15;
export const MAX_WORKSHOP_LENGTH_MIN = 240;
/// Capacity ceiling for a single workshop session — anything bigger almost
/// certainly needs to be split into multiple sessions.
export const MIN_WORKSHOP_CAPACITY = 1;
export const MAX_WORKSHOP_CAPACITY = 60;

// ---------------------------------------------------------------------------
// Status labels (single source of truth for human copy)
// ---------------------------------------------------------------------------

export function templateStatusLabel(status: WorkshopProposalTemplateStatus): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "APPROVED":
      return "Approved · visible to applicants";
    case "ARCHIVED":
      return "Archived";
  }
}

export function submissionStatusLabel(status: WorkshopProposalSubmissionStatus): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "SUBMITTED":
      return "Submitted";
    case "IN_REVIEW":
      return "In review";
    case "CHANGES_REQUESTED":
      return "Changes requested";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
  }
}

/**
 * Status colour palette — a four-colour traffic-light + brand-purple scheme
 * shared by the reviewer queue, the review detail header, and the applicant
 * status card so a submission reads the same colour everywhere:
 *
 *   purple → active for a reviewer (submitted / in review)
 *   yellow → waiting on the applicant (changes requested)
 *   green  → approved
 *   red    → rejected
 *
 * Hex values track the shared `--iv-*` semantic surfaces in globals.css and
 * the `--ypp-purple-*` brand scale, so the workshop surfaces stay visually
 * consistent with the rest of the admin app.
 */
export type WorkshopStatusPalette = {
  /** Soft tinted background. */
  surface: string;
  /** Border / hairline. */
  border: string;
  /** Readable text colour on `surface`. */
  ink: string;
  /** Strong accent — column dots, left rails, pill outlines. */
  accent: string;
};

const WORKSHOP_STATUS_PALETTES: Record<
  WorkshopProposalSubmissionStatus,
  WorkshopStatusPalette
> = {
  // Pre-submit — never shown in the reviewer queue, kept for completeness.
  DRAFT: { surface: "#f5f5f4", border: "#e7e5e4", ink: "#44403c", accent: "#78716c" },
  // Purple = needs a reviewer. Lighter shade for brand-new, deeper once open.
  SUBMITTED: { surface: "#f3ecff", border: "#e8d8ff", ink: "#5a1da8", accent: "#8b3fe8" },
  IN_REVIEW: { surface: "#f3ecff", border: "#e8d8ff", ink: "#5a1da8", accent: "#6b21c8" },
  // Yellow = the ball is in the applicant's court.
  CHANGES_REQUESTED: { surface: "#fffbeb", border: "#fde68a", ink: "#92400e", accent: "#d97706" },
  // Green = approved.
  APPROVED: { surface: "#f0fdf4", border: "#bbf7d0", ink: "#166534", accent: "#16a34a" },
  // Red = rejected.
  REJECTED: { surface: "#fef2f2", border: "#fecaca", ink: "#991b1b", accent: "#dc2626" },
};

export function workshopStatusPalette(
  status: WorkshopProposalSubmissionStatus
): WorkshopStatusPalette {
  return WORKSHOP_STATUS_PALETTES[status];
}

export function recommendationLabel(
  rec: WorkshopProposalReviewRecommendation
): string {
  switch (rec) {
    case "APPROVE":
      return "Approve";
    case "REQUEST_CHANGES":
      return "Request changes";
    case "REJECT":
      return "Reject";
  }
}

export function difficultyLabel(d: WorkshopProposalDifficulty): string {
  switch (d) {
    case "BEGINNER":
      return "Beginner";
    case "INTERMEDIATE":
      return "Intermediate";
    case "ADVANCED":
      return "Advanced";
  }
}

export function sourceTypeLabel(s: WorkshopProposalSourceType): string {
  return s === "CUSTOM_DESIGN" ? "Custom-designed workshop" : "Selected from library";
}

// ---------------------------------------------------------------------------
// Status transition predicates
// ---------------------------------------------------------------------------

/**
 * Whether the applicant can edit their submission. DRAFT and CHANGES_REQUESTED
 * are the editable states; everything else freezes the row.
 */
export function isSubmissionEditable(
  status: WorkshopProposalSubmissionStatus
): boolean {
  return status === "DRAFT" || status === "CHANGES_REQUESTED";
}

/**
 * Whether reviewers can land a decision. SUBMITTED and IN_REVIEW are
 * decidable; the rest are terminal or pre-submit.
 */
export function isSubmissionReviewable(
  status: WorkshopProposalSubmissionStatus
): boolean {
  return status === "SUBMITTED" || status === "IN_REVIEW";
}
