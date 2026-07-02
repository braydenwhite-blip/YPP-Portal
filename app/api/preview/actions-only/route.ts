import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getSession } from "@/lib/auth-supabase";
import { ACTIONS_ONLY_PREVIEW_COOKIE_NAME } from "@/lib/leadership-preview-access";
import { isOfficerTierFromAuth } from "@/lib/public-gate";

/**
 * Toggle the local actions-only preview chrome for admins/officers.
 *   GET /api/preview/actions-only?enable=1  → narrow to Home + Actions
 *   GET /api/preview/actions-only?enable=0  → exit preview
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    return NextResponse.redirect(login);
  }

  const roles = session.user.roles ?? [];
  const primaryRole = session.user.primaryRole ?? null;
  if (!isOfficerTierFromAuth(roles, primaryRole)) {
    return NextResponse.json({ error: "Officer access required." }, { status: 403 });
  }

  const enable = request.nextUrl.searchParams.get("enable");
  const dest = request.nextUrl.clone();
  dest.search = "";
  dest.pathname = enable === "0" ? "/" : "/actions";

  const response = NextResponse.redirect(dest);
  if (enable === "1") {
    response.cookies.set(ACTIONS_ONLY_PREVIEW_COOKIE_NAME, "1", {
      path: "/",
      maxAge: 60 * 60 * 8,
      httpOnly: true,
      sameSite: "lax",
    });
  } else {
    response.cookies.set(ACTIONS_ONLY_PREVIEW_COOKIE_NAME, "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
    });
  }

  return response;
}
