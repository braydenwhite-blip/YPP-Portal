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

export type LifecyclePov = "me" | "mentor" | "committee" | "leadership";

export type LifecycleSnapshot = {
  /** Relationship */
  hasActiveMentorship: boolean;
  mentorshipStatus: string | null; // ACTIVE | PAUSED | COMPLETE | null
  kickoffComplete: boolean;
  cycleStage: MentorshipCycleStage | null;
  mentorName: string | null;
  chairName?: string | null;
  /** Goals — the G&R document state ("NONE" when no doc exists). */
  grDocStatus: "NONE" | "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "ARCHIVED";
  /** Current review cycle */
  cycleLabel: string | null;
  /** The reflection currently driving the monthly cycle, when one exists. */
  activeReflectionId?: string | null;
  /** The assigned mentor has recorded the cycle-bound conversation. */
  mentorCheckInComplete?: boolean;
  reflectionOverdue: boolean;
  /** Latest released review that the mentee has not yet reacted to. */
  releasedReviewPendingAck: boolean;
  /** Whether this pairing routes reviews through a chair. */
  requiresChairApproval: boolean;
  /** At least one active Role Chair can receive and decide this lane's packet. */
  hasRoleChair?: boolean;
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
  /**
   * Quarterly Committee Review — true once every 3rd cycle's monthly review
   * has been released. Layers on top of the monthly flow rather than
   * gating it; see deriveNextAction below for how it dominates once due.
   */
  quarterlyDue: boolean;
  /** Null when no MentorshipQuarterlyReview row exists yet for the due quarter. */
  quarterlyStatus:
    | "DRAFT"
    | "PENDING_CHAIR_APPROVAL"
    | "CHANGES_REQUESTED"
    | "PENDING_BOARD_APPROVAL"
    | "APPROVED"
    | null;
  /** Whether the in-flight (or approved) quarterly review needs Board sign-off. */
  quarterlyRequiresBoardApproval: boolean;
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
  isCommitteeMember?: boolean;
  canRecordCheckIn: boolean;
}): ReviewCapabilities {
  const {
    isSelf,
    isAdmin,
    isMentor,
    isChair,
    isLeadership,
    isCommitteeMember = false,
    canRecordCheckIn,
  } = args;
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
    // Visibility gate for the whole quarterly packet — mentor, chair,
    // leadership, admin (never the mentee; quarterly is committee-internal
    // deliberation, not released to them the way a monthly review is).
    canRunQuarterlyReview:
      isReviewer || isApprover || isCommitteeMember || isLeadership,
    canRecommendPathwayDecision: isReviewer || isCommitteeMember || isLeadership,
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
    | "await-goals"
    | "assign-role-chair"
    | "await-role-chair"
    | "submit-reflection"
    | "await-reflection"
    | "record-mentor-check-in"
    | "await-mentor-check-in"
    | "write-review"
    | "revise-review"
    | "await-review-revision"
    | "approve-review"
    | "await-approval"
    | "acknowledge-review"
    | "await-acknowledgment"
    | "start-quarterly-review"
    | "await-quarterly-start"
    | "revise-quarterly-review"
    | "approve-quarterly-review"
    | "await-quarterly-approval"
    | "board-approve-quarterly-review"
    | "await-board-approval"
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
  /** The cycle-bound Mentor Check-in composer. */
  recordMentorCheckIn: string;
  /** Admin matching lane (assign a mentor). */
  adminMatching: string;
  /** Admin G&R lane (assign goals). */
  adminGoals: string;
  /** Chair review inbox. */
  reviewInbox: string;
};

/**
 * `/mentorship/people/[id]` is the canonical destination for a person's whole Review &
 * G&R flow — every href the lifecycle engine bakes into `nextAction`/
 * `cycleStrip`/`cycleState` points there (with a `?panel=` for the
 * draft/approve in-page panels), never at the old `/mentorship/*` routes.
 */
export function defaultLifecycleHrefs(menteeId: string): LifecycleHrefs {
  const base = `/mentorship/people/${menteeId}`;
  return {
    section: (sectionId) => `${base}?section=${sectionId}`,
    writeReview: `${base}?section=reviews&panel=draft`,
    recordMentorCheckIn: `${base}?section=check-ins&panel=cycle-check-in`,
    adminMatching: `${base}?panel=setup`,
    adminGoals: `${base}?section=goals`,
    reviewInbox: `${base}?section=reviews&panel=approve`,
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
    if (snapshot.mentorshipStatus === "PAUSED") {
      if (pov === "leadership") {
        return {
          key: "resume-or-close",
          label: "Review relationship status",
          href: hrefs.section("overview"),
          reason: "The mentorship is paused.",
          urgent: false,
        };
      }
      return {
        key: "await-pairing",
        label: "Mentorship paused",
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
        reason:
          snapshot.mentorshipStatus === "COMPLETE"
            ? `${personName}'s previous mentorship is complete and there is no active pairing.`
            : `${personName} has no active mentorship.`,
        urgent: false,
      };
    }
    if (snapshot.mentorshipStatus === "COMPLETE") {
      return {
        key: "await-pairing",
        label: "Previous mentorship complete",
        href: null,
        reason: null,
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
        label: `Waiting on ${mentor} for your first meeting`,
        href: hrefs.section("check-ins"),
        reason: null,
        urgent: false,
      };
    }
    if (pov === "committee") {
      return {
        key: "await-kickoff",
        label: "Waiting on the first meeting",
        href: hrefs.section("overview"),
        reason: null,
        urgent: false,
      };
    }
    return {
      key: "schedule-kickoff",
      label: "Have the first meeting",
      href: hrefs.section("check-ins"),
      reason: null,
      urgent: true,
    };
  }

  // ── Goals (mentor or leadership assigns G&R) ──────────────────────────────
  if (snapshot.grDocStatus === "NONE") {
    if (pov === "leadership" || pov === "mentor") {
      return {
        key: "assign-goals",
        label: "Set up goals",
        href: hrefs.adminGoals,
        reason: `${personName} does not have goals yet.`,
        urgent: false,
      };
    }
    return {
      key: "await-goals",
      label: "Waiting for goals",
      href: hrefs.section("goals"),
      reason: "Your mentor will set these up.",
      urgent: false,
    };
  }

  // ── Role Chair (required before a cycle can be submitted) ─────────────────
  if (snapshot.requiresChairApproval && snapshot.hasRoleChair === false) {
    if (pov === "leadership") {
      return {
        key: "assign-role-chair",
        label: "Assign the Role Chair",
        href: hrefs.adminGoals,
        reason: `${personName}'s lane has no active Role Chair.`,
        urgent: false,
      };
    }
    return {
      key: "await-role-chair",
      label: "Waiting for Role Chair setup",
      href: null,
      reason: "Leadership owns this setup step.",
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
          label: cycle ? `Share your ${snapshot.cycleLabel} note` : "Share your monthly note",
          href: hrefs.section("reviews"),
          reason: snapshot.reflectionOverdue
            ? "A short note is overdue."
            : "Three short answers for your mentor.",
          urgent: snapshot.reflectionOverdue,
        };
      }
      // Mentor/leadership: reflection is on the mentee; their actionable work
      // is follow-through (handled below) — fall through.
      break;
    case "REFLECTION_SUBMITTED":
      if (!snapshot.mentorCheckInComplete) {
        if (pov === "mentor") {
          return {
            key: "record-mentor-check-in",
            label: "Log that you met",
            href: hrefs.recordMentorCheckIn,
            reason: `${personName} sent a note — mark that you talked, then send feedback.`,
            urgent: true,
          };
        }
        return {
          key: "await-mentor-check-in",
          label:
            pov === "me"
              ? `Meet with ${mentor}`
              : "Waiting on a meeting",
          href: hrefs.section("check-ins"),
          reason: "Log the meeting before sending feedback.",
          urgent: false,
        };
      }
      if (pov === "mentor") {
        return {
          key: "write-review",
          label: "Send feedback",
          href: hrefs.writeReview,
          reason: `Write a short note for ${personName}.`,
          urgent: true,
        };
      }
      if (pov === "me") {
        return {
          key: "await-reflection",
          label: "Your note is in — waiting on your mentor",
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
          label: "Fix and resend feedback",
          href: hrefs.writeReview,
          reason: "The chair asked for a tweak.",
          urgent: true,
        };
      }
      return {
        key: "await-review-revision",
        label:
          pov === "me"
            ? "Your mentor is updating your feedback"
            : "Waiting on the mentor to resend",
        href: hrefs.section("reviews"),
        reason: "The chair asked for changes before sharing.",
        urgent: false,
      };
    case "REVIEW_SUBMITTED":
      if (pov === "leadership") {
        return {
          key: "approve-review",
          label: "Approve and share feedback",
          href: hrefs.reviewInbox,
          reason: `${personName}'s feedback is ready to share.`,
          urgent: true,
        };
      }
      if (pov === "mentor") {
        return {
          key: "await-approval",
          label: "Feedback is with the chair",
          href: hrefs.section("reviews"),
          reason: null,
          urgent: false,
        };
      }
      break;
    default:
      break;
  }

  // ── Quarterly Committee Review ────────────────────────────────────────────
  // Every 3rd cycle, once that cycle's monthly review has been released, a
  // quarterly layer dominates until the committee's Pathway Decision (if any)
  // is approved. Mentees have no action here — the doc's quarterly step is
  // committee-internal; a mentee only ever sees its eventual outcome (a
  // promotion, award, etc.) through the normal channels, not this flow.
  if (snapshot.quarterlyDue && snapshot.quarterlyStatus !== "APPROVED") {
    if (snapshot.quarterlyStatus === null || snapshot.quarterlyStatus === "DRAFT") {
      if (pov === "mentor" || pov === "committee") {
        return {
          key: "start-quarterly-review",
          label:
            pov === "committee"
              ? "Continue the quarterly committee review"
              : "Start the quarterly committee review",
          href: hrefs.section("reviews"),
          reason: `${personName}'s quarterly review is due — gather feedback and summarize the last 3 reviews.`,
          urgent: true,
        };
      }
      if (pov === "leadership") {
        return {
          key: "await-quarterly-start",
          label: "Quarterly review not started",
          href: hrefs.section("reviews"),
          reason: `${personName}'s mentor hasn't started the quarterly review yet.`,
          urgent: false,
        };
      }
    } else if (snapshot.quarterlyStatus === "CHANGES_REQUESTED") {
      if (pov === "mentor") {
        return {
          key: "revise-quarterly-review",
          label: "Revise the quarterly review",
          href: hrefs.section("reviews"),
          reason: "The chair requested changes to the quarterly packet.",
          urgent: true,
        };
      }
    } else if (snapshot.quarterlyStatus === "PENDING_CHAIR_APPROVAL") {
      if (pov === "leadership") {
        return {
          key: "approve-quarterly-review",
          label: "Review the quarterly committee packet",
          href: hrefs.section("reviews"),
          reason: `${personName}'s quarterly review is waiting on the committee.`,
          urgent: true,
        };
      }
      if (pov === "mentor") {
        return {
          key: "await-quarterly-approval",
          label: "Quarterly review with the committee",
          href: hrefs.section("reviews"),
          reason: null,
          urgent: false,
        };
      }
    } else if (snapshot.quarterlyStatus === "PENDING_BOARD_APPROVAL") {
      if (pov === "leadership") {
        return {
          key: "board-approve-quarterly-review",
          label: "Board sign-off needed",
          href: hrefs.section("reviews"),
          reason: `${personName}'s Pathway Decision needs Board approval.`,
          urgent: true,
        };
      }
      if (pov === "mentor") {
        return {
          key: "await-board-approval",
          label: "Pathway Decision with the Board",
          href: hrefs.section("reviews"),
          reason: null,
          urgent: false,
        };
      }
    }
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
  key: "reflection" | "check-in" | "review" | "approval" | "released" | "acknowledged";
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

  type StageIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;
  // 0 = reflection pending, 1 = mentor check-in pending, 2 = progress update
  // pending, 3 = approval pending, 4 = release pending, 5 = ack pending,
  // 6 = complete.
  let index: StageIndex;
  switch (snapshot.cycleStage) {
    case "REFLECTION_DUE":
      index = 0;
      break;
    case "REFLECTION_SUBMITTED":
      index = snapshot.mentorCheckInComplete ? 2 : 1;
      break;
    case "CHANGES_REQUESTED":
      index = 2;
      break;
    case "REVIEW_SUBMITTED":
      index = 3;
      break;
    case "APPROVED":
      index = snapshot.releasedReviewPendingAck ? 5 : 6;
      break;
    default:
      index = 0;
      break;
  }

  const steps: Array<{ key: CycleStripStep["key"]; label: string; at: StageIndex; detail: string }> = [
    { key: "reflection", label: "Their note", at: 0, detail: `Waiting on ${mentee}` },
    { key: "check-in", label: "Meet", at: 1, detail: `Waiting on ${mentor}` },
    {
      key: "review",
      label: "Feedback",
      at: 2,
      detail:
        snapshot.cycleStage === "CHANGES_REQUESTED"
          ? `Back with ${mentor} for a tweak`
          : `Waiting on ${mentor}`,
    },
    { key: "approval", label: "Share", at: 3, detail: "Chair is reviewing" },
    { key: "released", label: "Shared", at: 4, detail: "About to be shared" },
    { key: "acknowledged", label: "Seen", at: 5, detail: `Waiting on ${mentee}` },
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
  "record-mentor-check-in",
  "write-review",
  "revise-review",
  "approve-review",
  "acknowledge-review",
  "start-quarterly-review",
  "revise-quarterly-review",
  "approve-quarterly-review",
  "board-approve-quarterly-review",
]);

function ownerRoleForPov(pov: LifecyclePov, actionKey: LifecycleNextAction["key"]): CycleOwnerRole {
  if (pov === "me") return "subject";
  if (pov === "mentor") return "writer";
  return actionKey === "approve-review" ||
    actionKey === "approve-quarterly-review" ||
    actionKey === "board-approve-quarterly-review"
    ? "approver"
    : "leadership";
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

  const blockingReason = !snapshot.hasActiveMentorship ? "No mentor yet" : null;

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
    if (snapshot.cycleStage === "REFLECTION_SUBMITTED" && !snapshot.mentorCheckInComplete) {
      availableActions.push("record-mentor-check-in");
    }
    if (snapshot.cycleStage === "REFLECTION_SUBMITTED" && snapshot.mentorCheckInComplete) {
      availableActions.push("write-review");
    }
    if (snapshot.cycleStage === "CHANGES_REQUESTED") availableActions.push("revise-review");
  }
  if (capabilities.canApprove && snapshot.cycleStage === "REVIEW_SUBMITTED") {
    availableActions.push("approve-review");
  }
  if (snapshot.quarterlyDue && snapshot.quarterlyStatus !== "APPROVED") {
    if (
      capabilities.canRecommendPathwayDecision &&
      (snapshot.quarterlyStatus === null ||
        snapshot.quarterlyStatus === "DRAFT" ||
        snapshot.quarterlyStatus === "CHANGES_REQUESTED")
    ) {
      availableActions.push(
        snapshot.quarterlyStatus === "CHANGES_REQUESTED"
          ? "revise-quarterly-review"
          : "start-quarterly-review"
      );
    }
    if (capabilities.canApprovePathwayDecision && snapshot.quarterlyStatus === "PENDING_CHAIR_APPROVAL") {
      availableActions.push("approve-quarterly-review");
    }
    if (capabilities.canApprovePathwayDecision && snapshot.quarterlyStatus === "PENDING_BOARD_APPROVAL") {
      availableActions.push("board-approve-quarterly-review");
    }
  }

  return {
    stage: snapshot.cycleStage,
    commentsSubstate,
    completedSteps: buildCycleStrip(snapshot, owningPov, personName),
    nextAction: {
      ...owningAction,
      ownerRole: ownerRoleForPov(owningPov, owningAction.key),
      ownerName:
        owningPov === "mentor"
          ? snapshot.mentorName
          : owningPov === "me"
            ? personName
            : owningAction.key === "approve-review" ||
                owningAction.key === "approve-quarterly-review"
              ? snapshot.chairName ?? null
            : null,
    },
    blockingReason,
    availableActions,
  };
}
