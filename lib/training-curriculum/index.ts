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

export const CURRICULUM_REGISTRY: Record<string, CurriculumDefinition> = {
  [M1_YPP_STANDARD.contentKey]: M1_YPP_STANDARD,
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
