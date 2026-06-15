// Student Advising cockpit — shared view-model types.
//
// These are the serializable shapes that flow from the server loader
// (lib/advising/queries.ts) through the deterministic selector
// (lib/advising/cockpit.ts) into the client cockpit. Keeping them here means
// the pure selectors and their tests never import Prisma or React.

/** Status tones, aligned with the ui-v2 StatusBadge vocabulary. */
export type AdvisingTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "brand";

/** The operating lanes of the advising cockpit, in display order. */
export type AdvisingLane =
  | "needs_advisor"
  | "suggested_matches"
  | "kickoff_needed"
  | "follow_up_due"
  | "needs_reassignment"
  | "advisor_overloaded"
  | "recommendations_ready"
  | "recently_checked_in";

/** Lifecycle stage of a single advisor↔student relationship. */
export type AdvisingLifecycle =
  | "KICKOFF_NEEDED"
  | "ACTIVE"
  | "FOLLOW_UP_DUE"
  | "STALE"
  | "READY_FOR_NEXT"
  | "INACTIVE";

/** What the primary/secondary buttons on a card do. The client maps each
 *  kind to either a drawer or a navigation; no logic lives in the string. */
export type AdvisingActionKind =
  | "assign_advisor"
  | "review_suggestion"
  | "schedule_kickoff"
  | "add_checkin"
  | "create_followup"
  | "review_recommendation"
  | "reassign_advisor"
  | "redistribute_caseload"
  | "open_student_360"
  | "open_advisor_360"
  | "create_advising_action";

export type AdvisingCardAction = {
  kind: AdvisingActionKind;
  label: string;
  /** Optional explicit link (for navigations); drawers ignore this. */
  href?: string;
};

/** A deterministic advisor suggestion for an unadvised student. */
export type AdvisorMatchSuggestion = {
  advisorId: string;
  advisorName: string;
  score: number;
  /** Plain-English, explainable reasons this advisor fits. */
  reasons: string[];
  /** Plain-English cautions (e.g. already at capacity). */
  warnings: string[];
  activeCount: number;
  band: "HIGH" | "TYPICAL" | "LOW";
};

/** One spotlight card in a lane. Everything is pre-resolved + serializable. */
export type AdvisingCard = {
  id: string;
  lane: AdvisingLane;
  /** What the card is fundamentally about, so the client can wire actions. */
  studentId: string | null;
  studentName: string | null;
  advisorId: string | null;
  advisorName: string | null;
  assignmentId: string | null;
  recommendationId: string | null;

  /** Concrete status label + tone (e.g. "Kickoff needed"). */
  statusLabel: string;
  statusTone: AdvisingTone;
  /** Left-rail urgency accent. */
  accentTone: AdvisingTone;

  title: string;
  subtitle: string | null;
  /** "Why this card appears" — always present, always plain English. */
  why: string;
  /** Program / class / interest context, when known. */
  context: string | null;
  /** Last advising interaction line, when known. */
  metaLine: string | null;
  /** The single recommended next action, phrased as a sentence. */
  nextAction: string;

  primaryAction: AdvisingCardAction;
  secondaryActions: AdvisingCardAction[];

  /** Present on suggested-match cards. */
  suggestion: AdvisorMatchSuggestion | null;
};

export type AdvisingBriefingChip = {
  key: string;
  label: string;
  count: number;
  tone: AdvisingTone;
  /** Which lane this chip jumps to. */
  lane: AdvisingLane | null;
};

export type AdvisingLaneView = {
  lane: AdvisingLane;
  label: string;
  /** One-line description of what belongs in the lane. */
  blurb: string;
  cards: AdvisingCard[];
  total: number;
  /** Action-oriented empty-state copy for when the lane is clear. */
  emptyTitle: string;
  emptyBody: string;
};

export type AdvisingCockpit = {
  briefing: AdvisingBriefingChip[];
  lanes: AdvisingLaneView[];
  /** Total surfaced situations (for the hero subtitle). */
  totalSituations: number;
  generatedAtISO: string;
};

// ── Loader input shapes (DB → pure selector) ───────────────────────────────

export type AdvisingAssignmentRow = {
  assignmentId: string;
  isActive: boolean;
  advisingStatus: "ENGAGED" | "NEEDS_ATTENTION" | "INACTIVE" | "READY_FOR_NEXT";
  needsFollowUp: boolean;
  followUpNote: string | null;
  nextSteps: string | null;
  lastCheckInAt: Date | null;
  nextCheckInDueAt: Date | null;
  startDate: Date;
  endedAt: Date | null;
  studentId: string;
  studentName: string;
  studentInterests: string[];
  studentGrade: number | null;
  studentChapterName: string | null;
  advisorId: string;
  advisorName: string;
  noteCount: number;
  recommendationCount: number;
  /** Pending (SUGGESTED) recommendations on this assignment, newest first. */
  pendingRecommendations: AdvisingRecommendationRow[];
};

export type AdvisingRecommendationRow = {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  advisorId: string;
  advisorName: string;
  kind: string;
  title: string;
  detail: string | null;
  createdAt: Date;
};

export type AdvisingStudentRow = {
  id: string;
  name: string;
  interests: string[];
  grade: number | null;
  chapterId: string | null;
  chapterName: string | null;
};

export type AdvisingAdvisorRow = {
  id: string;
  name: string;
  interests: string[];
  chapterId: string | null;
  chapterName: string | null;
  activeCount: number;
  band: "HIGH" | "TYPICAL" | "LOW";
  health: "ACTIVE" | "STALE" | "INACTIVE";
  needsFollowUpCount: number;
  lastCheckInAt: Date | null;
};

export type AdvisingCockpitInput = {
  assignments: AdvisingAssignmentRow[];
  unadvisedStudents: AdvisingStudentRow[];
  advisors: AdvisingAdvisorRow[];
  /** Precomputed suggestions for each unadvised student (top few). */
  suggestionsByStudent: Record<string, AdvisorMatchSuggestion[]>;
};
