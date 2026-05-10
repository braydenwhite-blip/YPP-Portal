import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PREVIEW_COOKIE_NAME } from "@/lib/public-gate";

/**
 * Clears the preview cookie so the user is bounced back into the
 * public gated experience. Accepts either GET (so a "Exit preview"
 * link can be a plain anchor) or POST (so server actions can call it).
 */
function clearAndRedirect(request: NextRequest): NextResponse {
  const dest = request.nextUrl.clone();
  const next = request.nextUrl.searchParams.get("next");
  dest.pathname = "/";
  dest.search = "";
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    dest.pathname = next;
  }
  const response = NextResponse.redirect(dest);
  response.cookies.set(PREVIEW_COOKIE_NAME, "", {
    path: "/",
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
  });
  return response;
}

export function GET(request: NextRequest) {
  return clearAndRedirect(request);
}

export function POST(request: NextRequest) {
  return clearAndRedirect(request);
}
