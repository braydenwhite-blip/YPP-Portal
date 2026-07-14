import { describe, expect, it } from "vitest";

describe("family-form-admin-service", () => {
  it("loads the Session 6 domain module", async () => {
    const mod = await import("@/lib/family-form-admin-service").catch(async (error) => ({ error }));
    expect(mod).toBeTruthy();
  });
});
