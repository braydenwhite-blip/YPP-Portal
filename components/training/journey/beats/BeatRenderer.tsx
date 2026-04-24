"use client";

/**
 * BeatRenderer — switch dispatcher that maps beat.kind to a body component.
 *
 * Unconditionally wraps output in <BeatShell>. For the six M1 kinds, renders
 * the matching body component. For any other kind, renders a non-fatal alert
 * (`role="alert"`) and logs to console.error once — the player's error boundary
 * handles fatal crashes; we keep this surface alive.
 *
 * Contract from JourneyPlayer:
 *   <BeatRenderer
 *     beat={beat}
 *     currentResponse={response}
 *     onResponseChange={(next) => setResponse(next)}
 *     feedback={feedback}
 *     readOnly={readOnly}
 *   />
 *
 * BeatActions is NOT rendered here — the player owns the actions bar so it
 * sits outside the per-beat AnimatePresence surface.
 */

import { useRef } from "react";
import type { ClientBeat, BeatFeedback } from "@/lib/training-journey/types";
import { BeatShell } from "./BeatShell";
import { BeatFeedback as BeatFeedbackPanel } from "./BeatFeedback";
import { ConceptReveal } from "./ConceptReveal";
import { ScenarioChoice } from "./ScenarioChoice";
import { MultiSelect } from "./MultiSelect";
import { SpotTheMistake } from "./SpotTheMistake";
import { Compare } from "./Compare";
import { Reflection } from "./Reflection";
import { SortOrder } from "./SortOrder";
import { MatchPairs } from "./MatchPairs";
import { FillInBlank } from "./FillInBlank";
import { BranchingScenario } from "./BranchingScenario";
import { Hotspot } from "./Hotspot";
import { MessageComposer } from "./MessageComposer";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type BeatRendererProps = {
  beat: ClientBeat;
  currentResponse: unknown | null;
  onResponseChange: (next: unknown | null) => void;
  feedback: BeatFeedback | null;
  readOnly: boolean;
};

// ---------------------------------------------------------------------------
// Unsupported kind notice — rendered once, error logged once per kind
// ---------------------------------------------------------------------------

const _loggedKinds = new Set<string>();

function UnsupportedKind({ kind }: { kind: string }) {
  if (!_loggedKinds.has(kind)) {
    _loggedKinds.add(kind);
    console.error(
      `[BeatRenderer] Beat kind "${kind}" is not yet implemented in Phase 4. ` +
        "Add a case to BeatRenderer.tsx when the body component is available."
    );
  }

  return (
    <div role="alert" className="beat-renderer__unsupported">
      <p>This beat kind isn&apos;t available yet.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BeatRenderer({
  beat,
  currentResponse,
  onResponseChange,
  feedback,
  readOnly,
}: BeatRendererProps) {
  // Track whether we need to suppress re-logging for the same kind in this render.
  const bodyRef = useRef<React.ReactNode>(null);

  let body: React.ReactNode;

  switch (beat.kind) {
    case "CONCEPT_REVEAL":
      body = (
        <ConceptReveal
          beat={beat as ClientBeat & { config: unknown }}
          response={currentResponse as { visitedPanelIds: string[] } | null}
          onResponseChange={onResponseChange as (next: { visitedPanelIds: string[] } | null) => void}
          readOnly={readOnly}
        />
      );
      break;

    case "SCENARIO_CHOICE":
      body = (
        <ScenarioChoice
          beat={beat as ClientBeat & { config: unknown }}
          response={currentResponse as { selectedOptionId: string } | null}
          onResponseChange={onResponseChange as (next: { selectedOptionId: string } | null) => void}
          readOnly={readOnly}
        />
      );
      break;

    case "MULTI_SELECT":
      body = (
        <MultiSelect
          beat={beat as ClientBeat & { config: unknown }}
          response={currentResponse as { selectedOptionIds: string[] } | null}
          onResponseChange={
            onResponseChange as (next: { selectedOptionIds: string[] } | null) => void
          }
          readOnly={readOnly}
        />
      );
      break;

    case "SPOT_THE_MISTAKE":
      body = (
        <SpotTheMistake
          beat={beat as ClientBeat & { config: unknown }}
          response={currentResponse as { clickedTargetId: string } | null}
          onResponseChange={
            onResponseChange as (next: { clickedTargetId: string } | null) => void
          }
          readOnly={readOnly}
        />
      );
      break;

    case "COMPARE":
      body = (
        <Compare
          beat={beat as ClientBeat & { config: unknown }}
          response={currentResponse as { selectedOptionId: "A" | "B" } | null}
          onResponseChange={
            onResponseChange as (next: { selectedOptionId: "A" | "B" } | null) => void
          }
          readOnly={readOnly}
        />
      );
      break;

    case "REFLECTION":
      body = (
        <Reflection
          beat={beat as ClientBeat & { config: unknown }}
          response={currentResponse as { text: string } | null}
          onResponseChange={onResponseChange as (next: { text: string } | null) => void}
          readOnly={readOnly}
        />
      );
      break;

    case "SORT_ORDER":
      body = (
        <SortOrder
          beat={beat as ClientBeat & { config: unknown }}
          response={currentResponse as { orderedIds: string[] } | null}
          onResponseChange={
            onResponseChange as (next: { orderedIds: string[] } | null) => void
          }
          readOnly={readOnly}
        />
      );
      break;

    case "MATCH_PAIRS":
      body = (
        <MatchPairs
          beat={beat as ClientBeat & { config: unknown }}
          response={
            currentResponse as { pairs: { leftId: string; rightId: string }[] } | null
          }
          onResponseChange={
            onResponseChange as (
              next: { pairs: { leftId: string; rightId: string }[] } | null
            ) => void
          }
          readOnly={readOnly}
        />
      );
      break;

    case "FILL_IN_BLANK":
      body = (
        <FillInBlank
          beat={beat as ClientBeat & { config: unknown }}
          response={currentResponse as { text: string } | null}
          onResponseChange={onResponseChange as (next: { text: string } | null) => void}
          readOnly={readOnly}
        />
      );
      break;

    case "BRANCHING_SCENARIO":
      body = (
        <BranchingScenario
          beat={beat as ClientBeat & { config: unknown }}
          response={currentResponse as { selectedOptionId: string } | null}
          onResponseChange={
            onResponseChange as (next: { selectedOptionId: string } | null) => void
          }
          readOnly={readOnly}
        />
      );
      break;

    case "HOTSPOT":
      body = (
        <Hotspot
          beat={beat as ClientBeat & { config: unknown }}
          response={currentResponse as { x: number; y: number } | null}
          onResponseChange={
            onResponseChange as (next: { x: number; y: number } | null) => void
          }
          readOnly={readOnly}
        />
      );
      break;

    case "MESSAGE_COMPOSER":
      body = (
        <MessageComposer
          beat={beat as ClientBeat & { config: unknown }}
          response={
            currentResponse as {
              selections: { poolId: string; snippetIds: string[] }[];
            } | null
          }
          onResponseChange={
            onResponseChange as (
              next: {
                selections: { poolId: string; snippetIds: string[] }[];
              } | null
            ) => void
          }
          readOnly={readOnly}
        />
      );
      break;

    default:
      body = <UnsupportedKind kind={beat.kind} />;
      break;
  }

  bodyRef.current = body;

  return (
    <BeatShell kind={beat.kind} title={beat.title} prompt={beat.prompt}>
      {body}
      {feedback ? <BeatFeedbackPanel feedback={feedback} /> : null}
    </BeatShell>
  );
}
