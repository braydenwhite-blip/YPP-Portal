import { describe, expect, it } from "vitest";

import { RoleTypeSchema, parseRoleType, parseRoleTypes } from "@/lib/authorization";

describe("RoleTypeSchema", () => {
  it("accepts every canonical RoleType value including HIRING_CHAIR", () => {
    const valid = [
      "ADMIN",
      "INSTRUCTOR",
      "STUDENT",
      "MENTOR",
      "CHAPTER_PRESIDENT",
      "STAFF",
      "PARENT",
      "APPLICANT",
      "HIRING_CHAIR",
    ];
    for (const role of valid) {
      expect(RoleTypeSchema.parse(role)).toBe(role);
    }
  });

  it("rejects unknown role values", () => {
    expect(() => RoleTypeSchema.parse("FOO")).toThrow();
    expect(() => RoleTypeSchema.parse("")).toThrow();
    expect(() => RoleTypeSchema.parse("hiring_chair")).toThrow();
  });

  it("parseRoleType passes HIRING_CHAIR through", () => {
    expect(parseRoleType("HIRING_CHAIR")).toBe("HIRING_CHAIR");
  });

  it("parseRoleTypes deduplicates and validates a list", () => {
    expect(parseRoleTypes(["ADMIN", "HIRING_CHAIR", "ADMIN"])).toEqual([
      "ADMIN",
      "HIRING_CHAIR",
    ]);
  });

  it("parseRoleTypes throws on any invalid entry", () => {
    expect(() => parseRoleTypes(["ADMIN", "NOT_A_ROLE"])).toThrow();
  });
});
