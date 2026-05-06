"use client";

/**
 * BeatFeedback — two-phase teaching simulation feedback.
 *
 *   Phase 1 (immediate): "What happened in the room"
 *     - studentReaction card (avatar + body language + optional quote)
 *     - one-line consequence ("Maya re-engages", "The room goes quiet")
 *
 *   Phase 2 (~520ms later): Coach analysis
 *     - mentor avatar + byline
 *     - opener + headline + body
 *     - hint + callouts
 *
 * If the feedback has no studentReaction/consequence (legacy content), Phase 1
 * is skipped and the mentor analysis renders immediately — same UX as before.
 *
 * Reduced-motion: phases reveal back-to-back with no springs; no transition
 * delay since users with reduced-motion preferences typically also expect
 * immediate information.
 *
 * Accessibility: aria-live="polite" on the wrapper. Announcements are batched
 * via aria-atomic so the screen reader hears the room reaction + analysis as
 * one coherent moment, not two interruptions.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { BeatFeedback as BeatFeedbackType } from "@/lib/training-journey/types";
import { useJourneyMotion } from "@/components/training/journey/MotionProvider";

// ---------------------------------------------------------------------------
// Mentor voice — small rotating list of warm, human openers, picked
// deterministically so the same beat always gets the same opener.
// ---------------------------------------------------------------------------

const POSITIVE_OPENERS = [
  "Nice read.",
  "That's the one.",
  "Good instinct.",
  "Yes — exactly that.",
  "You picked it up.",
];

const PARTIAL_OPENERS = ["Almost there.", "Close — a tweak.", "Right idea."];

const INCORRECT_OPENERS = [
  "Worth a closer look.",
  "Let's rewind a beat.",
  "Try this lens.",
];

const NOTED_OPENERS = ["Logged.", "Got it.", "Thanks for that."];

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
// Student archetype → emoji + accent. Kept small on purpose — these read as
// avatars, not characters. Avoid skin-tone emoji to dodge representation
// landmines; abstract faces only.
// ---------------------------------------------------------------------------

const ARCHETYPE_VISUALS: Record<
  NonNullable<NonNullable<BeatFeedbackType["studentReaction"]>["archetype"]>,
  { emoji: string; label: string }
> = {
  shy: { emoji: "🫥", label: "shy" },
  overconfident: { emoji: "😎", label: "overconfident" },
  distracted: { emoji: "🌀", label: "distracted" },
  nervous: { emoji: "😬", label: "nervous" },
  curious: { emoji: "🤔", label: "curious" },
  resistant: { emoji: "😶", label: "resistant" },
};

const MOOD_LABEL: Record<
  NonNullable<NonNullable<BeatFeedbackType["studentReaction"]>["mood"]>,
  string
> = {
  shutdown: "shutting down",
  engaged: "engaged",
  confused: "confused",
  "checked-out": "checked out",
  energized: "energized",
  frustrated: "frustrated",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type BeatFeedbackProps = {
  feedback: BeatFeedbackType;
};

function isPositiveTone(tone: BeatFeedbackType["tone"]): boolean {
  return tone === "correct" || tone === "noted";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BeatFeedback({ feedback }: BeatFeedbackProps) {
  const { variants, reduced } = useJourneyMotion();
  const regionRef = useRef<HTMLDivElement>(null);

  const opener = useMemo(
    () => pickOpener(feedback.tone, feedback.headline),
    [feedback.tone, feedback.headline]
  );

  const hasReaction = Boolean(feedback.studentReaction || feedback.consequence);
  const [showCoach, setShowCoach] = useState(!hasReaction);

  // Reveal mentor analysis after the room reaction has had a moment to land.
  useEffect(() => {
    if (!hasReaction) return;
    const id = setTimeout(() => setShowCoach(true), reduced ? 100 : 520);
    return () => clearTimeout(id);
  }, [hasReaction, reduced]);

  useEffect(() => {
    if (showCoach && isPositiveTone(feedback.tone)) {
      const id = setTimeout(() => regionRef.current?.focus(), 100);
      return () => clearTimeout(id);
    }
  }, [showCoach, feedback.tone]);

  return (
    <div
      ref={regionRef}
      className="beat-feedback-stack"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      tabIndex={-1}
      data-tone={feedback.tone}
    >
      {/* ── Phase 1: room reaction ── */}
      <AnimatePresence>
        {hasReaction ? (
          <motion.div
            key="reaction"
            className="room-reaction"
            data-tone={feedback.tone}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.1 : 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            {feedback.studentReaction ? (
              <div className="room-reaction__student">
                <span className="room-reaction__avatar" aria-hidden="true">
                  {feedback.studentReaction.archetype
                    ? ARCHETYPE_VISUALS[feedback.studentReaction.archetype].emoji
                    : "🙂"}
                </span>
                <div className="room-reaction__bio">
                  <span className="room-reaction__name">
                    {feedback.studentReaction.studentName}
                    {feedback.studentReaction.mood ? (
                      <span className="room-reaction__mood">
                        {" · "}
                        {MOOD_LABEL[feedback.studentReaction.mood]}
                      </span>
                    ) : null}
                  </span>
                  {feedback.studentReaction.bodyLanguage ? (
                    <span className="room-reaction__body-lang">
                      {feedback.studentReaction.bodyLanguage}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}

            {feedback.studentReaction?.quote ? (
              <p className="room-reaction__quote">
                &ldquo;{feedback.studentReaction.quote}&rdquo;
              </p>
            ) : null}

            {feedback.consequence ? (
              <p className="room-reaction__consequence">{feedback.consequence}</p>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ── Phase 2: mentor analysis ── */}
      <AnimatePresence>
        {showCoach ? (
          <motion.div
            key="coach"
            className="beat-feedback"
            data-tone={feedback.tone}
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
              <ul
                className="beat-feedback__callouts"
                aria-label="Feedback callouts"
              >
                {feedback.callouts.map((callout) => (
                  <li
                    key={String(callout.target)}
                    className="beat-feedback__callout"
                  >
                    {callout.label}
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
