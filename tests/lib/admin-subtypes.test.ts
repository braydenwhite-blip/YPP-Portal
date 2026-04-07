import { describe, expect, it } from "vitest";
import {
  canAccessContentAdmin,
  hasAnyAdminSubtype,
  isSuperAdmin,
  normalizeAdminSubtypes,
} from "@/lib/admin-subtypes";

describe("admin subtype helpers", () => {
  it("normalizes, deduplicates, and filters invalid subtype values", () => {
    expect(
      normalizeAdminSubtypes([
        "content_admin",
        "SUPER_ADMIN",
        "super_admin",
        "not-real",
      ])
    ).toEqual(["CONTENT_ADMIN", "SUPER_ADMIN"]);
  });

  it("detects super admins and content access correctly", () => {
    expect(isSuperAdmin(["SUPER_ADMIN"])).toBe(true);
    expect(canAccessContentAdmin(["CONTENT_ADMIN"])).toBe(true);
    expect(canAccessContentAdmin(["HIRING_ADMIN"])).toBe(false);
  });

  it("checks whether any subtype in a list matches", () => {
    expect(
      hasAnyAdminSubtype(["HIRING_ADMIN", "MENTORSHIP_ADMIN"], [
        "CONTENT_ADMIN",
        "MENTORSHIP_ADMIN",
      ])
    ).toBe(true);
  });
});
