/**
 * Behavior tests for lib/instructor-completeness.ts.
 *
 * Contract:
 *   - A fully populated instructor scores 100 with no missing fields.
 *   - A sparse record loses points and lists the absent fields.
 *   - Instructor-only checks (mentor, training) do not apply to applicants.
 *   - Tone buckets map to score ranges.
 */
import { describe, it, expect } from "vitest";
import {
  computeInstructorCompleteness,
  completenessTone,
  type CompletenessInput,
} from "@/lib/instructor-completeness";

const FULL: CompletenessInput = {
  isInstructor: true,
  phone: "555-1234",
  city: "Scarsdale",
  stateProvince: "NY",
  school: "Scarsdale High",
  bio: "Loves teaching.",
  avatarUrl: "https://example.com/a.png",
  availabilityTags: ["Weekends"],
  availabilityText: "Weekends",
  subjectTags: ["Psychology"],
  hasActiveMentor: true,
  trainingComplete: true,
  profileHref: "/admin/instructors/u1",
};

describe("computeInstructorCompleteness", () => {
  it("scores a fully populated instructor at 100 with nothing missing", () => {
    const result = computeInstructorCompleteness(FULL);
    expect(result.score).toBe(100);
    expect(result.missing).toHaveLength(0);
    expect(result.completeChecks).toBe(result.totalChecks);
  });

  it("flags absent fields and lowers the score", () => {
    const result = computeInstructorCompleteness({
      ...FULL,
      phone: null,
      school: "",
      hasActiveMentor: false,
    });
    expect(result.score).toBeLessThan(100);
    const codes = result.missing.map((m) => m.code);
    expect(codes).toContain("phone");
    expect(codes).toContain("school");
    expect(codes).toContain("mentor");
    // Missing fields carry the profile href as the "fix it" affordance.
    expect(result.missing.every((m) => m.href === FULL.profileHref)).toBe(true);
  });

  it("does not apply instructor-only checks to applicants", () => {
    const applicant = computeInstructorCompleteness({
      ...FULL,
      isInstructor: false,
      hasActiveMentor: false,
      trainingComplete: false,
    });
    const codes = applicant.missing.map((m) => m.code);
    expect(codes).not.toContain("mentor");
    expect(codes).not.toContain("training");
    // With every applicable field present, an applicant still scores 100.
    expect(applicant.score).toBe(100);
  });

  it("treats availability text as a fallback for availability tags", () => {
    const result = computeInstructorCompleteness({
      ...FULL,
      availabilityTags: [],
      availabilityText: "Weekday evenings",
    });
    expect(result.missing.map((m) => m.code)).not.toContain("availability");
  });

  it("maps scores to tone buckets", () => {
    expect(completenessTone(95)).toBe("success");
    expect(completenessTone(80)).toBe("success");
    expect(completenessTone(60)).toBe("warning");
    expect(completenessTone(40)).toBe("danger");
  });
});
