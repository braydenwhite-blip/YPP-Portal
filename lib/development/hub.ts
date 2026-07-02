import type { CycleDisplayState } from "./cycle-flow";
import { primaryLane, type DevelopmentSignal } from "./signals";

/**
 * Mentorship hub — pure perspective + mentor-console logic.
 *
 * The hub at /mentorship is ONE front door with three perspectives:
 *   "me"      — My development (everyone internal: mentee + input duties)
 *   "mentees" — Mentor console (mentors in the program, cycle reviewers)
 *   "admin"   — Oversight (leadership command center)
 *
 * This module decides which perspectives a viewer gets and what a mentor's
 * single next step is for each person they coach — merging THREE sources that
 * used to live on different pages: the legacy monthly-loop state (kickoff /
 * reflection / review), the review-cycle state (synthesis / action plan /
 * follow-up), and the development signals (concern / no recent check-in /
 * ready for more). Pure functions only; tested in
 * tests/lib/development/hub.test.ts.
 */

// ── Perspectives ─────────────────────────────────────────────────────────────

export type HubView = "me" | "mentees" | "admin";

export function resolveHubViews(input: {
  isLeadership: boolean;
  /** Actively mentors someone in the mentorship program. */
  mentorsInProgram: boolean;
  /** Assigned reviewer on at least one open review cycle. */
  reviewsCycles: boolean;
}): HubView[] {
  const views: HubView[] = ["me"];
  if (input.mentorsInProgram || input.reviewsCycles || input.isLeadership) {
    views.push("mentees");
  }
  if (input.isLeadership) {
    views.push("admin");
  }
  return views;
}

/**
 * Where a viewer lands by default: leadership runs the system (oversight),
 * mentors coach (console), everyone else sees their own development.
 */
export function defaultHubView(views: HubView[]): HubView {
  if (views.includes("admin")) return "admin";
  if (views.includes("mentees")) return "mentees";
  return "me";
}

export function parseHubView(
  raw: string | undefined,
  available: HubView[]
): HubView {
  if (raw === "me" || raw === "mentees" || raw === "admin") {
    if (available.includes(raw)) return raw;
  }
  return defaultHubView(available);
}

export const HUB_VIEW_META: Record<HubView, { label: string; blurb: string }> = {
  me: {
    label: "My development",
    blurb: "Your mentor, what's waiting on you, and where you're headed.",
  },
  mentees: {
    label: "Mentor console",
    blurb: "The people you coach — one next step for each.",
  },
  admin: {
    label: "Oversight",
    blurb: "Who needs support across the whole system, and where it's stuck.",
  },
};

// ── Mentor console rows ──────────────────────────────────────────────────────

/** Legacy monthly-loop state for a mentee, from the mentorship program. */
export type MentorProgramState = {
  mentorshipId: string;
  kickoffPending: boolean;
  /** MentorshipCycleStage value, e.g. "REFLECTION_SUBMITTED". */
  cycleStage: string;
};

export type MentorRowInput = {
  menteeId: string;
  menteeName: string;
  contextLabel: string | null;
  signals: DevelopmentSignal[];
  cycle: { id: string; displayState: CycleDisplayState } | null;
  program: MentorProgramState | null;
};

export type MentorNextStep = {
  label: string;
  href: string;
  /** Lower = more urgent; orders the console. */
  rank: number;
  tone: "danger" | "warning" | "info" | "brand" | "success" | "neutral";
};

/**
 * The single next move for one mentee, merged across the monthly loop, the
 * review cycle, and the development signals — most urgent wins.
 */
export function deriveMentorNextStep(row: MentorRowInput): MentorNextStep {
  const lane = primaryLane(row.signals);

  // 1. A relationship that never started blocks everything else.
  if (row.program?.kickoffPending) {
    return {
      label: "Hold the kickoff meeting",
      href: `/mentorship/mentees/${row.menteeId}`,
      rank: 0,
      tone: "warning",
    };
  }

  // 2. Review-cycle states where the ball is with the mentor/reviewer.
  if (row.cycle) {
    const href = `/people/develop/reviews/${row.cycle.id}`;
    switch (row.cycle.displayState) {
      case "follow-up-overdue":
        return { label: "Hold the overdue follow-up", href, rank: 1, tone: "danger" };
      case "ready-for-synthesis":
        return { label: "Write the synthesis", href, rank: 2, tone: "warning" };
      case "action-plan-needed":
        return { label: "Build the action plan", href, rank: 3, tone: "warning" };
      default:
        break;
    }
  }

  // 3. A submitted monthly reflection is waiting on the mentor's review.
  if (
    row.program?.cycleStage === "REFLECTION_SUBMITTED" ||
    row.program?.cycleStage === "CHANGES_REQUESTED"
  ) {
    return {
      label: "Write their monthly review",
      href: "/mentorship/reviews",
      rank: 4,
      tone: "info",
    };
  }

  // 4. A concern beats routine nudges.
  if (lane === "concern") {
    return {
      label: "Check in about the concern",
      href: `/people/develop/${row.menteeId}`,
      rank: 5,
      tone: "danger",
    };
  }

  // 5. Cycle input being waited on — a nudge from the mentor moves it.
  if (row.cycle) {
    const href = `/people/develop/reviews/${row.cycle.id}`;
    if (
      row.cycle.displayState === "waiting-self-input" ||
      row.cycle.displayState === "waiting-input"
    ) {
      return { label: "Nudge their self-reflection", href, rank: 6, tone: "info" };
    }
    if (row.cycle.displayState === "waiting-feedback") {
      return { label: "Chase contributor feedback", href, rank: 7, tone: "info" };
    }
  }

  // 6. Routine coaching rhythm.
  if (lane === "no-recent-checkin") {
    return {
      label: "Hold a check-in",
      href: `/people/develop/${row.menteeId}`,
      rank: 8,
      tone: "info",
    };
  }
  if (lane === "ready-for-more") {
    return {
      label: "Plan their next responsibility",
      href: `/people/develop/${row.menteeId}`,
      rank: 9,
      tone: "brand",
    };
  }

  return {
    label: "Nothing pressing — steady",
    href: `/people/develop/${row.menteeId}`,
    rank: 10,
    tone: "success",
  };
}

export type MentorConsoleRow = MentorRowInput & { nextStep: MentorNextStep };

/** Build and order the console: most urgent first, then by name. */
export function buildMentorConsoleRows(
  inputs: MentorRowInput[]
): MentorConsoleRow[] {
  return inputs
    .map((input) => ({ ...input, nextStep: deriveMentorNextStep(input) }))
    .sort(
      (a, b) =>
        a.nextStep.rank - b.nextStep.rank ||
        a.menteeName.localeCompare(b.menteeName, undefined, { sensitivity: "base" })
    );
}

// ── Mentee home ──────────────────────────────────────────────────────────────

/** How many things are waiting on the signed-in person right now. */
export function countWaitingOnMe(input: {
  selfInputs: Array<{ submitted: boolean }>;
  feedbackRequests: Array<{ submitted: boolean }>;
}): number {
  return (
    input.selfInputs.filter((item) => !item.submitted).length +
    input.feedbackRequests.filter((item) => !item.submitted).length
  );
}
