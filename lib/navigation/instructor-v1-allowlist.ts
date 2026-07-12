import type { NavRole } from "@/lib/navigation/types";

/** Bump when the href set changes so dashboard cache partitions stay correct. */
export const INSTRUCTOR_V1_ALLOWLIST_VERSION = "10";

/**
 * Default instructor nav follows the teaching lifecycle instead of the portal's
 * database/features: one home, assigned classes, actionable students, materials
 * in session context, and the teaching schedule. Training, builders, history,
 * profile, and settings remain reachable as secondary destinations from the
 * relevant workflow, not as competing top-level homes.
 */
export const INSTRUCTOR_V1_ALLOWED_HREFS: ReadonlySet<string> = new Set([
  "/",
  "/instructor/classes",
  "/instructor/students",
  "/instructor/materials",
  "/instructor/schedule",
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
