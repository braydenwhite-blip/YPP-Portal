import type { GoalRatingColor, GrowthTag } from "@prisma/client";

import { RATING_LABELS } from "@/lib/people-strategy/check-in-rating";
import {
  GROWTH_TAG_META,
  GROWTH_OPPORTUNITY_TAGS,
} from "@/lib/people-strategy/growth-signals";

import type { CycleDisplayState } from "./cycle-flow";

/**
 * Leadership Development — the signal engine (deterministic, testable).
 *
 * One decision model for developing the people who RUN YPP — instructors and
 * officers (chapter presidents, staff, team leads). Every person is reduced to
 * a set of concrete, evidence-backed signals ("Review overdue — no 2026-Q3
 * review", "Leads 2 teams · 3 overdue actions") and placed in exactly ONE
 * attention lane keyed off the most pressing thing leadership should do for
 * them. Pure functions only: no Prisma, no clock, no session — the loader in
 * `lib/development/load.ts` feeds shaped facts in.
 *
 * Presentation policy follows the People-Strategy master plan: every signal is
 * a concrete fact with its reason in the label — never a bare score or vague
 * health word. Privacy: this layer carries statuses, counts, and rating
 * colors only — never review comments or feedback bodies.
 */

// ── Thresholds ───────────────────────────────────────────────────────────────

/** Days without a check-in / mentorship session before "no recent check-in". */
export const NO_RECENT_TOUCH_DAYS = 35;
/** Someone in their first weeks is "new" — a missing mentor is more urgent. */
export const NEW_PERSON_DAYS = 60;
/** Open actions at/above this count an officer or instructor as heavily loaded. */
export const HEAVY_OPEN_ACTIONS = 6;
/** Teams led + committees chaired at/above this is a heavy leadership load. */
export const HEAVY_LEADERSHIP_ROLES = 3;
/** A touch within this many days counts as "recently supported". */
export const RECENTLY_SUPPORTED_DAYS = 14;
/** A monthly review waiting on chair approval longer than this is flagged. */
export const APPROVAL_WAITING_DAYS = 7;

// ── Facts (loader-shaped input) ──────────────────────────────────────────────

export type DevelopmentPopulation = "instructor" | "officer";

export type DevelopmentPersonFacts = {
  id: string;
  name: string;
  email: string;
  /** Primary role, e.g. "INSTRUCTOR" / "CHAPTER_PRESIDENT". */
  role: string | null;
  /** Human role line, e.g. "Chapter President · Scarsdale". */
  contextLabel: string | null;
  population: DevelopmentPopulation;
  daysSinceJoined: number;

  // Coaching / mentorship
  mentorName: string | null;
  /** This person's role is one the mentorship program pairs a mentor with. */
  mentorEligible: boolean;
  /** Days since their last completed mentorship session as a mentee. */
  daysSinceLastSession: number | null;

  // Monthly check-ins (People-Strategy CheckIn)
  /** Check-ins are being compiled for the current month (program started). */
  checkInAccountable: boolean;
  hasCurrentMonthCheckIn: boolean;
  lastCheckInRating: GoalRatingColor | null;
  /** "June" — month of the most recent compiled check-in. */
  lastCheckInMonthLabel: string | null;
  daysSinceLastCheckIn: number | null;

  // Reviews
  /** No quarterly review recorded for the current quarter. */
  reviewDue: boolean;
  hasAnyReview: boolean;
  lastReviewQuarter: string | null;
  lastReviewPerformance: GoalRatingColor | null;
  lastReviewPotential: GoalRatingColor | null;
  successionFlag: boolean;
  /** Latest released monthly mentor review's overall color (instructor lane). */
  lastMentorReviewRating: GoalRatingColor | null;
  /** Age in days of their oldest monthly review stuck in chair approval. */
  pendingChairReviewDays: number | null;

  // Load
  openActionCount: number;
  overdueActionCount: number;
  /** Open meeting follow-ups they own. */
  openFollowUpCount: number;
  teamsLeadingCount: number;
  committeesChairedCount: number;
  /** People they actively mentor (as the mentor). */
  activeMenteeCount: number;
  /** Mentor cap when they mentor in the full program, else null. */
  mentorCap: number | null;
  classesTeachingCount: number;

  // Growth
  growthTags: GrowthTag[];
  /** Meets Senior/Lead Instructor leadership expectations (instructor lane). */
  meetsSeniorExpectations: boolean;
  meetsLeadExpectations: boolean;

  /** The person's in-flight review cycle, when one exists. */
  activeReviewCycle: {
    id: string;
    displayState: CycleDisplayState;
  } | null;
};

/** Neutral defaults — loaders spread real values over this. */
export const EMPTY_DEVELOPMENT_FACTS: Omit<
  DevelopmentPersonFacts,
  "id" | "name" | "email" | "population"
> = {
  role: null,
  contextLabel: null,
  daysSinceJoined: 365,
  mentorName: null,
  mentorEligible: false,
  daysSinceLastSession: null,
  checkInAccountable: true,
  hasCurrentMonthCheckIn: false,
  lastCheckInRating: null,
  lastCheckInMonthLabel: null,
  daysSinceLastCheckIn: null,
  reviewDue: false,
  hasAnyReview: false,
  lastReviewQuarter: null,
  lastReviewPerformance: null,
  lastReviewPotential: null,
  successionFlag: false,
  lastMentorReviewRating: null,
  pendingChairReviewDays: null,
  openActionCount: 0,
  overdueActionCount: 0,
  openFollowUpCount: 0,
  teamsLeadingCount: 0,
  committeesChairedCount: 0,
  activeMenteeCount: 0,
  mentorCap: null,
  classesTeachingCount: 0,
  growthTags: [],
  meetsSeniorExpectations: false,
  meetsLeadExpectations: false,
  activeReviewCycle: null,
};

// ── Signals ──────────────────────────────────────────────────────────────────

export type DevelopmentLaneId =
  | "concern"
  | "overloaded"
  | "review-due"
  | "needs-coach"
  | "no-recent-checkin"
  | "ready-for-more"
  | "recently-supported";

export type DevelopmentSignalTone =
  | "danger"
  | "warning"
  | "info"
  | "brand"
  | "success"
  | "neutral";

export type DevelopmentSignal = {
  kind:
    | "disengagement-risk"
    | "rated-behind"
    | "needs-training"
    | "overdue-actions"
    | "heavy-load"
    | "mentor-over-cap"
    | "review-overdue"
    | "review-due"
    | "approval-waiting"
    | "cycle-synthesis-ready"
    | "cycle-action-plan"
    | "cycle-follow-up-overdue"
    | "new-without-mentor"
    | "no-mentor"
    | "never-checked-in"
    | "no-recent-checkin"
    | "officer-inactive"
    | "ready-tagged"
    | "succession-flagged"
    | "strong-recent-review"
    | "meets-expectations"
    | "recently-supported";
  /** Which lane this signal argues for. */
  lane: DevelopmentLaneId;
  /** Plain-language label carrying its own evidence. */
  label: string;
  tone: DevelopmentSignalTone;
};

function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many;
}

/** Days since their last supportive touch (check-in compile or session). */
export function daysSinceLastTouch(facts: DevelopmentPersonFacts): number | null {
  const candidates = [facts.daysSinceLastCheckIn, facts.daysSinceLastSession].filter(
    (d): d is number => d != null
  );
  if (candidates.length === 0) return null;
  return Math.min(...candidates);
}

/** Teams led + committees chaired — the structural leadership load. */
function leadershipRoleCount(facts: DevelopmentPersonFacts): number {
  return facts.teamsLeadingCount + facts.committeesChairedCount;
}

function describeLoad(facts: DevelopmentPersonFacts): string {
  const parts: string[] = [];
  if (facts.teamsLeadingCount > 0) {
    parts.push(`leads ${facts.teamsLeadingCount} ${plural(facts.teamsLeadingCount, "team")}`);
  }
  if (facts.committeesChairedCount > 0) {
    parts.push(
      `chairs ${facts.committeesChairedCount} ${plural(facts.committeesChairedCount, "committee")}`
    );
  }
  if (facts.activeMenteeCount > 0) {
    parts.push(`mentors ${facts.activeMenteeCount}`);
  }
  if (facts.openActionCount > 0) {
    const overdue =
      facts.overdueActionCount > 0 ? ` (${facts.overdueActionCount} overdue)` : "";
    parts.push(`${facts.openActionCount} open ${plural(facts.openActionCount, "action")}${overdue}`);
  }
  if (facts.openFollowUpCount > 0) {
    parts.push(`${facts.openFollowUpCount} open ${plural(facts.openFollowUpCount, "follow-up")}`);
  }
  const joined = parts.join(" · ");
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

/**
 * Derive every applicable signal for one person. Order within the result is
 * meaningful only lane-internally; lane selection uses `LANE_PRIORITY`.
 */
export function deriveDevelopmentSignals(
  facts: DevelopmentPersonFacts
): DevelopmentSignal[] {
  const signals: DevelopmentSignal[] = [];

  // ── Concern raised — a human flag or a red rating on any recent record.
  if (facts.growthTags.includes("AT_RISK_OF_DISENGAGING")) {
    signals.push({
      kind: "disengagement-risk",
      lane: "concern",
      label: GROWTH_TAG_META.AT_RISK_OF_DISENGAGING.label,
      tone: "danger",
    });
  }
  if (facts.lastCheckInRating === "BEHIND_SCHEDULE") {
    signals.push({
      kind: "rated-behind",
      lane: "concern",
      label: facts.lastCheckInMonthLabel
        ? `Rated ${RATING_LABELS.BEHIND_SCHEDULE} in ${facts.lastCheckInMonthLabel} check-in`
        : `Last check-in rated ${RATING_LABELS.BEHIND_SCHEDULE}`,
      tone: "danger",
    });
  }
  if (facts.lastReviewPerformance === "BEHIND_SCHEDULE") {
    signals.push({
      kind: "rated-behind",
      lane: "concern",
      label: `${facts.lastReviewQuarter ?? "Last"} review rated ${RATING_LABELS.BEHIND_SCHEDULE}`,
      tone: "danger",
    });
  }
  if (facts.lastMentorReviewRating === "BEHIND_SCHEDULE") {
    signals.push({
      kind: "rated-behind",
      lane: "concern",
      label: `Last mentor review rated ${RATING_LABELS.BEHIND_SCHEDULE}`,
      tone: "danger",
    });
  }

  // ── Overloaded — concrete workload, never a vague "capacity" word.
  if (facts.overdueActionCount >= 2) {
    signals.push({
      kind: "overdue-actions",
      lane: "overloaded",
      label: `${facts.overdueActionCount} overdue ${plural(facts.overdueActionCount, "action")}`,
      tone: "danger",
    });
  }
  const roleCount = leadershipRoleCount(facts);
  if (
    facts.openActionCount >= HEAVY_OPEN_ACTIONS ||
    roleCount >= HEAVY_LEADERSHIP_ROLES ||
    (roleCount >= 2 && facts.openActionCount >= 4)
  ) {
    signals.push({
      kind: "heavy-load",
      lane: "overloaded",
      label: describeLoad(facts),
      tone: "warning",
    });
  }
  if (facts.mentorCap != null && facts.activeMenteeCount > facts.mentorCap) {
    signals.push({
      kind: "mentor-over-cap",
      lane: "overloaded",
      label: `Mentors ${facts.activeMenteeCount} — over the cap of ${facts.mentorCap}`,
      tone: "danger",
    });
  }

  // ── Review cycle in flight — the reviewer-side states that need a move.
  // (Waiting-on-input states stay off the person lanes; the review queue
  // carries them so the lanes only show situations leadership can act on.)
  const cycle = facts.activeReviewCycle;
  if (cycle?.displayState === "ready-for-synthesis") {
    signals.push({
      kind: "cycle-synthesis-ready",
      lane: "review-due",
      label: "Review ready for synthesis — all input in",
      tone: "warning",
    });
  } else if (cycle?.displayState === "action-plan-needed") {
    signals.push({
      kind: "cycle-action-plan",
      lane: "review-due",
      label: "Review needs an action plan",
      tone: "warning",
    });
  } else if (cycle?.displayState === "follow-up-overdue") {
    signals.push({
      kind: "cycle-follow-up-overdue",
      lane: "review-due",
      label: "Review follow-up overdue",
      tone: "danger",
    });
  }

  // ── Review due / overdue — suppressed while a cycle is already running the
  // review, so a person isn't flagged for the thing already in motion.
  if (facts.reviewDue && !cycle) {
    if (facts.hasAnyReview) {
      signals.push({
        kind: "review-overdue",
        lane: "review-due",
        label: `Review overdue — last review ${facts.lastReviewQuarter}`,
        tone: "danger",
      });
    } else {
      signals.push({
        kind: "review-due",
        lane: "review-due",
        label: "Review due — no review on file yet",
        tone: "warning",
      });
    }
  }
  if (
    facts.pendingChairReviewDays != null &&
    facts.pendingChairReviewDays >= APPROVAL_WAITING_DAYS
  ) {
    signals.push({
      kind: "approval-waiting",
      lane: "review-due",
      label: `Monthly review waiting ${facts.pendingChairReviewDays} days for chair approval`,
      tone: "warning",
    });
  }

  // ── Needs a coach.
  if (facts.mentorEligible && !facts.mentorName) {
    if (facts.daysSinceJoined <= NEW_PERSON_DAYS) {
      signals.push({
        kind: "new-without-mentor",
        lane: "needs-coach",
        label: `New — joined ${facts.daysSinceJoined} ${plural(facts.daysSinceJoined, "day")} ago, no mentor yet`,
        tone: "danger",
      });
    } else {
      signals.push({
        kind: "no-mentor",
        lane: "needs-coach",
        label: "No mentor assigned",
        tone: "warning",
      });
    }
  }
  if (facts.growthTags.includes("NEEDS_TRAINING")) {
    signals.push({
      kind: "needs-training",
      lane: "needs-coach",
      label: GROWTH_TAG_META.NEEDS_TRAINING.label,
      tone: "warning",
    });
  }

  // ── No recent check-in.
  const touch = daysSinceLastTouch(facts);
  if (facts.checkInAccountable) {
    if (touch == null) {
      signals.push({
        kind: "never-checked-in",
        lane: "no-recent-checkin",
        label: "Never checked in on",
        tone: "warning",
      });
    } else if (touch >= NO_RECENT_TOUCH_DAYS) {
      signals.push({
        kind: "no-recent-checkin",
        lane: "no-recent-checkin",
        label: `No check-in for ${touch} days`,
        tone: "warning",
      });
    }
  }
  if (
    facts.population === "officer" &&
    facts.openActionCount === 0 &&
    facts.openFollowUpCount === 0 &&
    roleCount === 0 &&
    (touch == null || touch >= NO_RECENT_TOUCH_DAYS)
  ) {
    signals.push({
      kind: "officer-inactive",
      lane: "no-recent-checkin",
      label: "No open work and no recent check-in",
      tone: "warning",
    });
  }

  // ── Ready for more.
  const readyTags = facts.growthTags.filter((t) =>
    GROWTH_OPPORTUNITY_TAGS.includes(t)
  );
  for (const tag of readyTags) {
    signals.push({
      kind: "ready-tagged",
      lane: "ready-for-more",
      label: GROWTH_TAG_META[tag].label,
      tone: tag === "POTENTIAL_TEAM_LEAD" ? "brand" : "success",
    });
  }
  if (facts.successionFlag) {
    signals.push({
      kind: "succession-flagged",
      lane: "ready-for-more",
      label: "Succession candidate",
      tone: "brand",
    });
  }
  if (facts.lastMentorReviewRating === "ABOVE_AND_BEYOND") {
    signals.push({
      kind: "strong-recent-review",
      lane: "ready-for-more",
      label: `Last mentor review: ${RATING_LABELS.ABOVE_AND_BEYOND}`,
      tone: "brand",
    });
  }
  if (
    facts.lastReviewPerformance === "ABOVE_AND_BEYOND" &&
    facts.lastReviewPotential === "ABOVE_AND_BEYOND"
  ) {
    signals.push({
      kind: "strong-recent-review",
      lane: "ready-for-more",
      label: `${facts.lastReviewQuarter ?? "Last"} review: ${RATING_LABELS.ABOVE_AND_BEYOND} across the board`,
      tone: "brand",
    });
  }
  if (facts.meetsLeadExpectations) {
    signals.push({
      kind: "meets-expectations",
      lane: "ready-for-more",
      label: "Meets Lead Instructor leadership expectations",
      tone: "success",
    });
  } else if (facts.meetsSeniorExpectations) {
    signals.push({
      kind: "meets-expectations",
      lane: "ready-for-more",
      label: "Meets Senior Instructor leadership expectations",
      tone: "success",
    });
  }

  // ── Recently supported — the calm confirmation lane.
  if (touch != null && touch <= RECENTLY_SUPPORTED_DAYS) {
    signals.push({
      kind: "recently-supported",
      lane: "recently-supported",
      label:
        touch === 0
          ? "Checked in on today"
          : `Checked in on ${touch} ${plural(touch, "day")} ago`,
      tone: "success",
    });
  }

  return signals;
}

// ── Lane selection ───────────────────────────────────────────────────────────

/** Most-pressing-first. A person lands in the FIRST lane they have a signal for. */
export const LANE_PRIORITY: DevelopmentLaneId[] = [
  "concern",
  "overloaded",
  "review-due",
  "needs-coach",
  "no-recent-checkin",
  "ready-for-more",
  "recently-supported",
];

export const LANE_META: Record<
  DevelopmentLaneId,
  { title: string; blurb: string; tone: DevelopmentSignalTone }
> = {
  concern: {
    title: "Concern raised",
    blurb: "A flag or a red rating — talk with them before anything else.",
    tone: "danger",
  },
  overloaded: {
    title: "Overloaded",
    blurb: "Carrying too much — rebalance before it turns into burnout.",
    tone: "warning",
  },
  "review-due": {
    title: "Review due",
    blurb: "A quarterly review is missing or a monthly review is stuck.",
    tone: "warning",
  },
  "needs-coach": {
    title: "Needs a coach",
    blurb: "No mentor on file, or flagged as needing training.",
    tone: "info",
  },
  "no-recent-checkin": {
    title: "No recent check-in",
    blurb: "Nobody has checked in on them lately.",
    tone: "info",
  },
  "ready-for-more": {
    title: "Ready for more",
    blurb: "Strong signals — plan their next responsibility.",
    tone: "brand",
  },
  "recently-supported": {
    title: "Recently supported",
    blurb: "Checked in on within the last two weeks — nothing pressing.",
    tone: "success",
  },
};

/**
 * The single lane a person appears in — their most pressing signal's lane.
 * Null when they have no signals at all (steady, not shown as a card).
 */
export function primaryLane(signals: DevelopmentSignal[]): DevelopmentLaneId | null {
  for (const lane of LANE_PRIORITY) {
    if (signals.some((s) => s.lane === lane)) return lane;
  }
  return null;
}

// ── Next step ────────────────────────────────────────────────────────────────

export type DevelopmentNextStep = {
  label: string;
  /** Concrete reason, e.g. "Review overdue — last review 2026-Q1". */
  reason: string;
  href: string;
};

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/**
 * One concrete next step per person, decided by their primary lane. Every href
 * lands on an EXISTING surface where the step can actually be taken.
 */
export function recommendNextStep(
  facts: DevelopmentPersonFacts,
  signals: DevelopmentSignal[]
): DevelopmentNextStep {
  const lane = primaryLane(signals);
  const first = firstName(facts.name || facts.email);
  const laneSignals = lane ? signals.filter((s) => s.lane === lane) : [];
  const reason = laneSignals[0]?.label ?? "Up to date";

  switch (lane) {
    case "concern":
      return {
        label: `Check in with ${first}`,
        reason,
        href: `/people/${facts.id}`,
      };
    case "overloaded":
      return {
        label: "Rebalance their work",
        reason,
        href: `/people/develop/${facts.id}`,
      };
    case "review-due": {
      const kind = laneSignals[0]?.kind;
      if (facts.activeReviewCycle && kind?.startsWith("cycle-")) {
        const label =
          kind === "cycle-synthesis-ready"
            ? "Write the synthesis"
            : kind === "cycle-action-plan"
              ? "Build the action plan"
              : "Hold the follow-up";
        return {
          label,
          reason,
          href: `/people/develop/reviews/${facts.activeReviewCycle.id}`,
        };
      }
      if (kind === "approval-waiting") {
        return {
          label: "Unblock the approval",
          reason,
          href: "/admin/mentorship?tab=approvals",
        };
      }
      return {
        label: "Start their review",
        reason,
        href: "/people/develop/reviews/new",
      };
    }
    case "needs-coach":
      if (laneSignals[0]?.kind === "needs-training") {
        return {
          label: "Plan their training",
          reason,
          href: `/people/develop/${facts.id}`,
        };
      }
      return {
        label: "Assign a mentor",
        reason,
        href: `/admin/mentorship?tab=assignments&menteeId=${facts.id}&supportRole=PRIMARY_MENTOR`,
      };
    case "no-recent-checkin":
      return {
        label: `Compile ${first}'s check-in`,
        reason,
        href: "/people/check-ins",
      };
    case "ready-for-more":
      return {
        label: "Plan their next step",
        reason,
        href: `/people/develop/${facts.id}`,
      };
    case "recently-supported":
    default:
      return {
        label: "View development record",
        reason,
        href: `/people/develop/${facts.id}`,
      };
  }
}

// ── Cockpit assembly ─────────────────────────────────────────────────────────

export type DevelopmentCard = {
  facts: DevelopmentPersonFacts;
  signals: DevelopmentSignal[];
  lane: DevelopmentLaneId;
  nextStep: DevelopmentNextStep;
};

export type DevelopmentLane = {
  id: DevelopmentLaneId;
  title: string;
  blurb: string;
  tone: DevelopmentSignalTone;
  cards: DevelopmentCard[];
};

export type DevelopmentCockpit = {
  lanes: DevelopmentLane[];
  /** People with signals, by lane, for the briefing chips. */
  chips: Array<{ laneId: DevelopmentLaneId; label: string; tone: DevelopmentSignalTone }>;
  /** People with no signals at all — steady, only a count. */
  steadyCount: number;
  total: number;
};

const TONE_RANK: Record<DevelopmentSignalTone, number> = {
  danger: 0,
  warning: 1,
  info: 2,
  brand: 3,
  success: 4,
  neutral: 5,
};

function cardOrder(a: DevelopmentCard, b: DevelopmentCard): number {
  const toneDiff =
    TONE_RANK[a.signals[0]?.tone ?? "neutral"] - TONE_RANK[b.signals[0]?.tone ?? "neutral"];
  if (toneDiff !== 0) return toneDiff;
  return (a.facts.name || a.facts.email).localeCompare(b.facts.name || b.facts.email, undefined, {
    sensitivity: "base",
  });
}

function chipLabel(lane: DevelopmentLane): string {
  const n = lane.cards.length;
  switch (lane.id) {
    case "concern":
      return `${n} ${n === 1 ? "concern" : "concerns"} raised`;
    case "overloaded":
      return `${n} overloaded`;
    case "review-due":
      return `${n} ${n === 1 ? "review" : "reviews"} due`;
    case "needs-coach":
      return `${n} ${n === 1 ? "needs" : "need"} a coach`;
    case "no-recent-checkin":
      return `${n} not checked in on`;
    case "ready-for-more":
      return `${n} ready for more`;
    case "recently-supported":
      return `${n} recently supported`;
    default:
      return `${n}`;
  }
}

/**
 * Assemble people into ordered attention lanes. Each person appears in exactly
 * one lane (their most pressing); people with no signals are counted as steady
 * rather than rendered — absence of noise is the point.
 */
export function buildDevelopmentCockpit(
  people: DevelopmentPersonFacts[]
): DevelopmentCockpit {
  const byLane = new Map<DevelopmentLaneId, DevelopmentCard[]>();
  let steadyCount = 0;

  for (const facts of people) {
    const signals = deriveDevelopmentSignals(facts);
    const lane = primaryLane(signals);
    if (!lane) {
      steadyCount++;
      continue;
    }
    // Lead with the primary lane's signals so the card reads why it is here.
    const ordered = [
      ...signals.filter((s) => s.lane === lane),
      ...signals.filter((s) => s.lane !== lane),
    ];
    const card: DevelopmentCard = {
      facts,
      signals: ordered,
      lane,
      nextStep: recommendNextStep(facts, signals),
    };
    const list = byLane.get(lane);
    if (list) list.push(card);
    else byLane.set(lane, [card]);
  }

  const lanes: DevelopmentLane[] = [];
  for (const id of LANE_PRIORITY) {
    const cards = byLane.get(id);
    if (!cards || cards.length === 0) continue;
    cards.sort(cardOrder);
    lanes.push({ id, ...LANE_META[id], cards });
  }

  const chips = lanes
    .filter((lane) => lane.id !== "recently-supported")
    .map((lane) => ({ laneId: lane.id, label: chipLabel(lane), tone: lane.tone }));

  const total = lanes.reduce((n, lane) => n + lane.cards.length, 0);

  return { lanes, chips, steadyCount, total };
}
