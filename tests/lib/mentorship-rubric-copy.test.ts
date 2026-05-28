import { describe, expect, it } from "vitest";

import {
  getGoalRatingCopy,
  getProgressStatusCopy,
  ratingRequiresAdminAttention,
} from "@/lib/mentorship-rubric-copy";

describe("mentorship rubric copy", () => {
  it("uses supportive mentee-facing red copy while preserving admin severity", () => {
    const copy = getGoalRatingCopy("BEHIND_SCHEDULE");

    expect(copy.shortLabel).toBe("Red");
    expect(copy.menteeLabel).toBe("Needs focused support");
    expect(copy.adminDescription).toContain("requires admin attention");
    expect(ratingRequiresAdminAttention("BEHIND_SCHEDULE")).toBe(true);
  });

  it("maps ProgressStatus ON_TRACK to the green meaning", () => {
    const copy = getProgressStatusCopy("ON_TRACK");

    expect(copy.shortLabel).toBe("Green");
    expect(copy.menteeLabel).toBe("On track");
    expect(copy.adminAttention).toBe(false);
  });
});
