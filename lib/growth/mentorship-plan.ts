/**
 * Student Operating System / Growth Engine (Phase N1) — mentorship → hierarchy map.
 *
 * Pure mapper that turns the M2 Action Tracker bridge's MentorshipActionSeed
 * (lib/action-tracker-3/mentorship-bridge) into a persistable Growth hierarchy
 * plan: mentorship GOALS become GrowthGoals, mentorship MILESTONES become
 * GrowthMilestones, and mentorship ACTIONS (first steps) become GrowthActions —
 * ONE progression engine, no duplicate system. Deterministic `sourceRef`s make
 * the downstream persistence idempotent. No IO.
 */

import type { MentorshipActionSeed } from "@/lib/action-tracker-3/mentorship-bridge";

export interface PlanAction {
  title: string;
  sourceRef: string;
}

export interface PlanMilestone {
  title: string;
  description?: string;
  sourceRef: string;
}

export interface PlanGoal {
  title: string;
  description?: string;
  sourceRef: string;
  milestones: PlanMilestone[];
  /** Direct actions under the goal (not under a milestone). */
  actions: PlanAction[];
}

export interface MentorshipGrowthPlan {
  goals: PlanGoal[];
}

/**
 * Build the idempotent plan. The first derived goal is the "primary" one and
 * carries the kickoff milestones + first-step actions; the remaining derived
 * goals (career / leadership / interest) stand alone. Every node gets a stable
 * sourceRef keyed off the mentorship, so re-running upserts instead of dupes.
 */
export function buildMentorshipGrowthPlan(
  seed: MentorshipActionSeed,
  mentorshipId: string
): MentorshipGrowthPlan {
  const base = `mentorship:${mentorshipId}`;
  const goals: PlanGoal[] = [];

  const derivedGoals = seed.goals ?? [];
  derivedGoals.forEach((g, index) => {
    const isPrimary = index === 0;
    goals.push({
      title: g.title,
      description: g.description,
      sourceRef: `${base}:g${index}`,
      milestones: isPrimary
        ? (seed.milestones ?? []).map((m, i) => ({
            title: m.title,
            description: m.detail,
            sourceRef: `${base}:m${i}`,
          }))
        : [],
      actions: isPrimary
        ? (seed.firstSteps ?? []).map((title, i) => ({
            title,
            sourceRef: `${base}:a${i}`,
          }))
        : [],
    });
  });

  return { goals };
}
