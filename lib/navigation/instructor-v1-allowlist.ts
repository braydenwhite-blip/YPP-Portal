import type { NavRole } from "@/lib/navigation/types";

/** Bump when the href set changes so dashboard cache partitions stay correct. */
export const INSTRUCTOR_V1_ALLOWLIST_VERSION = "9";

/**
 * Default instructor nav: a dedicated Teach section (workspace, curriculum,
 * lesson plans, class settings), training, teaching ops, scheduling, updates,
 * program hub, chapter, account. Awards, interviews, growth, college tools,
 * events, journey, etc. stay off the sidebar unless
 * `INSTRUCTOR_FULL_PORTAL_EXPLORER` is enabled (full catalog within visible nav groups).
 */
export const INSTRUCTOR_V1_ALLOWED_HREFS: ReadonlySet<string> = new Set([
  "/",
  "/instructor-onboarding",
  "/instructor/workspace",
  "/instructor/curriculum-builder",
  "/lesson-plans",
  "/instructor/class-settings",
  "/instructor-training",
  "/instructor/lesson-design-studio",
  "/instructor/workshop-design-studio",
  "/attendance",
  "/instructor/parent-feedback",
  "/feedback/anonymous",
  "/scheduling",
  "/announcements",
  "/notifications",
  "/calendar",
  "/my-mentor",
  // Student Operating System centerpiece (gated by `requiresGrowthOs` in the
  // catalog, so this only applies when ENABLE_GROWTH_OS is on).
  "/my-growth",
  "/leadership-pathway",
  "/chapters",
  "/settings/personalization",
]);

export function isInstructorFullPortalExplorerEnabled(): boolean {
  return process.env.INSTRUCTOR_FULL_PORTAL_EXPLORER === "true";
}

export function shouldApplyInstructorV1NavFilter(
  primaryRole: NavRole,
  instructorFullPortalExplorer?: boolean
): boolean {
  if (primaryRole !== "INSTRUCTOR") return false;
  const fullExplorer =
    instructorFullPortalExplorer !== undefined
      ? instructorFullPortalExplorer
      : isInstructorFullPortalExplorerEnabled();
  return !fullExplorer;
}
