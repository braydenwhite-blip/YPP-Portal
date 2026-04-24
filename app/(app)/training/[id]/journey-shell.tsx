"use client";

/**
 * JourneyShell — top-level client component for interactive journey modules.
 *
 * State machine: "intro" → "player" → "complete"
 *
 * - Starts in "complete" if the user already passed (snapshot.completion?.passed).
 * - Wraps everything in <MotionProvider> for reduced-motion-aware animations.
 * - Wires the three server actions (submitBeatAttempt, completeInteractiveJourney,
 *   resumeInteractiveJourney) into the player components.
 * - On window focus, calls resumeInteractiveJourney to sync state for Phase 5+.
 */

import { useState, useEffect, useCallback } from "react";

import type { JourneySnapshot, JourneyCompletionSummary } from "@/lib/training-journey/client-contracts";
import { submitBeatAttempt, completeInteractiveJourney, resumeInteractiveJourney } from "@/lib/training-journey/actions";

import { MotionProvider } from "@/components/training/journey/MotionProvider";
import { JourneyIntro } from "@/components/training/journey/JourneyIntro";
import { JourneyPlayer } from "@/components/training/journey/JourneyPlayer";
import { JourneyComplete } from "@/components/training/journey/JourneyComplete";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JourneyShellProps = {
  snapshot: JourneySnapshot;
  backHref: string;
  backLabel: string;
  nextModule: { id: string; title: string } | null;
};

type Phase = "intro" | "player" | "complete";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function JourneyShell({
  snapshot,
  backHref,
  nextModule,
}: JourneyShellProps) {
  // Determine initial phase: skip straight to "complete" if already passed.
  const initialPhase: Phase =
    snapshot.completion?.passed === true ? "complete" : "intro";

  const [phase, setPhase] = useState<Phase>(initialPhase);

  // Completion state written during this visit (takes priority over snapshot.completion)
  const [completionState, setCompletionState] =
    useState<JourneyCompletionSummary | null>(null);

  // Active resume key — may be refreshed on window focus
  const [resumeBeatSourceKey, setResumeBeatSourceKey] = useState<string | null>(
    snapshot.resumeBeatSourceKey
  );

  // ---------------------------------------------------------------------------
  // On window focus: call resumeInteractiveJourney to pick up cross-tab progress.
  // Useful in Phase 5+; plumbed here for completeness. Only runs in "intro"
  // or "player" phase so we don't disturb the completion screen.
  // ---------------------------------------------------------------------------
  const handleFocus = useCallback(async () => {
    if (phase === "complete") return;

    const result = await resumeInteractiveJourney({ moduleId: snapshot.moduleId });
    if (result.ok) {
      setResumeBeatSourceKey(result.resumeBeatSourceKey);
    }
  }, [phase, snapshot.moduleId]);

  useEffect(() => {
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [handleFocus]);

  // ---------------------------------------------------------------------------
  // Derive intro mode
  // ---------------------------------------------------------------------------

  const introMode: "start" | "resume" | "review" = snapshot.completion
    ? "review"
    : snapshot.userAttempts.length > 0
    ? "resume"
    : "start";

  // ---------------------------------------------------------------------------
  // Derived: initialBeatSourceKey for the player
  // ---------------------------------------------------------------------------

  const firstBeatSourceKey = snapshot.beats[0]?.sourceKey ?? "";
  const playerInitialBeat = resumeBeatSourceKey ?? firstBeatSourceKey;

  // ---------------------------------------------------------------------------
  // Completion handler (called by JourneyPlayer after completeJourneyAction)
  // ---------------------------------------------------------------------------

  const handleComplete = useCallback((result: JourneyCompletionSummary) => {
    setCompletionState(result);
    setPhase("complete");
  }, []);

  // ---------------------------------------------------------------------------
  // Resolved completion (this visit takes priority over snapshot)
  // ---------------------------------------------------------------------------

  const resolvedCompletion = completionState ?? snapshot.completion;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <MotionProvider>
      {phase === "intro" && (
        <JourneyIntro
          title={snapshot.title}
          description={snapshot.description}
          estimatedMinutes={snapshot.estimatedMinutes}
          beatCount={snapshot.beats.length}
          backHref={backHref}
          mode={introMode}
          onStart={() => setPhase("player")}
        />
      )}

      {phase === "player" && (
        <JourneyPlayer
          moduleId={snapshot.moduleId}
          contentKey={snapshot.contentKey}
          beats={snapshot.beats}
          strictMode={snapshot.strictMode}
          passScorePct={snapshot.passScorePct}
          title={snapshot.title}
          initialBeatSourceKey={playerInitialBeat}
          userAttempts={snapshot.userAttempts}
          submitBeatAction={submitBeatAttempt}
          completeJourneyAction={completeInteractiveJourney}
          onComplete={handleComplete}
        />
      )}

      {phase === "complete" && resolvedCompletion !== null && (
        <JourneyComplete
          completion={resolvedCompletion}
          title={snapshot.title}
          backHref={backHref}
          nextModule={nextModule}
        />
      )}
    </MotionProvider>
  );
}
