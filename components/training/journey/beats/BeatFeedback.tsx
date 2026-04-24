"use client";

/**
 * BeatFeedback — slides-up feedback panel shown after a beat is submitted.
 *
 * Accessibility:
 *   - aria-live="polite" + aria-atomic="true" so screen readers announce on mount.
 *   - On "correct" / "noted" tone, the panel is focused after 100 ms so the
 *     announcement is caught even when focus is elsewhere.
 *
 * Animation: uses the `fadeUp` variant from MotionProvider context.
 */

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { BeatFeedback as BeatFeedbackType } from "@/lib/training-journey/types";
import { useJourneyMotion } from "@/components/training/journey/MotionProvider";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type BeatFeedbackProps = {
  feedback: BeatFeedbackType;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPositiveTone(tone: BeatFeedbackType["tone"]): boolean {
  return tone === "correct" || tone === "noted";
}

function borderColor(tone: BeatFeedbackType["tone"]): string {
  return isPositiveTone(tone) ? "#16a34a" : "#b91c1c";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BeatFeedback({ feedback }: BeatFeedbackProps) {
  const { variants } = useJourneyMotion();
  const regionRef = useRef<HTMLDivElement>(null);

  // Focus the panel after correct/noted tone so screen readers catch it.
  useEffect(() => {
    if (isPositiveTone(feedback.tone)) {
      const id = setTimeout(() => {
        regionRef.current?.focus();
      }, 100);
      return () => clearTimeout(id);
    }
  }, [feedback.tone]);

  return (
    <motion.div
      ref={regionRef}
      className="beat-feedback"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      tabIndex={-1}
      style={{ borderLeftColor: borderColor(feedback.tone) }}
      variants={variants.fadeUp}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <h3 className="beat-feedback__headline">{feedback.headline}</h3>
      <p className="beat-feedback__body">{feedback.body}</p>

      {feedback.hint && (
        <p className="beat-feedback__hint">
          <em>{feedback.hint}</em>
        </p>
      )}

      {feedback.callouts && feedback.callouts.length > 0 && (
        <ul className="beat-feedback__callouts" aria-label="Feedback callouts">
          {feedback.callouts.map((callout) => (
            <li key={String(callout.target)} className="beat-feedback__callout">
              <strong>{callout.label}</strong>
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}
