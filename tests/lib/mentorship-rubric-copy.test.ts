import { describe, expect, it } from "vitest";

import {
  getGoalRatingCopy,
  getProgressStatusCopy,
  getRatingCopyForAudience,
  ratingRequiresAdminAttention,
  RATING_ORDER,
} from "@/lib/mentorship-rubric-copy";

describe("mentorship rubric copy", () => {
  it("uses the Leadership Goals & Rubric rating labels", () => {
    expect(getGoalRatingCopy("ABOVE_AND_BEYOND").label).toBe("Above & Beyond");
    expect(getGoalRatingCopy("ABOVE_AND_BEYOND").mentorDescription).toContain(
      "Dramatically exceeds"
    );
    expect(getGoalRatingCopy("ACHIEVED").label).toBe("On Track");
    expect(getGoalRatingCopy("ACHIEVED").mentorDescription).toBe("All bullets met.");
    expect(getGoalRatingCopy("GETTING_STARTED").label).toBe("Needs Attention");
    expect(getGoalRatingCopy("GETTING_STARTED").mentorDescription).toContain(
      "Some bullets met"
    );
    expect(getGoalRatingCopy("BEHIND_SCHEDULE").label).toBe("At Risk");
    expect(getGoalRatingCopy("BEHIND_SCHEDULE").mentorDescription).toBe(
      "Major deficiencies present."
    );
  });

  it("keeps At Risk as the admin-attention flag", () => {
    const copy = getGoalRatingCopy("BEHIND_SCHEDULE");
    expect(copy.shortLabel).toBe("Red");
    expect(copy.menteeLabel).toBe("At Risk");
    expect(copy.adminDescription).toContain("requires admin attention");
    expect(ratingRequiresAdminAttention("BEHIND_SCHEDULE")).toBe(true);
  });

  it("maps ProgressStatus ON_TRACK to On Track", () => {
    const copy = getProgressStatusCopy("ON_TRACK");
    expect(copy.shortLabel).toBe("Green");
    expect(copy.label).toBe("On Track");
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

    expect(mentee.label).toBe("At Risk");
    expect(mentor.label).toBe("At Risk");
    expect(admin.description).toContain("requires admin attention");

    expect(mentee.color).toBe(admin.color);
    expect(admin.adminAttention).toBe(true);
  });
});
