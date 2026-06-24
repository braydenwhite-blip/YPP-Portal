/**
 * Public Portal Gate
 * ---------------------------------------------------------------------------
 * The portal is being shipped to the public with a deliberately narrow
 * surface area: only the Summer Workshop applicant flow and the Summer
 * Workshop proposal (workshop design) flow are visible to normal users.
 * Everything else (G&R, mentorship, chapter tools, admin dashboards, the
 * regular instructor program, experimental student/instructor surfaces, etc.)
 * is hidden behind this gate so the production deployment feels focused
 * while we keep iterating on the rest of the platform.
 *
 * One way past the gate, the same for everyone (admins included):
 * INTERNAL PREVIEW MODE — visit /preview, enter the passcode from
 * `PORTAL_PREVIEW_PASSCODE`, and receive a signed HTTP-only cookie that
 * unlocks the rest of the portal for ~7 days.
 *
 * IMPORTANT: this gate ONLY controls feature visibility / route
 * availability. It does NOT grant admin permissions. Sensitive admin
 * actions still require the user's actual role/subtype, enforced at the
 * page/server-action layer (`requireAnyRole`, etc.).
 *
 * Edge-safe: this module avoids Node-only APIs so it can be imported by
 * `proxy.ts` (Next.js middleware runs on the Edge runtime).
 */

/** Cookie name carrying the signed preview-mode token. HTTP-only, SameSite=Lax. */
export const PREVIEW_COOKIE_NAME = "ypp_preview";

/** Short-lived cookie set by /preview after a failed passcode attempt — purely UX. */
export const PREVIEW_FLASH_COOKIE_NAME = "ypp_preview_flash";

/** Default lifetime of a preview cookie. */
export const PREVIEW_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

/** Path testers are redirected to when they hit a hidden surface. */
export const LOCKED_PATH = "/locked";

/** Where the "Apply for a Summer Workshop" CTA points. */
export const SUMMER_WORKSHOP_APPLY_HREF = "/applications/summer-workshop";

/** Where the "Propose a Summer Workshop" CTA points. */
export const SUMMER_WORKSHOP_PROPOSE_HREF = "/instructor/workshop-design-studio";

/**
 * Path prefixes that remain available to *every* logged-in user when the
 * public gate is active. Anything not matching one of these prefixes is
 * redirected to /locked unless the user is an admin or has a valid
 * preview cookie.
 *
 * Keep this list intentionally small. When we ship a new feature to the
 * public, add its top-level prefix here in a small focused PR.
 */
export const PUBLIC_ALLOWED_PREFIXES: readonly string[] = [
  // Core public/auth surfaces (auth pages are also exempted by middleware
  // PUBLIC_PATHS, but listing them here keeps the gate self-consistent).
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/magic-link",
  "/auth",

  // The gate's own surfaces.
  LOCKED_PATH,
  "/preview",
  "/api/preview",

  // Onboarding must be reachable so new users can finish setup before
  // landing on the Summer Workshop CTAs.
  "/onboarding",
  "/instructor-onboarding",
  "/qa/instructor-onboarding",

  // Lightweight personal surfaces. Users still need to be able to sign
  // out, manage their basic profile, and verify email. We deliberately
  // do NOT add /messages, /notifications, etc. — those aren't part of
  // the public Summer Workshop flow.
  "/profile",
  "/settings",

  // Summer Workshop Applications.
  "/applications",                    // "My applications" listing
  "/application-status",              // applicant-facing status page

  // The instructor applicant board (admin hiring kanban) — the primary
  // live surface. The page enforces its own role checks (ADMIN /
  // HIRING_CHAIR / CHAPTER_PRESIDENT), so listing it here only lets the
  // route through middleware; it does not grant access.
  "/admin/instructor-applicants",

  // NOTE: the Leadership / People-Strategy / ops surfaces (/people, /meetings,
  // /actions, /operations, /partners), general comms (/messages,
  // /notifications), and the AI help agent (/help-agent) are intentionally NOT
  // public. Officer-tier users (ADMIN / STAFF / CHAPTER_PRESIDENT /
  // HIRING_CHAIR) still reach them — `proxy.ts` bypasses the gate by role — so
  // dropping them from this allowlist only re-hides them from non-officer
  // users who lack a preview passcode, matching the gate's stated purpose
  // (Summer Workshop + hiring only).

  // Admin hiring intake — external applicant entry (staff, instructor, CP).
  // Page enforces ADMIN / CHAPTER_PRESIDENT server-side.
  "/admin/external-applicants",

  // Summer Workshop Proposals (workshop design studio + required
  // training surface that the Summer Workshop pathway depends on).
  "/instructor/workshop-design-studio",
  "/instructor-training",
];

/**
 * The home route ("/") is special: middleware lets it through, but the
 * server component renders a focused public landing instead of the full
 * dashboard when the gate is active.
 */
export const PUBLIC_HOME_PATH = "/";

/**
 * Master switch. The gate is ON by default — to disable it (e.g. for
 * internal staging environments where everyone is a tester) set
 * `PORTAL_PUBLIC_GATE=off` in the environment.
 */
export function isPublicGateEnabled(): boolean {
  const raw = (process.env.PORTAL_PUBLIC_GATE ?? "").toLowerCase().trim();
  if (raw === "off" || raw === "false" || raw === "0" || raw === "disabled") {
    return false;
  }
  return true;
}

export function isAllowedPublicPath(pathname: string): boolean {
  if (pathname === PUBLIC_HOME_PATH) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/api/")) {
    // API routes are not gated by middleware — server actions still
    // perform their own role/permission checks (requireAnyRole, etc.).
    // The /api/preview/* family is allowed explicitly so testers can
    // exit preview mode while on /locked.
    return true;
  }
  return PUBLIC_ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Edge-safe officer check for middleware. Defined once in
 * `@/lib/org/role-sets` (alongside the canonical OFFICER_TIER_ROLES) and
 * re-exported here so existing importers (`proxy.ts`, `resolve-nav.ts`,
 * `app/(app)/page.tsx`) keep working.
 */
export { isOfficerTierFromAuth } from "@/lib/org/role-sets";

// ---------------------------------------------------------------------------
// Preview cookie signing/verification
// ---------------------------------------------------------------------------
// Format: `<base64url(payload)>.<base64url(hmac-sha256)>` where payload is
//   `{ "v": 1, "exp": <unix-seconds> }`
// HMAC key is derived from NEXTAUTH_SECRET (already required in env.ts).
// Edge-safe — uses Web Crypto. Do NOT import `crypto` from "node:crypto".

const PREVIEW_TOKEN_VERSION = 1;
const TEXT_ENCODER = new TextEncoder();

function getPreviewSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) {
    // Surfacing this clearly is better than silently signing with a
    // weak/absent secret. env.ts already enforces this for production
    // builds, so reaching this branch means dev with no env file.
    throw new Error("NEXTAUTH_SECRET is required to sign the preview cookie.");
  }
  return secret;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacSha256(key: string, data: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    TEXT_ENCODER.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, TEXT_ENCODER.encode(data));
  return new Uint8Array(sig);
}

/** Constant-time comparison to avoid timing leaks during signature verify. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function signPreviewToken(
  ttlSeconds: number = PREVIEW_COOKIE_MAX_AGE_SECONDS
): Promise<string> {
  const payload = {
    v: PREVIEW_TOKEN_VERSION,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const payloadJson = JSON.stringify(payload);
  const payloadEncoded = base64UrlEncode(TEXT_ENCODER.encode(payloadJson));
  const signature = await hmacSha256(getPreviewSecret(), payloadEncoded);
  return `${payloadEncoded}.${base64UrlEncode(signature)}`;
}

/**
 * Verifies a signed preview token. Returns true iff signature is valid AND
 * the token hasn't expired. Never throws.
 */
export async function verifyPreviewToken(token: string | null | undefined): Promise<boolean> {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadEncoded, signatureEncoded] = parts;

  let secret: string;
  try {
    secret = getPreviewSecret();
  } catch {
    return false;
  }

  let provided: Uint8Array;
  try {
    provided = base64UrlDecode(signatureEncoded);
  } catch {
    return false;
  }
  const expected = await hmacSha256(secret, payloadEncoded);
  if (!timingSafeEqual(provided, expected)) return false;

  let payload: { v?: number; exp?: number };
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadEncoded)));
  } catch {
    return false;
  }
  if (payload.v !== PREVIEW_TOKEN_VERSION) return false;
  if (typeof payload.exp !== "number") return false;
  if (payload.exp < Math.floor(Date.now() / 1000)) return false;

  return true;
}

/** Whether the configured passcode env var is set (controls /preview UX). */
export function isPreviewPasscodeConfigured(): boolean {
  return Boolean((process.env.PORTAL_PREVIEW_PASSCODE ?? "").trim().length);
}

/**
 * Constant-time passcode comparison. Returns false when the env var is
 * unset so a missing passcode doesn't accidentally match an empty input.
 */
export function comparePreviewPasscode(input: string): boolean {
  const expected = (process.env.PORTAL_PREVIEW_PASSCODE ?? "").trim();
  if (!expected) return false;
  if (input.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ input.charCodeAt(i);
  }
  return diff === 0;
}
