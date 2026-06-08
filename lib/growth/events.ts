/**
 * Student Operating System / Growth Engine (Phase N1) — the ProgressEvent registry.
 *
 * Future systems don't know about the Growth Engine's internals — they emit
 * events. This registry is the single source of truth mapping each canonical
 * event type to its track, the growth dimension (achievement category) it counts
 * toward, and a student-facing default title for the timeline. Pure: no IO.
 *
 * The event TYPE is a TEXT vocabulary (no Postgres enum) so new emitters can be
 * added without a migration, matching the repo's actionType convention.
 */

import type { AchievementCategory, GrowthTrackId } from "./constants";

export const GROWTH_EVENT_TYPES = [
  // Classes / teaching
  "CLASS_PUBLISHED",
  "CLASS_COMPLETED",
  "CLASS_REACHED_25_STUDENTS",
  "CLASS_REACHED_100_STUDENTS",
  "CLASS_HIGH_RATING",
  "INSTRUCTOR_TRAINING_COMPLETED",
  // Mentorship
  "MENTOR_MATCHED",
  "MENTORSHIP_GOAL_SET",
  "MENTORSHIP_MILESTONE_REACHED",
  "MENTORSHIP_COMPLETED",
  // Chapters / community
  "CHAPTER_JOINED",
  "CHAPTER_MEMBER_RECRUITED",
  "CHAPTER_EVENT_HOSTED",
  "CHAPTER_PARTNERSHIP_LAUNCHED",
  "CHAPTER_MEETING_ATTENDED",
  "SERVICE_HOURS_LOGGED",
  // Leadership / certificates / projects
  "LEADERSHIP_ROLE_EARNED",
  "CERTIFICATE_EARNED",
  "PROJECT_LAUNCHED",
  "PROJECT_COMPLETED",
] as const;
export type GrowthEventType = (typeof GROWTH_EVENT_TYPES)[number];

export interface GrowthEventDefinition {
  type: GrowthEventType;
  track: GrowthTrackId;
  /** The growth dimension this event contributes to (null = neutral signal). */
  category: AchievementCategory | null;
  /** Short admin/analytics label. */
  label: string;
  /** Default student-facing timeline title (an emitter may override it). */
  defaultTitle: string;
  /** Whether reaching this event counts as a "completed experience". */
  countsAsExperience: boolean;
}

export const GROWTH_EVENT_DEFINITIONS: Record<GrowthEventType, GrowthEventDefinition> = {
  CLASS_PUBLISHED: {
    type: "CLASS_PUBLISHED",
    track: "INSTRUCTOR",
    category: "TEACHING",
    label: "Class published",
    defaultTitle: "Published a class",
    countsAsExperience: false,
  },
  CLASS_COMPLETED: {
    type: "CLASS_COMPLETED",
    track: "INSTRUCTOR",
    category: "TEACHING",
    label: "Class completed",
    defaultTitle: "Completed teaching a class",
    countsAsExperience: true,
  },
  CLASS_REACHED_25_STUDENTS: {
    type: "CLASS_REACHED_25_STUDENTS",
    track: "INSTRUCTOR",
    category: "IMPACT",
    label: "Reached 25 students",
    defaultTitle: "Reached 25 students taught",
    countsAsExperience: false,
  },
  CLASS_REACHED_100_STUDENTS: {
    type: "CLASS_REACHED_100_STUDENTS",
    track: "INSTRUCTOR",
    category: "IMPACT",
    label: "Reached 100 students",
    defaultTitle: "Reached 100 students taught",
    countsAsExperience: false,
  },
  CLASS_HIGH_RATING: {
    type: "CLASS_HIGH_RATING",
    track: "INSTRUCTOR",
    category: "TEACHING",
    label: "Earned high ratings",
    defaultTitle: "Earned high student ratings",
    countsAsExperience: false,
  },
  INSTRUCTOR_TRAINING_COMPLETED: {
    type: "INSTRUCTOR_TRAINING_COMPLETED",
    track: "INSTRUCTOR",
    category: "TEACHING",
    label: "Instructor training completed",
    defaultTitle: "Completed instructor training",
    countsAsExperience: true,
  },
  MENTOR_MATCHED: {
    type: "MENTOR_MATCHED",
    track: "MENTORSHIP",
    category: "MENTORSHIP",
    label: "Matched with a mentor",
    defaultTitle: "Matched with a mentor",
    countsAsExperience: false,
  },
  MENTORSHIP_GOAL_SET: {
    type: "MENTORSHIP_GOAL_SET",
    track: "MENTORSHIP",
    category: "MENTORSHIP",
    label: "Mentorship goal set",
    defaultTitle: "Set a mentorship goal",
    countsAsExperience: false,
  },
  MENTORSHIP_MILESTONE_REACHED: {
    type: "MENTORSHIP_MILESTONE_REACHED",
    track: "MENTORSHIP",
    category: "MENTORSHIP",
    label: "Mentorship milestone reached",
    defaultTitle: "Reached a mentorship milestone",
    countsAsExperience: false,
  },
  MENTORSHIP_COMPLETED: {
    type: "MENTORSHIP_COMPLETED",
    track: "MENTORSHIP",
    category: "MENTORSHIP",
    label: "Mentorship completed",
    defaultTitle: "Completed a mentorship",
    countsAsExperience: true,
  },
  CHAPTER_JOINED: {
    type: "CHAPTER_JOINED",
    track: "CHAPTER",
    category: "CHAPTER",
    label: "Joined a chapter",
    defaultTitle: "Joined a chapter",
    countsAsExperience: false,
  },
  CHAPTER_MEMBER_RECRUITED: {
    type: "CHAPTER_MEMBER_RECRUITED",
    track: "CHAPTER",
    category: "CHAPTER",
    label: "Recruited a member",
    defaultTitle: "Recruited a new chapter member",
    countsAsExperience: false,
  },
  CHAPTER_EVENT_HOSTED: {
    type: "CHAPTER_EVENT_HOSTED",
    track: "CHAPTER",
    category: "CHAPTER",
    label: "Hosted an event",
    defaultTitle: "Hosted a chapter event",
    countsAsExperience: true,
  },
  CHAPTER_PARTNERSHIP_LAUNCHED: {
    type: "CHAPTER_PARTNERSHIP_LAUNCHED",
    track: "CHAPTER",
    category: "CHAPTER",
    label: "Launched a partnership",
    defaultTitle: "Launched a chapter partnership",
    countsAsExperience: true,
  },
  CHAPTER_MEETING_ATTENDED: {
    type: "CHAPTER_MEETING_ATTENDED",
    track: "CHAPTER",
    category: "CHAPTER",
    label: "Attended a meeting",
    defaultTitle: "Attended a chapter meeting",
    countsAsExperience: false,
  },
  SERVICE_HOURS_LOGGED: {
    type: "SERVICE_HOURS_LOGGED",
    track: "CHAPTER",
    category: "COMMUNITY",
    label: "Logged service hours",
    defaultTitle: "Logged community service hours",
    countsAsExperience: false,
  },
  LEADERSHIP_ROLE_EARNED: {
    type: "LEADERSHIP_ROLE_EARNED",
    track: "LEADERSHIP",
    category: "LEADERSHIP",
    label: "Earned a leadership role",
    defaultTitle: "Earned a leadership role",
    countsAsExperience: true,
  },
  CERTIFICATE_EARNED: {
    type: "CERTIFICATE_EARNED",
    track: "STUDENT",
    category: "IMPACT",
    label: "Earned a certificate",
    defaultTitle: "Earned a certificate",
    countsAsExperience: true,
  },
  PROJECT_LAUNCHED: {
    type: "PROJECT_LAUNCHED",
    track: "STUDENT",
    category: "PROJECT",
    label: "Launched a project",
    defaultTitle: "Launched a project",
    countsAsExperience: false,
  },
  PROJECT_COMPLETED: {
    type: "PROJECT_COMPLETED",
    track: "STUDENT",
    category: "PROJECT",
    label: "Completed a project",
    defaultTitle: "Completed a project",
    countsAsExperience: true,
  },
};

export function isGrowthEventType(value: unknown): value is GrowthEventType {
  return (
    typeof value === "string" && (GROWTH_EVENT_TYPES as readonly string[]).includes(value)
  );
}

export function getGrowthEventDefinition(type: GrowthEventType): GrowthEventDefinition {
  return GROWTH_EVENT_DEFINITIONS[type];
}

export function growthEventTrack(type: GrowthEventType): GrowthTrackId {
  return GROWTH_EVENT_DEFINITIONS[type].track;
}

export function defaultGrowthEventTitle(type: GrowthEventType): string {
  return GROWTH_EVENT_DEFINITIONS[type].defaultTitle;
}

/**
 * Tally a list of raw event-type strings into a counts map, ignoring unknown
 * types. Deterministic; the achievement + opportunity engines read this shape.
 */
export function tallyEventCounts(
  types: readonly string[]
): Partial<Record<GrowthEventType, number>> {
  const counts: Partial<Record<GrowthEventType, number>> = {};
  for (const raw of types) {
    if (!isGrowthEventType(raw)) continue;
    counts[raw] = (counts[raw] ?? 0) + 1;
  }
  return counts;
}
