import { describe, expect, it } from "vitest";

import { resolveNavModel } from "@/lib/navigation/resolve-nav";

function hrefs(model: ReturnType<typeof resolveNavModel>): string[] {
  return [...model.core, ...model.visible].map((i) => i.href);
}

describe("/my-growth nav gating (dark-launch safety)", () => {
  it("is hidden for an admin when ENABLE_GROWTH_OS is off", () => {
    const model = resolveNavModel({
      roles: ["ADMIN"],
      primaryRole: "ADMIN",
      pathname: "/",
      growthOsEnabled: false,
    });
    expect(hrefs(model)).not.toContain("/my-growth");
  });

  it("appears for an admin when ENABLE_GROWTH_OS is on", () => {
    const model = resolveNavModel({
      roles: ["ADMIN"],
      primaryRole: "ADMIN",
      pathname: "/",
      growthOsEnabled: true,
    });
    expect(hrefs(model)).toContain("/my-growth");
  });

  it("appears for a default (minimal-nav) student only when the flag is on", () => {
    const off = resolveNavModel({
      roles: ["STUDENT"],
      primaryRole: "STUDENT",
      pathname: "/",
      studentFullPortalExplorer: false,
      growthOsEnabled: false,
    });
    expect(hrefs(off)).not.toContain("/my-growth");

    const on = resolveNavModel({
      roles: ["STUDENT"],
      primaryRole: "STUDENT",
      pathname: "/",
      studentFullPortalExplorer: false,
      growthOsEnabled: true,
    });
    expect(hrefs(on)).toContain("/my-growth");
  });

  it("appears for a default (minimal-nav) instructor only when the flag is on", () => {
    const on = resolveNavModel({
      roles: ["INSTRUCTOR"],
      primaryRole: "INSTRUCTOR",
      pathname: "/",
      instructorFullPortalExplorer: false,
      growthOsEnabled: true,
    });
    expect(hrefs(on)).toContain("/my-growth");
  });
});
