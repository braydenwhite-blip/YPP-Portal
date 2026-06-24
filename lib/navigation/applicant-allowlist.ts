import type { NavRole } from "@/lib/navigation/types";

/** Bump when the href set changes so dashboard cache partitions stay correct. */
export const APPLICANT_ALLOWLIST_VERSION = "2";

/**
 * Navigation allowlist for APPLICANT-role users.
 *
 * APPLICANT is someone who has submitted an instructor application but has not
 * yet been fully approved. They should only see their application status and
 * general portal pages — NOT instructor workspaces, challenges, projects, or
 * curriculum tools. Those unlock after APPROVED status (UserRole grants
 * INSTRUCTOR, which switches them out of this allowlist).
 */
export const APPLICANT_ALLOWED_HREFS: ReadonlySet<string> = new Set([
  "/",
  "/application-status",
  "/my-interview",
  "/positions",
  "/applications",
  "/announcements",
  "/notifications",
  "/help",
  "/feedback/anonymous",
  "/settings",
  "/settings/personalization",
]);

/**
 * Whether the applicant-only sidebar filter should apply. True when the user's
 * primary role is APPLICANT AND they do not also hold a more-elevated role
 * (INSTRUCTOR/CHAPTER_PRESIDENT/HIRING_CHAIR/STAFF/ADMIN). The role overlap
 * check matches resolveNavModel's normalization — applicants who somehow have
 * a second role keep that role's full sidebar.
 */
export function shouldApplyApplicantNavFilter(
  primaryRole: NavRole,
  roles: readonly string[]
): boolean {
  if (primaryRole !== "APPLICANT") return false;
  if (
    roles.includes("INSTRUCTOR") ||
    roles.includes("CHAPTER_PRESIDENT") ||
    roles.includes("HIRING_CHAIR") ||
    roles.includes("STAFF") ||
    roles.includes("ADMIN") ||
    roles.includes("SUPER_ADMIN")
  ) {
    return false;
  }
  return true;
}
