// Instructor Pairing cockpit — shared view-model types.
//
// Unifies class-offering coverage (RegularInstructorAssignment lifecycle) and
// the accepted-applicant placement pipeline into one guided cockpit. The pure
// selectors here never import Prisma or React.

export type PairingTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "brand";

export type PairingLane =
  | "needs_instructor"
  | "starts_soon"
  | "suggested_matches"
  | "accepted_unplaced"
  | "needs_training"
  | "waiting_instructor"
  | "waiting_partner"
  | "cp_follow_up"
  | "fully_covered";

/** Concrete coverage status of one class/partner unit. */
export type CoverageStatus =
  | "NEEDS_INSTRUCTOR"
  | "SUGGESTED_MATCH"
  | "INSTRUCTOR_CONTACTED"
  | "INSTRUCTOR_CONFIRMED"
  | "PARTNER_CONFIRMATION_NEEDED"
  | "TRAINING_NEEDED"
  | "NEEDS_CONFIRMATION"
  | "NEEDS_OWNER"
  | "FULLY_COVERED";

export type PairingActionKind =
  | "pair_instructor"
  | "review_suggestion"
  | "confirm_instructor"
  | "request_partner_confirmation"
  | "schedule_training"
  | "replace_instructor"
  | "unpair_instructor"
  | "place_instructor"
  | "assign_owner"
  | "create_coverage_action"
  | "open_class_360"
  | "open_partner_360"
  | "open_instructor_360";

export type PairingCardAction = {
  kind: PairingActionKind;
  label: string;
  href?: string;
  /** RegularInstructorAssignment id the action targets, when relevant. */
  assignmentId?: string;
  /** Target assignment status for confirm/training transitions. */
  nextStatus?: string;
  offeringId?: string;
  instructorId?: string;
  partnerId?: string;
};

export type InstructorSuggestion = {
  instructorId: string;
  instructorName: string;
  score: number;
  reasons: string[];
  warnings: string[];
  trained: boolean;
  activeLoad: number;
};

export type PairingCard = {
  id: string;
  lane: PairingLane;
  offeringId: string | null;
  offeringTitle: string | null;
  partnerId: string | null;
  partnerName: string | null;
  instructorId: string | null;
  instructorName: string | null;
  primaryAssignmentId: string | null;

  statusLabel: string;
  statusTone: PairingTone;
  accentTone: PairingTone;

  title: string;
  subtitle: string | null;
  why: string;
  context: string | null;
  metaLine: string | null;
  nextAction: string;

  primaryAction: PairingCardAction;
  secondaryActions: PairingCardAction[];

  suggestions: InstructorSuggestion[];
};

export type PairingBriefingChip = {
  key: string;
  label: string;
  count: number;
  tone: PairingTone;
  lane: PairingLane | null;
};

export type PairingLaneView = {
  lane: PairingLane;
  label: string;
  blurb: string;
  cards: PairingCard[];
  total: number;
  emptyTitle: string;
  emptyBody: string;
};

export type PairingCockpit = {
  briefing: PairingBriefingChip[];
  lanes: PairingLaneView[];
  totalSituations: number;
  generatedAtISO: string;
};

// ── Loader input shapes (DB → pure selector) ───────────────────────────────

export type PairingAssignmentLite = {
  id: string;
  instructorId: string;
  instructorName: string;
  role: string;
  status: string;
};

export type PairingUnit = {
  offeringId: string;
  title: string;
  subject: string | null;
  ageGroup: string | null;
  partnerId: string | null;
  partnerName: string | null;
  chapterId: string | null;
  chapterName: string | null;
  ownerId: string | null;
  ownerName: string | null;
  startDate: Date | null;
  offeringStatus: string;
  /** Confirmed instructors needed (1 for a normal class lead). */
  slotsNeeded: number;
  /** Legacy single-pointer lead instructor (ClassOffering.instructorId). */
  legacyLeadId: string | null;
  legacyLeadName: string | null;
  assignments: PairingAssignmentLite[];
  /** Precomputed top suggestions for uncovered units. */
  suggestions: InstructorSuggestion[];
};

export type AcceptedUnplacedInstructor = {
  instructorId: string;
  name: string;
  chapterName: string | null;
  /** "Accepted applicant", "Active instructor", etc. */
  readinessLabel: string;
  trained: boolean;
  /** Days since they became available, for ordering oldest-first. */
  waitingDays: number;
};

export type PairingCockpitInput = {
  units: PairingUnit[];
  acceptedUnplaced: AcceptedUnplacedInstructor[];
};
