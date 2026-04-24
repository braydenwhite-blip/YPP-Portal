"use client";

/**
 * JourneyPlayer — the primary interactive beat-by-beat player (Phase 4).
 *
 * Orchestrates the beat state machine:
 *   idle → checking (≥150ms spinner) → correct | incorrect
 *
 * Beat navigation:
 *   - Forward: "Check" → submit → feedback → "Next" → advance
 *   - Back: "Back" button on top bar (disabled on first beat or in strictMode)
 *   - Keyboard: Enter triggers primary action when response is non-null
 *
 * After the last beat, calls completeJourneyAction() and fires onComplete().
 *
 * Branching note: getNextVisibleBeat() is written branching-ready but the
 * Phase 4 implementation is linear (M1 has no branching). Full showWhen
 * predicate evaluation lands with M3 (plan §4 Module 3).
 */

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

import type { ClientBeat, ShowWhenPredicate } from "@/lib/training-journey/types";
import type {
  JourneyAttemptSummary,
  JourneyCompletionSummary,
  BeatSubmitInput,
  BeatSubmitResult,
  CompleteJourneyInput,
  CompleteJourneyResult,
  BeatFeedback,
} from "@/lib/training-journey/client-contracts";

import { useJourneyMotion } from "./MotionProvider";
import { JourneyProgress } from "./JourneyProgress";
import { BeatRenderer } from "./beats/BeatRenderer";
import { BeatActions } from "./beats/BeatActions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JourneyPlayerProps = {
  moduleId: string;
  contentKey: string | null;
  beats: ClientBeat[];
  strictMode: boolean;
  initialBeatSourceKey: string;
  userAttempts: JourneyAttemptSummary[];
  passScorePct: number;
  title: string;
  onComplete: (result: JourneyCompletionSummary) => void;
  submitBeatAction: (input: BeatSubmitInput) => Promise<BeatSubmitResult>;
  completeJourneyAction: (input: CompleteJourneyInput) => Promise<CompleteJourneyResult>;
};

type BeatPhase = "idle" | "checking" | "correct" | "incorrect";

type Direction = "forward" | "back";

// ---------------------------------------------------------------------------
// Beat traversal (branching-ready)
// ---------------------------------------------------------------------------

/**
 * Evaluates a `ShowWhenPredicate` against the user's latest attempt responses.
 *
 * Phase 4 (M1): no beats use showWhen — returns true unconditionally.
 * M3 will flesh out the response-matching logic against `attempts`.
 * TODO(M3): resolve `response` from the attempt record for the ancestor beat.
 */
function evaluateShowWhen(
  predicate: ShowWhenPredicate,
  attempts: JourneyAttemptSummary[]
): boolean {
  // Phase 4 stub — predicate evaluation is not used in M1 (linear journey).
  // The structure is here so the traversal loop calls the right hook point.
  void predicate;
  void attempts;
  return true;
}

/**
 * Returns the next visible beat after `currentSourceKey`, or `null` when the
 * journey is complete (all remaining beats are exhausted).
 *
 * Branching-ready: filters child beats through `showWhen` predicates against
 * the latest user attempts. For the Phase 4 linear journey (M1), no beats
 * have `showWhen` set, so the traversal is a simple next-index walk.
 *
 * Full branching DAG support (for M3 BRANCHING_SCENARIO beats) will plug into
 * this function by grouping children by parentBeatId and evaluating predicates
 * before deciding which subtree to visit.
 *
 * TODO(M3): handle parentBeatId grouping and multi-level DAG traversal.
 */
function getNextVisibleBeat(
  currentSourceKey: string,
  beats: ClientBeat[],
  attempts: JourneyAttemptSummary[]
): ClientBeat | null {
  const currentIdx = beats.findIndex((b) => b.sourceKey === currentSourceKey);
  if (currentIdx === -1) return null;

  for (let i = currentIdx + 1; i < beats.length; i++) {
    const candidate = beats[i];
    // Skip beats with unmet showWhen predicates (no-op in Phase 4 / M1).
    if (candidate.showWhen !== null) {
      if (!evaluateShowWhen(candidate.showWhen, attempts)) continue;
    }
    return candidate;
  }

  return null; // journey complete
}

/**
 * Returns the previous visible beat before `currentSourceKey`, or `null`
 * when already on the first beat.
 */
function getPrevVisibleBeat(
  currentSourceKey: string,
  beats: ClientBeat[]
): ClientBeat | null {
  const currentIdx = beats.findIndex((b) => b.sourceKey === currentSourceKey);
  if (currentIdx <= 0) return null;
  return beats[currentIdx - 1];
}

// ---------------------------------------------------------------------------
// Minimum spinner duration helper
// ---------------------------------------------------------------------------

function minDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MIN_CHECK_MS = 150; // plan §5 — minimum spinner duration

export function JourneyPlayer({
  moduleId,
  contentKey: _contentKey,
  beats,
  strictMode,
  initialBeatSourceKey,
  userAttempts,
  passScorePct: _passScorePct,
  title: _title,
  onComplete,
  submitBeatAction,
  completeJourneyAction,
}: JourneyPlayerProps) {
  const { variants, reduced } = useJourneyMotion();

  // Current beat tracking
  const [currentSourceKey, setCurrentSourceKey] = useState<string>(initialBeatSourceKey);
  const [direction, setDirection] = useState<Direction>("forward");

  // Beat interaction state
  const [phase, setPhase] = useState<BeatPhase>("idle");
  const [currentResponse, setCurrentResponse] = useState<unknown>(null);
  const [feedback, setFeedback] = useState<BeatFeedback | null>(null);
  const [attempts, setAttempts] = useState<JourneyAttemptSummary[]>(userAttempts);

  // Error banner
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Completion overlay
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  // will-change management (plan §6 Performance)
  const [stageWillChange, setStageWillChange] = useState(false);

  // Beat start time for timeMs measurement
  const beatStartTimeRef = useRef<number>(Date.now());

  const currentBeat = beats.find((b) => b.sourceKey === currentSourceKey) ?? beats[0];
  const isFirstBeat = getPrevVisibleBeat(currentSourceKey, beats) === null;
  const isReadOnly = phase === "correct";

  // Reset response + phase when beat changes
  useEffect(() => {
    setPhase("idle");
    setCurrentResponse(null);
    setFeedback(null);
    setErrorMessage(null);
    beatStartTimeRef.current = Date.now();
  }, [currentSourceKey]);

  // ---------------------------------------------------------------------------
  // Action handlers
  // ---------------------------------------------------------------------------

  const handleCheck = useCallback(async () => {
    if (currentResponse === null || phase !== "idle") return;

    setPhase("checking");
    setStageWillChange(true);
    setErrorMessage(null);

    const timeMs = Date.now() - beatStartTimeRef.current;
    const [result] = await Promise.all([
      submitBeatAction({
        moduleId,
        beatSourceKey: currentBeat.sourceKey,
        response: currentResponse,
        timeMs,
      }),
      minDelay(MIN_CHECK_MS),
    ]);

    setStageWillChange(false);

    if (!result.ok) {
      setPhase("idle");
      setErrorMessage(result.message);
      return;
    }

    // Record the attempt for traversal purposes
    setAttempts((prev) => {
      const updated = prev.filter((a) => a.beatSourceKey !== currentBeat.sourceKey);
      return [
        ...updated,
        {
          beatSourceKey: currentBeat.sourceKey,
          attemptNumber: result.attemptNumber,
          correct: result.correct,
          score: result.score,
        },
      ];
    });

    setFeedback(result.feedback);

    if (result.correct || strictMode) {
      setPhase("correct");
    } else {
      setPhase("incorrect");
    }
  }, [currentResponse, phase, submitBeatAction, moduleId, currentBeat, strictMode]);

  const handleNext = useCallback(async () => {
    if (phase !== "correct") return;

    const updatedAttempts = attempts;
    const nextBeat = getNextVisibleBeat(currentSourceKey, beats, updatedAttempts);

    if (nextBeat === null) {
      // Journey complete — call completeJourneyAction
      setFinalizing(true);
      setFinalizeError(null);

      const result = await completeJourneyAction({ moduleId });

      setFinalizing(false);

      if (!result.ok) {
        setFinalizeError(result.message);
        return;
      }

      onComplete(result.completion);
      return;
    }

    setDirection("forward");
    setStageWillChange(true);
    setCurrentSourceKey(nextBeat.sourceKey);
  }, [
    phase,
    attempts,
    currentSourceKey,
    beats,
    completeJourneyAction,
    moduleId,
    onComplete,
  ]);

  const handleRetry = useCallback(() => {
    if (phase !== "incorrect") return;
    setPhase("idle");
    setFeedback(null);
    // Preserve currentResponse so the user can see their answer and edit it
  }, [phase]);

  const handleBack = useCallback(() => {
    if (isFirstBeat || strictMode) return;
    const prevBeat = getPrevVisibleBeat(currentSourceKey, beats);
    if (!prevBeat) return;
    setDirection("back");
    setStageWillChange(true);
    setCurrentSourceKey(prevBeat.sourceKey);
  }, [isFirstBeat, strictMode, currentSourceKey, beats]);

  // Primary action dispatcher
  const handlePrimaryAction = useCallback(() => {
    if (phase === "idle") {
      handleCheck();
    } else if (phase === "correct") {
      handleNext();
    } else if (phase === "incorrect") {
      if (strictMode) {
        handleNext();
      } else {
        handleRetry();
      }
    }
  }, [phase, handleCheck, handleNext, handleRetry, strictMode]);

  // ---------------------------------------------------------------------------
  // Keyboard: Enter triggers primary action when response is valid
  // ---------------------------------------------------------------------------

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Enter") return;
      // Don't intercept Enter inside textarea / contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === "TEXTAREA" ||
        target.tagName === "INPUT" ||
        target.isContentEditable
      ) {
        return;
      }
      if (currentResponse !== null || phase !== "idle") {
        e.preventDefault();
        handlePrimaryAction();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentResponse, phase, handlePrimaryAction]);

  // ---------------------------------------------------------------------------
  // Variant selection based on direction
  // ---------------------------------------------------------------------------

  const stageVariants =
    direction === "forward" ? variants.beatAdvance : variants.beatBack;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100dvh",
        background: "var(--bg)",
      }}
    >
      {/* ── Top bar ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid var(--ypp-line-soft)",
          background: "var(--surface, #fff)",
          gap: 12,
          flexShrink: 0,
        }}
      >
        {/* Back button */}
        <button
          onClick={handleBack}
          disabled={isFirstBeat || strictMode}
          aria-label="Go to previous beat"
          style={{
            background: "none",
            border: "none",
            cursor: isFirstBeat || strictMode ? "not-allowed" : "pointer",
            opacity: isFirstBeat || strictMode ? 0.35 : 1,
            padding: "6px 10px",
            borderRadius: 6,
            fontSize: 18,
            color: "var(--ypp-ink)",
            lineHeight: 1,
          }}
        >
          ←
        </button>

        {/* Progress dots */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <JourneyProgress
            beats={beats}
            currentBeatSourceKey={currentSourceKey}
            attempts={attempts}
          />
        </div>

        {/* Exit link */}
        <Link
          href="/instructor-training"
          style={{
            fontSize: 13,
            color: "var(--muted)",
            textDecoration: "none",
            padding: "6px 10px",
            borderRadius: 6,
            whiteSpace: "nowrap",
          }}
        >
          Exit
        </Link>
      </div>

      {/* ── Error banner ── */}
      {(errorMessage || finalizeError) && (
        <div
          role="alert"
          aria-live="polite"
          style={{
            background: "#fee2e2",
            borderBottom: "1px solid #fca5a5",
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            fontSize: 14,
            color: "#991b1b",
            flexShrink: 0,
          }}
        >
          <span>{errorMessage ?? finalizeError}</span>
          <button
            onClick={async () => {
              if (finalizeError) {
                // Re-fire the completion action
                setFinalizeError(null);
                setFinalizing(true);
                const result = await completeJourneyAction({ moduleId });
                setFinalizing(false);
                if (!result.ok) {
                  setFinalizeError(result.message);
                  return;
                }
                onComplete(result.completion);
              } else {
                setErrorMessage(null);
              }
            }}
            style={{
              background: "none",
              border: "1px solid #fca5a5",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              color: "#991b1b",
              padding: "3px 8px",
              flexShrink: 0,
            }}
          >
            {finalizeError ? "Retry" : "Dismiss"}
          </button>
        </div>
      )}

      {/* ── Beat announce region for screen readers ── */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}
      >
        {phase === "correct" ? "Correct! Moving to next beat." : null}
        {phase === "incorrect" ? "Incorrect. Review feedback and try again." : null}
      </div>

      {/* ── Stage ── */}
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          position: "relative",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentSourceKey}
            variants={stageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onAnimationStart={() => setStageWillChange(true)}
            onAnimationComplete={() => setStageWillChange(false)}
            style={{
              flex: 1,
              padding: "24px 16px",
              willChange: stageWillChange ? "transform, opacity" : "auto",
            }}
          >
            <BeatRenderer
              beat={currentBeat}
              currentResponse={currentResponse}
              onResponseChange={setCurrentResponse}
              feedback={feedback}
              readOnly={isReadOnly}
            />
          </motion.div>
        </AnimatePresence>

        {/* Finalizing overlay */}
        {finalizing && (
          <div
            aria-live="polite"
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(255,255,255,0.85)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 15,
              color: "var(--ypp-purple)",
              fontWeight: 600,
            }}
          >
            Finalizing…
          </div>
        )}
      </div>

      {/* ── Bottom actions bar ── */}
      <div
        style={{
          padding: "16px",
          borderTop: "1px solid var(--ypp-line-soft)",
          background: "var(--surface, #fff)",
          display: "flex",
          justifyContent: "flex-end",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <BeatActions
          state={phase}
          canSubmit={currentResponse !== null}
          onCheck={handleCheck}
          onRetry={handleRetry}
          onNext={handleNext}
          strictMode={strictMode}
          isLastBeat={getNextVisibleBeat(currentSourceKey, beats, attempts) === null}
        />
      </div>

    </div>
  );
}
