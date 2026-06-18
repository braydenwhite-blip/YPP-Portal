import { describe, expect, it } from "vitest";

import {
  chapterAssignmentLabel,
  classifyChapterAssignment,
  formatMissingChapterAge,
  missingChapterAgeDays,
} from "@/lib/org/missing-chapter-utils";

describe("classifyChapterAssignment", () => {
  it("is ASSIGNED when a chapter is set", () => {
    expect(classifyChapterAssignment({ chapterId: "c1" })).toBe("ASSIGNED");
  });

  it("is MISSING when there is an unresolved flag", () => {
    expect(classifyChapterAssignment({ chapterId: null, hasUnresolvedMissingFlag: true })).toBe("MISSING");
  });

  it("is GLOBAL when explicitly global and not flagged", () => {
    expect(classifyChapterAssignment({ chapterId: null, isGlobal: true })).toBe("GLOBAL");
  });

  it("defaults to MISSING when nothing classifies it", () => {
    expect(classifyChapterAssignment({})).toBe("MISSING");
  });

  it("has readable labels", () => {
    expect(chapterAssignmentLabel("MISSING")).toBe("Missing Chapter");
    expect(chapterAssignmentLabel("GLOBAL")).toBe("Global");
  });
});

describe("missing chapter age", () => {
  const now = new Date("2026-06-18T12:00:00Z");

  it("counts whole days, never negative", () => {
    expect(missingChapterAgeDays(new Date("2026-06-18T00:00:00Z"), now)).toBe(0);
    expect(missingChapterAgeDays(new Date("2026-06-15T12:00:00Z"), now)).toBe(3);
    expect(missingChapterAgeDays(new Date("2026-06-20T12:00:00Z"), now)).toBe(0);
  });

  it("formats the age label", () => {
    expect(formatMissingChapterAge(new Date("2026-06-18T01:00:00Z"), now)).toBe("today");
    expect(formatMissingChapterAge(new Date("2026-06-17T11:00:00Z"), now)).toBe("1 day");
    expect(formatMissingChapterAge(new Date("2026-06-10T12:00:00Z"), now)).toBe("8 days");
  });
});
