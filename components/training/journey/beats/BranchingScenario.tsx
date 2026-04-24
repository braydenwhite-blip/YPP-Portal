"use client";

/**
 * BranchingScenario — scenario-framed single-choice beat.
 *
 * Config shape (client-safe — correctOptionId/feedback stripped server-side):
 *   rootPrompt: string
 *   options: { id, label, leadsToChildSourceKey: string | null }[]
 *
 * Displays config.rootPrompt as a styled scenario framing block above the
 * options. Options are rendered as a radiogroup identical to ScenarioChoice.
 * Options where leadsToChildSourceKey is non-null show a ⤷ indicator to hint
 * that the choice leads to a follow-up scenario.
 *
 * This component ONLY captures the user's root choice. Navigation to child
 * beats and showWhen evaluation are handled entirely by JourneyPlayer.
 *
 * Response shape: { selectedOptionId: string }
 * Non-null when: one option is selected.
 *
 * Keyboard: ArrowDown/ArrowUp navigate; Space/Enter select (copied from
 * ScenarioChoice — known-good pattern).
 *
 * readOnly disables all options.
 */

import { useState, useRef, useCallback, useId } from "react";
import type { ClientBeat } from "@/lib/training-journey/types";

// ---------------------------------------------------------------------------
// Config shape
// ---------------------------------------------------------------------------

type BranchingOption = {
  id: string;
  label: string;
  leadsToChildSourceKey: string | null;
};

type BranchingScenarioConfig = {
  rootPrompt: string;
  options: BranchingOption[];
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  beat: ClientBeat & { config: unknown };
  response: { selectedOptionId: string } | null;
  onResponseChange: (next: { selectedOptionId: string } | null) => void;
  readOnly: boolean;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BranchingScenario({ beat, response, onResponseChange, readOnly }: Props) {
  const config = beat.config as BranchingScenarioConfig;
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
      className={[
        "branching-scenario",
        readOnly ? "branching-scenario--readonly" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Scenario framing block */}
      <div
        className="branching-scenario__root-prompt"
        style={{
          padding: "16px",
          background: "var(--ypp-blush, #fdf6f0)",
          borderLeft: "4px solid var(--ypp-purple)",
          borderRadius: "var(--radius-md)",
          marginBottom: "20px",
        }}
      >
        {config.rootPrompt}
      </div>

      {/* Radio group — same pattern as ScenarioChoice */}
      <div
        role="radiogroup"
        aria-labelledby={`${groupId}-label`}
        aria-disabled={readOnly}
        className={[
          "branching-scenario__options",
          readOnly ? "branching-scenario__options--readonly" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span id={`${groupId}-label`} className="sr-only">
          {beat.prompt}
        </span>

        {options.map((option, index) => {
          const isSelected = selected === option.id;
          const hasBranch = option.leadsToChildSourceKey !== null;

          return (
            <div
              key={option.id}
              ref={(el) => { optionRefs.current[index] = el; }}
              role="radio"
              aria-checked={isSelected}
              aria-disabled={readOnly}
              tabIndex={
                readOnly
                  ? -1
                  : isSelected || (selected === null && index === 0)
                  ? 0
                  : -1
              }
              className={[
                "branching-scenario__option",
                isSelected ? "branching-scenario__option--selected" : "",
                readOnly ? "branching-scenario__option--readonly" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => handleSelect(option.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
            >
              <span
                className={[
                  "branching-scenario__indicator",
                  isSelected ? "branching-scenario__indicator--selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-hidden="true"
              />
              <span className="branching-scenario__label">{option.label}</span>
              {hasBranch && (
                <span
                  className="branching-scenario__branch-hint"
                  aria-label="leads to a follow-up scenario"
                  title="leads to a follow-up scenario"
                >
                  {" "}⤷
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
