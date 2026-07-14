import { describe, expect, it, vi } from "vitest";
vi.mock("next/headers", () => ({ cookies: async () => ({ set: vi.fn(), get: vi.fn() }) }));
const mod = await import("@/lib/qa-auth-harness");
describe("QA auth harness guard", () => {
  it("is disabled unless explicitly enabled outside production", () => { const old = process.env.ENABLE_YPP_QA_AUTH; delete process.env.ENABLE_YPP_QA_AUTH; expect(mod.qaHarnessEnabled()).toBe(false); process.env.ENABLE_YPP_QA_AUTH = old; });
});
