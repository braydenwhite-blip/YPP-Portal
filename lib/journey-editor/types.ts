/**
 * Shared types for the Admin Journey Editor.
 *
 * This file is the anchor for imports across journey-editor commits 2–15.
 * It is intentionally light on implementation today — fields are filled in
 * by Commit 2 (Prisma schema additions) and Commit 3 (validation).
 *
 * Plan: docs/admin-journey-editor-plan.md
 */

import type { InteractiveBeatKind } from "@prisma/client";

/**
 * Audience taxonomy for journey assignment. Maps onto the existing
 * `RoleType` / `AdminSubtype` enums but stays editor-local so the editor
 * can ship its own audience labels without coupling to auth taxonomy.
 *
 * Kept in sync with Prisma `JourneyAudienceRole` once Commit 2 lands.
 */
export type JourneyAudienceRole =
  | "STUDENT"
  | "INSTRUCTOR"
  | "CHAPTER_PRESIDENT"
  | "CHAPTER_LEAD"
  | "LEADERSHIP"
  | "SUMMER_WORKSHOP_INSTRUCTOR"
  | "MENTOR";

export type JourneyVersionStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type JourneyGateKind =
  | "READINESS_CHECK"
  | "BEAT_COMPLETE"
  | "MODULE_COMPLETE"
  | "SCORE_THRESHOLD";

/**
 * In-memory shape of a draft beat as the editor manipulates it before
 * persisting. Mirrors Prisma `InteractiveBeat` but with editor-friendly
 * id semantics (negative ids for not-yet-persisted rows).
 */
export interface BeatDraft {
  id: string | null; // null until first save
  sourceKey: string;
  kind: InteractiveBeatKind;
  title: string;
  prompt: string;
  mediaUrl: string | null;
  sortOrder: number;
  parentBeatId: string | null;
  showWhen: unknown | null;
  scoringWeight: number;
  scoringRule: string | null;
  schemaVersion: number;
  config: unknown; // validated against kind-specific configSchema at save
  removedAt: string | null;
}

export interface GateDraft {
  id: string | null;
  kind: JourneyGateKind;
  targetRef: string; // e.g. "beat:lesson-design-studio-intro"
  requiredRef: string; // e.g. "module:academy_readiness_check_005"
  threshold: number | null;
}

export interface JourneyMetaDraft {
  slug: string;
  title: string;
  description: string | null;
  estimatedMinutes: number;
  passScorePct: number;
  strictMode: boolean;
  moduleId: string | null;
}

export interface JourneyAssignmentDraft {
  audience: JourneyAudienceRole;
  autoEnroll: boolean;
}

/**
 * The entire editable surface of a journey draft as the editor presents it.
 * Server actions accept and return this shape; persistence layer in
 * `lib/journey-editor/actions.ts` (added in Commit 6) maps to Prisma rows.
 */
export interface JourneyDraft {
  journeyId: string;
  versionId: string;
  versionNumber: number;
  status: JourneyVersionStatus;
  meta: JourneyMetaDraft;
  beats: BeatDraft[];
  gates: GateDraft[];
  assignments: JourneyAssignmentDraft[];
}

/**
 * Validation error shape used by the right-rail validation panel.
 * Filled in by Commit 3 (`lib/journey-editor/validation.ts`).
 */
export interface ValidationError {
  scope: "meta" | "beat" | "gate" | "assignment";
  refId: string | null;
  field: string | null;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationError[];
}
