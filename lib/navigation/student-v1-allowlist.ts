import type { NavRole } from "@/lib/navigation/types";

/** Bump when the href set changes so dashboard cache partitions stay correct. */
export const STUDENT_V1_ALLOWLIST_VERSION = "4";

export const STUDENT_V1_ALLOWED_HREFS: ReadonlySet<string> = new Set([
  "/",
  "/my-chapter",
  "/pathways",
  "/pathways/progress",
  "/curriculum",
  "/my-classes",
  "/curriculum/schedule",
  "/my-program",
  "/goals",
  "/chapters",
  "/join-chapter",
  "/events",
  "/events/map",
  "/calendar",
  "/positions",
  "/applications",
  "/announcements",
  "/notifications",
  "/messages",
  "/student-training",
  "/profile/timeline",
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
