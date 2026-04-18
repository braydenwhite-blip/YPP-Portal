import type { NavRole } from "@/lib/navigation/types";

/** Bump when the href set changes so dashboard cache partitions stay correct. */
export const INSTRUCTOR_V1_ALLOWLIST_VERSION = "2";

/**
 * Default instructor nav: training, teaching ops, scheduling, updates, program hub, chapter, account.
 * Awards, interviews, growth, college tools, events, journey, etc. stay off the sidebar unless
 * `INSTRUCTOR_FULL_PORTAL_EXPLORER` is enabled (full catalog within visible nav groups).
 */
export const INSTRUCTOR_V1_ALLOWED_HREFS: ReadonlySet<string> = new Set([
  "/",
  "/instructor-training",
  "/instructor/lesson-design-studio",
  "/attendance",
  "/instructor/parent-feedback",
  "/feedback/anonymous",
  "/scheduling",
  "/announcements",
  "/notifications",
  "/calendar",
  "/my-program",
  "/messages",
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
