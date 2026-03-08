import { describe, expect, it } from "vitest";

import {
  calculateOverallProgress,
  getAchievementPointsForCategory,
  getDefaultPointCategory,
  getMonthlyCycleLabel,
  normalizeMonthlyReviewMonth,
} from "@/lib/mentorship-review-helpers";

describe("mentorship-review-helpers", () => {
  describe("normalizeMonthlyReviewMonth", () => {
    it("normalizes a date to the first day of the month", () => {
      const result = normalizeMonthlyReviewMonth("2026-03-18T12:45:00.000Z");

      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(2);
      expect(result.getDate()).toBe(1);
    });
  });

  describe("calculateOverallProgress", () => {
    it("returns null when no statuses are present", () => {
      expect(calculateOverallProgress([null, undefined])).toBeNull();
    });

    it("returns Behind Schedule for low averages", () => {
      expect(
        calculateOverallProgress(["BEHIND_SCHEDULE", "GETTING_STARTED"])
      ).toBe("BEHIND_SCHEDULE");
    });

    it("returns Achieved for on-track averages", () => {
      expect(
        calculateOverallProgress(["ON_TRACK", "ON_TRACK", "GETTING_STARTED"])
      ).toBe("ON_TRACK");
    });

    it("returns Above & Beyond for high averages", () => {
      expect(
        calculateOverallProgress(["ABOVE_AND_BEYOND", "ABOVE_AND_BEYOND"])
      ).toBe("ABOVE_AND_BEYOND");
    });
  });

  describe("getMonthlyCycleLabel", () => {
    it("prioritizes explicit review statuses", () => {
      expect(
        getMonthlyCycleLabel({
          hasReflection: true,
          reviewStatus: "PENDING_CHAIR_APPROVAL",
        })
      ).toEqual({
        label: "Chair Approval Pending",
        tone: "warning",
      });
    });

    it("returns mentor review needed after a reflection is submitted", () => {
      expect(
        getMonthlyCycleLabel({
          hasReflection: true,
          reviewStatus: null,
        })
      ).toEqual({
        label: "Mentor Review Needed",
        tone: "warning",
      });
    });

    it("returns reflection not started when nothing has happened", () => {
      expect(
        getMonthlyCycleLabel({
          hasReflection: false,
          reviewStatus: null,
        })
      ).toEqual({
        label: "Reflection Not Started",
        tone: "neutral",
      });
    });
  });

  describe("achievement point helpers", () => {
    it("maps default point categories from primary roles", () => {
      expect(getDefaultPointCategory("INSTRUCTOR")).toBe("INSTRUCTOR");
      expect(getDefaultPointCategory("CHAPTER_LEAD")).toBe(
        "CHAPTER_PRESIDENT"
      );
      expect(getDefaultPointCategory("STAFF")).toBe("STAFF");
    });

    it("returns the correct point value for a category and progress status", () => {
      expect(
        getAchievementPointsForCategory("GLOBAL_LEADERSHIP", "ON_TRACK")
      ).toBe(60);
      expect(
        getAchievementPointsForCategory("INSTRUCTOR", "ABOVE_AND_BEYOND")
      ).toBe(75);
      expect(getAchievementPointsForCategory("CUSTOM", "ON_TRACK")).toBe(0);
    });
  });
});
