import { describe, expect, it } from "vitest";
import {
  LEADERSHIP_GOALS,
  LEADERSHIP_STAGES,
  LEADERSHIP_STAGE_ORDER,
  MENTORSHIP_PATTERN,
  expectationsForStage,
  getNextStage,
  inferLeadershipStage,
  toMenteeRoleTypeFromStage,
} from "@/lib/leadership-pathway";

describe("leadership-pathway: stage catalog", () => {
  it("includes the five canonical stages in order", () => {
    expect(LEADERSHIP_STAGE_ORDER).toEqual([
      "WORKSHOP_INSTRUCTOR",
      "INSTRUCTOR",
      "SENIOR_INSTRUCTOR",
      "LEAD_INSTRUCTOR",
      "ORGANIZATIONAL_LEADERSHIP",
    ]);
  });

  it("registers a stage record for every id with required copy", () => {
    for (const id of LEADERSHIP_STAGE_ORDER) {
      const stage = LEADERSHIP_STAGES[id];
      expect(stage.label, `label for ${id}`).toBeTruthy();
      expect(stage.tagline, `tagline for ${id}`).toBeTruthy();
      expect(stage.mission, `mission for ${id}`).toBeTruthy();
      expect(stage.focusAreas.length, `focus areas for ${id}`).toBeGreaterThan(0);
      expect(stage.mentoredBy, `mentoredBy for ${id}`).toBeTruthy();
      expect(stage.color.bg).toMatch(/^#/);
    }
  });

  it("registers a mentorship pattern for every stage", () => {
    for (const id of LEADERSHIP_STAGE_ORDER) {
      expect(MENTORSHIP_PATTERN[id], `mentorship pattern for ${id}`).toBeTruthy();
    }
  });
});

describe("leadership-pathway: goal rubric", () => {
  it("exposes five numbered goals with per-stage expectations", () => {
    expect(LEADERSHIP_GOALS).toHaveLength(5);
    const numbers = LEADERSHIP_GOALS.map((g) => g.number).sort();
    expect(numbers).toEqual([1, 2, 3, 4, 5]);
    for (const goal of LEADERSHIP_GOALS) {
      expect(goal.title, `title for ${goal.id}`).toBeTruthy();
      expect(goal.oneLiner, `oneLiner for ${goal.id}`).toBeTruthy();
      expect(goal.expectations.INSTRUCTOR.length).toBeGreaterThan(0);
      expect(goal.expectations.SENIOR_INSTRUCTOR.length).toBeGreaterThan(0);
      expect(goal.expectations.LEAD_INSTRUCTOR.length).toBeGreaterThan(0);
    }
  });

  it("expectationsForStage falls back to Instructor rubric for workshop & ORG_LEADERSHIP folds into Lead", () => {
    const workshop = expectationsForStage("WORKSHOP_INSTRUCTOR");
    const instructor = expectationsForStage("INSTRUCTOR");
    expect(workshop.map((e) => e.expectations)).toEqual(
      instructor.map((e) => e.expectations)
    );

    const lead = expectationsForStage("LEAD_INSTRUCTOR");
    const org = expectationsForStage("ORGANIZATIONAL_LEADERSHIP");
    expect(org.map((e) => e.expectations)).toEqual(
      lead.map((e) => e.expectations)
    );
  });
});

describe("inferLeadershipStage", () => {
  it("returns null for non-instructor roles", () => {
    expect(
      inferLeadershipStage({ primaryRole: "STUDENT" })
    ).toBeNull();
    expect(
      inferLeadershipStage({ primaryRole: "PARENT" })
    ).toBeNull();
  });

  it("treats summer workshop instructors as WORKSHOP_INSTRUCTOR", () => {
    expect(
      inferLeadershipStage({
        primaryRole: "INSTRUCTOR",
        instructorSubtype: "SUMMER_WORKSHOP",
      })
    ).toBe("WORKSHOP_INSTRUCTOR");
  });

  it("standard instructors with no mentor/chair signals are INSTRUCTOR", () => {
    expect(
      inferLeadershipStage({
        primaryRole: "INSTRUCTOR",
        instructorSubtype: "STANDARD",
      })
    ).toBe("INSTRUCTOR");
  });

  it("instructors who mentor someone are SENIOR_INSTRUCTOR", () => {
    expect(
      inferLeadershipStage({
        primaryRole: "INSTRUCTOR",
        instructorSubtype: "STANDARD",
        isMentor: true,
      })
    ).toBe("SENIOR_INSTRUCTOR");
  });

  it("committee chairs are LEAD_INSTRUCTOR", () => {
    expect(
      inferLeadershipStage({
        primaryRole: "INSTRUCTOR",
        instructorSubtype: "STANDARD",
        isMentor: true,
        isCommitteeChair: true,
      })
    ).toBe("LEAD_INSTRUCTOR");
  });

  it("chapter presidents map to LEAD_INSTRUCTOR", () => {
    expect(
      inferLeadershipStage({
        primaryRole: "CHAPTER_PRESIDENT",
      })
    ).toBe("LEAD_INSTRUCTOR");
  });

  it("admins and staff map to ORGANIZATIONAL_LEADERSHIP", () => {
    expect(inferLeadershipStage({ primaryRole: "ADMIN" })).toBe(
      "ORGANIZATIONAL_LEADERSHIP"
    );
    expect(inferLeadershipStage({ primaryRole: "STAFF" })).toBe(
      "ORGANIZATIONAL_LEADERSHIP"
    );
  });

  it("the isOrgLeader override beats everything else", () => {
    expect(
      inferLeadershipStage({
        primaryRole: "INSTRUCTOR",
        isOrgLeader: true,
      })
    ).toBe("ORGANIZATIONAL_LEADERSHIP");
  });
});

describe("getNextStage", () => {
  it("returns the next stage in the canonical order", () => {
    expect(getNextStage("WORKSHOP_INSTRUCTOR")?.id).toBe("INSTRUCTOR");
    expect(getNextStage("INSTRUCTOR")?.id).toBe("SENIOR_INSTRUCTOR");
    expect(getNextStage("SENIOR_INSTRUCTOR")?.id).toBe("LEAD_INSTRUCTOR");
    expect(getNextStage("LEAD_INSTRUCTOR")?.id).toBe("ORGANIZATIONAL_LEADERSHIP");
  });

  it("returns null when there's no stage above the current one", () => {
    expect(getNextStage("ORGANIZATIONAL_LEADERSHIP")).toBeNull();
    expect(getNextStage(null)).toBeNull();
  });
});

describe("toMenteeRoleTypeFromStage", () => {
  it("maps stages back to the existing G&R MenteeRoleType enum", () => {
    expect(toMenteeRoleTypeFromStage("WORKSHOP_INSTRUCTOR")).toBe("INSTRUCTOR");
    expect(toMenteeRoleTypeFromStage("INSTRUCTOR")).toBe("INSTRUCTOR");
    expect(toMenteeRoleTypeFromStage("SENIOR_INSTRUCTOR")).toBe("INSTRUCTOR");
    expect(toMenteeRoleTypeFromStage("LEAD_INSTRUCTOR")).toBe("INSTRUCTOR");
    expect(toMenteeRoleTypeFromStage("ORGANIZATIONAL_LEADERSHIP")).toBe(
      "GLOBAL_LEADERSHIP"
    );
  });

  it("returns null for null input", () => {
    expect(toMenteeRoleTypeFromStage(null)).toBeNull();
  });
});
