import { describe, expect, it } from "vitest";

import { formatRoleLabel, getUserTitle } from "@/lib/user-title";

describe("formatRoleLabel", () => {
  it("title-cases an enum-style role", () => {
    expect(formatRoleLabel("CHAPTER_PRESIDENT")).toBe("Chapter President");
    expect(formatRoleLabel("instructor")).toBe("Instructor");
  });

  it("falls back for empty input", () => {
    expect(formatRoleLabel(null)).toBe("Portal member");
    expect(formatRoleLabel("")).toBe("Portal member");
  });
});

describe("getUserTitle", () => {
  it("prefers the stored title above everything", () => {
    expect(
      getUserTitle({
        title: "VP of People",
        primaryRole: "ADMIN",
        adminSubtypes: ["CPO"],
      })
    ).toBe("VP of People");
  });

  it("trims and ignores a blank stored title", () => {
    expect(
      getUserTitle({ title: "   ", primaryRole: "CHAPTER_PRESIDENT" })
    ).toBe("Chapter President");
  });

  it("uses the admin-subtype label when no stored title (CPO → Leadership)", () => {
    expect(
      getUserTitle({ title: null, primaryRole: "ADMIN", adminSubtypes: ["CPO"] })
    ).toBe("Leadership");
  });

  it("prefers the most senior subtype label", () => {
    expect(
      getUserTitle({
        primaryRole: "ADMIN",
        adminSubtypes: ["HIRING_ADMIN", "SUPER_ADMIN"],
      })
    ).toBe("Super Admin");
  });

  it("falls back to a formatted primaryRole when there is no subtype", () => {
    expect(getUserTitle({ primaryRole: "INSTRUCTOR" })).toBe("Instructor");
  });

  it("never returns empty for a null user", () => {
    expect(getUserTitle(null)).toBe("Portal member");
  });
});
