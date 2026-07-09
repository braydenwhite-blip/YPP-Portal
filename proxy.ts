import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";
import { LEGACY_AUTH_COOKIE_NAME, verifyLegacySessionToken } from "@/lib/legacy-auth";
import { isDemoAllowedPathname, isHiringDemoModeEnabled } from "@/lib/hiring-demo-mode";
import {
  ACTIONS_ONLY_PREVIEW_COOKIE_NAME,
  isActionsOnlyPreviewAccessFromAuth,
  isActionsOnlyPilotEmail,
  isActionsOnlyPreviewAllowedPath,
  isLeadershipPreviewAccessFromAuth,
  isLeadershipPreviewPath,
} from "@/lib/leadership-preview-access";
import {
  LOCKED_PATH,
  PREVIEW_COOKIE_NAME,
  isAllowedPublicPath,
  isOfficerTierFromAuth,
  isPublicGateEnabled,
  verifyPreviewToken,
} from "@/lib/public-gate";
import {
  isGamificationEnabled,
  isGamificationGatedPath,
} from "@/lib/gamification-gate";
import { isPeopleHubOfficerRoute } from "@/lib/people/hub-access";

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
  // Internal preview unlock — reachable without login so testers can
  // enter the passcode before authenticating.
  "/preview",
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

function withForwardedRequestHeaders(
  request: NextRequest,
  pathname: string,
  extra: Record<string, string> = {}
): Headers {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  for (const [key, value] of Object.entries(extra)) {
    requestHeaders.set(key, value);
  }
  return requestHeaders;
}

function mergeMiddlewareResponse(
  request: NextRequest,
  source: NextResponse,
  pathname: string,
  extra: Record<string, string> = {}
): NextResponse {
  const merged = NextResponse.next({
    request: {
      headers: withForwardedRequestHeaders(request, pathname, extra),
    },
  });
  for (const cookie of source.cookies.getAll()) {
    merged.cookies.set(cookie.name, cookie.value);
  }
  return merged;
}

function applySecurityHeaders(response: NextResponse, pathname?: string): NextResponse {
  const nonce = generateNonce();

  // Forward nonce to server components via request header
  response.headers.set("x-nonce", nonce);

  // Forward the request pathname so layouts/RSCs can read it via `headers()`.
  if (pathname) {
    response.headers.set("x-pathname", pathname);
  }

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
    const response = NextResponse.next({
      request: {
        headers: withForwardedRequestHeaders(request, pathname),
      },
    });
    return applySecurityHeaders(response, pathname);
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

  // Gamification gate: while the gamification suite is turned off, its surfaces
  // are hidden from EVERYONE (no officer bypass) — route requests away to home.
  // Nav links are dropped in resolve-nav.ts, so this only catches stale/direct
  // links. The data layer is untouched; this is a UI product-readiness switch.
  if (
    isAuthenticated &&
    !isGamificationEnabled() &&
    isGamificationGatedPath(pathname)
  ) {
    const dest = request.nextUrl.clone();
    dest.pathname = "/";
    dest.search = "";
    return NextResponse.redirect(dest);
  }

  // Public portal gate: redirect any non-allowed surface to /locked
  // unless the visitor presents a valid signed preview cookie or holds an
  // officer-tier role (admin, staff, chapter president, hiring chair).
  if (isPublicGateEnabled() && isAuthenticated && pathname !== LOCKED_PATH) {
    const previewCookie = request.cookies.get(PREVIEW_COOKIE_NAME)?.value ?? null;
    const previewValid = previewCookie ? await verifyPreviewToken(previewCookie) : false;
    // Legacy local-password sign-in (roster emails) has no Supabase JWT — use
    // the legacy session email/roles so nav and middleware agree.
    const authEmail = user?.email ?? legacySession?.email ?? null;
    const metadata =
      user?.user_metadata ??
      (legacySession
        ? {
            roles: legacySession.roles,
            primaryRole: legacySession.primaryRole ?? undefined,
          }
        : undefined);
    const leadershipAccess = isLeadershipPreviewAccessFromAuth(metadata, authEmail);
    const actionsOnlyAccess =
      isActionsOnlyPilotEmail(authEmail) ||
      isActionsOnlyPreviewAccessFromAuth(metadata, authEmail);
    const actionsOnlyPreviewCookie =
      request.cookies.get(ACTIONS_ONLY_PREVIEW_COOKIE_NAME)?.value ?? null;
    const actionsOnlyUiActive =
      actionsOnlyAccess || actionsOnlyPreviewCookie === "1";
    const officerBypass = isOfficerTierFromAuth(
      (metadata as { roles?: string[] } | undefined)?.roles,
      (metadata as { primaryRole?: string } | undefined)?.primaryRole,
    );

    if (
      actionsOnlyUiActive &&
      !previewValid &&
      !isActionsOnlyPreviewAllowedPath(pathname)
    ) {
      const dest = request.nextUrl.clone();
      dest.pathname = LOCKED_PATH;
      dest.search = "";
      if (pathname && pathname !== "/") {
        dest.searchParams.set("from", pathname);
      }
      return NextResponse.redirect(dest);
    }

    if (!isAllowedPublicPath(pathname)) {
      if (!previewValid) {
        if (isPeopleHubOfficerRoute(pathname) && !officerBypass) {
          const dest = request.nextUrl.clone();
          dest.pathname = LOCKED_PATH;
          dest.search = "";
          if (pathname && pathname !== "/") {
            dest.searchParams.set("from", pathname);
          }
          return NextResponse.redirect(dest);
        }
        if (isLeadershipPreviewPath(pathname) && !leadershipAccess) {
          const actionsPathAllowed =
            actionsOnlyUiActive &&
            (pathname === "/actions" || pathname.startsWith("/actions/"));
          if (!actionsPathAllowed) {
            const dest = request.nextUrl.clone();
            dest.pathname = LOCKED_PATH;
            dest.search = "";
            if (pathname && pathname !== "/") {
              dest.searchParams.set("from", pathname);
            }
            return NextResponse.redirect(dest);
          }
        }
        if (!isLeadershipPreviewPath(pathname) && !officerBypass && !actionsOnlyUiActive) {
          const dest = request.nextUrl.clone();
          dest.pathname = LOCKED_PATH;
          dest.search = "";
          if (pathname && pathname !== "/") {
            dest.searchParams.set("from", pathname);
          }
          return NextResponse.redirect(dest);
        }
      }
    }
  }

  const authForward: Record<string, string> = {};
  if (user && !isArchivedPortalUser) {
    authForward["x-supabase-auth-id"] = user.id;
    if (user.email) authForward["x-supabase-auth-email"] = user.email;
  }
  if (legacySession?.userId) {
    authForward["x-legacy-user-id"] = legacySession.userId;
    if (legacySession.email) authForward["x-legacy-auth-email"] = legacySession.email;
  }

  return applySecurityHeaders(
    mergeMiddlewareResponse(request, response, pathname, authForward),
    pathname
  );
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"]
};
