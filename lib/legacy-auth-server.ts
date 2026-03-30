import { cookies } from "next/headers";
import {
  LEGACY_AUTH_COOKIE_NAME,
  createLegacySessionToken,
  verifyLegacySessionToken,
} from "@/lib/legacy-auth";

const LEGACY_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function getLegacySessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: LEGACY_SESSION_MAX_AGE_SECONDS,
  };
}

export async function establishLegacySession(input: { userId: string; email: string }) {
  const cookieStore = await cookies();
  const token = await createLegacySessionToken({
    userId: input.userId,
    email: input.email,
    exp: Date.now() + LEGACY_SESSION_MAX_AGE_SECONDS * 1000,
  });

  cookieStore.set(LEGACY_AUTH_COOKIE_NAME, token, getLegacySessionCookieOptions());
}

export async function clearLegacySession() {
  const cookieStore = await cookies();
  cookieStore.set(LEGACY_AUTH_COOKIE_NAME, "", {
    ...getLegacySessionCookieOptions(),
    maxAge: 0,
  });
}

export async function getLegacySessionFromCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(LEGACY_AUTH_COOKIE_NAME)?.value;
  return verifyLegacySessionToken(token);
}
