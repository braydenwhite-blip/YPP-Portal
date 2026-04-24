"use client";

/**
 * FillInBlank — free-text answer; accepted answers are stripped server-side.
 *
 * Config shape (client-safe — acceptedAnswers/acceptedPatterns stripped):
 *   caseSensitive?: boolean
 *   hint?: string
 *
 * The prompt text lives on beat.prompt and is already rendered by BeatShell;
 * the textarea uses it only as an aria-label.
 *
 * Response shape: { text: string }
 * Non-null when: text.trim() is non-empty.
 *
 * readOnly disables the textarea.
 * Enter in a textarea inserts a newline (default browser behaviour); the
 * player's global Enter handler already excludes textareas so we do not
 * intercept the keydown event here.
 */

import { useState, useCallback } from "react";
import type { ClientBeat } from "@/lib/training-journey/types";

// ---------------------------------------------------------------------------
// Config shape
// ---------------------------------------------------------------------------

type FillInBlankConfig = {
  caseSensitive?: boolean;
  hint?: string;
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  beat: ClientBeat & { config: unknown };
  response: { text: string } | null;
  onResponseChange: (next: { text: string } | null) => void;
  readOnly: boolean;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FillInBlank({ beat, response, onResponseChange, readOnly }: Props) {
  const config = beat.config as FillInBlankConfig;
  const hint = config.hint;

  const [text, setText] = useState<string>(response?.text ?? "");

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

  return (
    <div
      className={["fill-in-blank", readOnly ? "fill-in-blank--readonly" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      <textarea
        className={[
          "fill-in-blank__textarea",
          readOnly ? "fill-in-blank__textarea--readonly" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        value={text}
        onChange={handleChange}
        aria-label={beat.prompt}
        aria-disabled={readOnly}
        disabled={readOnly}
        maxLength={200}
        rows={2}
        placeholder="Type your answer…"
      />

      {hint && (
        <p className="fill-in-blank__hint" aria-live="polite">
          {hint}
        </p>
      )}
    </div>
  );
}
