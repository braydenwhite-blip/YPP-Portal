/**
 * Navigation allowlist for APPLICANT-role users.
 *
 * APPLICANT is someone who has submitted an instructor application but has not
 * yet been fully approved. They should only see their application status and
 * general portal pages — NOT instructor workspaces, challenges, projects, or
 * curriculum tools. Those unlock after PRE_APPROVED (via the application-status
 * page) and after full APPROVED status.
 */
export const APPLICANT_ALLOWED_HREFS: ReadonlySet<string> = new Set([
  "/",
  "/application-status",
  "/positions",
  "/applications",
  "/messages",
  "/announcements",
  "/notifications",
  "/help",
  "/feedback/anonymous",
  "/settings",
  "/settings/personalization",
]);
