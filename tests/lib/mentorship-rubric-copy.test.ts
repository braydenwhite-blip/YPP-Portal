import { describe, expect, it } from "vitest";

import {
  getGoalRatingCopy,
  getProgressStatusCopy,
  getRatingCopyForAudience,
  ratingRequiresAdminAttention,
  RATING_ORDER,
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

  it("orders the rubric strongest → needs-most-support", () => {
    expect(RATING_ORDER).toEqual([
      "ABOVE_AND_BEYOND",
      "ACHIEVED",
      "GETTING_STARTED",
      "BEHIND_SCHEDULE",
    ]);
  });

  it("returns audience-appropriate label and description", () => {
    const mentee = getRatingCopyForAudience("BEHIND_SCHEDULE", "mentee");
    const mentor = getRatingCopyForAudience("BEHIND_SCHEDULE", "mentor");
    const admin = getRatingCopyForAudience("BEHIND_SCHEDULE", "admin");

    // Mentee copy stays supportive; operator copy stays operationally blunt.
    expect(mentee.label).toBe("Needs focused support");
    expect(mentor.label).toBe("Serious Concern");
    expect(admin.description).toContain("requires admin attention");

    // The shared color/flag metadata is preserved across audiences.
    expect(mentee.color).toBe(admin.color);
    expect(admin.adminAttention).toBe(true);
  });
});
