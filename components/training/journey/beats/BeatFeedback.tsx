"use client";

/**
 * BeatFeedback — mentor-style feedback card shown after a beat is submitted.
 *
 * Adds a small "Coach" byline + avatar so the panel reads as a person reacting,
 * not a flat verdict. Headlines lightly vary across attempts so users don't see
 * "That's the move" every single time. Reduced-motion safe via the existing
 * MotionProvider variants.
 *
 * Accessibility:
 *   - aria-live="polite" + aria-atomic="true" so screen readers announce on mount.
 *   - On positive tone, the panel is focused after 100 ms so the announcement
 *     is caught even when focus is elsewhere.
 */

import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import type { BeatFeedback as BeatFeedbackType } from "@/lib/training-journey/types";
import { useJourneyMotion } from "@/components/training/journey/MotionProvider";

// ---------------------------------------------------------------------------
// Mentor voice — small rotating list of warm, human openers.
// We pick deterministically based on the headline so the same beat always
// gets the same opener (no flicker, no unwanted novelty between renders).
// ---------------------------------------------------------------------------

const POSITIVE_OPENERS = [
  "Nice read.",
  "That's the one.",
  "Good instinct.",
  "Yes — exactly that.",
  "You picked it up.",
];

const PARTIAL_OPENERS = [
  "Almost there.",
  "Close — a tweak.",
  "Right idea.",
];

const INCORRECT_OPENERS = [
  "Worth a closer look.",
  "Let's rewind a beat.",
  "Try this lens.",
];

const NOTED_OPENERS = [
  "Logged.",
  "Got it.",
  "Thanks for that.",
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pickOpener(tone: BeatFeedbackType["tone"], seed: string): string {
  const list =
    tone === "correct"
      ? POSITIVE_OPENERS
      : tone === "partial"
      ? PARTIAL_OPENERS
      : tone === "noted"
      ? NOTED_OPENERS
      : INCORRECT_OPENERS;
  return list[hashStr(seed) % list.length];
}

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BeatFeedback({ feedback }: BeatFeedbackProps) {
  const { variants } = useJourneyMotion();
  const regionRef = useRef<HTMLDivElement>(null);

  const opener = useMemo(
    () => pickOpener(feedback.tone, feedback.headline),
    [feedback.tone, feedback.headline]
  );

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
      data-tone={feedback.tone}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      tabIndex={-1}
      variants={variants.fadeUp}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <div className="beat-feedback__top">
        <span className="beat-feedback__avatar" aria-hidden="true">
          MJ
        </span>
        <span className="beat-feedback__byline">
          <span className="beat-feedback__byline-name">Coach Mara</span>
          <span className="beat-feedback__byline-role">Workshop lead</span>
        </span>
      </div>

      <h3 className="beat-feedback__headline">
        <span className="beat-feedback__opener">{opener} </span>
        {feedback.headline}
      </h3>

      <p className="beat-feedback__body">{feedback.body}</p>

      {feedback.hint && (
        <p className="beat-feedback__hint">
          <strong>Try this:</strong> {feedback.hint}
        </p>
      )}

      {feedback.callouts && feedback.callouts.length > 0 && (
        <ul className="beat-feedback__callouts" aria-label="Feedback callouts">
          {feedback.callouts.map((callout) => (
            <li key={String(callout.target)} className="beat-feedback__callout">
              {callout.label}
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}
