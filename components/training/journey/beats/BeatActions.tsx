"use client";

/**
 * BeatActions — the action bar exported separately and consumed by the player.
 *
 * Renders one primary button whose label changes with `state`:
 *   idle      → "Check"        (disabled if !canSubmit)
 *   checking  → spinner + "Checking…" (always disabled)
 *   correct   → "Next" / "Finish"
 *   incorrect + !strictMode → "Try again"
 *   incorrect + strictMode  → "Next"
 *
 * Enter key on the button fires the same handler as click.
 * Reduced-motion is respected — no bounce; the button just switches label.
 */

import { useJourneyMotion } from "@/components/training/journey/MotionProvider";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type BeatActionsProps = {
  state: "idle" | "checking" | "correct" | "incorrect";
  canSubmit: boolean;
  onCheck: () => void;
  onRetry: () => void;
  onNext: () => void;
  strictMode: boolean;
  isLastBeat: boolean;
};

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

function Spinner() {
  return (
    <svg
      className="beat-actions__spinner"
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="28"
        strokeDashoffset="10"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BeatActions({
  state,
  canSubmit,
  onCheck,
  onRetry,
  onNext,
  strictMode,
  isLastBeat,
}: BeatActionsProps) {
  // Motion context consumed to respect reduced-motion (no bounce).
  // We don't animate the button itself here; MotionProvider is referenced for
  // consistency with the rest of the journey surface.
  const { reduced } = useJourneyMotion();

  // ---------------------------------------------------------------------------
  // Derive label + handler + disabled state
  // ---------------------------------------------------------------------------

  let label: React.ReactNode;
  let onClick: () => void;
  let disabled: boolean;
  let ariaLabel: string;

  switch (state) {
    case "idle":
      label = "Check";
      onClick = onCheck;
      disabled = !canSubmit;
      ariaLabel = canSubmit ? "Check your answer" : "Check your answer (select an answer first)";
      break;

    case "checking":
      label = (
        <>
          <Spinner />
          Checking…
        </>
      );
      onClick = () => {};
      disabled = true;
      ariaLabel = "Checking your answer";
      break;

    case "correct":
      label = isLastBeat ? "Finish" : "Next";
      onClick = onNext;
      disabled = false;
      ariaLabel = isLastBeat ? "Finish the module" : "Go to the next beat";
      break;

    case "incorrect":
      if (strictMode) {
        label = "Next";
        onClick = onNext;
        ariaLabel = "Go to the next beat";
      } else {
        label = "Try again";
        onClick = onRetry;
        ariaLabel = "Try the question again";
      }
      disabled = false;
      break;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      className="beat-actions"
      // data-reduced lets CSS skip the button-bounce if needed
      data-reduced={reduced ? "true" : undefined}
    >
      <button
        type="button"
        className={[
          "button",
          "beat-actions__primary",
          state === "correct" ? "beat-actions__primary--correct" : "",
          state === "incorrect" ? "beat-actions__primary--incorrect" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-disabled={disabled}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled) {
            e.preventDefault();
            onClick();
          }
        }}
      >
        {label}
      </button>
    </div>
  );
}
