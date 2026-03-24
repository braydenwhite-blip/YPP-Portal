export type LegacyDifficultyLevel =
  | "LEVEL_101"
  | "LEVEL_201"
  | "LEVEL_301"
  | "LEVEL_401";

type LearnerFitCopy = {
  label: string;
  description: string;
  accent: string;
};

const LEGACY_LEARNER_FIT_COPY: Record<LegacyDifficultyLevel, LearnerFitCopy> = {
  LEVEL_101: {
    label: "Best for first-time learners",
    description: "No prior experience needed.",
    accent: "#22c55e",
  },
  LEVEL_201: {
    label: "Great if you've tried the basics",
    description: "Some early experience helps, but support is still built in.",
    accent: "#3b82f6",
  },
  LEVEL_301: {
    label: "Best if you can work more independently",
    description: "Learners should be ready for faster pacing and lighter scaffolding.",
    accent: "#f59e0b",
  },
  LEVEL_401: {
    label: "Best if you're ready for advanced project work",
    description: "Learners should be comfortable owning complex work with creative freedom.",
    accent: "#ef4444",
  },
};

const DEFAULT_LEARNER_FIT: LearnerFitCopy = LEGACY_LEARNER_FIT_COPY.LEVEL_101;

export function getLegacyLearnerFitCopy(
  difficultyLevel: string | null | undefined
): LearnerFitCopy {
  return LEGACY_LEARNER_FIT_COPY[
    (difficultyLevel as LegacyDifficultyLevel) || "LEVEL_101"
  ] ?? DEFAULT_LEARNER_FIT;
}

export function getLearnerFitSummary(input: {
  learnerFitLabel?: string | null;
  learnerFitDescription?: string | null;
  difficultyLevel?: string | null;
}) {
  const fallback = getLegacyLearnerFitCopy(input.difficultyLevel);
  const label = input.learnerFitLabel?.trim() || fallback.label;
  const description = input.learnerFitDescription?.trim() || fallback.description;

  return {
    label,
    description,
    accent: fallback.accent,
  };
}
