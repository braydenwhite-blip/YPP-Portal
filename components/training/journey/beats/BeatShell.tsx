"use client";

/**
 * BeatShell — the outer container for every beat.
 *
 * Renders a semantic <section> with a <header> containing the kind chip and
 * title, then a body area for children (which includes the beat body and the
 * BeatFeedback panel when present). BeatActions is NOT rendered here — it is
 * owned by the player shell.
 *
 * Accessible: role="region", aria-labelledby ties the section to its title.
 * The `data-phase` attribute is toggled by the player during AnimatePresence
 * transitions; a CSS class uses it to set will-change on the wrapper element.
 */

import type { InteractiveBeatKind } from "@/lib/training-journey/types";
import { useId } from "react";

// ---------------------------------------------------------------------------
// Kind chip labels
// ---------------------------------------------------------------------------

const KIND_LABELS: Record<InteractiveBeatKind, string> = {
  CONCEPT_REVEAL: "Concept",
  SCENARIO_CHOICE: "Scenario",
  MULTI_SELECT: "Multi-select",
  SORT_ORDER: "Sort",
  MATCH_PAIRS: "Match",
  SPOT_THE_MISTAKE: "Spot the mistake",
  FILL_IN_BLANK: "Fill in the blank",
  BRANCHING_SCENARIO: "Branching scenario",
  REFLECTION: "Reflection",
  COMPARE: "Compare",
  HOTSPOT: "Hotspot",
  MESSAGE_COMPOSER: "Compose",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type BeatShellProps = {
  kind: InteractiveBeatKind;
  title: string;
  prompt: string;
  children: React.ReactNode;
  /** Set by the player during AnimatePresence mount/exit to trigger will-change. */
  "data-phase"?: "entering" | "exiting" | undefined;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BeatShell({
  kind,
  title,
  prompt,
  children,
  "data-phase": dataPhase,
}: BeatShellProps) {
  const titleId = useId();

  return (
    <section
      className="beat-shell"
      role="region"
      aria-labelledby={titleId}
      data-phase={dataPhase}
    >
      <header className="beat-shell__header">
        <span className="beat-shell__kind-chip" aria-label={`Beat type: ${KIND_LABELS[kind]}`}>
          {KIND_LABELS[kind]}
        </span>
        <h2 id={titleId} className="beat-shell__title">
          {title}
        </h2>
        {prompt && (
          <p className="beat-shell__prompt">{prompt}</p>
        )}
      </header>

      <div className="beat-shell__body">
        {children}
      </div>
    </section>
  );
}
