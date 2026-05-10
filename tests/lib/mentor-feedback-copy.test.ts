import { describe, expect, it } from "vitest";

import {
  feedbackPortalEmptyState,
  feedbackPortalSubtitle,
} from "@/lib/mentor-feedback-copy";

describe("mentor-feedback-copy", () => {
  it("uses 'mentee' wording on the mentor side", () => {
    const subtitle = feedbackPortalSubtitle(true);
    expect(subtitle).toMatch(/mentees/i);
    expect(subtitle).not.toMatch(/students/i);
  });

  it("uses 'mentee' wording in the mentor empty state", () => {
    const empty = feedbackPortalEmptyState(true);
    expect(empty).toMatch(/mentees/i);
    expect(empty).not.toMatch(/students/i);
  });

  it("keeps requester-side copy unchanged for non-mentor viewers", () => {
    expect(feedbackPortalSubtitle(false)).toMatch(/your work/i);
    expect(feedbackPortalEmptyState(false)).toMatch(/your work/i);
  });
});
