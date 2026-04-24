"use client";

/**
 * JourneyProgress — horizontal row of progress dots, one per beat.
 *
 * States per dot:
 *   - current   : filled with --ypp-purple, slightly larger
 *   - correct   : filled with --ypp-purple (any attempt with correct=true)
 *   - incomplete: outlined only
 *
 * When a dot transitions to "correct", a 280ms scale pulse plays (plan §6,
 * DURATIONS.slow). Respects reduced-motion via useJourneyMotion().
 *
 * Accessibility: role="progressbar" on the row; aria-label per dot.
 */

import { motion } from "framer-motion";
import type { ClientBeat } from "@/lib/training-journey/types";
import type { JourneyAttemptSummary } from "@/lib/training-journey/client-contracts";
import { DURATIONS, EASE } from "@/lib/training-journey/motion";
import { useJourneyMotion } from "./MotionProvider";

export type JourneyProgressProps = {
  beats: ClientBeat[];
  currentBeatSourceKey: string;
  attempts: JourneyAttemptSummary[];
};

type DotState = "current" | "correct" | "incomplete";

function getDotState(
  beat: ClientBeat,
  currentBeatSourceKey: string,
  attempts: JourneyAttemptSummary[]
): DotState {
  if (beat.sourceKey === currentBeatSourceKey) return "current";
  const attempt = attempts.find((a) => a.beatSourceKey === beat.sourceKey);
  if (attempt?.correct) return "correct";
  return "incomplete";
}

export function JourneyProgress({
  beats,
  currentBeatSourceKey,
  attempts,
}: JourneyProgressProps) {
  const { reduced } = useJourneyMotion();

  const completedCount = beats.filter((b) => {
    const attempt = attempts.find((a) => a.beatSourceKey === b.sourceKey);
    return attempt?.correct === true;
  }).length;

  // Scale-pulse keyframes for the dot transitioning to "correct".
  // In reduced-motion mode: no scale, just a fast opacity flash.
  const correctPulseVariants = reduced
    ? {
        idle: { scale: 1, opacity: 1 },
        pulse: { scale: 1, opacity: [1, 0.6, 1], transition: { duration: DURATIONS.instant } },
      }
    : {
        idle: { scale: 1 },
        pulse: {
          scale: [1, 1.15, 1],
          transition: { duration: DURATIONS.slow, ease: EASE },
        },
      };

  return (
    <div
      role="progressbar"
      aria-valuenow={completedCount}
      aria-valuemax={beats.length}
      aria-label={`Journey progress: ${completedCount} of ${beats.length} beats completed`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 0",
      }}
    >
      {beats.map((beat, idx) => {
        const state = getDotState(beat, currentBeatSourceKey, attempts);
        const isFilled = state === "current" || state === "correct";
        const isCurrent = state === "current";

        const dotSize = isCurrent ? 10 : 8;

        const stateLabel =
          state === "current"
            ? "current"
            : state === "correct"
            ? "completed"
            : "not started";

        return (
          <motion.span
            key={beat.sourceKey}
            layout
            variants={correctPulseVariants}
            // Trigger pulse animation when transitioning to "correct"
            animate={state === "correct" ? "pulse" : "idle"}
            aria-label={`Beat ${idx + 1} of ${beats.length} — ${stateLabel}`}
            style={{
              display: "block",
              width: dotSize,
              height: dotSize,
              borderRadius: "50%",
              backgroundColor: isFilled
                ? "var(--ypp-purple)"
                : "transparent",
              border: isFilled
                ? "none"
                : "2px solid var(--ypp-purple-300)",
              transition: reduced
                ? undefined
                : `width ${DURATIONS.fast}s, height ${DURATIONS.fast}s`,
              flexShrink: 0,
            }}
          />
        );
      })}
    </div>
  );
}
