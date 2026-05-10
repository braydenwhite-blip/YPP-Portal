/**
 * Pure-function validators for an Admin Journey Editor draft.
 *
 * Drives the validation panel in the editor UI and gates `publishVersion()`
 * on the server. No DB access, no React, no zod-from-network — just data in
 * via `JourneyDraft`, errors out via `ValidationResult`.
 *
 * Rules (see docs/admin-journey-editor-plan.md §8):
 *   - meta: title min 3, slug `[a-z0-9-]+`, passScorePct 0..100, estimatedMinutes >= 0
 *   - beats: at least one non-removed beat; per-beat config parses against
 *     the kind's Zod configSchema; sourceKey unique within draft;
 *     sortOrder strictly increasing per parent group; parentBeatId resolves
 *     within draft; no cycles in the parent chain
 *   - gates: targetRef/requiredRef well-formed; targets/requireds resolve
 *     to existing draft beats or known sibling modules
 *   - assignments: at least one assignment row before publish
 *   - LDS special-case: any beat whose sourceKey contains "lesson-design-studio"
 *     requires a READINESS_CHECK gate against
 *     "module:academy_readiness_check_005"
 */

import { BEAT_CONFIG_SCHEMAS } from "@/lib/training-journey/schemas";

import type {
  BeatDraft,
  GateDraft,
  JourneyAssignmentDraft,
  JourneyDraft,
  JourneyMetaDraft,
  ValidationError,
  ValidationResult,
} from "./types";

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const TITLE_MIN = 3;
const REF_RE = /^(beat|module):[A-Za-z0-9_\-]+$/;
const READINESS_MODULE_REF = "module:academy_readiness_check_005";
const LDS_PATTERN = /lesson-design-studio/i;

export interface ValidateDraftOptions {
  /**
   * `contentKey`s of training modules that exist in the system. Used to
   * resolve `module:<contentKey>` references in gates. Pass an empty array
   * to skip module-existence checks.
   */
  knownModuleContentKeys?: readonly string[];
  /** Whether to apply publish-only rules (e.g. assignments required). */
  forPublish?: boolean;
}

export function validateDraft(
  draft: JourneyDraft,
  options: ValidateDraftOptions = {},
): ValidationResult {
  const errors: ValidationError[] = [
    ...validateMeta(draft.meta),
    ...validateBeats(draft.beats),
    ...validateGates(draft.gates, draft.beats, options.knownModuleContentKeys ?? []),
    ...validateLessonDesignStudioGate(draft.beats, draft.gates),
  ];

  if (options.forPublish) {
    errors.push(...validateAssignmentsForPublish(draft.assignments));
  }

  return { ok: errors.length === 0, errors };
}

// ----------------------------------------------------------------------------
// Meta
// ----------------------------------------------------------------------------

export function validateMeta(meta: JourneyMetaDraft): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!meta.title || meta.title.trim().length < TITLE_MIN) {
    errors.push(metaError("title", `Title must be at least ${TITLE_MIN} characters.`));
  }
  if (!meta.slug || !SLUG_RE.test(meta.slug)) {
    errors.push(
      metaError(
        "slug",
        "Slug must start with a letter or digit and contain only lowercase letters, digits, and hyphens.",
      ),
    );
  }
  if (
    !Number.isInteger(meta.passScorePct) ||
    meta.passScorePct < 0 ||
    meta.passScorePct > 100
  ) {
    errors.push(metaError("passScorePct", "Pass score must be an integer between 0 and 100."));
  }
  if (!Number.isInteger(meta.estimatedMinutes) || meta.estimatedMinutes < 0) {
    errors.push(metaError("estimatedMinutes", "Estimated minutes must be a non-negative integer."));
  }

  return errors;
}

// ----------------------------------------------------------------------------
// Beats
// ----------------------------------------------------------------------------

export function validateBeats(beats: BeatDraft[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const live = beats.filter((b) => b.removedAt === null);

  if (live.length === 0) {
    errors.push(beatError(null, null, "Draft must contain at least one non-removed beat."));
    return errors;
  }

  // sourceKey uniqueness
  const seen = new Map<string, BeatDraft>();
  for (const b of live) {
    if (!b.sourceKey || b.sourceKey.trim() === "") {
      errors.push(beatError(refIdFor(b), "sourceKey", "Beat sourceKey is required."));
      continue;
    }
    const prior = seen.get(b.sourceKey);
    if (prior) {
      errors.push(
        beatError(
          refIdFor(b),
          "sourceKey",
          `Duplicate sourceKey "${b.sourceKey}" (also used by another beat in this draft).`,
        ),
      );
    } else {
      seen.set(b.sourceKey, b);
    }
  }

  // sortOrder strictly increasing per parent group
  const byParent = new Map<string | null, BeatDraft[]>();
  for (const b of live) {
    const key = b.parentBeatId ?? null;
    const list = byParent.get(key) ?? [];
    list.push(b);
    byParent.set(key, list);
  }
  for (const [, group] of byParent) {
    const sorted = [...group].sort((a, b) => a.sortOrder - b.sortOrder);
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i].sortOrder <= sorted[i - 1].sortOrder) {
        errors.push(
          beatError(
            refIdFor(sorted[i]),
            "sortOrder",
            `sortOrder must be strictly increasing within a parent group (got ${sorted[i].sortOrder} after ${sorted[i - 1].sortOrder}).`,
          ),
        );
      }
    }
  }

  // parentBeatId references must resolve within the draft
  const liveIds = new Set<string>();
  for (const b of live) {
    if (b.id) liveIds.add(b.id);
    liveIds.add(b.sourceKey); // parentBeatId may be sourceKey for not-yet-saved beats
  }
  for (const b of live) {
    if (b.parentBeatId && !liveIds.has(b.parentBeatId)) {
      errors.push(
        beatError(
          refIdFor(b),
          "parentBeatId",
          `parentBeatId "${b.parentBeatId}" does not match any beat in this draft.`,
        ),
      );
    }
  }

  // No cycles in the parent chain
  const cycleRefs = findCycleSources(live);
  for (const ref of cycleRefs) {
    errors.push(
      beatError(ref, "parentBeatId", "Beat parent chain forms a cycle."),
    );
  }

  // Per-kind config validation
  for (const b of live) {
    const schema = BEAT_CONFIG_SCHEMAS[b.kind];
    if (!schema) {
      errors.push(beatError(refIdFor(b), "kind", `Unknown beat kind "${b.kind}".`));
      continue;
    }
    const result = schema.safeParse(b.config);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push(
          beatError(
            refIdFor(b),
            ["config", ...issue.path.map(String)].join("."),
            issue.message,
          ),
        );
      }
    }
  }

  return errors;
}

// ----------------------------------------------------------------------------
// Gates
// ----------------------------------------------------------------------------

export function validateGates(
  gates: GateDraft[],
  beats: BeatDraft[],
  knownModuleContentKeys: readonly string[],
): ValidationError[] {
  const errors: ValidationError[] = [];
  const beatRefs = new Set(
    beats.filter((b) => b.removedAt === null).map((b) => `beat:${b.sourceKey}`),
  );
  const moduleRefs = new Set(knownModuleContentKeys.map((k) => `module:${k}`));

  for (const g of gates) {
    if (!REF_RE.test(g.targetRef)) {
      errors.push(
        gateError(refIdForGate(g), "targetRef", `Invalid targetRef "${g.targetRef}".`),
      );
    } else if (!resolveRef(g.targetRef, beatRefs, moduleRefs)) {
      errors.push(
        gateError(
          refIdForGate(g),
          "targetRef",
          `Gate targetRef "${g.targetRef}" does not match any beat in this draft or known module.`,
        ),
      );
    }
    if (!REF_RE.test(g.requiredRef)) {
      errors.push(
        gateError(refIdForGate(g), "requiredRef", `Invalid requiredRef "${g.requiredRef}".`),
      );
    } else if (!resolveRef(g.requiredRef, beatRefs, moduleRefs)) {
      errors.push(
        gateError(
          refIdForGate(g),
          "requiredRef",
          `Gate requiredRef "${g.requiredRef}" does not match any beat in this draft or known module.`,
        ),
      );
    }
    if (g.kind === "SCORE_THRESHOLD") {
      if (g.threshold === null || !Number.isInteger(g.threshold) || g.threshold < 0 || g.threshold > 100) {
        errors.push(
          gateError(
            refIdForGate(g),
            "threshold",
            "SCORE_THRESHOLD gates require an integer threshold 0..100.",
          ),
        );
      }
    }
  }

  return errors;
}

// ----------------------------------------------------------------------------
// Assignments (publish-only)
// ----------------------------------------------------------------------------

export function validateAssignmentsForPublish(
  assignments: JourneyAssignmentDraft[],
): ValidationError[] {
  if (assignments.length === 0) {
    return [
      {
        scope: "assignment",
        refId: null,
        field: null,
        message: "Published journey must have at least one audience assignment.",
      },
    ];
  }
  return [];
}

// ----------------------------------------------------------------------------
// Lesson Design Studio readiness gate (special-case)
// ----------------------------------------------------------------------------

export function validateLessonDesignStudioGate(
  beats: BeatDraft[],
  gates: GateDraft[],
): ValidationError[] {
  const ldsBeats = beats.filter(
    (b) => b.removedAt === null && LDS_PATTERN.test(b.sourceKey),
  );
  if (ldsBeats.length === 0) return [];

  const hasReadinessGate = gates.some(
    (g) => g.kind === "READINESS_CHECK" && g.requiredRef === READINESS_MODULE_REF,
  );
  if (hasReadinessGate) return [];

  return [
    {
      scope: "gate",
      refId: null,
      field: null,
      message: `Lesson Design Studio beats require a READINESS_CHECK gate against ${READINESS_MODULE_REF}.`,
    },
  ];
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function metaError(field: string, message: string): ValidationError {
  return { scope: "meta", refId: null, field, message };
}

function beatError(
  refId: string | null,
  field: string | null,
  message: string,
): ValidationError {
  return { scope: "beat", refId, field, message };
}

function gateError(
  refId: string | null,
  field: string | null,
  message: string,
): ValidationError {
  return { scope: "gate", refId, field, message };
}

function refIdFor(beat: BeatDraft): string {
  return beat.id ?? `source:${beat.sourceKey}`;
}

function refIdForGate(gate: GateDraft): string {
  return gate.id ?? `${gate.kind}:${gate.targetRef}<-${gate.requiredRef}`;
}

function resolveRef(
  ref: string,
  beatRefs: ReadonlySet<string>,
  moduleRefs: ReadonlySet<string>,
): boolean {
  if (ref.startsWith("beat:")) return beatRefs.has(ref);
  if (ref.startsWith("module:")) return moduleRefs.has(ref);
  return false;
}

/**
 * Returns the set of beat refIds whose parent chain forms or enters a cycle.
 * Iterative DFS over `parentBeatId` (which may match either `id` or
 * `sourceKey` of another beat in the draft).
 */
function findCycleSources(beats: BeatDraft[]): string[] {
  const lookup = new Map<string, BeatDraft>();
  for (const b of beats) {
    if (b.id) lookup.set(b.id, b);
    lookup.set(b.sourceKey, b);
  }

  const cycleRefs: string[] = [];

  for (const start of beats) {
    if (!start.parentBeatId) continue;
    const visited = new Set<string>();
    let cursor: BeatDraft | undefined = start;
    while (cursor && cursor.parentBeatId) {
      const cursorKey = cursor.id ?? cursor.sourceKey;
      if (visited.has(cursorKey)) {
        cycleRefs.push(refIdFor(start));
        break;
      }
      visited.add(cursorKey);
      cursor = lookup.get(cursor.parentBeatId);
      if (cursor && (cursor.id === start.id || cursor.sourceKey === start.sourceKey)) {
        cycleRefs.push(refIdFor(start));
        break;
      }
    }
  }

  return Array.from(new Set(cycleRefs));
}
