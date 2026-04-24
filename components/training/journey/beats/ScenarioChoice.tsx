"use client";

/**
 * ScenarioChoice — radio-style single-choice component.
 *
 * Each option is a clickable card with an outlined circle indicator.
 * Selected card: --ypp-purple border + --ypp-purple-50 background + 1px inset ring.
 *
 * ARIA: role="radiogroup" on parent, role="radio" + aria-checked on each option.
 * Keyboard: ArrowDown / ArrowUp navigate; Space / Enter select.
 * readOnly: all options get aria-disabled; pointer-events disabled via class.
 *
 * Response shape: { selectedOptionId: string }
 * Non-null when: one option is selected.
 */

import { useState, useRef, useCallback, useId } from "react";
import type { ClientBeat } from "@/lib/training-journey/types";

// ---------------------------------------------------------------------------
// Config shape (client-safe)
// ---------------------------------------------------------------------------

type ScenarioOption = {
  id: string;
  label: string;
};

type ScenarioChoiceConfig = {
  options: ScenarioOption[];
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type ScenarioChoiceProps = {
  beat: ClientBeat & { config: unknown };
  response: { selectedOptionId: string } | null;
  onResponseChange: (next: { selectedOptionId: string } | null) => void;
  readOnly: boolean;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ScenarioChoice({
  beat,
  response,
  onResponseChange,
  readOnly,
}: ScenarioChoiceProps) {
  const config = beat.config as ScenarioChoiceConfig;
  const options = config.options ?? [];

  const [selected, setSelected] = useState<string | null>(
    response?.selectedOptionId ?? null
  );

  const groupId = useId();
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleSelect = useCallback(
    (id: string) => {
      if (readOnly) return;
      setSelected(id);
      onResponseChange({ selectedOptionId: id });
    },
    [readOnly, onResponseChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>, index: number) => {
      if (readOnly) return;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        const next = (index + 1) % options.length;
        optionRefs.current[next]?.focus();
        handleSelect(options[next].id);
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        const prev = (index - 1 + options.length) % options.length;
        optionRefs.current[prev]?.focus();
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
      className={["scenario-choice", readOnly ? "scenario-choice--readonly" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      <span id={`${groupId}-label`} className="sr-only">
        {beat.prompt}
      </span>

      {options.map((option, index) => {
        const isSelected = selected === option.id;

        return (
          <div
            key={option.id}
            ref={(el) => { optionRefs.current[index] = el; }}
            role="radio"
            aria-checked={isSelected}
            aria-disabled={readOnly}
            tabIndex={readOnly ? -1 : isSelected || (selected === null && index === 0) ? 0 : -1}
            className={[
              "scenario-choice__option",
              isSelected ? "scenario-choice__option--selected" : "",
              readOnly ? "scenario-choice__option--readonly" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => handleSelect(option.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            <span
              className={[
                "scenario-choice__indicator",
                isSelected ? "scenario-choice__indicator--selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-hidden="true"
            />
            <span className="scenario-choice__label">{option.label}</span>
          </div>
        );
      })}
    </div>
  );
}
