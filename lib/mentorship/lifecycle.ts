import type { MentorshipCycleStage } from "@prisma/client";

/**
 * The canonical Mentorship lifecycle engine.
 *
 * Mentorship is one lifecycle — relationship → goals → check-ins →
 * reflection/review → follow-up → continued progress — and every surface
 * (mentee, mentor, leadership) is a different view of the same state. This
 * module is the single place that turns a lifecycle snapshot into "what
 * happens next" for a given point of view, and into the plain-language cycle
 * strip the Reviews section renders. Pure functions only: the workspace
 * loader (lib/mentorship/workspace.ts) gathers the snapshot.
 *
 * Stage state reuses the denormalized `Mentorship.cycleStage` (see
 * lib/mentorship-cycle.ts `computeCycleStage`); this module layers the
 * relationship, goals, acknowledgment, and follow-up dimensions on top and
 * keeps every verb per-POV so no surface invents its own next-action logic.
 */

export type LifecyclePov = "me" | "mentor" | "leadership";

export type LifecycleSnapshot = {
  /** Relationship */
  hasActiveMentorship: boolean;
  mentorshipStatus: string | null; // ACTIVE | PAUSED | COMPLETE | null
  kickoffComplete: boolean;
  cycleStage: MentorshipCycleStage | null;
  mentorName: string | null;
  /** Goals — the G&R document state ("NONE" when no doc exists). */
  grDocStatus: "NONE" | "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "ARCHIVED";
  /** Current review cycle */
  cycleLabel: string | null;
  reflectionOverdue: boolean;
  /** Latest released review that the mentee has not yet reacted to. */
  releasedReviewPendingAck: boolean;
  /** Whether this pairing routes reviews through a chair. */
  requiresChairApproval: boolean;
  /** Follow-through */
  overdueFollowUpLabel: string | null; // e.g. "Follow-up was due Jun 12, 2026"
  openActionItems: number;
  overdueActionItems: number;
  lastCheckInLabel: string | null; // e.g. "Jun 3, 2026"
  /**
   * Collaborator comment-request status (FeedbackRequest rows) for the
   * active cycle. This is a live-computed DIMENSION, never a gate — leadership
   * can draft/synthesize at any point regardless of how many are outstanding.
   * All zero when no comments have been requested for this cycle.
   */
  commentsRequested: number;
  commentsSubmitted: number;
  commentsOverdue: number;
};

/**
 * What a viewer can actually DO in the Review & G&R flow for this person,
 * derived once from the facts resolveWorkspaceAccess() gathers
 * (isSelf/isMentor/isChair/isLeadership/isAdmin). Capabilities union rather
 * than forcing a viewer into one mutually-exclusive tier — someone can be
 * Leadership AND the assigned chair AND (elsewhere) a collaborator, and a
 * single enum tier can't represent that without picking a wrong "winner".
 */
export type ReviewCapabilities = {
  /** Sees the reflection itself (the subject's answers), not just its status. */
  canViewReflection: boolean;
  /** Sees raw collaborator comments — never true for the subject themselves. */
  canViewPrivateComments: boolean;
  canRequestComments: boolean;
  canDraftReview: boolean;
  canRateCompetencies: boolean;
  /** Assigned-chair (or admin) approval authority for THIS person's review. */
  canApprove: boolean;
  /** Approval and release are one atomic action in this codebase today. */
  canRelease: boolean;
  canViewReleasedReview: boolean;
  canLogCheckIn: boolean;
  /** Chair-only recalibration of the mentor's proposed Character & Culture bonus points on THIS review — the same authority as canApprove, named for what it does. */
  canCalibratePoints: boolean;
  /** Committee member (chair, mentor-on-committee, leadership, admin) can open/participate in this person's quarterly committee review. */
  canRunQuarterlyReview: boolean;
  /** Mentor/committee member can propose a Pathway Decision as part of a quarterly review. */
  canRecommendPathwayDecision: boolean;
  /** Chair (or admin/leadership for org-level decisions) can finalize a Pathway Decision. */
  canApprovePathwayDecision: boolean;
};

export function deriveReviewCapabilities(args: {
  isSelf: boolean;
  isAdmin: boolean;
  isMentor: boolean;
  isChair: boolean;
  isLeadership: boolean;
  canRecordCheckIn: boolean;
}): ReviewCapabilities {
  const { isSelf, isAdmin, isMentor, isChair, isLeadership, canRecordCheckIn } = args;
  const isReviewer = isMentor || isAdmin;
  const isApprover = isChair || isAdmin;
  return {
    canViewReflection: isSelf || isMentor || isChair || isLeadership || isAdmin,
    // Raw collaborator comments are private to leadership — never the subject,
    // and not automatically to a plain assigned mentor/chair either.
    canViewPrivateComments: isLeadership || isAdmin,
    canRequestComments: isLeadership || isAdmin,
    canDraftReview: isReviewer,
    canRateCompetencies: isReviewer,
    canApprove: isApprover,
    canRelease: isApprover,
    canViewReleasedReview: isSelf || isMentor || isChair || isLeadership || isAdmin,
    canLogCheckIn: canRecordCheckIn,
    canCalibratePoints: isApprover,
    canRunQuarterlyReview: isApprover || isLeadership,
    canRecommendPathwayDecision: isReviewer || isLeadership,
    canApprovePathwayDecision: isApprover || isLeadership,
  };
}

export type LifecycleNextAction = {
  /** Stable identifier — tests and telemetry key off this, never the label. */
  key:
    | "assign-mentor"
    | "await-pairing"
    | "resume-or-close"
    | "schedule-kickoff"
    | "await-kickoff"
    | "assign-goals"
    | "submit-reflection"
    | "await-reflection"
    | "write-review"
    | "revise-review"
    | "approve-review"
    | "await-approval"
    | "acknowledge-review"
    | "await-acknowledgment"
    | "close-follow-up"
    | "log-check-in"
    | "all-caught-up";
  label: string;
  href: string | null;
  reason: string | null;
  urgent: boolean;
};

export type LifecycleHrefs = {
  /** Builds a workspace section URL for this person (host decides the shape). */
  section: (sectionId: "overview" | "goals" | "check-ins" | "reviews") => string;
  /** The mentor's review-authoring page for this mentee. */
  writeReview: string;
  /** Admin matching lane (assign a mentor). */
  adminMatching: string;
  /** Admin G&R lane (assign goals). */
  adminGoals: string;
  /** Chair review inbox. */
  reviewInbox: string;
};

/**
 * `/people/[id]` is the canonical destination for a person's whole Review &
 * G&R flow — every href the lifecycle engine bakes into `nextAction`/
 * `cycleStrip`/`cycleState` points there (with a `?panel=` for the
 * draft/approve in-page panels), never at the old `/mentorship/*` routes.
 */
export function defaultLifecycleHrefs(menteeId: string): LifecycleHrefs {
  const base = `/people/${menteeId}`;
  return {
    section: (sectionId) => `${base}?section=${sectionId}`,
    writeReview: `${base}?section=review&panel=draft`,
    adminMatching: "/mentorship?view=admin&tab=assignments",
    adminGoals: "/mentorship?view=admin&tab=templates",
    reviewInbox: `${base}?section=review&panel=approve`,
  };
}

/**
 * The one canonical "what happens next" — same state, different verb per
 * viewer. Returns at most one action; calm surfaces show one thing.
 */
export function deriveNextAction(
  snapshot: LifecycleSnapshot,
  pov: LifecyclePov,
  hrefs: LifecycleHrefs,
  personName = "this person"
): LifecycleNextAction {
  const mentor = snapshot.mentorName ?? "your mentor";

  // ── Relationship ──────────────────────────────────────────────────────────
  if (!snapshot.hasActiveMentorship) {
    if (snapshot.mentorshipStatus === "PAUSED" || snapshot.mentorshipStatus === "COMPLETE") {
      if (pov === "leadership") {
        return {
          key: "resume-or-close",
          label: "Review relationship status",
          href: hrefs.section("overview"),
          reason:
            snapshot.mentorshipStatus === "PAUSED"
              ? "The mentorship is paused."
              : "The mentorship is complete.",
          urgent: false,
        };
      }
      return {
        key: "await-pairing",
        label: snapshot.mentorshipStatus === "PAUSED" ? "Mentorship paused" : "Mentorship complete",
        href: null,
        reason: null,
        urgent: false,
      };
    }
    if (pov === "leadership") {
      return {
        key: "assign-mentor",
        label: "Assign a mentor",
        href: hrefs.adminMatching,
        reason: `${personName} has no active mentorship.`,
        urgent: false,
      };
    }
    return {
      key: "await-pairing",
      label: pov === "me" ? "You'll be paired with a mentor soon" : "No active mentorship",
      href: null,
      reason: null,
      urgent: false,
    };
  }

  // ── Kickoff ───────────────────────────────────────────────────────────────
  if (!snapshot.kickoffComplete) {
    if (pov === "me") {
      return {
        key: "await-kickoff",
        label: `Schedule your kickoff with ${mentor}`,
        href: hrefs.section("check-ins"),
        reason: "The kickoff meeting starts the review cycle.",
        urgent: false,
      };
    }
    return {
      key: "schedule-kickoff",
      label: "Hold the kickoff meeting",
      href: hrefs.section("check-ins"),
      reason: "Kickoff unlocks goals and the monthly review cycle.",
      urgent: true,
    };
  }

  // ── Goals (leadership owns G&R assignment) ────────────────────────────────
  if (pov === "leadership" && snapshot.grDocStatus === "NONE") {
    return {
      key: "assign-goals",
      label: "Assign G&R goals",
      href: hrefs.adminGoals,
      reason: `${personName} has no Goals & Responsibilities document yet.`,
      urgent: false,
    };
  }

  // ── The review cycle ──────────────────────────────────────────────────────
  const cycle = snapshot.cycleLabel ? ` ${snapshot.cycleLabel}` : "";
  switch (snapshot.cycleStage) {
    case "REFLECTION_DUE":
      if (pov === "me") {
        return {
          key: "submit-reflection",
          label: `Submit your${cycle} reflection`,
          href: hrefs.section("reviews"),
          reason: snapshot.reflectionOverdue
            ? "The reflection window is closing."
            : "Your reflection starts this month's review.",
          urgent: snapshot.reflectionOverdue,
        };
      }
      // Mentor/leadership: reflection is on the mentee; their actionable work
      // is follow-through (handled below) — fall through.
      break;
    case "REFLECTION_SUBMITTED":
      if (pov === "mentor") {
        return {
          key: "write-review",
          label: "Write this month's review",
          href: hrefs.writeReview,
          reason: `${personName}'s reflection is in.`,
          urgent: true,
        };
      }
      if (pov === "me") {
        return {
          key: "await-reflection",
          label: "Reflection in — your mentor is writing your review",
          href: hrefs.section("reviews"),
          reason: null,
          urgent: false,
        };
      }
      break;
    case "CHANGES_REQUESTED":
      if (pov === "mentor") {
        return {
          key: "revise-review",
          label: "Revise your review",
          href: hrefs.writeReview,
          reason: "The chair requested changes.",
          urgent: true,
        };
      }
      break;
    case "REVIEW_SUBMITTED":
      if (pov === "leadership") {
        return {
          key: "approve-review",
          label: "Approve the review",
          href: hrefs.reviewInbox,
          reason: `${personName}'s${cycle} review is waiting on the chair.`,
          urgent: true,
        };
      }
      if (pov === "mentor") {
        return {
          key: "await-approval",
          label: "Review with the chair for approval",
          href: hrefs.section("reviews"),
          reason: null,
          urgent: false,
        };
      }
      break;
    default:
      break;
  }

  // ── Acknowledgment closes the loop ────────────────────────────────────────
  if (snapshot.releasedReviewPendingAck) {
    if (pov === "me") {
      return {
        key: "acknowledge-review",
        label: "Read and react to your review",
        href: hrefs.section("reviews"),
        reason: `${mentor} released your${cycle} review.`,
        urgent: false,
      };
    }
    if (pov === "mentor") {
      return {
        key: "await-acknowledgment",
        label: "Review released — waiting on their reaction",
        href: hrefs.section("reviews"),
        reason: null,
        urgent: false,
      };
    }
  }

  // ── Follow-through ────────────────────────────────────────────────────────
  if (snapshot.overdueActionItems > 0) {
    return {
      key: "close-follow-up",
      label:
        pov === "me"
          ? `Close out your overdue commitment${snapshot.overdueActionItems === 1 ? "" : "s"}`
          : `Close ${snapshot.overdueActionItems} overdue follow-up${snapshot.overdueActionItems === 1 ? "" : "s"}`,
      href: hrefs.section("check-ins"),
      reason: "Commitments from past conversations are past due.",
      urgent: true,
    };
  }
  if (snapshot.overdueFollowUpLabel && pov !== "me") {
    return {
      key: "close-follow-up",
      label: "Follow up now",
      href: hrefs.section("check-ins"),
      reason: snapshot.overdueFollowUpLabel,
      urgent: true,
    };
  }

  if (pov !== "me") {
    return {
      key: "log-check-in",
      label: "Log a check-in",
      href: hrefs.section("check-ins"),
      reason: snapshot.lastCheckInLabel
        ? `Last conversation ${snapshot.lastCheckInLabel}`
        : "No check-ins logged yet",
      urgent: false,
    };
  }

  return {
    key: "all-caught-up",
    label: "You're all caught up",
    href: null,
    reason: snapshot.lastCheckInLabel ? `Last check-in ${snapshot.lastCheckInLabel}` : null,
    urgent: false,
  };
}

/* ---------------------------- Cycle strip ---------------------------- */

export type CycleStripStep = {
  key: "reflection" | "review" | "approval" | "released" | "acknowledged";
  label: string;
  state: "done" | "current" | "upcoming";
  /** Plain-language "who moves next", only on the current step. */
  detail: string | null;
};

/**
 * The current cycle rendered as a plain-language lifecycle — Reflection →
 * Mentor review → Approval → Released → Acknowledged. No database words.
 */
export function buildCycleStrip(
  snapshot: LifecycleSnapshot,
  pov: LifecyclePov,
  personName = "the mentee"
): CycleStripStep[] {
  const mentee = pov === "me" ? "you" : personName;
  const mentor = pov === "mentor" ? "you" : (snapshot.mentorName ?? "the mentor");

  type StageIndex = 0 | 1 | 2 | 3 | 4 | 5;
  // 0 = reflection pending, 1 = review pending, 2 = approval pending,
  // 3 = release pending (approved, not yet visible), 4 = ack pending, 5 = done
  let index: StageIndex;
  switch (snapshot.cycleStage) {
    case "REFLECTION_DUE":
      index = 0;
      break;
    case "REFLECTION_SUBMITTED":
    case "CHANGES_REQUESTED":
      index = 1;
      break;
    case "REVIEW_SUBMITTED":
      index = 2;
      break;
    case "APPROVED":
      index = snapshot.releasedReviewPendingAck ? 4 : 5;
      break;
    default:
      index = 0;
      break;
  }

  const steps: Array<{ key: CycleStripStep["key"]; label: string; at: StageIndex; detail: string }> = [
    { key: "reflection", label: "Reflection", at: 0, detail: `Waiting on ${mentee}` },
    {
      key: "review",
      label: "Mentor review",
      at: 1,
      detail:
        snapshot.cycleStage === "CHANGES_REQUESTED"
          ? `Back with ${mentor} for changes`
          : `Waiting on ${mentor}`,
    },
    { key: "approval", label: "Approval", at: 2, detail: "With the chair for approval" },
    { key: "released", label: "Released", at: 3, detail: "About to be shared" },
    { key: "acknowledged", label: "Acknowledged", at: 4, detail: `Waiting on ${mentee} to react` },
  ];

  return steps
    .filter((s) => s.key !== "approval" || snapshot.requiresChairApproval)
    .map((s) => ({
      key: s.key,
      label: s.label,
      state: index > s.at ? "done" : index === s.at ? "current" : "upcoming",
      detail: index === s.at ? s.detail : null,
    }));
}

/* ---------------------------- Cycle state (single source of truth) ---------------------------- */

export type CycleOwnerRole = "subject" | "writer" | "approver" | "leadership";

export type CommentsSubstate = {
  requested: number;
  submitted: number;
  overdue: number;
};

export type CycleState = {
  stage: MentorshipCycleStage | null;
  /** Never a gate — comment collection can be at any point when a review is drafted/approved. */
  commentsSubstate: CommentsSubstate | null;
  completedSteps: CycleStripStep[];
  nextAction: LifecycleNextAction & { ownerRole: CycleOwnerRole; ownerName: string | null };
  blockingReason: string | null;
  availableActions: LifecycleNextAction["key"][];
};

/** Stage-critical action keys — the ones that mean "it's actually this party's turn", as opposed to ambient/always-available actions like "log-check-in". */
const STAGE_CRITICAL_KEYS = new Set<LifecycleNextAction["key"]>([
  "assign-mentor",
  "schedule-kickoff",
  "assign-goals",
  "submit-reflection",
  "write-review",
  "revise-review",
  "approve-review",
  "acknowledge-review",
]);

function ownerRoleForPov(pov: LifecyclePov, actionKey: LifecycleNextAction["key"]): CycleOwnerRole {
  if (pov === "me") return "subject";
  if (pov === "mentor") return "writer";
  return actionKey === "approve-review" ? "approver" : "leadership";
}

/**
 * The one deterministic "what happens next" for a review cycle — stage,
 * live comment-collection status, completed steps, the next action (with WHO
 * owns it), why it's blocked (if it is), and everything the viewer's
 * capabilities would additionally let them do right now. Consumed by
 * /people/[id], the chair queue, and the leadership cockpit alike so none of
 * them compute their own "what's next" independently.
 */
export function deriveCycleState(
  snapshot: LifecycleSnapshot,
  capabilities: ReviewCapabilities,
  hrefs: LifecycleHrefs,
  personName = "this person"
): CycleState {
  // Determine whose turn it actually is, independent of who's looking: try
  // each POV's action in priority order and take the first stage-critical one.
  const povsInPriority: LifecyclePov[] = ["me", "mentor", "leadership"];
  let owningPov: LifecyclePov = "leadership";
  let owningAction: LifecycleNextAction = deriveNextAction(snapshot, "leadership", hrefs, personName);
  for (const pov of povsInPriority) {
    const action = deriveNextAction(snapshot, pov, hrefs, personName);
    if (STAGE_CRITICAL_KEYS.has(action.key)) {
      owningPov = pov;
      owningAction = action;
      break;
    }
  }
  // No stage-critical action anywhere (follow-ups / ambient check-in state) —
  // fall back to whichever POV's action is flagged urgent, defaulting to
  // "leadership" as the generic owner of ambient follow-through.
  if (!STAGE_CRITICAL_KEYS.has(owningAction.key)) {
    const urgentPov = povsInPriority.find(
      (pov) => deriveNextAction(snapshot, pov, hrefs, personName).urgent
    );
    if (urgentPov) {
      owningPov = urgentPov;
      owningAction = deriveNextAction(snapshot, urgentPov, hrefs, personName);
    }
  }

  const blockingReason = !snapshot.hasActiveMentorship
    ? "No active mentorship"
    : !snapshot.kickoffComplete
      ? "Kickoff not held"
      : null;

  const commentsSubstate: CommentsSubstate | null =
    snapshot.commentsRequested > 0
      ? {
          requested: snapshot.commentsRequested,
          submitted: snapshot.commentsSubmitted,
          overdue: snapshot.commentsOverdue,
        }
      : null;

  const availableActions: LifecycleNextAction["key"][] = [];
  if (capabilities.canDraftReview) {
    if (snapshot.cycleStage === "REFLECTION_SUBMITTED") availableActions.push("write-review");
    if (snapshot.cycleStage === "CHANGES_REQUESTED") availableActions.push("revise-review");
  }
  if (capabilities.canApprove && snapshot.cycleStage === "REVIEW_SUBMITTED") {
    availableActions.push("approve-review");
  }

  return {
    stage: snapshot.cycleStage,
    commentsSubstate,
    completedSteps: buildCycleStrip(snapshot, owningPov, personName),
    nextAction: {
      ...owningAction,
      ownerRole: ownerRoleForPov(owningPov, owningAction.key),
      ownerName: owningPov === "mentor" ? snapshot.mentorName : null,
    },
    blockingReason,
    availableActions,
  };
}
