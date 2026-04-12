import { isLegacyAuthBypassEmail } from "@/lib/legacy-auth-config";
import { canUseLocalPasswordFallback } from "@/lib/supabase/config";

export const LEGACY_AUTH_COOKIE_NAME = "ypp_legacy_session";
export type LegacySessionMode = "BYPASS" | "LOCAL_PASSWORD_FALLBACK";

export type LegacySessionPayload = {
  userId: string;
  email: string;
  exp: number;
  mode?: LegacySessionMode;
};

function getLegacyAuthSecret() {
  return process.env.NEXTAUTH_SECRET?.trim() || "";
}

function stringToBase64Url(value: string) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "utf8").toString("base64url");
  }

  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function bytesToBase64Url(value: Uint8Array) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value).toString("base64url");
  }

  let binary = "";
  for (const byte of value) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToString(value: string) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "base64url").toString("utf8");
  }

  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return atob(padded);
}

async function signValue(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function createLegacySessionToken(payload: LegacySessionPayload) {
  const secret = getLegacyAuthSecret();
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required for legacy auth.");
  }

  const body = stringToBase64Url(JSON.stringify(payload));
  const signature = await signValue(body, secret);
  return `${body}.${signature}`;
}

export async function verifyLegacySessionToken(token?: string | null): Promise<LegacySessionPayload | null> {
  if (!token) return null;

  const secret = getLegacyAuthSecret();
  if (!secret) return null;

  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expectedSignature = await signValue(body, secret);
  if (signature !== expectedSignature) return null;

  try {
    const payload = JSON.parse(base64UrlToString(body)) as LegacySessionPayload;
    if (!payload?.userId || !payload?.email || typeof payload.exp !== "number") {
      return null;
    }

    const mode = payload.mode ?? "BYPASS";
    const isAllowedEmail =
      mode === "LOCAL_PASSWORD_FALLBACK"
        ? canUseLocalPasswordFallback()
        : isLegacyAuthBypassEmail(payload.email);

    if (!isAllowedEmail) {
      return null;
    }

    if (payload.exp <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
