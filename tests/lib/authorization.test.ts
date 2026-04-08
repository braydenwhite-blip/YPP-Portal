import { describe, expect, it } from "vitest";

import { hasAnyRole, normalizeRoleList, normalizeRoleSet } from "@/lib/authorization";

describe("authorization role helpers", () => {
  it("builds a unified role set from the primary role and role entries", () => {
    expect(
      Array.from(
        normalizeRoleSet(
          ["INSTRUCTOR", { role: "ADMIN" }, "INSTRUCTOR"],
          "MENTOR"
        )
      )
    ).toEqual(["MENTOR", "INSTRUCTOR", "ADMIN"]);
  });

  it("treats the primary role as a valid role when checking access", () => {
    expect(hasAnyRole([], ["ADMIN"], "ADMIN")).toBe(true);
    expect(hasAnyRole([{ role: "MENTOR" }], ["ADMIN", "MENTOR"])).toBe(true);
    expect(hasAnyRole([], ["ADMIN"], "STUDENT")).toBe(false);
  });

  it("returns a normalized role list that includes the primary role", () => {
    expect(
      normalizeRoleList([{ role: "INSTRUCTOR" }], "CHAPTER_PRESIDENT")
    ).toEqual(["CHAPTER_PRESIDENT", "INSTRUCTOR"]);
  });
});
