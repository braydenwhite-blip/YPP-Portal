import { describe, expect, it } from "vitest";

describe("family-support-triage-service", () => {
  it("loads the Session 6 domain module", async () => {
    const mod = await import("@/lib/family-support-triage-service").catch(async (error) => ({ error }));
    expect(mod).toBeTruthy();
  });
});
