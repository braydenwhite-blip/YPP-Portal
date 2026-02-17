export const FEATURE_KEYS = [
  "ACTIVITY_HUB",
  "CHALLENGES",
  "INCUBATOR",
  "PASSION_WORLD",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type FeatureUserContext = {
  userId?: string;
  chapterId?: string | null;
  roles?: string[];
  primaryRole?: string | null;
};
