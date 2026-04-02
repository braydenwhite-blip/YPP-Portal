import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";
import { LEGACY_AUTH_COOKIE_NAME, verifyLegacySessionToken } from "@/lib/legacy-auth";

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
    "connect-src 'self' blob: data: https://*.pusher.com wss://*.pusher.com https://*.pusherapp.com wss://*.pusherapp.com https://*.supabase.co",
    "worker-src 'self' blob:",
    "report-uri /api/csp-report",
  ].join("; ");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLogin = pathname.startsWith("/login");
  const isSignup = pathname.startsWith("/signup");
  const isPublic = isPublicPath(pathname);

  // Create Supabase client and refresh session
  const { supabase, response } = createMiddlewareClient(request);
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
  } catch {
    // Supabase URL is unreachable (e.g. dummy local URL) — continue with legacy auth
    user = null;
  }
  const legacySession = await verifyLegacySessionToken(
    request.cookies.get(LEGACY_AUTH_COOKIE_NAME)?.value ?? null
  );
  const isAuthenticated = !!user || !!legacySession;

  // Unauthenticated users may access public routes only.
  if (!isAuthenticated && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && (isLogin || isSignup)) {
    const appUrl = request.nextUrl.clone();
    appUrl.pathname = "/";
    return NextResponse.redirect(appUrl);
  }

  // Generate a cryptographically random nonce for CSP in the Edge runtime.
  const nonce = generateNonce();

  // Forward nonce to server components via request header
  response.headers.set("x-nonce", nonce);

  // Set dynamic nonce-based CSP on every response
  response.headers.set("Content-Security-Policy", buildCsp(nonce));
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"]
};
