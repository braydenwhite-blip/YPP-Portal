import type { ReviewCycleState, ReviewCycleType } from "@prisma/client";

/**
 * Leadership Development — review cycle flow (deterministic, testable).
 *
 * The stored `ReviewCycleState` is deliberately coarse (DRAFT → COLLECTING →
 * ACTION_PLAN → FOLLOW_UP → COMPLETED). Everything finer — "waiting on
 * self-input", "waiting on feedback", "ready for synthesis", "follow-up
 * overdue" — is DERIVED here from the state plus input timestamps, so display
 * states can never go stale or disagree with the data. Pure functions only:
 * no Prisma, no clock (callers pass `now`), no session.
 *
 * Copy policy matches the cockpit: plain operational language, every label a
 * concrete fact, no vague health words, no scores.
 */

// ── Facts (loader-shaped input) ──────────────────────────────────────────────

export type CycleFlowFacts = {
  state: ReviewCycleState;
  dueDate: Date | null;
  selfInputSubmittedAt: Date | null;
  synthesisSubmittedAt: Date | null;
  followUpDueAt: Date | null;
  releasedToRevieweeAt: Date | null;
  completedAt: Date | null;
  /** Contributor feedback rows requested / of those, submitted. */
  feedbackRequested: number;
  feedbackSubmitted: number;
};

// ── Display state ────────────────────────────────────────────────────────────

export type CycleDisplayState =
  | "draft"
  | "waiting-self-input"
  | "waiting-feedback"
  | "waiting-input"
  | "ready-for-synthesis"
  | "action-plan-needed"
  | "follow-up-scheduled"
  | "follow-up-overdue"
  | "completed";

export const CYCLE_DISPLAY_META: Record<
  CycleDisplayState,
  {
    label: string;
    tone: "danger" | "warning" | "info" | "brand" | "success" | "neutral";
    blurb: string;
  }
> = {
  draft: {
    label: "Draft",
    tone: "neutral",
    blurb: "Being prepared — not yet collecting input.",
  },
  "waiting-self-input": {
    label: "Waiting on self-input",
    tone: "info",
    blurb: "The reviewee hasn't submitted their self-reflection yet.",
  },
  "waiting-feedback": {
    label: "Waiting on feedback",
    tone: "info",
    blurb: "Feedback requests are out — replies still outstanding.",
  },
  "waiting-input": {
    label: "Waiting on input",
    tone: "info",
    blurb: "Waiting on the reviewee's self-reflection and contributor feedback.",
  },
  "ready-for-synthesis": {
    label: "Ready for synthesis",
    tone: "warning",
    blurb: "All input is in — the reviewer writes the synthesis next.",
  },
  "action-plan-needed": {
    label: "Action plan needed",
    tone: "warning",
    blurb: "The synthesis is done — turn it into actions and a follow-up.",
  },
  "follow-up-scheduled": {
    label: "Follow-up scheduled",
    tone: "brand",
    blurb: "The action plan is in motion — a check-in is on the calendar.",
  },
  "follow-up-overdue": {
    label: "Follow-up overdue",
    tone: "danger",
    blurb: "The scheduled check-in has passed without being completed.",
  },
  completed: {
    label: "Review complete",
    tone: "success",
    blurb: "The cycle is closed and recorded on the development record.",
  },
};

/**
 * Derive the operational display state. In COLLECTING, "ready for synthesis"
 * means the self-input is in AND every requested feedback reply is in — the
 * reviewer may still synthesize earlier (the workspace allows it); this state
 * only says nothing is being waited on.
 */
export function deriveCycleDisplayState(
  facts: CycleFlowFacts,
  now: Date
): CycleDisplayState {
  switch (facts.state) {
    case "COMPLETED":
      return "completed";
    case "FOLLOW_UP":
      return facts.followUpDueAt && facts.followUpDueAt < now
        ? "follow-up-overdue"
        : "follow-up-scheduled";
    case "ACTION_PLAN":
      return "action-plan-needed";
    case "DRAFT":
      return "draft";
    case "COLLECTING": {
      const selfPending = facts.selfInputSubmittedAt == null;
      const feedbackPending = facts.feedbackRequested > facts.feedbackSubmitted;
      if (selfPending && feedbackPending) return "waiting-input";
      if (selfPending) return "waiting-self-input";
      if (feedbackPending) return "waiting-feedback";
      return "ready-for-synthesis";
    }
    default:
      return "draft";
  }
}

// ── Progress spine ───────────────────────────────────────────────────────────

export type CycleStepKey =
  | "prepare"
  | "collect-feedback"
  | "self-input"
  | "synthesis"
  | "action-plan"
  | "follow-up";

export type CycleStep = {
  key: CycleStepKey;
  label: string;
  /** One concrete status line ("2 of 3 replies in"). */
  detail: string | null;
  status: "done" | "current" | "todo";
};

function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many;
}

/** The six-step spine the workspace renders across the top. */
export function buildCycleSteps(facts: CycleFlowFacts, now: Date): CycleStep[] {
  const display = deriveCycleDisplayState(facts, now);
  const collecting = facts.state === "COLLECTING";
  const pastCollecting =
    facts.state === "ACTION_PLAN" ||
    facts.state === "FOLLOW_UP" ||
    facts.state === "COMPLETED";

  const feedbackDone =
    facts.feedbackRequested > 0 &&
    facts.feedbackSubmitted >= facts.feedbackRequested;
  const feedbackDetail =
    facts.feedbackRequested === 0
      ? "No contributors asked yet"
      : `${facts.feedbackSubmitted} of ${facts.feedbackRequested} ${plural(
          facts.feedbackRequested,
          "reply",
          "replies"
        )} in`;

  const steps: CycleStep[] = [
    {
      key: "prepare",
      label: "Prepare",
      detail: null,
      status: facts.state === "DRAFT" ? "current" : "done",
    },
    {
      key: "collect-feedback",
      label: "Feedback",
      detail: feedbackDetail,
      status:
        pastCollecting || feedbackDone
          ? "done"
          : collecting
            ? "current"
            : "todo",
    },
    {
      key: "self-input",
      label: "Self-reflection",
      detail: facts.selfInputSubmittedAt ? "Submitted" : "Not submitted yet",
      status: facts.selfInputSubmittedAt
        ? "done"
        : collecting
          ? "current"
          : pastCollecting
            ? "done"
            : "todo",
    },
    {
      key: "synthesis",
      label: "Synthesis",
      detail: facts.synthesisSubmittedAt ? "Written" : null,
      status: facts.synthesisSubmittedAt
        ? "done"
        : display === "ready-for-synthesis"
          ? "current"
          : "todo",
    },
    {
      key: "action-plan",
      label: "Action plan",
      detail: null,
      status:
        facts.state === "FOLLOW_UP" || facts.state === "COMPLETED"
          ? "done"
          : facts.state === "ACTION_PLAN"
            ? "current"
            : "todo",
    },
    {
      key: "follow-up",
      label: "Follow-up",
      detail: facts.followUpDueAt ? null : "Not scheduled",
      status:
        facts.state === "COMPLETED"
          ? "done"
          : facts.state === "FOLLOW_UP"
            ? "current"
            : "todo",
    },
  ];

  return steps;
}

// ── Next step ────────────────────────────────────────────────────────────────

export type CycleNextStep = {
  label: string;
  /** Who the ball is with. */
  who: "reviewer" | "reviewee" | "contributors" | "nobody";
};

/** The single next move for a cycle, in plain language. */
export function deriveCycleNextStep(
  facts: CycleFlowFacts,
  now: Date
): CycleNextStep {
  switch (deriveCycleDisplayState(facts, now)) {
    case "draft":
      return { label: "Open the cycle for input", who: "reviewer" };
    case "waiting-self-input":
      return { label: "Waiting on the reviewee's self-reflection", who: "reviewee" };
    case "waiting-feedback":
      return { label: "Waiting on contributor feedback", who: "contributors" };
    case "waiting-input":
      return {
        label: "Waiting on self-reflection and contributor feedback",
        who: "reviewee",
      };
    case "ready-for-synthesis":
      return { label: "Write the synthesis", who: "reviewer" };
    case "action-plan-needed":
      return {
        label: "Create actions and schedule the follow-up",
        who: "reviewer",
      };
    case "follow-up-scheduled":
      return { label: "Hold the follow-up check-in, then complete", who: "reviewer" };
    case "follow-up-overdue":
      return { label: "Hold the overdue follow-up check-in", who: "reviewer" };
    case "completed":
    default:
      return { label: "Nothing left — the cycle is complete", who: "nobody" };
  }
}

// ── Structured prompts ───────────────────────────────────────────────────────

/** Reviewee self-reflection prompts, in form order. Keys match ReviewCycle columns. */
export const SELF_INPUT_PROMPTS = [
  { key: "selfWentWell", label: "What went well?" },
  { key: "selfWasHard", label: "What was hard?" },
  { key: "selfImproved", label: "What did you improve?" },
  { key: "selfSupportNeeded", label: "Where do you need support?" },
  { key: "selfGoals", label: "What are your goals?" },
  {
    key: "selfNextResponsibility",
    label: "What responsibility do you want next?",
  },
  { key: "selfLeadershipNote", label: "What should leadership know?" },
] as const;

export type SelfInputKey = (typeof SELF_INPUT_PROMPTS)[number]["key"];

/** Contributor feedback prompts, in form order. Keys match ReviewCycleFeedback columns. */
export const FEEDBACK_PROMPTS = [
  { key: "doingWell", label: "What is this person doing well?" },
  { key: "needsSupport", label: "Where do they need support?" },
  { key: "concerns", label: "Any concerns?" },
  { key: "examples", label: "Evidence or examples" },
  { key: "suggestedNextStep", label: "Suggested next step" },
] as const;

export type FeedbackPromptKey = (typeof FEEDBACK_PROMPTS)[number]["key"];

/** Reviewer synthesis prompts. `leadershipOnly` fields are never reviewee-visible. */
export const SYNTHESIS_PROMPTS = [
  { key: "strengths", label: "Strengths", leadershipOnly: false },
  { key: "growthAreas", label: "Growth areas", leadershipOnly: false },
  { key: "concerns", label: "Concerns", leadershipOnly: true },
  { key: "coachingNotes", label: "Coaching notes", leadershipOnly: true },
  {
    key: "recommendedNextStep",
    label: "Recommended next step",
    leadershipOnly: false,
  },
] as const;

export type SynthesisPromptKey = (typeof SYNTHESIS_PROMPTS)[number]["key"];

// ── Feedback topic vocabulary (population-specific) ─────────────────────────

export const INSTRUCTOR_FEEDBACK_TOPICS = [
  { value: "class-delivery", label: "Class delivery" },
  { value: "student-engagement", label: "Student engagement" },
  { value: "preparedness", label: "Preparedness" },
  { value: "reliability", label: "Reliability" },
  { value: "communication", label: "Communication" },
  { value: "teaching-growth", label: "Teaching growth" },
  { value: "leadership-readiness", label: "Ready for leadership" },
] as const;

export const OFFICER_FEEDBACK_TOPICS = [
  { value: "chapter-execution", label: "Chapter execution" },
  { value: "communication", label: "Communication" },
  { value: "follow-through", label: "Follow-through" },
  { value: "team-leadership", label: "Team leadership" },
  { value: "reliability", label: "Reliability" },
  { value: "initiative-ownership", label: "Initiative ownership" },
  { value: "readiness-for-more", label: "Ready for more responsibility" },
] as const;

export function feedbackTopicsForType(
  type: ReviewCycleType
): ReadonlyArray<{ value: string; label: string }> {
  return type === "INSTRUCTOR"
    ? INSTRUCTOR_FEEDBACK_TOPICS
    : OFFICER_FEEDBACK_TOPICS;
}

export function isValidFeedbackTopic(
  type: ReviewCycleType,
  topic: string
): boolean {
  return feedbackTopicsForType(type).some((t) => t.value === topic);
}

export function feedbackTopicLabel(topic: string): string {
  const all = [...INSTRUCTOR_FEEDBACK_TOPICS, ...OFFICER_FEEDBACK_TOPICS];
  return all.find((t) => t.value === topic)?.label ?? topic;
}

// ── Cycle type meta ──────────────────────────────────────────────────────────

export const CYCLE_TYPE_META: Record<
  ReviewCycleType,
  { label: string; population: "instructor" | "officer" }
> = {
  INSTRUCTOR: { label: "Instructor review", population: "instructor" },
  OFFICER: { label: "Officer review", population: "officer" },
};
