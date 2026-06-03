/**
 * Curriculum registry — aggregates every `CurriculumDefinition` authored under
 * `lib/training-curriculum/`. The `scripts/import-training-academy-content.mjs`
 * pipeline reads `listCurricula()` and upserts the corresponding DB rows.
 *
 * Import paths deliberately avoid barrel re-exports from `./ypp-standard` so
 * that tree-shaking is straightforward and the file can be dynamic-imported
 * via the tsx ESM loader in `.mjs` scripts.
 */

export type { CurriculumDefinition, BeatDefinition } from "./types";

import type { CurriculumDefinition } from "./types";
import { M1_YPP_STANDARD } from "./ypp-standard";
import { M2_RUN_A_GREAT_SESSION } from "./run-a-great-session";
import { M3_STUDENT_SITUATIONS } from "./student-situations";
import { M4_COMMUNICATION_RELIABILITY } from "./communication-reliability";
import { M_COMMUNITY_INVOLVEMENT } from "./community-involvement";
import { M_LONG_TERM_GROWTH } from "./long-term-growth";
import { M5_READINESS_CHECK } from "./readiness-check";

// Ordered to mirror YPP's official role framework (see `lib/training-goals.ts`):
// Welcome → GOAL 1 → GOAL 2 → GOAL 3 → GOAL 4 → GOAL 5 → Readiness Check (capstone).
export const CURRICULUM_REGISTRY: Record<string, CurriculumDefinition> = {
  [M1_YPP_STANDARD.contentKey]: M1_YPP_STANDARD, // WELCOME
  [M2_RUN_A_GREAT_SESSION.contentKey]: M2_RUN_A_GREAT_SESSION, // GOAL_1
  [M3_STUDENT_SITUATIONS.contentKey]: M3_STUDENT_SITUATIONS, // GOAL_2
  [M4_COMMUNICATION_RELIABILITY.contentKey]: M4_COMMUNICATION_RELIABILITY, // GOAL_3
  [M_COMMUNITY_INVOLVEMENT.contentKey]: M_COMMUNITY_INVOLVEMENT, // GOAL_4
  [M_LONG_TERM_GROWTH.contentKey]: M_LONG_TERM_GROWTH, // GOAL_5
  [M5_READINESS_CHECK.contentKey]: M5_READINESS_CHECK, // CAPSTONE
};

export function listCurricula(): CurriculumDefinition[] {
  return Object.values(CURRICULUM_REGISTRY).sort(
    (a, b) => a.module.sortOrder - b.module.sortOrder,
  );
}

export function getCurriculum(
  contentKey: string,
): CurriculumDefinition | undefined {
  return CURRICULUM_REGISTRY[contentKey];
}
