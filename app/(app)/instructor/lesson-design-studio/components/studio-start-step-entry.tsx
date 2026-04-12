"use client";

import { SEED_CURRICULA, type SeedCurriculum } from "../curriculum-seeds";
import { StudioStartStep } from "./studio-start-step";

interface StudioStartStepEntryProps {
  interestArea: string;
  isReadOnly: boolean;
  hasStartedDraft: boolean;
  onApplyStarterScaffold: (seed: SeedCurriculum) => void;
  onMoveForward: () => void;
  onOpenStarterTour: () => void;
}

function normalizeTopic(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function scoreSeedMatch(seed: SeedCurriculum, topic: string) {
  const draft = normalizeTopic(topic);
  const seedTopic = normalizeTopic(seed.interestArea);
  if (!draft) return 0;
  if (seedTopic === draft) return 100;
  if (seedTopic.includes(draft) || draft.includes(seedTopic)) return 80;

  const draftWords = new Set(draft.split(" ").filter(Boolean));
  return seedTopic
    .split(" ")
    .filter((word) => draftWords.has(word)).length * 20;
}

export function StudioStartStepEntry({
  interestArea,
  isReadOnly,
  hasStartedDraft,
  onApplyStarterScaffold,
  onMoveForward,
  onOpenStarterTour,
}: StudioStartStepEntryProps) {
  const recommendedScaffoldId =
    SEED_CURRICULA.reduce<{ seed: SeedCurriculum; score: number } | null>(
      (best, seed) => {
        const score = scoreSeedMatch(seed, interestArea);
        if (!best || score > best.score) {
          return { seed, score };
        }
        return best;
      },
      null
    )?.seed.id ?? SEED_CURRICULA[0].id;

  return (
    <StudioStartStep
      starterScaffolds={SEED_CURRICULA}
      recommendedScaffoldId={recommendedScaffoldId}
      isReadOnly={isReadOnly}
      hasStartedDraft={hasStartedDraft}
      onApplyStarterScaffold={onApplyStarterScaffold}
      onMoveForward={onMoveForward}
      onOpenStarterTour={onOpenStarterTour}
    />
  );
}
