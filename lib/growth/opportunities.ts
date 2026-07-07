/**
 * Student Operating System / Growth Engine (Phase N1) — the Opportunity Engine.
 *
 * Deterministic, explainable recommendations. NO AI hand-waving: every
 * recommendation is produced by an ordered set of pure rules over typed inputs,
 * is reproducible, and carries a `reason` string that is LITERALLY the WHY shown
 * to the student. Results are scored, sorted (score desc, key asc), de-duplicated
 * by stable key, and capped — so the same input always yields the same list.
 *
 * `kind` buckets each suggestion into the six lanes the platform suggests across:
 * next class, leadership role, project, mentorship action, instructor milestone,
 * chapter responsibility.
 */

import {
  type AchievementCategory,
  type GrowthTrackId,
  type OpportunityKind,
} from "./constants";
import type { GrowthEventType } from "./events";
import {
  ACHIEVEMENT_DEFINITIONS,
  achievementProgress,
  isAchievementEarned,
  type AchievementInput,
} from "./achievements";

export interface OpportunityProfileSignals {
  careerInterests: string[];
  leadershipInterests: string[];
  impactInterests: string[];
}

export interface StalledGoalSignal {
  id: string;
  title: string;
  ratio: number; // 0..1
  track?: GrowthTrackId;
}

export interface OpportunityInput {
  eventCounts: Partial<Record<GrowthEventType, number>>;
  profile: OpportunityProfileSignals;
  earnedAchievementKeys: string[];
  hasActiveMentorship: boolean;
  /** Titles of open (TODO/IN_PROGRESS) seeded mentorship actions. */
  openMentorshipActionTitles: string[];
  stalledGoals: StalledGoalSignal[];
  /** Opportunity keys the student dismissed — never re-suggested. */
  dismissedKeys?: string[];
}

export interface Opportunity {
  key: string;
  kind: OpportunityKind;
  title: string;
  detail?: string;
  href?: string;
  /** The deterministic WHY — shown verbatim to the student. */
  reason: string;
  score: number;
}

const MAX_OPPORTUNITIES = 10;
/** A locked achievement at/above this progress becomes a "near" nudge. */
const NEAR_ACHIEVEMENT_THRESHOLD = 0.6;

const CATEGORY_TO_KIND: Record<AchievementCategory, OpportunityKind> = {
  LEADERSHIP: "LEADERSHIP_ROLE",
  IMPACT: "PROJECT",
  TEACHING: "INSTRUCTOR_MILESTONE",
  MENTORSHIP: "MENTORSHIP_ACTION",
  PROJECT: "PROJECT",
  CHAPTER: "CHAPTER_RESPONSIBILITY",
  COMMUNITY: "CHAPTER_RESPONSIBILITY",
};

const TRACK_TO_KIND: Record<GrowthTrackId, OpportunityKind> = {
  STUDENT: "CLASS",
  MENTORSHIP: "MENTORSHIP_ACTION",
  INSTRUCTOR: "INSTRUCTOR_MILESTONE",
  LEADERSHIP: "LEADERSHIP_ROLE",
  CHAPTER: "CHAPTER_RESPONSIBILITY",
  HIRING: "INSTRUCTOR_MILESTONE",
  ALUMNI: "MENTORSHIP_ACTION",
};

/* --------------------------------- helpers --------------------------------- */

function count(input: OpportunityInput, type: GrowthEventType): number {
  return input.eventCounts?.[type] ?? 0;
}

function earned(input: OpportunityInput, key: string): boolean {
  return input.earnedAchievementKeys.includes(key);
}

function formatList(items: string[]): string {
  const clean = items.map((s) => s.trim()).filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")}, and ${clean[clean.length - 1]}`;
}

function pct(ratio: number): number {
  return Math.round(Math.max(0, Math.min(1, ratio)) * 100);
}

/* ---------------------------------- rules ---------------------------------- */
// Each rule is a pure function returning zero or more Opportunities. The reason
// is built from the actual input values so it is a true, specific WHY.

type Rule = (input: OpportunityInput) => Opportunity[];

const ruleAdvanceMentorshipAction: Rule = (input) => {
  if (!input.hasActiveMentorship) return [];
  const first = input.openMentorshipActionTitles.map((t) => t.trim()).filter(Boolean)[0];
  if (!first) return [];
  return [
    {
      key: "advance_mentorship_action",
      kind: "MENTORSHIP_ACTION",
      title: "Take your next mentorship step",
      detail: first,
      href: "/my-growth",
      reason: `Your mentorship has an open next step: "${first}".`,
      score: 88,
    },
  ];
};

const ruleApplyForMentor: Rule = (input) => {
  if (input.hasActiveMentorship) return [];
  const interests = [
    ...input.profile.careerInterests,
    ...input.profile.leadershipInterests,
  ];
  if (interests.length === 0) return [];
  return [
    {
      key: "apply_for_mentor",
      kind: "MENTORSHIP_ACTION",
      title: "Find a mentor",
      detail: "Apply for mentorship to get personal guidance toward your goals.",
      href: "/mentorship?view=me",
      reason: `You've set interests (${formatList(
        interests.slice(0, 3)
      )}) but don't have a mentor yet — a mentor can help you get there.`,
      score: 80,
    },
  ];
};

const ruleRunForChapterRole: Rule = (input) => {
  const hosted = count(input, "CHAPTER_EVENT_HOSTED");
  if (hosted < 1) return [];
  if (earned(input, "emerging_leader")) return [];
  return [
    {
      key: "run_for_chapter_role",
      kind: "LEADERSHIP_ROLE",
      title: "Step into a leadership role",
      detail: "You're ready to lead — explore officer roles on the leadership pathway.",
      href: "/leadership-pathway",
      reason: `You're active in your chapter (hosted ${hosted} event${
        hosted === 1 ? "" : "s"
      }) — you're ready to take on a leadership role.`,
      score: 75,
    },
  ];
};

const ruleCompleteInstructorTraining: Rule = (input) => {
  if (count(input, "CLASS_PUBLISHED") < 1) return [];
  if (earned(input, "instructor_trained")) return [];
  return [
    {
      key: "complete_instructor_training",
      kind: "INSTRUCTOR_MILESTONE",
      title: "Complete instructor training",
      detail: "Finish training to grow as an instructor and unlock more teaching.",
      href: "/instructor-training",
      reason:
        "You've taught a class but haven't completed instructor training yet — it's your next milestone.",
      score: 70,
    },
  ];
};

const ruleStartAProject: Rule = (input) => {
  if (input.profile.impactInterests.length === 0) return [];
  if (count(input, "PROJECT_LAUNCHED") > 0 || earned(input, "project_launcher")) return [];
  return [
    {
      key: "start_a_project",
      kind: "PROJECT",
      title: "Launch your first project",
      detail: "Turn your impact interests into a real project.",
      href: "/projects/tracker",
      reason: `You care about impact (${formatList(
        input.profile.impactInterests.slice(0, 3)
      )}) but haven't launched a project yet.`,
      score: 58,
    },
  ];
};

const ruleNextClassInInterest: Rule = (input) => {
  if (count(input, "CLASS_COMPLETED") < 1) return [];
  const interests = [
    ...input.profile.careerInterests,
    ...input.profile.impactInterests,
  ];
  if (interests.length === 0) return [];
  return [
    {
      key: "next_class_in_interest",
      kind: "CLASS",
      title: "Take your next class",
      detail: "Keep your momentum going with another class in an area you care about.",
      href: "/courses",
      reason: `You finished a class and are interested in ${formatList(
        interests.slice(0, 2)
      )} — here's a next class to keep building.`,
      score: 52,
    },
  ];
};

const ruleNearAchievement: Rule = (input) => {
  const achievementInput: AchievementInput = { eventCounts: input.eventCounts };
  const out: Opportunity[] = [];
  for (const def of ACHIEVEMENT_DEFINITIONS) {
    if (isAchievementEarned(def, achievementInput)) continue;
    const progress = achievementProgress(def, achievementInput);
    if (progress < NEAR_ACHIEVEMENT_THRESHOLD || progress >= 1) continue;
    out.push({
      key: `near_${def.key}`,
      kind: CATEGORY_TO_KIND[def.category],
      title: `Almost there: ${def.title}`,
      detail: def.unlockHint,
      href: "/my-growth",
      reason: `You're ${pct(progress)}% of the way to earning "${def.title}" — ${
        def.unlockHint
      }`,
      // Closer achievements rank higher (60..79), still below the hard nudges.
      score: 60 + Math.round(progress * 19),
    });
  }
  return out;
};

const ruleFinishStalledGoal: Rule = (input) => {
  return (input.stalledGoals ?? []).map((goal) => ({
    key: `finish_goal_${goal.id}`,
    kind: goal.track ? TRACK_TO_KIND[goal.track] : "PROJECT",
    title: "Finish what you started",
    detail: goal.title,
    href: "/my-growth",
    reason: `"${goal.title}" is past its target date and only ${pct(
      goal.ratio
    )}% done — let's finish it.`,
    score: 64,
  }));
};

const RULES: readonly Rule[] = [
  ruleAdvanceMentorshipAction,
  ruleApplyForMentor,
  ruleRunForChapterRole,
  ruleCompleteInstructorTraining,
  ruleStartAProject,
  ruleNextClassInInterest,
  ruleNearAchievement,
  ruleFinishStalledGoal,
];

/* --------------------------------- engine ---------------------------------- */

/**
 * Compute the student's ranked opportunities. Deterministic and reproducible:
 * runs every rule, drops dismissed keys, de-dupes by key, sorts by score desc
 * then key asc, and caps the list. Every entry carries its WHY in `reason`.
 */
export function computeOpportunities(input: OpportunityInput): Opportunity[] {
  const dismissed = new Set(input.dismissedKeys ?? []);
  const byKey = new Map<string, Opportunity>();

  for (const rule of RULES) {
    for (const opp of rule(input)) {
      if (dismissed.has(opp.key)) continue;
      // First rule to emit a key wins (rules are ordered by intent priority).
      if (!byKey.has(opp.key)) byKey.set(opp.key, opp);
    }
  }

  return Array.from(byKey.values())
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    })
    .slice(0, MAX_OPPORTUNITIES);
}
