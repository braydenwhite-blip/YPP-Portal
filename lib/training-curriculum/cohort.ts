/**
 * Recurring student cohort that travels across the training journey modules.
 *
 * The training feels MORE alive when the same handful of names recur across
 * scenarios — Maya's name in Module 3 should land harder if a learner has
 * already met her in Module 1. This file holds the canonical roster so
 * curriculum authors can pull from a single source instead of inventing a
 * new student per beat.
 *
 * Keep this list small (5 students). Each one has an archetype that maps
 * to the BeatFeedback `studentReaction.archetype` enum. Authors are free to
 * use other names too — the cohort is a hint, not a constraint.
 */

import type { BeatFeedback } from "@/lib/training-journey/types";

type Archetype = NonNullable<NonNullable<BeatFeedback["studentReaction"]>["archetype"]>;

export type CohortStudent = {
  name: string;
  archetype: Archetype;
  /** One-line "what to remember about them" tag for the intro panel and any
   *  module-open recap. Keep ≤14 words, present tense. */
  thumbnail: string;
};

export const COHORT: ReadonlyArray<CohortStudent> = [
  {
    name: "Maya",
    archetype: "shy",
    thumbnail: "Quiet — works hard but freezes when she's wrong in front of the room.",
  },
  {
    name: "Diego",
    archetype: "distracted",
    thumbnail: "On camera, second tab open. Pulls others off-task when he drifts.",
  },
  {
    name: "Tasha",
    archetype: "overconfident",
    thumbnail: "Answers fast, sometimes louder than the question. Sets the room's energy.",
  },
  {
    name: "Jaden",
    archetype: "curious",
    thumbnail: "Asks the question others were thinking. The room follows his lead.",
  },
  {
    name: "Priya",
    archetype: "nervous",
    thumbnail: "Knows the answer; doesn't trust it. A small win unlocks her week.",
  },
] as const;

/** Quick lookup by name. Names in the system are case-sensitive. */
export const COHORT_BY_NAME: Record<string, CohortStudent> = Object.freeze(
  Object.fromEntries(COHORT.map((s) => [s.name, s]))
);
