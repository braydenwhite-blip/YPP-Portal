import { describe, it, expect } from "vitest";
import {
  CHAPTER_EXPECTATIONS,
  buildExpectationsProgress,
  summarizeChapterExpectations,
  expectationTargetLabel,
} from "@/lib/chapters/expectations";

const FULL_STRENGTH = {
  confirmedPartners: 9,
  instructorApplicants: 34,
  instructorsHired: 16,
  studentsEnrolled: 85,
  classesRunning: 3,
};

describe("buildExpectationsProgress", () => {
  it("returns one row per baseline expectation in canonical order", () => {
    const rows = buildExpectationsProgress({});
    expect(rows.map((r) => r.key)).toEqual(CHAPTER_EXPECTATIONS.map((e) => e.key));
  });

  it("missing counts default to 0 and read as building", () => {
    const rows = buildExpectationsProgress({});
    for (const r of rows) {
      expect(r.current).toBe(0);
      expect(r.percent).toBe(0);
      expect(r.status).toBe("building");
    }
  });

  it("meeting the baseline marks the expectation met and caps percent at 100", () => {
    const rows = buildExpectationsProgress({ confirmedPartners: 12 });
    const partners = rows.find((r) => r.key === "confirmedPartners")!;
    expect(partners.status).toBe("met");
    expect(partners.percent).toBe(100);
  });

  it("60%+ of the baseline reads as close", () => {
    // 5 of 8 partners = 63%
    const rows = buildExpectationsProgress({ confirmedPartners: 5 });
    const partners = rows.find((r) => r.key === "confirmedPartners")!;
    expect(partners.status).toBe("close");
    expect(partners.percent).toBe(63);
  });

  it("negative inputs are clamped to zero", () => {
    const rows = buildExpectationsProgress({ studentsEnrolled: -5 });
    const students = rows.find((r) => r.key === "studentsEnrolled")!;
    expect(students.current).toBe(0);
  });

  it("summaries use range language for ranged targets and N+ otherwise", () => {
    const partners = CHAPTER_EXPECTATIONS.find((e) => e.key === "confirmedPartners")!;
    const applicants = CHAPTER_EXPECTATIONS.find((e) => e.key === "instructorApplicants")!;
    expect(expectationTargetLabel(partners)).toBe("8–10");
    expect(expectationTargetLabel(applicants)).toBe("30+");
  });
});

describe("summarizeChapterExpectations", () => {
  it("a full-strength chapter is ready to scale", () => {
    const s = summarizeChapterExpectations(FULL_STRENGTH);
    expect(s.metCount).toBe(s.total);
    expect(s.readyToScale).toBe(true);
    expect(s.headline).toMatch(/ready to scale/i);
  });

  it("a partial chapter reports honest progress and is not ready to scale", () => {
    const s = summarizeChapterExpectations({ ...FULL_STRENGTH, studentsEnrolled: 20 });
    expect(s.readyToScale).toBe(false);
    expect(s.metCount).toBe(s.total - 1);
    expect(s.headline).toBe(`${s.total - 1} of ${s.total} chapter expectations met`);
  });

  it("an empty chapter meets nothing", () => {
    const s = summarizeChapterExpectations({});
    expect(s.metCount).toBe(0);
    expect(s.readyToScale).toBe(false);
  });
});
