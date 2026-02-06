import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const isLogin = request.nextUrl.pathname.startsWith("/login");
  const isSignup = request.nextUrl.pathname.startsWith("/signup");
  const isOnboarding = request.nextUrl.pathname.startsWith("/onboarding");

  if (!token && !isLogin && !isSignup) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  if (token && (isLogin || isSignup)) {
    const appUrl = request.nextUrl.clone();
    appUrl.pathname = "/";
    return NextResponse.redirect(appUrl);
  }

  // Redirect new users (no onboarding completed) to onboarding
  // We check a cookie set by the app layout to avoid DB calls in middleware
  if (token && !isOnboarding && !isLogin && !isSignup) {
    const onboardingDone = request.cookies.get("onboarding_completed");
    if (onboardingDone?.value === "false") {
      const onboardingUrl = request.nextUrl.clone();
      onboardingUrl.pathname = "/onboarding";
      return NextResponse.redirect(onboardingUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"]
};
