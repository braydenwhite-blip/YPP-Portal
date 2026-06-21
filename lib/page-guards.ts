import { redirect } from "next/navigation";
import { getSession, type SessionUser } from "@/lib/auth-supabase";
import { normalizeRoleList } from "@/lib/authorization";
import { APPLICATION_REVIEWER_ROLES } from "@/lib/org/role-sets";

/**
 * Page-level role guards for server components.
 *
 * Unlike the `requireAnyRole` helpers in `lib/authorization.ts` — which THROW
 * `Unauthorized` and are meant for server actions — these resolve the session
 * and `redirect()` on failure, so an unauthorized visit lands somewhere sane
 * instead of rendering a 500.
 *
 * Per-record checks (e.g. `assertCanViewApplicant`, `canSeeChairQueue`) still
 * belong on the page; this only enforces the coarse role gate.
 */
export async function requirePageRoles(
  allowedRoles: readonly string[],
  opts?: { redirectTo?: string }
): Promise<SessionUser> {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = normalizeRoleList(session.user.roles, session.user.primaryRole);
  if (!allowedRoles.some((role) => roles.includes(role))) {
    redirect(opts?.redirectTo ?? "/");
  }

  return session.user;
}

/** Application-workflow review surfaces are open to all reviewer roles. */
export { APPLICATION_REVIEWER_ROLES } from "@/lib/org/role-sets";

/** ADMIN-only admin route. */
export function requireAdminPage(): Promise<SessionUser> {
  return requirePageRoles(["ADMIN"]);
}

/** Applicant review board — ADMIN, Hiring Chair, or Chapter President. */
export function requireApplicationReviewerPage(): Promise<SessionUser> {
  return requirePageRoles(APPLICATION_REVIEWER_ROLES);
}

/** Hiring Chair decision surfaces — ADMIN or Hiring Chair (matches `canSeeChairQueue`). */
export function requireChairPage(): Promise<SessionUser> {
  return requirePageRoles(["ADMIN", "HIRING_CHAIR"]);
}

/** Applicant-only surfaces. Non-applicants are sent home rather than to login. */
export function requireApplicantPage(): Promise<SessionUser> {
  return requirePageRoles(["APPLICANT"], { redirectTo: "/" });
}
