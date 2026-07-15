import { describe, expect, it } from "vitest";
import { pretty, shortDate } from "@/lib/session8/format";

describe("Session 8 family-facing formatting", () => {
  it("humanizes raw statuses before rendering family/instructor UI", () => {
    expect(pretty("WAITLIST_OFFERED")).toBe("Waitlist Offered");
    expect(pretty(null)).toBe("Not set");
  });

  it("formats certificate and completion dates consistently", () => {
    expect(shortDate("2026-07-14T00:00:00.000Z")).toContain("2026");
  });
});
