"use client";

/**
 * RecoveryPrompt — inline mini-beat that appears only after an INCORRECT
 * feedback when the author supplied a `recoveryPrompt` block.
 *
 * Purpose: turn dead-end mistakes into recoverable moments. The learner
 * sees one tight follow-up question with 2-3 quick moves; picking one
 * shows a short reaction line and (optionally) nudges the room HUD.
 *
 * The pick does NOT change the underlying score — the parent beat is
 * already locked. This is purely an immersion / emotional-payoff layer.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { BeatFeedback } from "@/lib/training-journey/types";
import { useJourneyMotion } from "@/components/training/journey/MotionProvider";

type RecoveryPromptProps = {
  prompt: NonNullable<BeatFeedback["recoveryPrompt"]>;
  onRoomDelta?: (delta: {
    engagement?: number;
    clarity?: number;
    energy?: number;
  }) => void;
};

export function RecoveryPrompt({ prompt, onRoomDelta }: RecoveryPromptProps) {
  const { reduced } = useJourneyMotion();
  const [pickedId, setPickedId] = useState<string | null>(null);

  const picked = prompt.options.find((o) => o.id === pickedId) ?? null;

  function handlePick(optionId: string) {
    if (pickedId !== null) return; // single-shot
    const option = prompt.options.find((o) => o.id === optionId);
    if (!option) return;
    setPickedId(optionId);
    if (option.roomDelta && onRoomDelta) {
      onRoomDelta(option.roomDelta);
    }
  }

  return (
    <motion.div
      className="recovery-prompt"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0.1 : 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="recovery-prompt__head">
        <span className="recovery-prompt__chip">Recovery move</span>
        <p className="recovery-prompt__question">{prompt.question}</p>
      </div>

      <div
        className="recovery-prompt__options"
        role="group"
        aria-label="Recovery options"
        aria-disabled={pickedId !== null}
      >
        {prompt.options.map((option) => {
          const isPicked = pickedId === option.id;
          const isFaded = pickedId !== null && !isPicked;
          return (
            <button
              key={option.id}
              type="button"
              className={[
                "recovery-prompt__option",
                isPicked ? "recovery-prompt__option--picked" : "",
                isFaded ? "recovery-prompt__option--faded" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => handlePick(option.id)}
              disabled={pickedId !== null}
            >
              <span className="recovery-prompt__option-arrow" aria-hidden="true">
                ↳
              </span>
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {picked ? (
          <motion.div
            key="reaction"
            className="recovery-prompt__reaction"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0.1 : 0.24, ease: [0.22, 1, 0.36, 1] }}
            role="status"
            aria-live="polite"
          >
            <span className="recovery-prompt__reaction-label">
              In the room
            </span>
            <span className="recovery-prompt__reaction-text">
              {picked.reaction}
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
