import { describe, expect, it } from "vitest";

import { parseSubjectsOfInterest } from "@/lib/instructor-applicants/parse-subjects";

describe("parseSubjectsOfInterest", () => {
  it("splits on comma and semicolon only", () => {
    expect(parseSubjectsOfInterest("Computer Science, Programming")).toEqual([
      "Computer Science",
      "Programming",
    ]);
    expect(parseSubjectsOfInterest("Math; Physics")).toEqual(["Math", "Physics"]);
  });

  it("does not split on whitespace inside a subject", () => {
    expect(parseSubjectsOfInterest("Computer Science")).toEqual(["Computer Science"]);
  });

  it("returns empty for blank input", () => {
    expect(parseSubjectsOfInterest(null)).toEqual([]);
    expect(parseSubjectsOfInterest("   ")).toEqual([]);
  });
});
