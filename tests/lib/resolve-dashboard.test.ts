import { describe, expect, it } from "vitest";

import { resolveDashboardRole } from "@/lib/dashboard/resolve-dashboard";

describe("resolveDashboardRole", () => {
  it("returns HIRING_CHAIR for a pure hiring-chair user", () => {
    expect(
      resolveDashboardRole({ primaryRole: "HIRING_CHAIR", roles: ["HIRING_CHAIR"] })
    ).toBe("HIRING_CHAIR");
  });

  it("returns ADMIN when user is both ADMIN and HIRING_CHAIR (ADMIN priority)", () => {
    // primaryRole wins when present and supported
    expect(
      resolveDashboardRole({
        primaryRole: "ADMIN",
        roles: ["ADMIN", "HIRING_CHAIR"],
      })
    ).toBe("ADMIN");
  });

  it("falls back to ADMIN over HIRING_CHAIR when no primaryRole is set (per fallback order)", () => {
    expect(
      resolveDashboardRole({
        primaryRole: null,
        roles: ["HIRING_CHAIR", "ADMIN"],
      })
    ).toBe("ADMIN");
  });

  it("uses HIRING_CHAIR as fallback when no primaryRole and only HIRING_CHAIR is present", () => {
    expect(
      resolveDashboardRole({ primaryRole: null, roles: ["HIRING_CHAIR"] })
    ).toBe("HIRING_CHAIR");
  });

  it("returns STUDENT for unknown roles and empty arrays", () => {
    expect(resolveDashboardRole({ primaryRole: null, roles: [] })).toBe("STUDENT");
    expect(
      resolveDashboardRole({ primaryRole: "UNKNOWN", roles: ["FOO", "BAR"] })
    ).toBe("STUDENT");
  });

  it("preserves INSTRUCTOR / STUDENT / etc. resolution behavior", () => {
    expect(
      resolveDashboardRole({ primaryRole: "INSTRUCTOR", roles: ["INSTRUCTOR"] })
    ).toBe("INSTRUCTOR");
    expect(
      resolveDashboardRole({ primaryRole: "STUDENT", roles: ["STUDENT"] })
    ).toBe("STUDENT");
  });
});
