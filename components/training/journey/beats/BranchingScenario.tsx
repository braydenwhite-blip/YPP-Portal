"use client";

/**
 * BranchingScenario — scenario-framed single-choice beat.
 *
 * Config shape (client-safe — correctOptionId/feedback stripped server-side):
 *   rootPrompt: string
 *   options: { id, label, leadsToChildSourceKey: string | null }[]
 *   breadcrumb?: string[]   — path of choices already made (set by player for
 *                             child beats when navigating into a branch).
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
  /** Breadcrumb path of prior choices shown when deep in a branch. */
  breadcrumb?: string[];
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
  const breadcrumb = config.breadcrumb ?? [];

  const [selected, setSelected] = useState<string | null>(
    response?.selectedOptionId ?? null
  );

  const groupId = useId();
  const promptId = useId();
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

  // Find the label of the currently selected option for the "you chose" breadcrumb.
  const selectedLabel = selected
    ? options.find((o) => o.id === selected)?.label
    : null;

  return (
    <div
      className={[
        "branching-scenario",
        readOnly ? "branching-scenario--readonly" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Breadcrumb — shows path of choices when deep in a branch */}
      {breadcrumb.length > 0 && (
        <nav
          className="branching-scenario__breadcrumb"
          aria-label="Your path through this scenario"
        >
          <ol className="branching-scenario__breadcrumb-list">
            {breadcrumb.map((crumb, i) => (
              <li key={i} className="branching-scenario__breadcrumb-item">
                {crumb}
              </li>
            ))}
          </ol>
        </nav>
      )}

      {/* "You chose X" inline note when an answer is selected in readOnly/review */}
      {readOnly && selectedLabel && (
        <p className="branching-scenario__you-chose" aria-live="polite">
          <span aria-hidden="true">You chose: </span>
          <strong>{selectedLabel}</strong>
        </p>
      )}

      {/* Scenario framing block */}
      <div
        id={promptId}
        className="branching-scenario__root-prompt"
      >
        {config.rootPrompt}
      </div>

      {/* Radio group — same pattern as ScenarioChoice */}
      <fieldset
        className={[
          "branching-scenario__fieldset",
          readOnly ? "branching-scenario__fieldset--readonly" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        disabled={readOnly}
      >
        <legend className="sr-only">{beat.prompt}</legend>

        <div
          role="radiogroup"
          aria-labelledby={`${groupId}-label`}
          aria-describedby={promptId}
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
                  hasBranch ? "branching-scenario__option--has-branch" : "",
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
                    title="Choosing this will show a follow-up question"
                  >
                    ⤷
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
