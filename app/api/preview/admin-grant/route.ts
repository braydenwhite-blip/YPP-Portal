import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth-supabase";
import {
  PREVIEW_COOKIE_MAX_AGE_SECONDS,
  PREVIEW_COOKIE_NAME,
  isAdminBypassRole,
  signPreviewToken,
} from "@/lib/public-gate";

/**
 * Admin auto-grant for the public portal gate.
 *
 * When an admin hits a hidden surface, the middleware redirects them to
 * /locked. /locked detects the admin role and bounces here. We re-verify
 * admin server-side from the actual session (not just a header) and
 * issue the same signed preview cookie testers receive — but without
 * requiring the passcode. This mirrors the existing `canBypassInstructorGate`
 * pattern: admins always get through, and they get there transparently.
 *
 * The cookie ONLY disables feature/route gates. It does NOT grant any
 * additional admin permissions — those are still enforced by
 * `requireAnyRole` and friends on each admin page/server action.
 */
async function grant(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  const user = session?.user;
  const isAdmin = isAdminBypassRole({
    roles: user?.roles ?? [],
    primaryRole: user?.primaryRole ?? null,
  });

  if (!isAdmin) {
    // Non-admins must use the passcode flow at /preview.
    const dest = request.nextUrl.clone();
    dest.pathname = "/preview";
    dest.search = "";
    const next = request.nextUrl.searchParams.get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      dest.searchParams.set("next", next);
    }
    return NextResponse.redirect(dest);
  }

  const next = request.nextUrl.searchParams.get("next");
  const dest = request.nextUrl.clone();
  dest.pathname = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  dest.search = "";

  const token = await signPreviewToken();
  const response = NextResponse.redirect(dest);
  response.cookies.set(PREVIEW_COOKIE_NAME, token, {
    path: "/",
    maxAge: PREVIEW_COOKIE_MAX_AGE_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

export function GET(request: NextRequest) {
  return grant(request);
}

export function POST(request: NextRequest) {
  return grant(request);
}
