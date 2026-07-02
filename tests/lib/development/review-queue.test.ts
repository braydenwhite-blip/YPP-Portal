import { describe, expect, it } from "vitest";

import { buildReviewQueue } from "@/lib/development/review-queue";
import {
  EMPTY_DEVELOPMENT_FACTS,
  type DevelopmentPersonFacts,
} from "@/lib/development/signals";

function person(
  overrides: Partial<DevelopmentPersonFacts> = {}
): DevelopmentPersonFacts {
  return {
    ...EMPTY_DEVELOPMENT_FACTS,
    id: "user-1",
    name: "Maya Chen",
    email: "maya@ypp.org",
    population: "instructor",
    ...overrides,
  };
}

describe("buildReviewQueue", () => {
  it("orders overdue reviews before stuck approvals before first reviews before recognition", () => {
    const queue = buildReviewQueue({
      people: [
        person({
          id: "overdue",
          name: "Olive",
          reviewDue: true,
          hasAnyReview: true,
          lastReviewQuarter: "2026-Q1",
        }),
        person({ id: "first", name: "Fern", reviewDue: true, hasAnyReview: false }),
      ],
      pendingApprovals: [
        {
          reviewId: "r1",
          menteeId: "stuck",
          menteeName: "Sam",
          mentorName: "Jordan",
          daysWaiting: 9,
        },
      ],
      strongReviews: [
        {
          menteeId: "star",
          menteeName: "Ada",
          contextLabel: "Instructor",
          overallRating: "ABOVE_AND_BEYOND",
          monthLabel: "June",
        },
      ],
    });

    expect(queue.map((item) => item.kind)).toEqual([
      "quarterly-overdue",
      "approval-stuck",
      "quarterly-due",
      "recognize",
    ]);
  });

  it("writes concrete reasons with real quarters and wait times", () => {
    const queue = buildReviewQueue({
      people: [
        person({
          reviewDue: true,
          hasAnyReview: true,
          lastReviewQuarter: "2026-Q1",
        }),
      ],
      pendingApprovals: [
        {
          reviewId: "r1",
          menteeId: "m1",
          menteeName: "Sam",
          mentorName: "Jordan",
          daysWaiting: 3,
        },
      ],
      strongReviews: [],
    });
    expect(queue[0]?.reason).toBe("Review overdue — last review 2026-Q1");
    expect(queue[1]?.reason).toBe(
      "Monthly review waiting 3 days for chair approval"
    );
    expect(queue[1]?.tone).toBe("warning");
  });

  it("puts review-cycle moves ahead of everything and skips the quarterly nag for people in a cycle", () => {
    const queue = buildReviewQueue({
      people: [
        person({
          id: "in-cycle",
          name: "Cy",
          reviewDue: true,
          hasAnyReview: true,
          lastReviewQuarter: "2026-Q1",
        }),
      ],
      activeCycles: [
        {
          cycleId: "c1",
          revieweeId: "in-cycle",
          revieweeName: "Cy",
          contextLabel: "Instructor",
          displayState: "follow-up-overdue",
        },
        {
          cycleId: "c2",
          revieweeId: "other",
          revieweeName: "Ada",
          contextLabel: null,
          displayState: "waiting-feedback",
        },
      ],
      pendingApprovals: [],
      strongReviews: [],
    });

    expect(queue.map((item) => item.kind)).toEqual([
      "cycle-follow-up-overdue",
      "cycle-waiting",
    ]);
    // The person with a running cycle gets no duplicate quarterly item.
    expect(queue.some((item) => item.kind === "quarterly-overdue")).toBe(false);
    expect(queue[0]?.href).toBe("/people/develop/reviews/c1");
    expect(queue[0]?.reason).toBe("Follow-up overdue");
  });

  it("routes quarterly items to starting a review cycle", () => {
    const queue = buildReviewQueue({
      people: [
        person({ reviewDue: true, hasAnyReview: true, lastReviewQuarter: "2026-Q1" }),
      ],
      pendingApprovals: [],
      strongReviews: [],
    });
    expect(queue[0]?.actionLabel).toBe("Start review");
    expect(queue[0]?.href).toBe("/people/develop/reviews/new");
  });

  it("skips people whose reviews are current and non-purple strong reviews", () => {
    const queue = buildReviewQueue({
      people: [person({ reviewDue: false })],
      pendingApprovals: [],
      strongReviews: [
        {
          menteeId: "ok",
          menteeName: "Kim",
          contextLabel: null,
          overallRating: "ACHIEVED",
          monthLabel: "June",
        },
      ],
    });
    expect(queue).toHaveLength(0);
  });
});
