import type { NavRole } from "@/lib/navigation/types";

/** Bump when the href set changes so dashboard cache partitions stay correct. */
export const STUDENT_V1_ALLOWLIST_VERSION = "5";

/**
 * Default student nav: classes, work, schedule, progress, chapter, account.
 * Chapter directory and join flows stay reachable from the Chapter page and `/join-chapter`
 * redirect; turn on `STUDENT_FULL_PORTAL_EXPLORER` for the full catalog.
 */
export const STUDENT_V1_ALLOWED_HREFS: ReadonlySet<string> = new Set([
  "/",
  "/my-classes",
  "/my-classes/assignments",
  "/curriculum",
  "/curriculum/schedule",
  "/calendar",
  "/messages",
  "/my-chapter",
  "/goals",
  "/pathways/progress",
  "/my-program",
  "/notifications",
  "/settings/personalization",
]);

export function isStudentFullPortalExplorerEnabled(): boolean {
  return process.env.STUDENT_FULL_PORTAL_EXPLORER === "true";
}

export function shouldApplyStudentV1NavFilter(
  primaryRole: NavRole,
  studentFullPortalExplorer?: boolean
): boolean {
  if (primaryRole !== "STUDENT") return false;
  const fullExplorer =
    studentFullPortalExplorer !== undefined
      ? studentFullPortalExplorer
      : isStudentFullPortalExplorerEnabled();
  return !fullExplorer;
}
