export const FEATURE_KEYS = [
  "ACTIVITY_HUB",
  "CHALLENGES",
  "INCUBATOR",
  "PASSION_WORLD",
  "INSTRUCTOR_TEACHING_TOOLS",
  "INTERVIEWER",
  "GR_SYSTEM",
  // Mentorship rollout flags (Phase 0.5)
  "MENTORSHIP_V2",
  "MENTORSHIP_STUDENT_LANE",
  "MENTORSHIP_LEGACY_UI",
  "MENTORSHIP_CHAPTER_SCOPE",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const FEATURE_KEY_DEFAULTS: Record<FeatureKey, boolean> = {
  ACTIVITY_HUB: true,
  CHALLENGES: true,
  INCUBATOR: true,
  PASSION_WORLD: false,
  INSTRUCTOR_TEACHING_TOOLS: false,
  INTERVIEWER: false,
  GR_SYSTEM: false,
  // Mentorship rollout flags
  // MENTORSHIP_V2: gates the unified modern pipeline + new mentor Kanban. Off until Phase 1 ships.
  MENTORSHIP_V2: false,
  // MENTORSHIP_STUDENT_LANE: gates all student-as-mentee surfaces. Off for initial instructor-only rollout.
  MENTORSHIP_STUDENT_LANE: false,
  // MENTORSHIP_LEGACY_UI: gates /mentorship-program/* redirect stubs and legacy review screens.
  // Default ON so existing prod users are not disrupted mid-cycle. Turn OFF in new environments.
  MENTORSHIP_LEGACY_UI: true,
  // MENTORSHIP_CHAPTER_SCOPE: gates chapter-president mentorship dashboard views.
  MENTORSHIP_CHAPTER_SCOPE: false,
};

export type FeatureUserContext = {
  userId?: string;
  chapterId?: string | null;
  roles?: string[];
  primaryRole?: string | null;
};
