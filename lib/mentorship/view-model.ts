import type {
  GoalProgressState,
  GoalRatingColor,
  MentorshipActionItemStatus,
  MentorshipCycleStage,
  MentorshipRequestStatus,
  MentorshipSessionType,
  MentorshipStatus,
} from "@prisma/client";

import type { QueueInline } from "@/lib/queue/types";

/**
 * Canonical mentorship view-model (Calm Mentorship, Phase 1).
 *
 * A single, pure, serializable shape that every Calm and Executive mentorship
 * surface consumes, so no surface re-derives mentorship state. The selectors in
 * `./selectors` build this from already-fetched canonical data (the loader maps
 * Prisma rows → the *Fact inputs below). This module is types-only: no Prisma
 * client, no server imports, so it stays trivially unit-testable.
 */

// --- output: the view-model -------------------------------------------------

export type MentorshipRole = "mentor" | "mentee" | "chair" | "admin" | "none";

export type MentorshipFocusKind =
  | "kickoff"
  | "reflection"
  | "review"
  | "chair_approval"
  | "changes_requested"
  | "session"
  | "commitment"
  | "feedback"
  | "support";

export type MentorshipFocusTone = "brand" | "success" | "attention";

/** The viewer's overall standing in mentorship, used for routing + nav. */
export type CurrentUserRole = {
  /** The single dominant role (admin > mentor > chair > mentee). */
  role: MentorshipRole;
  /** Every role the viewer holds across their relationships. */
  roles: MentorshipRole[];
  /** Holds both a mentor and a mentee role (show cross-links). */
  isDualRole: boolean;
};

export type MentorshipRelationshipSummary = {
  id: string;
  mentorId: string;
  mentorName: string;
  menteeId: string;
  menteeName: string;
  /** The viewer's role *for this relationship*. */
  viewerRole: MentorshipRole;
  status: MentorshipStatus;
  cycleStage: MentorshipCycleStage;
  cycleNumber: number;
  /** Latest RELEASED review color only — never an unreleased draft. */
  colorStatus: GoalRatingColor | null;
  href: string;
};

/** The single calm "next move" for the viewer. */
export type NextMentorshipFocus = {
  kind: MentorshipFocusKind;
  relationshipId: string | null;
  title: string;
  reason: string;
  ctaLabel: string;
  ctaHref: string;
  tone: MentorshipFocusTone;
  /** Inline queue capability — wired in Phase 10; null until then. */
  inline: QueueInline | null;
};

export type SessionSummary = {
  id: string;
  relationshipId: string | null;
  type: MentorshipSessionType;
  title: string;
  whenISO: string;
  status: "upcoming" | "completed" | "cancelled";
  href: string;
};

export type ActiveGoal = {
  id: string;
  relationshipId: string | null;
  title: string;
  color: GoalRatingColor | null;
  progressState: GoalProgressState;
  dueISO: string | null;
};

export type UnresolvedCommitment = {
  id: string;
  relationshipId: string | null;
  title: string;
  status: MentorshipActionItemStatus;
  ownerId: string | null;
  ownerName: string | null;
  dueISO: string | null;
};

export type PendingFeedback = {
  id: string;
  relationshipId: string | null;
  kind: string;
  requestedISO: string;
  href: string;
};

export type QueueCapability = {
  canResolveInline: boolean;
  inline: QueueInline | null;
};

export type MentorshipPermissions = {
  canViewPrivateNotes: boolean;
  canRequestFeedback: boolean;
  canRespondFeedback: boolean;
  canUpdateGoals: boolean;
  canCreateCommitment: boolean;
  canScheduleSession: boolean;
  canCompleteSession: boolean;
  canAssign: boolean;
  canReassign: boolean;
};

export type MentorshipViewModel = {
  role: CurrentUserRole;
  relationships: MentorshipRelationshipSummary[];
  focus: NextMentorshipFocus | null;
  sessions: SessionSummary[];
  goals: ActiveGoal[];
  commitments: UnresolvedCommitment[];
  pendingFeedback: PendingFeedback[];
  permissions: MentorshipPermissions;
};

// --- input: normalized facts the loader provides ----------------------------

export type MentorshipViewerContext = {
  userId: string;
  /** Holds an ADMIN role (program-wide oversight). */
  isAdmin: boolean;
  /** Is a committee chair in any in-scope lane. */
  isChair: boolean;
};

export type MentorshipSessionFact = {
  id: string;
  type: MentorshipSessionType;
  title: string;
  scheduledISO: string;
  completedISO: string | null;
  cancelledISO: string | null;
};

export type MentorshipGoalFact = {
  id: string;
  title: string;
  color: GoalRatingColor | null;
  progressState: GoalProgressState;
  dueISO: string | null;
};

export type MentorshipCommitmentFact = {
  id: string;
  title: string;
  status: MentorshipActionItemStatus;
  ownerId: string | null;
  ownerName: string | null;
  dueISO: string | null;
};

export type MentorshipFeedbackFact = {
  id: string;
  kind: string;
  requestedISO: string;
  awaitingResponse: boolean;
  /** Who must respond (drives the viewer's "respond" focus). */
  responderId: string | null;
};

export type MentorshipSupportFact = {
  id: string;
  title: string;
  status: MentorshipRequestStatus;
  assignedToId: string | null;
  requesterId: string;
};

/**
 * One relationship, with the per-cycle work signals already computed by the
 * loader from canonical models (Mentorship, MonthlySelfReflection,
 * MentorGoalReview, GRDocumentGoal, MentorshipActionItem, …). `cycleNumber` is
 * authoritative; `cycleStage` is the denormalized kanban hint.
 */
export type MentorshipRelationshipFact = {
  id: string;
  mentorId: string;
  mentorName: string;
  menteeId: string;
  menteeName: string;
  chairId: string | null;
  status: MentorshipStatus;
  cycleStage: MentorshipCycleStage;
  cycleNumber: number;
  /** Latest RELEASED review color (mentee-safe); null if none released. */
  releasedColorStatus: GoalRatingColor | null;
  kickoffCompleted: boolean;
  reflectionDue: boolean;
  /** Reflection is in; mentor still needs to log the meeting. */
  meetingDue: boolean;
  reviewDue: boolean;
  reviewPendingChairApproval: boolean;
  reviewChangesRequested: boolean;
  lastActivityISO: string | null;
  sessions: MentorshipSessionFact[];
  goals: MentorshipGoalFact[];
  commitments: MentorshipCommitmentFact[];
  feedback: MentorshipFeedbackFact[];
  support: MentorshipSupportFact[];
};

export type MentorshipViewModelInput = {
  viewer: MentorshipViewerContext;
  relationships: MentorshipRelationshipFact[];
};
