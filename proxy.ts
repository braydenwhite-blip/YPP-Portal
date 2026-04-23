import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";
import { LEGACY_AUTH_COOKIE_NAME, verifyLegacySessionToken } from "@/lib/legacy-auth";
import { isDemoAllowedPathname, isHiringDemoModeEnabled } from "@/lib/hiring-demo-mode";

// Supabase SSR writes session data into cookies of the form `sb-<ref>-auth-token`
// and may chunk large JWTs across `<name>.0`, `<name>.1`, … When the refresh
// token is rejected ("refresh_token_not_found"), those cookies become poison —
// every subsequent request re-attempts the refresh and spams errors. Strip
// them off the response so the client starts clean on the next request.
function clearSupabaseAuthCookies(request: NextRequest, response: NextResponse) {
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token")) {
      response.cookies.set(cookie.name, "", { maxAge: 0, path: "/" });
    }
  }
}

function isRecoverableAuthError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string; status?: number }).code;
  const status = (error as { code?: string; status?: number }).status;
  if (code === "refresh_token_not_found") return true;
  if (code === "invalid_grant") return true;
  if (status === 400 || status === 401) return true;
  return false;
}

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/magic-link",
  "/incubator/launches",
  "/auth/callback",
  "/auth/confirm",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function generateNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function getConnectSrcDirectives(isDev: boolean) {
  const connectSrc = [
    "'self'",
    "blob:",
    "data:",
    "https://*.pusher.com",
    "wss://*.pusher.com",
    "https://*.pusherapp.com",
    "wss://*.pusherapp.com",
    "https://*.supabase.co",
  ];

  if (isDev) {
    connectSrc.push(
      "http://localhost:*",
      "ws://localhost:*",
      "http://127.0.0.1:*",
      "ws://127.0.0.1:*",
      "http://0.0.0.0:*",
      "ws://0.0.0.0:*"
    );
  }

  return connectSrc.join(" ");
}

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    // unsafe-eval is only needed in development (Next.js HMR / fast refresh)
    ...(isDev ? ["'unsafe-eval'"] : []),
  ].join(" ");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: blob:",
    "frame-src 'self' https://www.youtube.com https://player.vimeo.com https://www.loom.com",
    `connect-src ${getConnectSrcDirectives(isDev)}`,
    "worker-src 'self' blob:",
    "report-uri /api/csp-report",
  ].join("; ");
}

function applySecurityHeaders(response: NextResponse): NextResponse {
  const nonce = generateNonce();

  // Forward nonce to server components via request header
  response.headers.set("x-nonce", nonce);

  // Set dynamic nonce-based CSP on every response
  response.headers.set("Content-Security-Policy", buildCsp(nonce));
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLogin = pathname.startsWith("/login");
  const isSignup = pathname.startsWith("/signup");
  const isPublic = isPublicPath(pathname);

  if (isPublic && !isLogin && !isSignup) {
    return applySecurityHeaders(NextResponse.next({ request }));
  }

  // Create Supabase client and refresh session
  const demoMode = isHiringDemoModeEnabled();
  const legacyToken = request.cookies.get(LEGACY_AUTH_COOKIE_NAME)?.value ?? null;
  const demoLegacySession = demoMode
    ? await verifyLegacySessionToken(legacyToken)
    : null;

  const { supabase, response } = createMiddlewareClient(request);
  let user = null;
  if (!demoLegacySession && supabase) {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error && isRecoverableAuthError(error)) {
        // Stale/invalid Supabase session — clear the poison cookies and treat
        // this request as unauthenticated. Legacy auth may still take over.
        clearSupabaseAuthCookies(request, response);
        user = null;
      } else {
        user = data?.user ?? null;
      }
    } catch (error) {
      // Network error or unreachable Supabase (e.g. dummy local URL). Clear
      // cookies for recoverable auth errors so they don't recur every request.
      if (isRecoverableAuthError(error)) {
        clearSupabaseAuthCookies(request, response);
      }
      user = null;
    }
  }
  const isArchivedPortalUser = user?.user_metadata?.portalArchived === true;
  const fallbackLegacyToken =
    !user || isArchivedPortalUser
      ? legacyToken
      : null;
  const legacySession = demoLegacySession
    ? demoLegacySession
    : fallbackLegacyToken
    ? await verifyLegacySessionToken(fallbackLegacyToken)
    : null;
  const isAuthenticated = (!!user && !isArchivedPortalUser) || !!legacySession;

  // Unauthenticated users may access public routes only.
  if (!isAuthenticated && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    if (isArchivedPortalUser) {
      loginUrl.searchParams.set("error", "account_archived");
    }
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && (isLogin || isSignup)) {
    const appUrl = request.nextUrl.clone();
    appUrl.pathname = "/";
    return NextResponse.redirect(appUrl);
  }

  if (demoMode && isAuthenticated) {
    if (!isDemoAllowedPathname(pathname)) {
      const dest = request.nextUrl.clone();
      dest.pathname = "/not-rolled-out";
      return NextResponse.redirect(dest);
    }
  }

  return applySecurityHeaders(response);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"]
};
