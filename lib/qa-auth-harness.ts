import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE = "ypp_qa_role";
const MAX_AGE_SECONDS = 60 * 60 * 4;
export const QA_ROLES = ["student", "guardian", "instructor", "chapter-president", "leadership", "restricted-safety-staff"] as const;
export type QaRole = (typeof QA_ROLES)[number];

export const QA_EMAIL_BY_ROLE: Record<QaRole, string> = {
  student: "session5-student@ypp.test",
  guardian: "session5-guardian@ypp.test",
  instructor: "session5-instructor@ypp.test",
  "chapter-president": "session5-president@ypp.test",
  leadership: "session5-leadership@ypp.test",
  "restricted-safety-staff": "session5-safety@ypp.test",
};

export function qaHarnessEnabled(env = process.env) {
  return env.NODE_ENV !== "production" && env.ENABLE_YPP_QA_AUTH === "true";
}

export function isQaRole(value: unknown): value is QaRole {
  return typeof value === "string" && (QA_ROLES as readonly string[]).includes(value);
}

function signingSecret(env = process.env) {
  return env.YPP_QA_AUTH_SECRET ?? env.NEXTAUTH_SECRET ?? "ypp-local-qa-auth-only";
}

function signature(role: QaRole, env = process.env) {
  return createHmac("sha256", signingSecret(env)).update(role).digest("base64url");
}

export function signQaRole(role: QaRole, env = process.env) {
  return `${role}.${signature(role, env)}`;
}

export function verifySignedQaRole(value: string | undefined | null, env = process.env): QaRole | null {
  if (!value || !qaHarnessEnabled(env)) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const role = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!isQaRole(role)) return null;
  const expected = signature(role, env);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? role : null;
}

export function qaCookieOptions(env = process.env) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}

export async function setQaRole(role: QaRole) {
  if (!qaHarnessEnabled()) throw new Error("QA auth harness is disabled outside guarded non-production runs.");
  (await cookies()).set(COOKIE, signQaRole(role), qaCookieOptions());
}

export async function clearQaRole() {
  (await cookies()).delete(COOKIE);
}

export async function getQaRole() {
  if (!qaHarnessEnabled()) return null;
  return verifySignedQaRole((await cookies()).get(COOKIE)?.value);
}
