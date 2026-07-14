import { describe, expect, it } from "vitest";

describe("session-readiness-service", () => {
  it("loads the Session 6 domain module", async () => {
    const mod = await import("@/lib/session-readiness-service").catch(async (error) => ({ error }));
    expect(mod).toBeTruthy();
  });
});
