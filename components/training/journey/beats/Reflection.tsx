"use client";

/**
 * Reflection — open textarea; not scored.
 *
 * Config shape (client-safe):
 *   minLength: number
 *   maxLength: number
 *   sampleAnswers: string[]
 *
 * Anti-anchoring: sampleAnswers are revealed ONLY after the beat has been
 * submitted (feedback is non-null AND tone === "noted"). Never shown before
 * submit (plan §5).
 *
 * Response shape: { text: string }
 * Non-null when: text.trim().length >= config.minLength.
 *
 * readOnly disables the textarea.
 */

import { useState, useCallback } from "react";
import type { ClientBeat, BeatFeedback } from "@/lib/training-journey/types";

// ---------------------------------------------------------------------------
// Config shape
// ---------------------------------------------------------------------------

type ReflectionConfig = {
  minLength: number;
  maxLength: number;
  sampleAnswers?: string[];
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type ReflectionProps = {
  beat: ClientBeat & { config: unknown };
  response: { text: string } | null;
  onResponseChange: (next: { text: string } | null) => void;
  readOnly: boolean;
  /** Optional: passed through by the player so we can reveal sampleAnswers post-submit. */
  feedback?: BeatFeedback | null;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Reflection({
  beat,
  response,
  onResponseChange,
  readOnly,
  feedback,
}: ReflectionProps) {
  const config = beat.config as ReflectionConfig;
  const minLength = config.minLength ?? 40;
  const maxLength = config.maxLength ?? 500;
  const sampleAnswers = config.sampleAnswers ?? [];

  const [text, setText] = useState<string>(response?.text ?? "");

  const charCount = text.length;
  const trimmed = text.trim();
  const isValid = trimmed.length >= minLength;

  // Show sample answers only after a "noted" feedback has been received.
  const showSamples =
    sampleAnswers.length > 0 &&
    feedback != null &&
    feedback.tone === "noted";

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (readOnly) return;
      const val = e.target.value;
      setText(val);
      if (val.trim().length >= minLength) {
        onResponseChange({ text: val });
      } else {
        onResponseChange(null);
      }
    },
    [readOnly, minLength, onResponseChange]
  );

  return (
    <div className="reflection">
      <div className="reflection__field">
        <label htmlFor={`reflection-textarea-${beat.id}`} className="sr-only">
          {beat.prompt}
        </label>
        <textarea
          id={`reflection-textarea-${beat.id}`}
          className={[
            "reflection__textarea",
            readOnly ? "reflection__textarea--readonly" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          value={text}
          onChange={handleChange}
          placeholder="Your reflection..."
          minLength={minLength}
          maxLength={maxLength}
          disabled={readOnly}
          aria-disabled={readOnly}
          aria-describedby={`reflection-count-${beat.id}`}
          rows={5}
        />
        <div
          id={`reflection-count-${beat.id}`}
          className={[
            "reflection__char-count",
            charCount > maxLength ? "reflection__char-count--over" : "",
            !isValid && charCount > 0 ? "reflection__char-count--under" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-live="polite"
        >
          {charCount}/{maxLength}
          {!isValid && charCount > 0 && (
            <span className="reflection__min-hint">
              {" "}— {minLength - trimmed.length} more character
              {minLength - trimmed.length === 1 ? "" : "s"} needed
            </span>
          )}
        </div>
      </div>

      {showSamples && (
        <details className="reflection__samples">
          <summary className="reflection__samples-summary">
            Compare your reflection
          </summary>
          <ul className="reflection__samples-list">
            {sampleAnswers.map((answer, i) => (
              <li key={i} className="reflection__sample">
                {answer}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
