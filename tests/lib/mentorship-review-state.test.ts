import { describe, expect, it } from "vitest";

import {
  getReviewHeadlineState,
  getReviewStateChips,
  getReviewStateTonePalette,
} from "@/lib/mentorship-review-state";

describe("mentorship-review-state", () => {
  describe("getReviewHeadlineState", () => {
    it("treats a draft review as not yet actionable", () => {
      const state = getReviewHeadlineState({ status: "DRAFT" });
      expect(state.key).toBe("draft");
      expect(state.tone).toBe("neutral");
    });

    it("marks a submitted review as pending chair approval", () => {
      const state = getReviewHeadlineState({ status: "PENDING_CHAIR_APPROVAL" });
      expect(state.key).toBe("pending-chair");
      expect(state.tone).toBe("pending");
    });

    it("distinguishes returned reviews", () => {
      const state = getReviewHeadlineState({ status: "CHANGES_REQUESTED" });
      expect(state.key).toBe("changes-requested");
      expect(state.tone).toBe("warning");
    });

    it("reflects whether an approved review has been released", () => {
      const notReleased = getReviewHeadlineState({ status: "APPROVED" });
      expect(notReleased.label).toBe("Approved");

      const released = getReviewHeadlineState({
        status: "APPROVED",
        releasedToMenteeAt: new Date(),
      });
      expect(released.label).toBe("Approved & released");
      expect(released.tone).toBe("success");
    });
  });

  describe("getReviewStateChips", () => {
    it("returns the full pipeline in order", () => {
      const chips = getReviewStateChips({ status: "PENDING_CHAIR_APPROVAL" });
      expect(chips.map((c) => c.key)).toEqual([
        "submitted",
        "chair-decision",
        "released",
        "points",
      ]);
    });

    it("keeps everything downstream pending while awaiting chair approval", () => {
      const chips = getReviewStateChips({ status: "PENDING_CHAIR_APPROVAL" });
      expect(chips.find((c) => c.key === "submitted")?.done).toBe(true);
      expect(chips.find((c) => c.key === "chair-decision")?.done).toBe(false);
      expect(chips.find((c) => c.key === "released")?.done).toBe(false);
      expect(chips.find((c) => c.key === "points")?.done).toBe(false);
    });

    it("confirms release and points only once approved with points awarded", () => {
      const chips = getReviewStateChips({
        status: "APPROVED",
        releasedToMenteeAt: new Date(),
        pointsAwarded: 40,
      });
      expect(chips.find((c) => c.key === "chair-decision")?.done).toBe(true);
      expect(chips.find((c) => c.key === "released")?.done).toBe(true);
      const points = chips.find((c) => c.key === "points");
      expect(points?.done).toBe(true);
      expect(points?.label).toBe("Points confirmed");
      expect(points?.description).toContain("40");
    });

    it("treats an approved review with zero points as points pending", () => {
      const chips = getReviewStateChips({ status: "APPROVED", pointsAwarded: 0 });
      expect(chips.find((c) => c.key === "points")?.label).toBe("Points pending");
    });

    it("marks a returned review's chair decision as a warning", () => {
      const chips = getReviewStateChips({ status: "CHANGES_REQUESTED" });
      const decision = chips.find((c) => c.key === "chair-decision");
      expect(decision?.tone).toBe("warning");
      expect(decision?.done).toBe(false);
    });
  });

  describe("getReviewStateTonePalette", () => {
    it("returns a color + background for every tone", () => {
      for (const tone of ["neutral", "info", "pending", "success", "warning"] as const) {
        const palette = getReviewStateTonePalette(tone);
        expect(palette.color).toMatch(/^#/);
        expect(palette.background).toMatch(/^#/);
      }
    });
  });
});
