import { describe, expect, it } from "vitest";

import {
  filterContributions,
  groupByInstructor,
  ownershipGaps,
  type ContributionRow,
} from "@/lib/leadership/filters";

function row(overrides: Partial<ContributionRow> = {}): ContributionRow {
  return {
    id: "c1",
    instructorId: "i1",
    instructorName: "Ada Lovelace",
    category: "STUDENT_ADVISOR",
    title: "Student Advisor",
    status: "ACTIVE",
    expectedLevel: "EITHER",
    weight: 2,
    isOwnership: false,
    reviewVisible: true,
    relatedLabel: null,
    adminOwnerName: null,
    startDate: "2026-01-01T00:00:00.000Z",
    endDate: null,
    lastActivityAt: null,
    ...overrides,
  };
}

const ROWS: ContributionRow[] = [
  row(),
  row({ id: "c2", category: "INTERVIEWER", title: "Spring interviews", status: "COMPLETED" }),
  row({
    id: "c3",
    instructorId: "i2",
    instructorName: "Grace Hopper",
    category: "INSTRUCTION_COMMITTEE",
    title: "Instruction Committee",
    expectedLevel: "LEAD_INSTRUCTOR",
    isOwnership: true,
    weight: 3,
  }),
  row({
    id: "c4",
    instructorId: "i2",
    instructorName: "Grace Hopper",
    category: "PARTNER_RELATIONSHIP_LEAD",
    title: "Lincoln Center partnership",
    status: "NEEDS_ATTENTION",
    relatedLabel: "Lincoln Center",
    expectedLevel: "LEAD_INSTRUCTOR",
    isOwnership: true,
    weight: 3,
  }),
];

describe("filterContributions", () => {
  it("returns everything with empty or ALL filters", () => {
    expect(filterContributions(ROWS, {})).toHaveLength(4);
    expect(
      filterContributions(ROWS, {
        category: "ALL",
        instructorId: "ALL",
        level: "ALL",
        status: "ALL",
      }),
    ).toHaveLength(4);
  });

  it("filters by role type", () => {
    const result = filterContributions(ROWS, { category: "INTERVIEWER" });
    expect(result.map((r) => r.id)).toEqual(["c2"]);
  });

  it("filters by instructor", () => {
    const result = filterContributions(ROWS, { instructorId: "i2" });
    expect(result.map((r) => r.id)).toEqual(["c3", "c4"]);
  });

  it("filters by expected level and status together", () => {
    const result = filterContributions(ROWS, {
      level: "LEAD_INSTRUCTOR",
      status: "NEEDS_ATTENTION",
    });
    expect(result.map((r) => r.id)).toEqual(["c4"]);
  });

  it("searches across instructor, title, and related labels case-insensitively", () => {
    expect(filterContributions(ROWS, { search: "lincoln" }).map((r) => r.id)).toEqual(["c4"]);
    expect(filterContributions(ROWS, { search: "GRACE" })).toHaveLength(2);
    expect(filterContributions(ROWS, { search: "nope" })).toHaveLength(0);
  });
});

describe("groupByInstructor", () => {
  it("groups rows preserving order within each instructor", () => {
    const groups = groupByInstructor(ROWS);
    expect(groups.get("i1")?.map((r) => r.id)).toEqual(["c1", "c2"]);
    expect(groups.get("i2")?.map((r) => r.id)).toEqual(["c3", "c4"]);
  });
});

describe("ownershipGaps", () => {
  it("reports every ownership area uncovered when nothing is active", () => {
    const gaps = ownershipGaps([]);
    expect(gaps).toContain("INSTRUCTION_COMMITTEE");
    expect(gaps).toContain("CURRICULUM_LEAD");
    expect(gaps).toContain("INITIATIVE_OWNER");
    // Support roles are never ownership gaps.
    expect(gaps).not.toContain("STUDENT_ADVISOR");
  });

  it("treats ACTIVE and ASSIGNED contributions as covering an area", () => {
    const gaps = ownershipGaps([
      { category: "INSTRUCTION_COMMITTEE", status: "ACTIVE" },
      { category: "CURRICULUM_LEAD", status: "ASSIGNED" },
      { category: "RECRUITMENT_LEAD", status: "COMPLETED" },
    ]);
    expect(gaps).not.toContain("INSTRUCTION_COMMITTEE");
    expect(gaps).not.toContain("CURRICULUM_LEAD");
    // Completed work does not cover the area going forward.
    expect(gaps).toContain("RECRUITMENT_LEAD");
  });
});
