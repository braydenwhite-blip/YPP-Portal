export const FEATURE_KEYS = [
  "ACTIVITY_HUB",
  "CHALLENGES",
  "INCUBATOR",
  "PASSION_WORLD",
  "INSTRUCTOR_TEACHING_TOOLS",
  "INTERVIEWER",
  "WORKSHOP_DESIGN_STUDIO",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const FEATURE_KEY_DEFAULTS: Record<FeatureKey, boolean> = {
  ACTIVITY_HUB: true,
  CHALLENGES: true,
  INCUBATOR: true,
  PASSION_WORLD: false,
  INSTRUCTOR_TEACHING_TOOLS: false,
  INTERVIEWER: false,
  // WORKSHOP_DESIGN_STUDIO: global kill-switch for the Summer Workshop Design Studio.
  // OFF by default so the studio can be opened deliberately at the start of a
  // workshop cycle and closed again once the design window ends. Admins and
  // chapter presidents bypass this gate (see getWorkshopStudioGateStatus).
  WORKSHOP_DESIGN_STUDIO: false,
};

export type FeatureUserContext = {
  userId?: string;
  chapterId?: string | null;
  roles?: string[];
  primaryRole?: string | null;
};
