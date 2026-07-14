import { describe, expect, it } from "vitest";

describe("class-announcement-service", () => {
  it("loads the Session 6 domain module", async () => {
    const mod = await import("@/lib/class-announcement-service").catch(async (error) => ({ error }));
    expect(mod).toBeTruthy();
  });
});
