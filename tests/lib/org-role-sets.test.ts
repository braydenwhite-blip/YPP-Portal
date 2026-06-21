import { describe, expect, it } from "vitest";

import { resolvePersonAuthority, type PersonAuthority } from "@/lib/org/levels";
import {
  OFFICER_TIER_ROLES,
  LEADERSHIP_ACTION_CENTER_ROLES,
  APPLICATION_REVIEWER_ROLES,
  INSTRUCTOR_SURFACE_ROLES,
  INSTRUCTOR_TRAINING_ROLES,
  OPERATIONS_HUB_ROLES,
  rolesIncludeAny,
  isOfficerTierAuthority,
  isBoardAuthority,
  isLeadershipAuthority,
  isInstructionLeadAuthority,
  isInstructorSurface,
  isOfficerTierFromAuth,
} from "@/lib/org/role-sets";
import { hasAdminSubtype } from "@/lib/authorization";
import { hasAdminSubtype as hasAdminSubtypeCanonical } from "@/lib/admin-subtypes";

// Regression lock: the canonical constants must equal the exact literals that
// were previously scattered across the codebase. If anyone edits a set, this
// fails loudly rather than silently drifting behavior.
describe("role-set constants", () => {
  it("match the original literals exactly", () => {
    expect([...OFFICER_TIER_ROLES]).toEqual(["ADMIN", "STAFF", "CHAPTER_PRESIDENT", "HIRING_CHAIR"]);
    expect([...LEADERSHIP_ACTION_CENTER_ROLES]).toEqual(["ADMIN", "STAFF"]);
    expect([...APPLICATION_REVIEWER_ROLES]).toEqual(["ADMIN", "HIRING_CHAIR", "CHAPTER_PRESIDENT"]);
    expect([...INSTRUCTOR_SURFACE_ROLES]).toEqual(["INSTRUCTOR", "ADMIN", "CHAPTER_PRESIDENT"]);
    expect([...INSTRUCTOR_TRAINING_ROLES]).toEqual(["ADMIN", "CHAPTER_PRESIDENT", "INSTRUCTOR"]);
    expect([...OPERATIONS_HUB_ROLES]).toEqual([
      "ADMIN",
      "STAFF",
      "CHAPTER_PRESIDENT",
      "HIRING_CHAIR",
      "INSTRUCTOR",
      "MENTOR",
      "STUDENT",
    ]);
  });
});

describe("rolesIncludeAny", () => {
  it("matches primary role or any secondary role (normalized)", () => {
    expect(rolesIncludeAny(["STUDENT"], "STAFF", OFFICER_TIER_ROLES)).toBe(true);
    expect(rolesIncludeAny(["ADMIN"], "STUDENT", OFFICER_TIER_ROLES)).toBe(true);
    expect(rolesIncludeAny(["STUDENT"], "STUDENT", OFFICER_TIER_ROLES)).toBe(false);
    expect(rolesIncludeAny(null, null, OFFICER_TIER_ROLES)).toBe(false);
  });
});

describe("spine-derived tier predicates — OR bridge", () => {
  // During the backfill window a user may have no internal level yet; the legacy
  // role keeps them working. Once backfilled, the level check is authoritative.
  it("isOfficerTierAuthority passes on a legacy officer role even with no level", () => {
    expect(isOfficerTierAuthority({ roles: ["STAFF"] })).toBe(true);
    expect(isOfficerTierAuthority({ roles: ["STUDENT"] })).toBe(false);
  });

  it("isOfficerTierAuthority passes on internal level >= 5 even without a legacy role", () => {
    const officer = resolvePersonAuthority({ title: "Officer" });
    expect(isOfficerTierAuthority({ authority: officer, roles: ["STUDENT"] })).toBe(true);
    const seniorManager = resolvePersonAuthority({ title: "Senior Manager" }); // level 2
    expect(isOfficerTierAuthority({ authority: seniorManager, roles: ["STUDENT"] })).toBe(false);
  });

  it("isBoardAuthority requires level 7 or SUPER_ADMIN", () => {
    const board = resolvePersonAuthority({ title: "Board Member" });
    expect(isBoardAuthority({ authority: board })).toBe(true);
    expect(isBoardAuthority({ adminSubtypes: ["SUPER_ADMIN"] })).toBe(true);
    expect(isBoardAuthority({ adminSubtypes: ["LEADERSHIP"] })).toBe(false);
    const officer = resolvePersonAuthority({ title: "Officer" }); // level 5
    expect(isBoardAuthority({ authority: officer })).toBe(false);
  });

  it("isLeadershipAuthority requires level 5+ or a LEADERSHIP/SUPER_ADMIN subtype", () => {
    expect(isLeadershipAuthority({ adminSubtypes: ["LEADERSHIP"] })).toBe(true);
    expect(isLeadershipAuthority({ adminSubtypes: ["SUPER_ADMIN"] })).toBe(true);
    expect(isLeadershipAuthority({ adminSubtypes: [] })).toBe(false);
    const officer = resolvePersonAuthority({ title: "Officer" });
    expect(isLeadershipAuthority({ authority: officer })).toBe(true);
  });

  it("isInstructionLeadAuthority is true only on the instruction ladder at level 3+", () => {
    const leadInstructor = resolvePersonAuthority({ title: "Lead Instructor" });
    expect(isInstructionLeadAuthority({ authority: leadInstructor })).toBe(true);
    const seniorInstructor = resolvePersonAuthority({ title: "Senior Instructor" }); // level 2
    expect(isInstructionLeadAuthority({ authority: seniorInstructor })).toBe(false);
    const director = resolvePersonAuthority({ title: "Director" }); // leadership level 3
    expect(isInstructionLeadAuthority({ authority: director })).toBe(false);
  });
});

describe("isInstructorSurface", () => {
  it("matches the instructor surface roles", () => {
    expect(isInstructorSurface(["INSTRUCTOR"])).toBe(true);
    expect(isInstructorSurface(["CHAPTER_PRESIDENT"])).toBe(true);
    expect(isInstructorSurface([], "ADMIN")).toBe(true);
    expect(isInstructorSurface(["STUDENT"])).toBe(false);
  });
});

describe("isOfficerTierFromAuth (edge-safe)", () => {
  it("uppercases loose input and checks the officer set", () => {
    expect(isOfficerTierFromAuth(["staff"])).toBe(true);
    expect(isOfficerTierFromAuth([], "admin")).toBe(true);
    expect(isOfficerTierFromAuth(["student"], "student")).toBe(false);
    expect(isOfficerTierFromAuth(undefined, undefined)).toBe(false);
  });
});

describe("de-duplication shim", () => {
  it("hasAdminSubtype re-exported from authorization is the canonical one", () => {
    expect(hasAdminSubtype).toBe(hasAdminSubtypeCanonical);
    expect(hasAdminSubtype(["SUPER_ADMIN"], "SUPER_ADMIN")).toBe(true);
  });
});

// Type-level sanity: a PersonAuthority is accepted by the predicates.
const _typecheck: PersonAuthority = resolvePersonAuthority({ title: "Officer" });
void _typecheck;
