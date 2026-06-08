/**
 * Student Operating System / Growth Engine (Phase N1) — the Achievement Engine.
 *
 * A first-class, deterministic achievement framework. Definitions live in this
 * code registry (versioned in git, diffable) and every definition connects to a
 * growth dimension (leadership / impact / teaching / mentorship / project /
 * chapter / community). Evaluation is a pure function over an AchievementInput
 * (event-type counts), so it is reproducible and unit-tested — no random badges,
 * no black boxes.
 *
 * It answers two questions:
 *   - "What did I accomplish?"  -> evaluateAchievements(input)
 *   - "What can I unlock next?" -> nextAchievements(input)
 */

import { clamp01, type AchievementCategory } from "./constants";
import type { GrowthEventType } from "./events";

/** A criterion: each event type must reach its threshold count. */
export type AchievementThresholds = Partial<Record<GrowthEventType, number>>;

export interface AchievementDefinition {
  key: string;
  title: string;
  description: string;
  category: AchievementCategory;
  /** Display ordering (stable, deterministic). */
  order: number;
  /** Earned when EVERY threshold here is met. */
  thresholds: AchievementThresholds;
  /** Human "what unlocks it" line shown in the locked state. */
  unlockHint: string;
}

/**
 * The registry. Every achievement ties to leadership / impact / teaching /
 * mentorship / project / chapter / community — never a random badge.
 */
export const ACHIEVEMENT_DEFINITIONS: readonly AchievementDefinition[] = [
  {
    key: "first_class_taught",
    title: "First Class Taught",
    description: "You published and taught your first class.",
    category: "TEACHING",
    order: 10,
    thresholds: { CLASS_PUBLISHED: 1 },
    unlockHint: "Publish your first class.",
  },
  {
    key: "instructor_trained",
    title: "Trained Instructor",
    description: "You completed instructor training.",
    category: "TEACHING",
    order: 20,
    thresholds: { INSTRUCTOR_TRAINING_COMPLETED: 1 },
    unlockHint: "Complete instructor training.",
  },
  {
    key: "highly_rated_instructor",
    title: "Highly Rated Instructor",
    description: "Your students rated your teaching highly.",
    category: "TEACHING",
    order: 30,
    thresholds: { CLASS_HIGH_RATING: 1 },
    unlockHint: "Earn high student ratings in a class.",
  },
  {
    key: "reached_25_students",
    title: "Reached 25 Students",
    description: "Your teaching has reached 25 students.",
    category: "IMPACT",
    order: 40,
    thresholds: { CLASS_REACHED_25_STUDENTS: 1 },
    unlockHint: "Teach 25 students across your classes.",
  },
  {
    key: "reached_100_students",
    title: "Reached 100 Students",
    description: "Your teaching has reached 100 students.",
    category: "IMPACT",
    order: 50,
    thresholds: { CLASS_REACHED_100_STUDENTS: 1 },
    unlockHint: "Teach 100 students across your classes.",
  },
  {
    key: "certified",
    title: "Certified",
    description: "You earned your first certificate.",
    category: "IMPACT",
    order: 60,
    thresholds: { CERTIFICATE_EARNED: 1 },
    unlockHint: "Earn a certificate.",
  },
  {
    key: "mentor_matched",
    title: "Mentee",
    description: "You were matched with a mentor.",
    category: "MENTORSHIP",
    order: 70,
    thresholds: { MENTOR_MATCHED: 1 },
    unlockHint: "Get matched with a mentor.",
  },
  {
    key: "mentorship_graduate",
    title: "Mentorship Graduate",
    description: "You completed a full mentorship.",
    category: "MENTORSHIP",
    order: 80,
    thresholds: { MENTORSHIP_COMPLETED: 1 },
    unlockHint: "Complete a mentorship.",
  },
  {
    key: "chapter_member",
    title: "Chapter Member",
    description: "You joined a chapter.",
    category: "CHAPTER",
    order: 90,
    thresholds: { CHAPTER_JOINED: 1 },
    unlockHint: "Join a chapter.",
  },
  {
    key: "event_host",
    title: "Event Host",
    description: "You hosted a chapter event.",
    category: "CHAPTER",
    order: 100,
    thresholds: { CHAPTER_EVENT_HOSTED: 1 },
    unlockHint: "Host a chapter event.",
  },
  {
    key: "chapter_recruiter",
    title: "Chapter Recruiter",
    description: "You recruited 5 new members into your chapter.",
    category: "CHAPTER",
    order: 110,
    thresholds: { CHAPTER_MEMBER_RECRUITED: 5 },
    unlockHint: "Recruit 5 new chapter members.",
  },
  {
    key: "partnership_builder",
    title: "Partnership Builder",
    description: "You launched a chapter partnership.",
    category: "CHAPTER",
    order: 120,
    thresholds: { CHAPTER_PARTNERSHIP_LAUNCHED: 1 },
    unlockHint: "Launch a chapter partnership.",
  },
  {
    key: "community_servant",
    title: "Community Servant",
    description: "You logged community service across 3 occasions.",
    category: "COMMUNITY",
    order: 130,
    thresholds: { SERVICE_HOURS_LOGGED: 3 },
    unlockHint: "Log community service 3 times.",
  },
  {
    key: "project_launcher",
    title: "Project Launcher",
    description: "You launched a project.",
    category: "PROJECT",
    order: 140,
    thresholds: { PROJECT_LAUNCHED: 1 },
    unlockHint: "Launch a project.",
  },
  {
    key: "project_finisher",
    title: "Project Finisher",
    description: "You took a project all the way to completion.",
    category: "PROJECT",
    order: 150,
    thresholds: { PROJECT_COMPLETED: 1 },
    unlockHint: "Complete a project.",
  },
  {
    key: "emerging_leader",
    title: "Emerging Leader",
    description: "You earned your first leadership role.",
    category: "LEADERSHIP",
    order: 160,
    thresholds: { LEADERSHIP_ROLE_EARNED: 1 },
    unlockHint: "Earn a leadership role.",
  },
];

export interface AchievementInput {
  eventCounts: Partial<Record<GrowthEventType, number>>;
}

export interface EarnedAchievement {
  key: string;
  title: string;
  description: string;
  category: AchievementCategory;
}

export interface RemainingThreshold {
  type: GrowthEventType;
  need: number;
  have: number;
}

export interface LockedAchievement extends EarnedAchievement {
  /** 0..1 progress toward unlocking. */
  progress: number;
  unlockHint: string;
  remaining: RemainingThreshold[];
}

function have(input: AchievementInput, type: GrowthEventType): number {
  return input.eventCounts?.[type] ?? 0;
}

/** 0..1 progress = min over thresholds of have/need (so ALL must be met). */
export function achievementProgress(
  def: AchievementDefinition,
  input: AchievementInput
): number {
  const entries = Object.entries(def.thresholds) as [GrowthEventType, number][];
  if (entries.length === 0) return 1;
  let min = 1;
  for (const [type, need] of entries) {
    if (need <= 0) continue;
    const ratio = clamp01(have(input, type) / need);
    if (ratio < min) min = ratio;
  }
  return min;
}

export function isAchievementEarned(
  def: AchievementDefinition,
  input: AchievementInput
): boolean {
  return achievementProgress(def, input) >= 1;
}

function toEarned(def: AchievementDefinition): EarnedAchievement {
  return {
    key: def.key,
    title: def.title,
    description: def.description,
    category: def.category,
  };
}

/** Every achievement whose criteria are fully met, in stable display order. */
export function evaluateAchievements(input: AchievementInput): EarnedAchievement[] {
  return ACHIEVEMENT_DEFINITIONS.filter((def) => isAchievementEarned(def, input))
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(toEarned);
}

/**
 * Not-yet-earned achievements with progress + exactly what remains to unlock,
 * sorted by closeness (progress desc, then stable order). Answers "What can I
 * unlock next?".
 */
export function nextAchievements(
  input: AchievementInput,
  opts: { limit?: number; minProgress?: number } = {}
): LockedAchievement[] {
  const minProgress = opts.minProgress ?? 0;
  const locked = ACHIEVEMENT_DEFINITIONS.filter(
    (def) => !isAchievementEarned(def, input)
  ).map((def): LockedAchievement => {
    const progress = achievementProgress(def, input);
    const remaining: RemainingThreshold[] = (
      Object.entries(def.thresholds) as [GrowthEventType, number][]
    )
      .map(([type, need]) => ({ type, need, have: have(input, type) }))
      .filter((r) => r.have < r.need);
    return { ...toEarned(def), progress, unlockHint: def.unlockHint, remaining };
  });

  const filtered = locked.filter((l) => l.progress >= minProgress);
  filtered.sort((a, b) => {
    if (b.progress !== a.progress) return b.progress - a.progress;
    return orderOf(a.key) - orderOf(b.key);
  });
  return typeof opts.limit === "number" ? filtered.slice(0, opts.limit) : filtered;
}

function orderOf(key: string): number {
  return getAchievementDefinition(key)?.order ?? Number.MAX_SAFE_INTEGER;
}

export function getAchievementDefinition(
  key: string
): AchievementDefinition | undefined {
  return ACHIEVEMENT_DEFINITIONS.find((d) => d.key === key);
}

/** Count of earned achievements per category (for the profile + dashboards). */
export function achievementCategoryCounts(
  earned: EarnedAchievement[]
): Record<AchievementCategory, number> {
  const counts = {
    LEADERSHIP: 0,
    IMPACT: 0,
    TEACHING: 0,
    MENTORSHIP: 0,
    PROJECT: 0,
    CHAPTER: 0,
    COMMUNITY: 0,
  } as Record<AchievementCategory, number>;
  for (const a of earned) counts[a.category] += 1;
  return counts;
}
