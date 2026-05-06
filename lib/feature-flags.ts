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
 * TEMPORARY visibility gate: while the regular Instructor program is
 * paused, only the Summer Workshop Instructor pathway should be exposed
 * to end users. Admins always retain access (see `canBypassInstructorGate`).
 *
 * Defaults to OFF — set `ENABLE_REGULAR_INSTRUCTOR=true` to restore the
 * full Instructor experience without redeploying.
 */
export function isRegularInstructorEnabled(): boolean {
  return process.env.ENABLE_REGULAR_INSTRUCTOR === "true";
}

/** Summer Workshop Instructor pathway — defaults ON during the gate. */
export function isSummerWorkshopInstructorEnabled(): boolean {
  return process.env.ENABLE_SUMMER_WORKSHOP !== "false";
}

/**
 * Hrefs that are hidden whenever `isRegularInstructorEnabled()` is false.
 * Admins bypass via `canBypassInstructorGate`. Keep in sync with
 * `getInstructorGateRedirect` so UI affordances and route guards agree.
 */
export const REGULAR_INSTRUCTOR_GATED_HREF_PREFIXES: readonly string[] = [
  "/instructor",
  "/instructor-training",
  "/instructor-growth",
  "/training",
  "/lesson-design-studio",
  // NOTE: /applications/instructor/* is intentionally NOT gated by prefix.
  // Summer Workshop applications live on the same route; the standard-track
  // redirect is handled inside the application detail page itself.
];

/** Single source of truth for "is this path gated by the regular instructor flag?" */
export function isRegularInstructorGatedPath(pathname: string): boolean {
  return REGULAR_INSTRUCTOR_GATED_HREF_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Admin override: admins can always reach gated areas. A `?adminPreview=1`
 * query param is also accepted so reviewers can spot-check without an
 * elevated role.
 */
export function canBypassInstructorGate(opts: {
  roles?: readonly string[] | null;
  primaryRole?: string | null;
  adminPreviewParam?: string | null;
}): boolean {
  const roles = opts.roles ?? [];
  if (roles.includes("ADMIN") || roles.includes("SUPER_ADMIN")) return true;
  if (opts.primaryRole === "ADMIN" || opts.primaryRole === "SUPER_ADMIN") return true;
  const preview = (opts.adminPreviewParam ?? "").toLowerCase();
  if (preview === "1" || preview === "true" || preview === "yes") return true;
  return false;
}

/**
 * Where to send a non-admin who hits a gated route. Returns null when the
 * path is not gated or the user can bypass.
 */
export function getInstructorGateRedirect(opts: {
  pathname: string;
  roles?: readonly string[] | null;
  primaryRole?: string | null;
  adminPreviewParam?: string | null;
}): string | null {
  if (isRegularInstructorEnabled()) return null;
  if (!isRegularInstructorGatedPath(opts.pathname)) return null;
  if (canBypassInstructorGate(opts)) return null;
  return "/applications/summer-workshop";
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
