"use client";

/**
 * Compare — two-card picker.
 *
 * Renders optionA and optionB side-by-side (stacked on mobile <640px).
 * Click a card to select it. Selected card: --ypp-purple border + --ypp-purple-50 bg.
 *
 * Config shape (client-safe — correctOptionId stripped):
 *   optionA: { id: "A"; label: string; body: string }
 *   optionB: { id: "B"; label: string; body: string }
 *
 * Response shape: { selectedOptionId: "A" | "B" }
 * Non-null when: one card is selected.
 *
 * ARIA: role="radiogroup", cards are role="radio", keyboard arrow navigation.
 * readOnly disables interaction.
 */

import { useState, useRef, useCallback, useId } from "react";
import type { ClientBeat } from "@/lib/training-journey/types";

// ---------------------------------------------------------------------------
// Config shape
// ---------------------------------------------------------------------------

type CompareOption = {
  id: "A" | "B";
  label: string;
  body: string;
};

type CompareConfig = {
  optionA: CompareOption;
  optionB: CompareOption;
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type CompareProps = {
  beat: ClientBeat & { config: unknown };
  response: { selectedOptionId: "A" | "B" } | null;
  onResponseChange: (next: { selectedOptionId: "A" | "B" } | null) => void;
  readOnly: boolean;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Compare({
  beat,
  response,
  onResponseChange,
  readOnly,
}: CompareProps) {
  const config = beat.config as CompareConfig;
  const options: CompareOption[] = [config.optionA, config.optionB].filter(Boolean);

  const [selected, setSelected] = useState<"A" | "B" | null>(
    response?.selectedOptionId ?? null
  );

  const groupId = useId();
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleSelect = useCallback(
    (id: "A" | "B") => {
      if (readOnly) return;
      setSelected(id);
      onResponseChange({ selectedOptionId: id });
    },
    [readOnly, onResponseChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>, index: number) => {
      if (readOnly) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = (index + 1) % options.length;
        cardRefs.current[next]?.focus();
        handleSelect(options[next].id);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = (index - 1 + options.length) % options.length;
        cardRefs.current[prev]?.focus();
        handleSelect(options[prev].id);
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        handleSelect(options[index].id);
      }
    },
    [readOnly, options, handleSelect]
  );

  return (
    <div
      role="radiogroup"
      aria-labelledby={`${groupId}-label`}
      aria-disabled={readOnly}
      className={["compare", readOnly ? "compare--readonly" : ""].filter(Boolean).join(" ")}
    >
      <span id={`${groupId}-label`} className="sr-only">
        {beat.prompt}
      </span>

      <div className="compare__grid">
        {options.map((option, index) => {
          const isSelected = selected === option.id;

          return (
            <div
              key={option.id}
              ref={(el) => { cardRefs.current[index] = el; }}
              role="radio"
              aria-checked={isSelected}
              aria-disabled={readOnly}
              tabIndex={readOnly ? -1 : isSelected || (selected === null && index === 0) ? 0 : -1}
              className={[
                "compare__card",
                "card",
                isSelected ? "compare__card--selected" : "",
                readOnly ? "compare__card--readonly" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => handleSelect(option.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
            >
              <div className="compare__card-header">
                <span
                  className={[
                    "compare__indicator",
                    isSelected ? "compare__indicator--selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-hidden="true"
                />
                <strong className="compare__card-label">{option.label}</strong>
              </div>
              <p className="compare__card-body">{option.body}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
