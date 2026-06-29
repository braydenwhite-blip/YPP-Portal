import { describe, expect, it } from "vitest";

import {
  deriveSpineFromAccess,
  roleForTitle,
  subtypesForTitle,
  resolvePersonAuthority,
  TITLE_AUTHORITY,
  type CanonicalTitle,
} from "@/lib/org/levels";
import { ladderCapabilities } from "@/lib/org/capabilities";

/** Build a PersonAuthority straight from a canonical title (for capability tests). */
function authorityFor(title: CanonicalTitle) {
  const meta = TITLE_AUTHORITY[title];
  return {
    title,
    ladder: meta.ladder,
    ladderLevel: meta.ladderLevel,
    internalLevel: meta.internalLevel,
    source: "PERSISTED" as const,
  };
}

describe("deriveSpineFromAccess", () => {
  it("lets an explicit canonical title win over subtype and role", () => {
    const spine = deriveSpineFromAccess({
      primaryRole: "INSTRUCTOR",
      adminSubtypes: ["SUPER_ADMIN"],
      roles: ["ADMIN"],
      explicitCanonicalTitle: "Lead Instructor",
    });
    expect(spine).toEqual({
      internalLevel: 3,
      ladder: "INSTRUCTION",
      canonicalTitle: "Lead Instructor",
    });
  });

  it("derives Board Member from a SUPER_ADMIN subtype on an ADMIN row", () => {
    const spine = deriveSpineFromAccess({
      primaryRole: "STAFF",
      roles: ["STAFF", "ADMIN"],
      adminSubtypes: ["SUPER_ADMIN"],
    });
    expect(spine).toEqual({
      internalLevel: 7,
      ladder: "LEADERSHIP",
      canonicalTitle: "Board Member",
    });
  });

  it("ignores an already-persisted level so re-saving refreshes the spine", () => {
    // resolvePersonAuthority would honor a persisted level; the derive helper must not.
    const persisted = resolvePersonAuthority({ internalLevel: 1, primaryRole: "STAFF" });
    expect(persisted.internalLevel).toBe(1);
    const spine = deriveSpineFromAccess({
      primaryRole: "STAFF",
      adminSubtypes: ["SUPER_ADMIN"],
      roles: ["ADMIN"],
    });
    expect(spine.internalLevel).toBe(7);
  });

  it("never persists a privileged level for a non-ADMIN (trust guard)", () => {
    const spine = deriveSpineFromAccess({
      primaryRole: "INSTRUCTOR", // not ADMIN, no ADMIN in roles
      roles: ["INSTRUCTOR"],
      adminSubtypes: ["SUPER_ADMIN"], // a stray subtype must not escalate
    });
    expect(spine).toEqual({ internalLevel: null, ladder: null, canonicalTitle: null });
  });

  it("falls back to the primary role when nothing else resolves", () => {
    expect(deriveSpineFromAccess({ primaryRole: "INSTRUCTOR" })).toEqual({
      internalLevel: 1,
      ladder: "INSTRUCTION",
      canonicalTitle: "Instructor",
    });
    expect(deriveSpineFromAccess({ primaryRole: "STUDENT" })).toEqual({
      internalLevel: null,
      ladder: null,
      canonicalTitle: null,
    });
  });
});

describe("roleForTitle / subtypesForTitle", () => {
  it("maps officer-and-above titles to the ADMIN role", () => {
    expect(roleForTitle("Officer")).toBe("ADMIN");
    expect(roleForTitle("Senior Officer")).toBe("ADMIN");
    expect(roleForTitle("Board Member")).toBe("ADMIN");
    expect(roleForTitle("Chapter President")).toBeNull();
    expect(roleForTitle("Manager")).toBeNull();
    expect(roleForTitle(null)).toBeNull();
  });

  it("maps the top two leadership titles to subtypes", () => {
    expect(subtypesForTitle("Board Member")).toEqual(["SUPER_ADMIN"]);
    expect(subtypesForTitle("Senior Officer")).toEqual(["LEADERSHIP"]);
    expect(subtypesForTitle("Officer")).toEqual([]);
    expect(subtypesForTitle("Instructor")).toEqual([]);
  });
});

describe("ladderCapabilities", () => {
  it("Instructor (L1): own class only, no lead, gets nothing broader", () => {
    const caps = ladderCapabilities(authorityFor("Instructor"));
    expect(caps.canLeadActions).toBe(false);
    expect(caps.canMentorInstructors).toBe(false);
    expect(caps.canAccessGlobalActionTracker).toBe(false);
    expect(caps.canAccessOutreachDatabases).toBe(false);
  });

  it("Senior Instructor (L2): mentor + outreach, still cannot lead", () => {
    const caps = ladderCapabilities(authorityFor("Senior Instructor"));
    expect(caps.canMentorInstructors).toBe(true);
    expect(caps.canAccessOutreachDatabases).toBe(true);
    expect(caps.canLeadActions).toBe(false);
    expect(caps.canAccessInstructionCommittee).toBe(false);
  });

  it("Lead Instructor (L3): committee + lead, not the global tracker", () => {
    const caps = ladderCapabilities(authorityFor("Lead Instructor"));
    expect(caps.canAccessInstructionCommittee).toBe(true);
    expect(caps.canFinalApproveCurriculum).toBe(true);
    expect(caps.canLeadActions).toBe(true);
    expect(caps.canAccessGlobalActionTracker).toBe(false);
  });

  it("Chapter President (L4): chapter tracker, not the global tracker", () => {
    const caps = ladderCapabilities(authorityFor("Chapter President"));
    expect(caps.canAccessChapterActionTracker).toBe(true);
    expect(caps.canAccessGlobalActionTracker).toBe(false);
  });

  it("Manager (leadership L1): global tracker, inherits CP instruction access, no perf stats", () => {
    const caps = ladderCapabilities(authorityFor("Manager"));
    expect(caps.canAccessGlobalActionTracker).toBe(true);
    expect(caps.canAccessChapterActionTracker).toBe(true); // inherits Chapter President
    expect(caps.canSeeLeadershipPerformanceStats).toBe(false);
    expect(caps.hasUniversalAccess).toBe(false);
  });

  it("Officer (L5): universal access, can manage org, but not officer reviews", () => {
    const caps = ladderCapabilities(authorityFor("Officer"));
    expect(caps.hasUniversalAccess).toBe(true);
    expect(caps.canManageOrg).toBe(true);
    expect(caps.canSeeLeadershipPerformanceStats).toBe(true);
    expect(caps.canSeeOfficerReviews).toBe(false);
  });

  it("Board Member (L7): everything, including officer reviews", () => {
    const caps = ladderCapabilities(authorityFor("Board Member"));
    expect(caps.hasUniversalAccess).toBe(true);
    expect(caps.canSeeOfficerReviews).toBe(true);
  });

  it("no authority → no capabilities", () => {
    const caps = ladderCapabilities(null);
    expect(caps.canLeadActions).toBe(false);
    expect(caps.hasUniversalAccess).toBe(false);
    expect(caps.canAccessGlobalActionTracker).toBe(false);
  });
});
