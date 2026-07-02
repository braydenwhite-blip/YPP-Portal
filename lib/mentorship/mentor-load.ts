/**
 * Mentor load & coverage (pure, testable).
 *
 * Who is mentoring how many people, who is over their cap, and how much of
 * the population has a mentor at all — the admin POV's coverage answer.
 */

import type { DevelopmentPersonFacts } from "@/lib/development/signals";

export type MentorLoadRow = {
  userId: string;
  name: string;
  contextLabel: string | null;
  menteeCount: number;
  cap: number | null;
  overCap: boolean;
};

export type MentorCoverage = {
  mentors: MentorLoadRow[];
  overCapCount: number;
  /** People whose role expects a mentor but who have none. */
  needsMentorCount: number;
  /** Mentor-eligible people with a mentor on file. */
  coveredCount: number;
  mentorEligibleCount: number;
};

export function buildMentorLoad(people: DevelopmentPersonFacts[]): MentorCoverage {
  const mentors = people
    .filter((p) => p.activeMenteeCount > 0)
    .map((p) => ({
      userId: p.id,
      name: p.name || p.email,
      contextLabel: p.contextLabel,
      menteeCount: p.activeMenteeCount,
      cap: p.mentorCap,
      overCap: p.mentorCap != null && p.activeMenteeCount > p.mentorCap,
    }))
    .sort((a, b) => {
      if (a.overCap !== b.overCap) return a.overCap ? -1 : 1;
      if (a.menteeCount !== b.menteeCount) return b.menteeCount - a.menteeCount;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

  const eligible = people.filter((p) => p.mentorEligible);
  const covered = eligible.filter((p) => p.mentorName != null);

  return {
    mentors,
    overCapCount: mentors.filter((m) => m.overCap).length,
    needsMentorCount: eligible.length - covered.length,
    coveredCount: covered.length,
    mentorEligibleCount: eligible.length,
  };
}
