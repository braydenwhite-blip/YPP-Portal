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
};

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

export function defaultLifecycleHrefs(menteeId: string): LifecycleHrefs {
  const base = `/mentorship/people/${menteeId}`;
  return {
    section: (sectionId) => `${base}?section=${sectionId}`,
    writeReview: `/mentorship/reviews/${menteeId}`,
    adminMatching: "/mentorship?view=admin&tab=assignments",
    adminGoals: "/mentorship?view=admin&tab=templates",
    reviewInbox: "/mentorship/reviews",
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
