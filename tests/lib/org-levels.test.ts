import { describe, expect, it } from "vitest";

import {
  TITLE_AUTHORITY,
  canLeadAction,
  normalizeTitle,
  resolvePersonAuthority,
  type PersonAuthority,
} from "@/lib/org/levels";

describe("normalizeTitle", () => {
  it("matches canonical titles case-insensitively", () => {
    expect(normalizeTitle("Lead Instructor")).toBe("Lead Instructor");
    expect(normalizeTitle("  senior officer ")).toBe("Senior Officer");
    expect(normalizeTitle("BOARD MEMBER")).toBe("Board Member");
  });

  it("resolves known aliases", () => {
    expect(normalizeTitle("Board")).toBe("Board Member");
    expect(normalizeTitle("President")).toBe("Chapter President");
  });

  it("returns null for unknown / empty input", () => {
    expect(normalizeTitle("Grand Wizard")).toBeNull();
    expect(normalizeTitle("")).toBeNull();
    expect(normalizeTitle(null)).toBeNull();
  });
});

describe("TITLE_AUTHORITY", () => {
  it("pins the proposal's leadership levels", () => {
    expect(TITLE_AUTHORITY.Officer.internalLevel).toBe(5);
    expect(TITLE_AUTHORITY["Senior Officer"].internalLevel).toBe(6);
    expect(TITLE_AUTHORITY["Board Member"].internalLevel).toBe(7);
  });

  it("keeps each title on the expected ladder", () => {
    expect(TITLE_AUTHORITY["Chapter President"].ladder).toBe("INSTRUCTION");
    expect(TITLE_AUTHORITY.Director.ladder).toBe("LEADERSHIP");
  });
});

describe("resolvePersonAuthority", () => {
  it("prefers an explicit canonical title over role/subtype", () => {
    const a = resolvePersonAuthority({
      title: "Lead Instructor",
      primaryRole: "INSTRUCTOR",
      adminSubtypes: ["SUPER_ADMIN"],
    });
    expect(a.title).toBe("Lead Instructor");
    expect(a.internalLevel).toBe(3);
    expect(a.source).toBe("TITLE");
  });

  it("derives Board Member from SUPER_ADMIN and Senior Officer from LEADERSHIP", () => {
    expect(resolvePersonAuthority({ adminSubtypes: ["SUPER_ADMIN"] }).title).toBe("Board Member");
    expect(resolvePersonAuthority({ adminSubtypes: ["LEADERSHIP"] }).title).toBe("Senior Officer");
  });

  it("derives titles from primaryRole when no title/subtype", () => {
    expect(resolvePersonAuthority({ primaryRole: "CHAPTER_PRESIDENT" }).title).toBe("Chapter President");
    expect(resolvePersonAuthority({ primaryRole: "INSTRUCTOR" }).internalLevel).toBe(1);
    expect(resolvePersonAuthority({ primaryRole: "STAFF" }).title).toBe("Manager");
    expect(resolvePersonAuthority({ primaryRole: "ADMIN" }).title).toBe("Officer");
  });

  it("returns UNKNOWN when nothing resolves", () => {
    const a = resolvePersonAuthority({ primaryRole: "STUDENT" });
    expect(a.internalLevel).toBeNull();
    expect(a.source).toBe("UNKNOWN");
    expect(resolvePersonAuthority(null).source).toBe("UNKNOWN");
  });
});

function authority(internalLevel: number | null, partial: Partial<PersonAuthority> = {}): PersonAuthority {
  return {
    title: null,
    ladder: null,
    ladderLevel: null,
    internalLevel,
    source: "TITLE",
    ...partial,
  };
}

describe("canLeadAction", () => {
  it("allows internal level >= 3 on either ladder", () => {
    expect(canLeadAction(authority(3)).eligible).toBe(true);
    expect(canLeadAction(authority(7)).eligible).toBe(true);
  });

  it("blocks levels 1-2 by default", () => {
    expect(canLeadAction(authority(1)).eligible).toBe(false);
    expect(canLeadAction(authority(2)).eligible).toBe(false);
  });

  it("lets a Manager/Senior Manager lead when authorized by an Officer", () => {
    const manager = authority(1, { ladder: "LEADERSHIP", ladderLevel: 1 });
    expect(canLeadAction(manager).eligible).toBe(false);
    expect(canLeadAction(manager, { authorizedByOfficer: true }).eligible).toBe(true);
  });

  it("does not extend the carve-out to instruction levels 1-2", () => {
    const seniorInstructor = authority(2, { ladder: "INSTRUCTION", ladderLevel: 2 });
    expect(canLeadAction(seniorInstructor, { authorizedByOfficer: true }).eligible).toBe(false);
  });

  it("blocks when the level is unknown", () => {
    expect(canLeadAction(authority(null)).eligible).toBe(false);
  });
});
