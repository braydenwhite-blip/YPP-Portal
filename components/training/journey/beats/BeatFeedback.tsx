"use client";

/**
 * BeatFeedback — cinematic teaching simulation feedback.
 *
 * Phasing (when fields are authored — every phase is optional and skipped
 * gracefully if absent):
 *
 *   1. Mentor aside       (≈ immediately) ─ short coach quip before the room
 *      reacts ("Watch this." / "Hold this for a beat.")
 *   2. Room reaction      (≈ 180 ms)      ─ focal student card +
 *      bodyLanguage + optional quote, plus a peer-ripple line for how the
 *      rest of the room moves.
 *   3. Consequence line   (same phase)    ─ "Maya re-engages." style.
 *   4. Coach typing       (≈ 460 ms)      ─ three-dot indicator in the
 *      mentor avatar slot. If `ambientLine` is authored it shows here as
 *      atmospheric subtitle ("The room holds its breath.").
 *   5. Mentor analysis    (≈ 760 ms)      ─ opener + headline + body +
 *      hint + callouts.
 *   6. Recovery prompt    (after analysis) ─ ONLY on incorrect feedback,
 *      ONLY when authored. A single follow-up "what do you do now?" with
 *      2-3 quick options. Pick → see room reaction → mentor accepts. Purely
 *      cosmetic for scoring; existential for the *feeling* of recoverability.
 *
 * Reduced-motion: phases collapse to a single 100ms reveal; no springs.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { BeatFeedback as BeatFeedbackType } from "@/lib/training-journey/types";
import { useJourneyMotion } from "@/components/training/journey/MotionProvider";
import { RecoveryPrompt } from "./RecoveryPrompt";

// ---------------------------------------------------------------------------
// Mentor voice — wider rotating list of warm, human openers, picked
// deterministically so the same beat always gets the same opener.
// ---------------------------------------------------------------------------

const POSITIVE_OPENERS = [
  "Nice read.",
  "That's the one.",
  "Good instinct.",
  "Yes — exactly that.",
  "You picked it up.",
  "Clean move.",
  "That's the read I wanted.",
  "Steady.",
];

const PARTIAL_OPENERS = [
  "Almost there.",
  "Close — a tweak.",
  "Right idea.",
  "The shape is right.",
  "Most of the way.",
];

const INCORRECT_OPENERS = [
  "Worth a closer look.",
  "Let's rewind a beat.",
  "Try this lens.",
  "Pause here for a sec.",
  "Stick with me.",
  "Not quite — here's why.",
];

const NOTED_OPENERS = ["Logged.", "Got it.", "Thanks for that.", "Noted."];

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

// Default ambient lines used when consequence is dramatic but author didn't
// supply an `ambientLine`. Picked by the absolute magnitude of roomDelta sum.
function inferAmbientLine(feedback: BeatFeedbackType): string | null {
  if (feedback.ambientLine) return feedback.ambientLine;
  const d = feedback.roomDelta;
  if (!d) return null;
  const total =
    Math.abs(d.engagement ?? 0) +
    Math.abs(d.clarity ?? 0) +
    Math.abs(d.energy ?? 0);
  if (total < 3) return null;

  // Tone-aware atmospheric defaults.
  if (feedback.tone === "correct") {
    return total >= 5
      ? "The room exhales. You feel it shift."
      : "A small click — the room leans in.";
  }
  if (feedback.tone === "incorrect" || feedback.tone === "partial") {
    return total >= 5
      ? "The room cools. The silence has weight."
      : "A pause stretches. You feel it land.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type BeatFeedbackProps = {
  feedback: BeatFeedbackType;
  /** Parent player can listen for room-state nudges from a recovery pick.
   *  Optional — used for HUD updates only, doesn't affect scoring. */
  onRecoveryRoomDelta?: (delta: {
    engagement?: number;
    clarity?: number;
    energy?: number;
  }) => void;
};

function isPositiveTone(tone: BeatFeedbackType["tone"]): boolean {
  return tone === "correct" || tone === "noted";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BeatFeedback({ feedback, onRecoveryRoomDelta }: BeatFeedbackProps) {
  const { variants, reduced } = useJourneyMotion();
  const regionRef = useRef<HTMLDivElement>(null);

  const opener = useMemo(
    () => pickOpener(feedback.tone, feedback.headline),
    [feedback.tone, feedback.headline]
  );
  const ambientLine = useMemo(() => inferAmbientLine(feedback), [feedback]);

  const hasAside = Boolean(feedback.mentorAside);
  const hasReaction = Boolean(feedback.studentReaction || feedback.consequence);
  const hasAmbient = Boolean(ambientLine);

  const [showAside, setShowAside] = useState(!hasAside);
  const [showReaction, setShowReaction] = useState(!hasAside && !hasReaction);
  const [showTyping, setShowTyping] = useState(false);
  const [showCoach, setShowCoach] = useState(!hasAside && !hasReaction && !hasAmbient);

  // Reveal timeline. Each phase has its own timer so the choreography reads
  // as deliberate pacing, not a stutter. Reduced-motion users skip straight
  // to coach analysis after a single tick.
  useEffect(() => {
    if (reduced) {
      setShowAside(true);
      setShowReaction(true);
      setShowCoach(true);
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];

    if (hasAside) {
      // Aside lands at t=0. Reaction follows it.
      setShowAside(true);
      if (hasReaction) {
        timers.push(setTimeout(() => setShowReaction(true), 380));
      }
    } else if (hasReaction) {
      // No aside — reaction lands first.
      timers.push(setTimeout(() => setShowReaction(true), 80));
    }

    // Coach typing dots before the analysis card. Slightly delayed when there's
    // a reaction or an ambient line so the room beat has time to land.
    const typingDelay = hasAside
      ? hasReaction
        ? 720
        : 420
      : hasReaction
      ? 520
      : 60;
    timers.push(setTimeout(() => setShowTyping(true), typingDelay));

    // Coach card reveal — dots vanish, analysis fades in.
    const coachDelay = typingDelay + (hasAmbient ? 720 : 320);
    timers.push(
      setTimeout(() => {
        setShowTyping(false);
        setShowCoach(true);
      }, coachDelay)
    );

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [reduced, hasAside, hasReaction, hasAmbient]);

  useEffect(() => {
    if (showCoach && isPositiveTone(feedback.tone)) {
      const id = setTimeout(() => regionRef.current?.focus(), 100);
      return () => clearTimeout(id);
    }
  }, [showCoach, feedback.tone]);

  const showRecovery =
    showCoach && feedback.tone === "incorrect" && Boolean(feedback.recoveryPrompt);

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
      {/* ── Phase 0: mentor aside ── */}
      <AnimatePresence>
        {showAside && feedback.mentorAside ? (
          <motion.div
            key="aside"
            className="mentor-aside"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.1 : 0.26, ease: [0.22, 1, 0.36, 1] }}
            aria-label={`Mentor aside: ${feedback.mentorAside}`}
          >
            <span className="mentor-aside__avatar" aria-hidden="true">
              MJ
            </span>
            <span className="mentor-aside__text">{feedback.mentorAside}</span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ── Phase 1: room reaction ── */}
      <AnimatePresence>
        {showReaction && hasReaction ? (
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

            {feedback.peerRipple ? (
              <p className="room-reaction__ripple">{feedback.peerRipple}</p>
            ) : null}

            {feedback.consequence ? (
              <p className="room-reaction__consequence">{feedback.consequence}</p>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ── Phase 1.5: coach typing + ambient line ── */}
      <AnimatePresence>
        {showTyping ? (
          <motion.div
            key="typing"
            className="coach-typing"
            data-tone={feedback.tone}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: reduced ? 0.1 : 0.22, ease: [0.22, 1, 0.36, 1] }}
            aria-hidden="true"
          >
            <span className="coach-typing__avatar">MJ</span>
            <span className="coach-typing__dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            {ambientLine ? (
              <span className="coach-typing__ambient">{ambientLine}</span>
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

      {/* ── Phase 3: recovery prompt (incorrect only, when authored) ── */}
      {showRecovery && feedback.recoveryPrompt ? (
        <RecoveryPrompt
          prompt={feedback.recoveryPrompt}
          onRoomDelta={onRecoveryRoomDelta}
        />
      ) : null}
    </div>
  );
}
