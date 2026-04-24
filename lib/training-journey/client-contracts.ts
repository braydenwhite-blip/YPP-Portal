/**
 * UI / server-action contracts for the interactive journey (Phase 4).
 *
 * These types are SHARED between:
 *   - the viewer RSC at `app/(app)/training/[id]/page.tsx`
 *   - the client shell at `app/(app)/training/[id]/journey-shell.tsx`
 *   - the player/beats components under `components/training/journey/**`
 *   - the server actions at `lib/training-journey/actions.ts`
 *
 * The `config` field on every beat shipped to the client has been filtered by
 * `serializeBeatForClient()` — secret fields such as `correctOptionId`,
 * `correctTargetId`, `acceptedAnswers`, `requiredTags`, etc. are stripped
 * server-side. The client renders interactive surfaces from the filtered
 * config and sends back the user's response; the server computes correctness.
 *
 * Never import `@prisma/client` from a file that imports from here — these
 * types are the boundary that keeps Prisma off the client bundle.
 */

import type {
  BeatFeedback,
  ClientBeat,
  ClientBeatAttempt,
  ClientJourney,
  ReadinessModuleBreakdown,
  ReadinessPersonalizedTip,
} from "./types";

export type { BeatFeedback, ClientBeat, ClientBeatAttempt, ClientJourney };

// ---------------------------------------------------------------------------
// Snapshot shipped by the viewer RSC to <JourneyShell />
// ---------------------------------------------------------------------------

/** Latest attempt summary for one beat (one row per beat per user).
 *  `response` carries the user's submitted payload so the client can evaluate
 *  `showWhen` predicates on child beats of BRANCHING_SCENARIO parents. For
 *  non-branching beats the field is opaque and unused. */
export type JourneyAttemptSummary = {
  beatSourceKey: string;
  attemptNumber: number;
  correct: boolean;
  score: number;
  response: unknown | null;
};

/**
 * Server-authoritative snapshot of a journey, per user. Produced by the RSC
 * and handed to the client shell. Never contains answer keys.
 */
export type JourneySnapshot = {
  moduleId: string;
  contentKey: string | null;
  title: string;
  description: string;
  estimatedMinutes: number;
  passScorePct: number;
  strictMode: boolean;
  version: number;
  /** Beats in render order (sortOrder ascending). `config` is already filtered. */
  beats: ClientBeat[];
  /** Latest attempt per beat for this user. Empty = not started. */
  userAttempts: JourneyAttemptSummary[];
  /**
   * First beat the user hasn't answered correctly yet (or the first beat if
   * no attempts exist). `null` when every beat has a correct attempt AND the
   * journey is already completed — the shell uses this to detect "resume"
   * vs. "start fresh" vs. "already complete".
   */
  resumeBeatSourceKey: string | null;
  /** Set when a completion row exists for this user + journey. */
  completion: JourneyCompletionSummary | null;
};

export type JourneyCompletionSummary = {
  totalScore: number;
  maxScore: number;
  scorePct: number;
  passed: boolean;
  firstTryCorrectCount: number;
  xpEarned: number;
  visitedBeatCount: number;
  moduleBreakdown: ReadinessModuleBreakdown | null;
  personalizedTips: ReadinessPersonalizedTip[] | null;
  completedAt: string;
  badgeKey: string | null;
};

// ---------------------------------------------------------------------------
// Server action I/O contracts
// ---------------------------------------------------------------------------

export type BeatSubmitInput = {
  moduleId: string;
  beatSourceKey: string;
  /** Response payload shape depends on beat kind; Zod-validated server-side. */
  response: unknown;
  /** Milliseconds spent on this beat (best-effort client timer). */
  timeMs?: number | null;
};

export type BeatSubmitErrorCode =
  | "UNAUTHORIZED"
  | "FEATURE_DISABLED"
  | "RATE_LIMITED"
  | "MODULE_NOT_FOUND"
  | "BEAT_NOT_FOUND"
  | "INVALID_INPUT"
  | "INVALID_RESPONSE"
  | "JOURNEY_LOCKED"
  | "SERVER_ERROR";

export type BeatSubmitResult =
  | {
      ok: true;
      correct: boolean;
      score: number;
      /** `attemptNumber` for the just-written row (1-indexed per user/beat). */
      attemptNumber: number;
      feedback: BeatFeedback;
      /** Next beat in reading order (or null if this is the last scored beat). */
      nextBeatSourceKey: string | null;
    }
  | { ok: false; code: BeatSubmitErrorCode; message: string };

export type CompleteJourneyInput = {
  moduleId: string;
};

export type CompleteJourneyErrorCode =
  | "UNAUTHORIZED"
  | "FEATURE_DISABLED"
  | "RATE_LIMITED"
  | "MODULE_NOT_FOUND"
  | "JOURNEY_NOT_READY"
  | "SERVER_ERROR";

export type CompleteJourneyResult =
  | {
      ok: true;
      completion: JourneyCompletionSummary;
      nextModule: { id: string; title: string } | null;
    }
  | { ok: false; code: CompleteJourneyErrorCode; message: string };

export type ResumeJourneyInput = {
  moduleId: string;
};

export type ResumeJourneyResult =
  | {
      ok: true;
      resumeBeatSourceKey: string | null;
      userAttempts: JourneyAttemptSummary[];
    }
  | {
      ok: false;
      code: "UNAUTHORIZED" | "FEATURE_DISABLED" | "MODULE_NOT_FOUND" | "SERVER_ERROR";
      message: string;
    };

// ---------------------------------------------------------------------------
// Badge mapping (derived, not persisted)
// ---------------------------------------------------------------------------

/**
 * Content-key → badge label. Extend as modules are authored. Returning `null`
 * from `getBadgeForContentKey` means no badge is displayed (fine for preview).
 */
const BADGE_BY_CONTENT_KEY: Record<string, string> = {
  academy_ypp_standard_001: "Standard Bearer",
  academy_run_session_002: "Session Ace",
  academy_student_situations_003: "Classroom Whisperer",
  academy_communication_004: "Reliable Pro",
  academy_readiness_check_005: "Ready to Teach",
};

export function getBadgeForContentKey(contentKey: string | null): string | null {
  if (!contentKey) return null;
  return BADGE_BY_CONTENT_KEY[contentKey] ?? null;
}
