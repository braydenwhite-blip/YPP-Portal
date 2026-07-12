/**
 * Server-side helper for the temporary "regular instructor disabled" gate.
 *
 * Pages call `enforceInstructorGate()` near the top of their RSC body —
 * if the gate applies it issues a `redirect()`, otherwise it returns and
 * the page renders normally. Admins (and `?adminPreview=1`) bypass.
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import {
  canBypassInstructorGate,
  isRegularInstructorEnabled,
  isSummerWorkshopPermittedPath,
} from "@/lib/feature-flags";

const GATE_DESTINATION = "/applications/summer-workshop";

export type InstructorGateOptions = {
  /** Optional searchParams from the calling page — used for `?adminPreview=1`. */
  adminPreview?: string | string[] | null;
  /**
   * Optional URL pathname for the route being gated. When provided and
   * the path is in `SUMMER_WORKSHOP_PERMITTED_HREF_PREFIXES`, an applicant
   * whose latest application is on the SUMMER_WORKSHOP track is allowed
   * through (workshop studio + required training).
   */
  pathname?: string | null;
};

function readAdminPreview(value: InstructorGateOptions["adminPreview"]): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function lookupInstructorSubtype(userId: string | null | undefined) {
  if (!userId) return null;
  try {
    const app = await prisma.instructorApplication.findFirst({
      where: { applicantId: userId },
      orderBy: { createdAt: "desc" },
      select: { instructorSubtype: true },
    });
    return app?.instructorSubtype ?? null;
  } catch {
    return null;
  }
}

/**
 * Redirects non-admin users away from gated routes when the regular
 * Instructor program is disabled. Call from any RSC that should be hidden.
 */
export async function enforceInstructorGate(
  options: InstructorGateOptions = {}
): Promise<void> {
  if (isRegularInstructorEnabled()) return;

  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  const primaryRole = session?.user?.primaryRole ?? null;
  const adminPreview = readAdminPreview(options.adminPreview);
  const pathname = options.pathname ?? null;

  // Resolve subtype for any approved instructor entering a gated instructor
  // route. Restricting this lookup to Summer Workshop paths made the documented
  // STANDARD-instructor bypass impossible on normal teaching routes.
  const lookedUpInstructorSubtype =
    pathname &&
    session?.user?.id &&
    (roles.includes("INSTRUCTOR") || primaryRole === "INSTRUCTOR")
      ? await lookupInstructorSubtype(session.user.id)
      : null;
  // Approved instructors that predate the subtype column are standard-track by
  // definition elsewhere in readiness. Apply the same fallback here so the
  // rollout gate never locks an existing instructor out of assigned classes.
  const instructorSubtype =
    lookedUpInstructorSubtype ??
    (roles.includes("INSTRUCTOR") || primaryRole === "INSTRUCTOR" ? "STANDARD" : null);

  if (
    canBypassInstructorGate({
      roles,
      primaryRole,
      adminPreviewParam: adminPreview,
      instructorSubtype,
      pathname,
    })
  ) {
    return;
  }

  redirect(GATE_DESTINATION);
}

/** Synchronous variant when the caller already has the session. */
export function enforceInstructorGateWithSession(opts: {
  roles?: readonly string[] | null;
  primaryRole?: string | null;
  adminPreview?: string | null;
  instructorSubtype?: string | null;
  pathname?: string | null;
}): void {
  if (isRegularInstructorEnabled()) return;
  if (
    canBypassInstructorGate({
      ...opts,
      adminPreviewParam: opts.adminPreview ?? null,
    })
  ) {
    return;
  }
  redirect(GATE_DESTINATION);
}
