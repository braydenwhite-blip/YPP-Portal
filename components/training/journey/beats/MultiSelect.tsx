"use client";

/**
 * MultiSelect — checkbox-style multi-select with animated SVG checkmark draw.
 *
 * Each option is a button[role="checkbox"]. On toggle ON, the checkmark SVG
 * path draws in via the `checkmarkDraw` variant from MotionProvider context.
 * Reduced-motion → instant opacity swap (pathLength stays 1).
 *
 * Config received from client (correct flag stripped by serialize.ts):
 *   options: { id: string; label: string }[]
 *
 * Response shape: { selectedOptionIds: string[] }
 * Non-null when: at least ONE option is selected.
 *
 * ARIA: role="group" on the container, aria-labelledby tied to beat prompt.
 *       Each row: role="checkbox", aria-checked. Space toggles.
 * readOnly: aria-disabled + pointer-events suppressed via class.
 */

import { useState, useCallback, useId } from "react";
import { motion } from "framer-motion";
import type { ClientBeat } from "@/lib/training-journey/types";
import { useJourneyMotion } from "@/components/training/journey/MotionProvider";

// ---------------------------------------------------------------------------
// Config shape (client-safe — correct flag stripped)
// ---------------------------------------------------------------------------

type MultiSelectOption = {
  id: string;
  label: string;
};

type MultiSelectConfig = {
  options: MultiSelectOption[];
  scoringMode?: string;
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type MultiSelectProps = {
  beat: ClientBeat & { config: unknown };
  response: { selectedOptionIds: string[] } | null;
  onResponseChange: (next: { selectedOptionIds: string[] } | null) => void;
  readOnly: boolean;
};

// ---------------------------------------------------------------------------
// SVG Checkmark
// ---------------------------------------------------------------------------

type CheckmarkProps = {
  checked: boolean;
  variants: ReturnType<typeof useJourneyMotion>["variants"];
};

function Checkmark({ checked, variants }: CheckmarkProps) {
  return (
    <svg
      className="multi-select__checkbox-svg"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="1"
        y="1"
        width="18"
        height="18"
        rx="4"
        stroke={checked ? "var(--ypp-purple)" : "var(--gray-300)"}
        strokeWidth="2"
        fill={checked ? "var(--ypp-purple-50)" : "transparent"}
      />
      {checked && (
        <motion.path
          d="M5 10 L8.5 13.5 L15 7"
          stroke="var(--ypp-purple)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          variants={variants.checkmarkDraw}
          initial="initial"
          animate="animate"
        />
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MultiSelect({
  beat,
  response,
  onResponseChange,
  readOnly,
}: MultiSelectProps) {
  const { variants } = useJourneyMotion();
  const config = beat.config as MultiSelectConfig;
  const options = config.options ?? [];

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(response?.selectedOptionIds ?? [])
  );

  const groupLabelId = useId();

  const handleToggle = useCallback(
    (id: string) => {
      if (readOnly) return;
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        if (next.size === 0) {
          onResponseChange(null);
        } else {
          onResponseChange({ selectedOptionIds: Array.from(next) });
        }
        return next;
      });
    },
    [readOnly, onResponseChange]
  );

  return (
    <div
      role="group"
      aria-labelledby={groupLabelId}
      aria-disabled={readOnly}
      className={["multi-select", readOnly ? "multi-select--readonly" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      <span id={groupLabelId} className="sr-only">
        {beat.prompt}
      </span>

      {options.map((option) => {
        const isChecked = selected.has(option.id);

        return (
          <button
            key={option.id}
            type="button"
            role="checkbox"
            aria-checked={isChecked}
            aria-disabled={readOnly}
            disabled={readOnly}
            className={[
              "multi-select__option",
              isChecked ? "multi-select__option--checked" : "",
              readOnly ? "multi-select__option--readonly" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => handleToggle(option.id)}
            onKeyDown={(e) => {
              if (e.key === " ") {
                e.preventDefault();
                handleToggle(option.id);
              }
            }}
          >
            <Checkmark checked={isChecked} variants={variants} />
            <span className="multi-select__label">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
