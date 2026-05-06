"use client";

/**
 * FillInBlank — free-text answer; accepted answers are stripped server-side.
 *
 * Config shape (client-safe — acceptedAnswers/acceptedPatterns stripped):
 *   caseSensitive?: boolean
 *   hint?: string
 *   label?: string   — optional visible label; defaults to beat.prompt
 *
 * The prompt text lives on beat.prompt and is rendered by BeatShell.
 * We also render a visible <label> so sighted users understand the field.
 *
 * Response shape: { text: string }
 * Non-null when: text.trim() is non-empty.
 *
 * readOnly disables the textarea.
 *
 * Enter key submits (form submit behaviour) unless Shift is held (newline).
 * Auto-focus on mount unless the user prefers reduced motion (which often
 * correlates with screen-reader use where auto-focus is disruptive).
 */

import { useState, useCallback, useId, useRef, useEffect } from "react";
import type { ClientBeat } from "@/lib/training-journey/types";
import { useJourneyMotion } from "@/components/training/journey/MotionProvider";

// ---------------------------------------------------------------------------
// Config shape
// ---------------------------------------------------------------------------

type FillInBlankConfig = {
  caseSensitive?: boolean;
  hint?: string;
  /** Optional visible label for the input field. Falls back to beat.prompt. */
  label?: string;
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  beat: ClientBeat & { config: unknown };
  response: { text: string } | null;
  onResponseChange: (next: { text: string } | null) => void;
  readOnly: boolean;
  /** Called when the user presses Enter (without Shift) so the player can trigger Check. */
  onSubmitIntent?: () => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MAX_LENGTH = 200;

export function FillInBlank({ beat, response, onResponseChange, readOnly, onSubmitIntent }: Props) {
  const config = beat.config as FillInBlankConfig;
  const hint = config.hint;
  const { reduced } = useJourneyMotion();

  const [text, setText] = useState<string>(response?.text ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const inputId = useId();
  const hintId = useId();
  const countId = useId();

  // Auto-focus when beat mounts, unless reduced-motion (correlates with AT use).
  useEffect(() => {
    if (!readOnly && !reduced) {
      // Small delay so the component has settled in the DOM after animation.
      const id = setTimeout(() => {
        textareaRef.current?.focus();
      }, 120);
      return () => clearTimeout(id);
    }
  }, [readOnly, reduced]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (readOnly) return;
      const val = e.target.value;
      setText(val);
      if (val.trim().length > 0) {
        onResponseChange({ text: val });
      } else {
        onResponseChange(null);
      }
    },
    [readOnly, onResponseChange]
  );

  // Enter (without Shift) triggers Check. Shift+Enter allows newlines.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSubmitIntent?.();
      }
    },
    [onSubmitIntent]
  );

  const charCount = text.length;
  const nearLimit = charCount >= Math.floor(MAX_LENGTH * 0.8);
  const atLimit = charCount >= MAX_LENGTH;
  const visibleLabel = config.label ?? "Your answer";

  // Build aria-describedby ids for the textarea.
  const describedByIds = [hintId, countId].join(" ");

  return (
    <div
      className={["fill-in-blank", readOnly ? "fill-in-blank--readonly" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Visible label — associates with the textarea via htmlFor */}
      <label htmlFor={inputId} className="fill-in-blank__label">
        {visibleLabel}
      </label>

      {hint && (
        <p id={hintId} className="fill-in-blank__hint">
          {hint}
        </p>
      )}

      {/* Reserve space below the label with min-height so feedback doesn't
          shift the layout when it appears. */}
      <div className="fill-in-blank__input-wrapper">
        <textarea
          ref={textareaRef}
          id={inputId}
          className={[
            "fill-in-blank__textarea",
            readOnly ? "fill-in-blank__textarea--readonly" : "",
            atLimit ? "fill-in-blank__textarea--at-limit" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          aria-describedby={describedByIds}
          aria-disabled={readOnly}
          disabled={readOnly}
          maxLength={MAX_LENGTH}
          rows={3}
          placeholder="Type your answer… (press Enter to check)"
        />

        {/* Character count — updates live so screen readers can query it */}
        <span
          id={countId}
          className={[
            "fill-in-blank__char-count",
            nearLimit && !atLimit ? "fill-in-blank__char-count--warning" : "",
            atLimit ? "fill-in-blank__char-count--limit" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-live="polite"
          aria-atomic="true"
        >
          {charCount}/{MAX_LENGTH}
        </span>
      </div>
    </div>
  );
}
