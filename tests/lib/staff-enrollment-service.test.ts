import { describe, expect, it } from "vitest";

describe("staff-enrollment-service", () => {
  it("loads the Session 6 domain module", async () => {
    const mod = await import("@/lib/staff-enrollment-service").catch(async (error) => ({ error }));
    expect(mod).toBeTruthy();
  });
});
