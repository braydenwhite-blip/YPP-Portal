/**
 * Server-side helper for the temporary "regular instructor disabled" gate.
 *
 * Pages call `enforceInstructorGate()` near the top of their RSC body —
 * if the gate applies it issues a `redirect()`, otherwise it returns and
 * the page renders normally. Admins (and `?adminPreview=1`) bypass.
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import {
  canBypassInstructorGate,
  isRegularInstructorEnabled,
} from "@/lib/feature-flags";

const GATE_DESTINATION = "/applications/summer-workshop";

export type InstructorGateOptions = {
  /** Optional searchParams from the calling page — used for `?adminPreview=1`. */
  adminPreview?: string | string[] | null;
};

function readAdminPreview(value: InstructorGateOptions["adminPreview"]): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
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

  if (canBypassInstructorGate({ roles, primaryRole, adminPreviewParam: adminPreview })) {
    return;
  }

  redirect(GATE_DESTINATION);
}

/** Synchronous variant when the caller already has the session. */
export function enforceInstructorGateWithSession(opts: {
  roles?: readonly string[] | null;
  primaryRole?: string | null;
  adminPreview?: string | null;
}): void {
  if (isRegularInstructorEnabled()) return;
  if (canBypassInstructorGate({ ...opts, adminPreviewParam: opts.adminPreview ?? null })) {
    return;
  }
  redirect(GATE_DESTINATION);
}
