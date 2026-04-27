/**
 * Feature flag helpers.
 * All flags default to enabled ("true") unless explicitly set to "false".
 * Toggle via environment variables — no deploy needed for quick kill-switch.
 */

/** Master gate for the Instructor Applicant Workflow V1 feature set. */
export function isInstructorApplicantWorkflowV1Enabled(): boolean {
  return process.env.ENABLE_INSTRUCTOR_APPLICANT_WORKFLOW_V1 !== "false";
}

/** Existing gate — controls downstream onboarding sync on APPROVED. */
export function isNativeInstructorGateEnabled(): boolean {
  return process.env.ENABLE_NATIVE_INSTRUCTOR_GATE !== "false";
}

/**
 * Final Review Cockpit redesign — global on/off gate.
 * The legacy ChairDecisionWorkspace remains the default until this flips.
 *
 * When set to "true" the cockpit is available to all chairs. For staged
 * rollout per chapter use FINAL_REVIEW_V2_CHAPTER_ALLOWLIST (a comma-
 * separated list of chapter IDs) — checked by `isFinalReviewV2EnabledForChapter`.
 */
export function isFinalReviewV2Enabled(): boolean {
  return process.env.ENABLE_FINAL_REVIEW_V2 === "true";
}

/**
 * Per-chapter rollout gate. Returns true when:
 *   - the global flag is on, OR
 *   - the chapter id is in FINAL_REVIEW_V2_CHAPTER_ALLOWLIST.
 *
 * Pass `null` for cross-chapter actors (admin / hiring chair without a
 * chapter assignment) — they always get the cockpit when the global flag
 * is on but never via the per-chapter gate alone.
 */
export function isFinalReviewV2EnabledForChapter(chapterId: string | null): boolean {
  if (isFinalReviewV2Enabled()) return true;
  if (!chapterId) return false;
  const allowlistRaw = process.env.FINAL_REVIEW_V2_CHAPTER_ALLOWLIST;
  if (!allowlistRaw) return false;
  const ids = allowlistRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(chapterId);
}
