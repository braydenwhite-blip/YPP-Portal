import { describe, expect, it } from "vitest";

import {
  derivePerformanceRating,
  deriveRatingFromGoalRatings,
  RATING_LABELS,
  RATING_POINTS,
} from "@/lib/people-strategy/check-in-rating";

describe("deriveRatingFromGoalRatings", () => {
  it("returns null when there are no ratings", () => {
    expect(deriveRatingFromGoalRatings([])).toBeNull();
  });

  it("returns the single rating unchanged", () => {
    expect(deriveRatingFromGoalRatings(["ACHIEVED"])).toBe("ACHIEVED");
  });

  it("averages and rounds to the nearest level", () => {
    // (0 + 3) / 2 = 1.5 -> rounds to 2 -> ACHIEVED
    expect(
      deriveRatingFromGoalRatings(["BEHIND_SCHEDULE", "ABOVE_AND_BEYOND"])
    ).toBe("ACHIEVED");
    // (1 + 2 + 2) / 3 = 1.67 -> rounds to 2 -> ACHIEVED
    expect(
      deriveRatingFromGoalRatings(["GETTING_STARTED", "ACHIEVED", "ACHIEVED"])
    ).toBe("ACHIEVED");
    // all behind -> BEHIND_SCHEDULE
    expect(
      deriveRatingFromGoalRatings(["BEHIND_SCHEDULE", "BEHIND_SCHEDULE"])
    ).toBe("BEHIND_SCHEDULE");
  });

  it("is deterministic", () => {
    const input = ["GETTING_STARTED", "ACHIEVED"] as const;
    expect(deriveRatingFromGoalRatings([...input])).toBe(
      deriveRatingFromGoalRatings([...input])
    );
  });
});

describe("derivePerformanceRating", () => {
  it("returns null for a missing review", () => {
    expect(derivePerformanceRating(null)).toBeNull();
    expect(derivePerformanceRating(undefined)).toBeNull();
  });

  it("prefers the explicit overallRating", () => {
    expect(
      derivePerformanceRating({
        overallRating: "ABOVE_AND_BEYOND",
        goalRatings: [{ rating: "BEHIND_SCHEDULE" }],
      })
    ).toBe("ABOVE_AND_BEYOND");
  });

  it("falls back to averaging per-goal ratings when overallRating is absent", () => {
    // (1 + 2 + 2) / 3 = 1.67 -> rounds to 2 -> ACHIEVED
    expect(
      derivePerformanceRating({
        overallRating: null,
        goalRatings: [
          { rating: "GETTING_STARTED" },
          { rating: "ACHIEVED" },
          { rating: "ACHIEVED" },
        ],
      })
    ).toBe("ACHIEVED");
  });

  it("returns null when there is no goal data at all", () => {
    expect(
      derivePerformanceRating({ overallRating: null, goalRatings: [] })
    ).toBeNull();
  });
});

describe("rating maps reuse the live GoalRatingColor enum", () => {
  it("documents the kickoff label mapping", () => {
    expect(RATING_LABELS.BEHIND_SCHEDULE).toBe("At Risk");
    expect(RATING_LABELS.GETTING_STARTED).toBe("Needs Attention");
    expect(RATING_LABELS.ACHIEVED).toBe("On Track");
    expect(RATING_LABELS.ABOVE_AND_BEYOND).toBe("Above & Beyond");
  });

  it("orders points 0..3", () => {
    expect(RATING_POINTS.BEHIND_SCHEDULE).toBe(0);
    expect(RATING_POINTS.ABOVE_AND_BEYOND).toBe(3);
  });
});
