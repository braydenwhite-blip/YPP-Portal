import { describe, expect, it } from "vitest";
import { QA_EMAIL_BY_ROLE, QA_ROLES, isQaRole, qaCookieOptions, qaHarnessEnabled, signQaRole, verifySignedQaRole } from "@/lib/qa-auth-harness";

const env = { NODE_ENV: "test", ENABLE_YPP_QA_AUTH: "true", YPP_QA_AUTH_SECRET: "unit-secret" } as NodeJS.ProcessEnv;

describe("qa-auth-harness", () => {
  it("is opt-in and impossible in production", () => {
    expect(qaHarnessEnabled({ NODE_ENV: "test", ENABLE_YPP_QA_AUTH: "true" } as NodeJS.ProcessEnv)).toBe(true);
    expect(qaHarnessEnabled({ NODE_ENV: "production", ENABLE_YPP_QA_AUTH: "true" } as NodeJS.ProcessEnv)).toBe(false);
    expect(qaHarnessEnabled({ NODE_ENV: "test" } as NodeJS.ProcessEnv)).toBe(false);
  });

  it("allowlists deterministic roles and emails only", () => {
    expect(QA_ROLES).toEqual(["student", "guardian", "instructor", "chapter-president", "leadership", "restricted-safety-staff"]);
    expect(isQaRole("admin")).toBe(false);
    expect(isQaRole("student")).toBe(true);
    expect(QA_EMAIL_BY_ROLE.student).toBe("session5-student@ypp.test");
    expect(Object.keys(QA_EMAIL_BY_ROLE).sort()).toEqual([...QA_ROLES].sort());
  });

  it("signs cookies and rejects tampering, arbitrary roles, and disabled environments", () => {
    const signed = signQaRole("guardian", env);
    expect(verifySignedQaRole(signed, env)).toBe("guardian");
    expect(verifySignedQaRole(signed.replace("guardian", "leadership"), env)).toBeNull();
    expect(verifySignedQaRole("admin.bad", env)).toBeNull();
    expect(verifySignedQaRole(signed, { ...env, ENABLE_YPP_QA_AUTH: "false" })).toBeNull();
  });

  it("uses bounded http-only same-site cookies", () => {
    expect(qaCookieOptions(env)).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 14400, secure: false });
    expect(qaCookieOptions({ ...env, NODE_ENV: "production" })).toMatchObject({ secure: true });
  });
});
