export const FEATURE_KEYS = [
  "ACTIVITY_HUB",
  "CHALLENGES",
  "INCUBATOR",
  "PASSION_WORLD",
  "INSTRUCTOR_TEACHING_TOOLS",
  "INTERVIEWER",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const FEATURE_KEY_DEFAULTS: Record<FeatureKey, boolean> = {
  ACTIVITY_HUB: true,
  CHALLENGES: true,
  INCUBATOR: true,
  PASSION_WORLD: false,
  INSTRUCTOR_TEACHING_TOOLS: false,
  INTERVIEWER: false,
};

export type FeatureUserContext = {
  userId?: string;
  chapterId?: string | null;
  roles?: string[];
  primaryRole?: string | null;
};
