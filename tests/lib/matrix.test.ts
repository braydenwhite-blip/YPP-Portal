import { describe, expect, it } from "vitest";
import type { GoalRatingColor } from "@prisma/client";

import { getMatrixLabel, isSuccessionCandidate } from "@/lib/matrix";

const ALL_RATINGS: GoalRatingColor[] = [
  "BEHIND_SCHEDULE", // At Risk
  "GETTING_STARTED", // Needs Attention
  "ACHIEVED", // On Track
  "ABOVE_AND_BEYOND", // Above & Beyond
];

describe("getMatrixLabel", () => {
  it("returns Clear Successor for Above & Beyond x Above & Beyond", () => {
    expect(getMatrixLabel("ABOVE_AND_BEYOND", "ABOVE_AND_BEYOND")).toBe(
      "Clear Successor"
    );
  });

  it("returns Critical Risk for At Risk x At Risk", () => {
    expect(getMatrixLabel("BEHIND_SCHEDULE", "BEHIND_SCHEDULE")).toBe(
      "Critical Risk"
    );
  });

  it("maps every Above & Beyond performance cell", () => {
    expect(getMatrixLabel("ABOVE_AND_BEYOND", "BEHIND_SCHEDULE")).toBe(
      "Peaked Performer"
    );
    expect(getMatrixLabel("ABOVE_AND_BEYOND", "GETTING_STARTED")).toBe(
      "Strong Contributor"
    );
    expect(getMatrixLabel("ABOVE_AND_BEYOND", "ACHIEVED")).toBe("Accelerate");
  });

  it("maps every On Track performance cell", () => {
    expect(getMatrixLabel("ACHIEVED", "BEHIND_SCHEDULE")).toBe(
      "Steady Performer"
    );
    expect(getMatrixLabel("ACHIEVED", "GETTING_STARTED")).toBe(
      "Solid Contributor"
    );
    expect(getMatrixLabel("ACHIEVED", "ACHIEVED")).toBe("Strong Candidate");
    expect(getMatrixLabel("ACHIEVED", "ABOVE_AND_BEYOND")).toBe(
      "Rising Talent"
    );
  });

  it("maps every Needs Attention performance cell", () => {
    expect(getMatrixLabel("GETTING_STARTED", "BEHIND_SCHEDULE")).toBe(
      "Blocked Performer"
    );
    expect(getMatrixLabel("GETTING_STARTED", "GETTING_STARTED")).toBe(
      "Inconsistent Performer"
    );
    expect(getMatrixLabel("GETTING_STARTED", "ACHIEVED")).toBe(
      "Developing Performer"
    );
    expect(getMatrixLabel("GETTING_STARTED", "ABOVE_AND_BEYOND")).toBe(
      "Untapped Talent"
    );
  });

  it("maps every At Risk performance cell", () => {
    expect(getMatrixLabel("BEHIND_SCHEDULE", "GETTING_STARTED")).toBe(
      "Disengaged Performer"
    );
    expect(getMatrixLabel("BEHIND_SCHEDULE", "ACHIEVED")).toBe(
      "Struggling Performer"
    );
    expect(getMatrixLabel("BEHIND_SCHEDULE", "ABOVE_AND_BEYOND")).toBe(
      "Misaligned Talent"
    );
  });

  it("is exhaustive and unique across all 16 cells", () => {
    const labels = new Set<string>();
    for (const performance of ALL_RATINGS) {
      for (const potential of ALL_RATINGS) {
        const label = getMatrixLabel(performance, potential);
        expect(label).toBeTruthy();
        labels.add(label);
      }
    }
    expect(labels.size).toBe(16);
  });

  it("is deterministic", () => {
    expect(getMatrixLabel("ACHIEVED", "GETTING_STARTED")).toBe(
      getMatrixLabel("ACHIEVED", "GETTING_STARTED")
    );
  });
});

describe("isSuccessionCandidate", () => {
  it("is true for Above & Beyond x Above & Beyond", () => {
    expect(isSuccessionCandidate("ABOVE_AND_BEYOND", "ABOVE_AND_BEYOND")).toBe(
      true
    );
  });

  it("is false for At Risk x At Risk", () => {
    expect(isSuccessionCandidate("BEHIND_SCHEDULE", "BEHIND_SCHEDULE")).toBe(
      false
    );
  });

  it("requires BOTH axes to be On Track or above", () => {
    // performance On Track, potential On Track -> succession quadrant
    expect(isSuccessionCandidate("ACHIEVED", "ACHIEVED")).toBe(true);
    // high performance but potential below On Track -> not a candidate
    expect(isSuccessionCandidate("ABOVE_AND_BEYOND", "GETTING_STARTED")).toBe(
      false
    );
    // high potential but performance below On Track -> not a candidate
    expect(isSuccessionCandidate("GETTING_STARTED", "ABOVE_AND_BEYOND")).toBe(
      false
    );
  });

  it("flags exactly the four On Track/Above & Beyond cells", () => {
    let flagged = 0;
    for (const performance of ALL_RATINGS) {
      for (const potential of ALL_RATINGS) {
        if (isSuccessionCandidate(performance, potential)) flagged += 1;
      }
    }
    expect(flagged).toBe(4);
  });
});
