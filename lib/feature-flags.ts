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
 * People Strategy — Action Tracker (Action Items, My Actions, All Actions).
 * Defaults OFF — set `ENABLE_ACTION_TRACKER=true` to expose the runtime
 * surfaces. The schema/migration ship regardless of this flag; the flag gates
 * the feature's pages, server actions, and emails added in later phases.
 */
export function isActionTrackerEnabled(): boolean {
  return process.env.ENABLE_ACTION_TRACKER === "true";
}

/**
 * People Strategy — automated Action Tracker emails (e.g. the "New Assignment"
 * notification sent when a user is newly added to an ActionAssignment).
 *
 * Defaults OFF — set `ENABLE_ACTION_TRACKER_EMAILS=true` to enable sending.
 * This is an independent kill-switch layered on top of `ENABLE_ACTION_TRACKER`:
 * the runtime surfaces can be live while assignment emails stay silent.
 */
export function isActionTrackerEmailsEnabled(): boolean {
  return process.env.ENABLE_ACTION_TRACKER_EMAILS === "true";
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

/**
 * Sub-prefixes of the gated list that *Summer Workshop* approved instructors
 * (subtype = SUMMER_WORKSHOP) are allowed into even while the regular
 * instructor program is paused. They need access to:
 *   - `/instructor/workshop-design-studio` to design and submit workshops
 *   - `/instructor-training` and `/training/*` to complete required training
 * Other `/instructor/*` paths (curriculum builder, etc.) stay gated for
 * everyone except admins, since those are Standard-track surfaces.
 */
export const SUMMER_WORKSHOP_PERMITTED_HREF_PREFIXES: readonly string[] = [
  "/instructor/workshop-design-studio",
  "/instructor-training",
  "/training",
];

/** Single source of truth for "is this path gated by the regular instructor flag?" */
export function isRegularInstructorGatedPath(pathname: string): boolean {
  return REGULAR_INSTRUCTOR_GATED_HREF_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/** Whether the path is reachable by a SUMMER_WORKSHOP-subtype user even
 *  when the regular instructor program is paused. */
export function isSummerWorkshopPermittedPath(pathname: string): boolean {
  return SUMMER_WORKSHOP_PERMITTED_HREF_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Admin override: admins can always reach gated areas. A `?adminPreview=1`
 * query param is also accepted so reviewers can spot-check without an
 * elevated role.
 *
 * Optionally accepts the user's `instructorSubtype` and the target
 * `pathname`. SUMMER_WORKSHOP-subtype users bypass the gate for paths in
    * `SUMMER_WORKSHOP_PERMITTED_HREF_PREFIXES` (workshop studio + training).
 */
export function canBypassInstructorGate(opts: {
  roles?: readonly string[] | null;
  primaryRole?: string | null;
  adminPreviewParam?: string | null;
  instructorSubtype?: string | null;
  pathname?: string | null;
}): boolean {
  const roles = opts.roles ?? [];
  if (roles.includes("ADMIN") || roles.includes("SUPER_ADMIN")) return true;
  if (opts.primaryRole === "ADMIN" || opts.primaryRole === "SUPER_ADMIN") return true;
  const preview = (opts.adminPreviewParam ?? "").toLowerCase();
  if (preview === "1" || preview === "true" || preview === "yes") return true;

  // Approved Full Instructors (subtype STANDARD with INSTRUCTOR role) keep
  // access to /instructor/* surfaces even while the regular instructor
  // program is "paused" for new applicants. The flag's intent is to hide
  // in-flight features from APPLICANT users — not to lock out people who
  // already legitimately have the INSTRUCTOR role.
  if (
    opts.instructorSubtype === "STANDARD" &&
    (roles.includes("INSTRUCTOR") || opts.primaryRole === "INSTRUCTOR")
  ) {
    return true;
  }

  // Summer Workshop subtype: allow the workshop studio + required training
  // surfaces even while the regular instructor program is paused.
  if (
    opts.instructorSubtype === "SUMMER_WORKSHOP" &&
    opts.pathname &&
    isSummerWorkshopPermittedPath(opts.pathname)
  ) {
    return true;
  }
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
 * Historical rollout helpers for the Final Review Cockpit. Chair review
 * application routes now use the cockpit as the canonical workspace, but these
 * helpers remain available for older scripts/tests that still inspect rollout
 * env vars.
 */
export function isFinalReviewV2Enabled(): boolean {
  return process.env.ENABLE_FINAL_REVIEW_V2 === "true";
}

/**
 * Historical per-chapter rollout gate. Returns true when:
 *   - the global flag is on, OR
 *   - the chapter id is in FINAL_REVIEW_V2_CHAPTER_ALLOWLIST.
 *
 * Pass `null` for cross-chapter actors (admin / hiring chair without a
 * chapter assignment) — they count only when the global flag is on, not via
 * the per-chapter allowlist.
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
