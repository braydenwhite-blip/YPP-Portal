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
 * Defaults ON — set `ENABLE_ACTION_TRACKER=false` to hide runtime surfaces.
 * Schema/migrations ship regardless; the flag gates pages, server actions, and emails.
 */
export function isActionTrackerEnabled(): boolean {
  return process.env.ENABLE_ACTION_TRACKER !== "false";
}

/**
 * People Strategy — Operations Hub (`/operations`) and the cross-surface
 * connection panels that turn the People Strategy area into one connected
 * operating system (see `docs/people-strategy-operating-system-plan.md`).
 *
 * Defaults ON — set `ENABLE_OPERATIONS_HUB=false` to hide the `/operations`
 * route, cross-surface panels, and nav entry. Tracker-powered features still
 * also require `ENABLE_ACTION_TRACKER`.
 */
export function isOperationsHubEnabled(): boolean {
  return process.env.ENABLE_OPERATIONS_HUB !== "false";
}

/**
 * People Strategy Execution OS — Strategic Initiatives (Phase II). Gates the
 * `/operations/initiatives`, `/operations/initiatives/[id]`, and
 * `/operations/strategic-map` routes plus the Command Center's Strategic
 * Initiatives section. The initiative LAYER is pure config + derivation (no
 * schema, no migration); this flag only gates the runtime surfaces.
 *
 * Defaults ON — set `ENABLE_STRATEGIC_INITIATIVES=false` to hide them. The
 * surfaces also require `ENABLE_OPERATIONS_HUB` and `ENABLE_ACTION_TRACKER`.
 */
export function isStrategicInitiativesEnabled(): boolean {
  return process.env.ENABLE_STRATEGIC_INITIATIVES !== "false";
}

/**
 * People Strategy — Weekly Team Briefs and Team Meetings. Adds the team-facing
 * weekly brief → Team Meeting → prepared presentation → Officer Meeting loop.
 *
 * Defaults OFF while the workflow rolls out. The schema/migration can safely
 * ship first; with the flag off, new pages return notFound(), server actions
 * throw, and cron/generation paths no-op.
 */
export function isWeeklyTeamBriefsEnabled(): boolean {
  return (
    process.env.ENABLE_WEEKLY_TEAM_BRIEFS === "true" &&
    isActionTrackerEnabled() &&
    isOperationsHubEnabled() &&
    isStrategicInitiativesEnabled()
  );
}

/**
 * Temporary deprecation gate for the older Leadership Action Center sidebar
 * entry. The route remains reachable during migration, but the nav should
 * point people at the newer People Strategy Action Tracker by default.
 */
export function isLegacyActionCenterNavEnabled(): boolean {
  return process.env.ENABLE_LEGACY_ACTION_CENTER_NAV === "true";
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
 * People Strategy — Monthly Check-Ins & Quarterly Reviews. Compiles a per-user,
 * per-month CheckIn that REUSES existing data (monthly self-reflection +
 * mentor goal review) and derives a performance rating from the live
 * `GoalRatingColor` goal-progress data — it does NOT add a second monthly
 * performance input.
 *
 * Defaults OFF — set `ENABLE_QUARTERLY_REVIEWS=true` to expose the compile
 * action and its surfaces. The schema/migration ship regardless of the flag.
 */
export function isQuarterlyReviewsEnabled(): boolean {
  return process.env.ENABLE_QUARTERLY_REVIEWS === "true";
}

/**
 * People Strategy — Leadership People Dashboard (`/people`). The succession + people
 * health table for the Leadership / Board (`requireLeadership()`), compiling live Action
 * Tracker, Quarterly Review, and Monthly Check-In data already in the schema.
 *
 * Defaults OFF — set `ENABLE_PEOPLE_DASHBOARD=true` to expose the route. With
 * the flag off the page returns notFound() so its existence is not leaked.
 */
export function isPeopleDashboardEnabled(): boolean {
  return process.env.ENABLE_PEOPLE_DASHBOARD === "true";
}

/**
 * People Strategy — provisional 3-month confirmation clock. The provisional
 * status field/model is not built yet; this flag gates the placeholder shown on
 * the member detail People Strategy section until the clock ships.
 *
 * Defaults OFF — set `ENABLE_PROVISIONAL_CLOCK=true` to enable once built.
 */
export function isProvisionalClockEnabled(): boolean {
  return process.env.ENABLE_PROVISIONAL_CLOCK === "true";
}

/**
 * Mentorship 2.0 (Action Tracker 3.0). Gates the mentor expertise taxonomy
 * editor, the mentee application intake → scored matching → pair flow, and the
 * COMPLETE -> Alumni transition surfaces. The schema/migration ship regardless
 * of this flag; the flag gates the runtime pages and server actions.
 *
 * Defaults ON as of Calm Mentorship Phase 9 (the intake→match→pair flow is
 * calm-ified and verified) — set `ENABLE_MENTORSHIP_2=false` as a kill-switch
 * to hide the application/matching/expertise surfaces and make their server
 * actions throw. Rollback for the production exposure is exactly that env flip.
 */
export function isMentorship2Enabled(): boolean {
  return process.env.ENABLE_MENTORSHIP_2 !== "false";
}

/**
 * Student Operating System / Growth Engine (Action Tracker 3.0, Phase N1). Gates
 * the unified progression system: the Vision -> Goal -> Milestone -> Action
 * hierarchy, the Growth Profile, the deterministic Achievement + Opportunity
 * engines, the `GrowthProgressEvent` ingress, the `/my-growth` student command
 * center, and the `/admin/growth` dashboard. The schema/migration ship
 * regardless of this flag.
 *
 * Defaults OFF — set `ENABLE_GROWTH_OS=true` to expose the surfaces. With the
 * flag off, `emitGrowthEvent` is a no-op, the new server actions throw, and the
 * new pages return notFound(), so existing behavior is byte-for-byte unchanged.
 */
export function isGrowthOsEnabled(): boolean {
  return process.env.ENABLE_GROWTH_OS === "true";
}

/**
 * Growth — Camp & Partner Pipeline. Upgrades `/admin/partners` from a flat
 * directory into a relationship pipeline (stages, contacts, program needs,
 * follow-ups, instructor matching, and a partner profile at
 * `/admin/partners/[id]`). The schema/migration ship regardless of the flag.
 *
 * Defaults OFF — set `ENABLE_PARTNER_PIPELINE=true` to expose the pipeline board
 * and partner profile. With the flag off, `/admin/partners` renders the original
 * simple list and `/admin/partners/[id]` returns notFound(), so existing users
 * see no behavior change. Action-linked affordances also require
 * `ENABLE_ACTION_TRACKER`.
 */
export function isPartnerPipelineEnabled(): boolean {
  return process.env.ENABLE_PARTNER_PIPELINE === "true";
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

/**
 * Leadership Roles & Contributions — concrete leadership roles instructors can
 * hold beyond teaching (Student Advisor, instructor mentor, curriculum
 * reviewer, interviewer, committee member, partner lead, …), tracked as
 * review/promotion evidence. Covers /my-advisees, /my-leadership,
 * /admin/leadership, and the leadership sections embedded in instructor and
 * student profiles.
 *
 * Defaults ON — set `ENABLE_LEADERSHIP_ROLES=false` as a kill-switch.
 */
export function isLeadershipRolesEnabled(): boolean {
  return process.env.ENABLE_LEADERSHIP_ROLES !== "false";
}
