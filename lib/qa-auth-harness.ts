import { cookies } from "next/headers";

const COOKIE = "ypp_qa_role";
export const QA_ROLES = ["student", "guardian", "instructor", "chapter-president", "leadership", "restricted-safety-staff"] as const;
export type QaRole = (typeof QA_ROLES)[number];
export function qaHarnessEnabled() { return process.env.NODE_ENV !== "production" && process.env.ENABLE_YPP_QA_AUTH === "true"; }
export async function setQaRole(role: QaRole) { if (!qaHarnessEnabled()) throw new Error("QA auth harness is disabled outside guarded non-production runs."); (await cookies()).set(COOKIE, role, { httpOnly: true, sameSite: "lax", path: "/" }); }
export async function getQaRole() { if (!qaHarnessEnabled()) return null; return (await cookies()).get(COOKIE)?.value as QaRole | undefined ?? null; }
