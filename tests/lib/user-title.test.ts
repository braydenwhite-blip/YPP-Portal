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
        adminSubtypes: ["LEADERSHIP"],
      })
    ).toBe("VP of People");
  });

  it("trims and ignores a blank stored title", () => {
    expect(
      getUserTitle({ title: "   ", primaryRole: "CHAPTER_PRESIDENT" })
    ).toBe("Chapter President");
  });

  it("derives the canonical ladder title from a subtype (LEADERSHIP → Senior Officer)", () => {
    expect(
      getUserTitle({ title: null, primaryRole: "ADMIN", adminSubtypes: ["LEADERSHIP"] })
    ).toBe("Senior Officer");
  });

  it("prefers the most senior subtype (SUPER_ADMIN → Board Member)", () => {
    expect(
      getUserTitle({
        primaryRole: "ADMIN",
        adminSubtypes: ["HIRING_ADMIN", "SUPER_ADMIN"],
      })
    ).toBe("Board Member");
  });

  it("prefers a persisted canonical ladder title over derived/role labels", () => {
    expect(
      getUserTitle({
        primaryRole: "INSTRUCTOR",
        internalLevel: 2,
        ladder: "INSTRUCTION",
        canonicalTitle: "Senior Instructor",
      })
    ).toBe("Senior Instructor");
  });

  it("falls back to a formatted primaryRole when there is no subtype", () => {
    expect(getUserTitle({ primaryRole: "INSTRUCTOR" })).toBe("Instructor");
  });

  it("never returns empty for a null user", () => {
    expect(getUserTitle(null)).toBe("Portal member");
  });
});
