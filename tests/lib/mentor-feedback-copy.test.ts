import { describe, expect, it } from "vitest";

import {
  feedbackCalmHeadline,
  feedbackCalmReason,
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

  it("leads the calm mentor headline with the count waiting on them", () => {
    expect(feedbackCalmHeadline(true, 0)).toMatch(/caught up/i);
    expect(feedbackCalmHeadline(true, 1)).toBe("1 request needs your response");
    expect(feedbackCalmHeadline(true, 3)).toBe("3 requests need your response");
    expect(feedbackCalmReason(true, 2)).toMatch(/respond inline/i);
  });

  it("keeps the calm mentee headline warm and never framed as a backlog", () => {
    expect(feedbackCalmHeadline(false, 0)).toMatch(/whenever you're ready/i);
    expect(feedbackCalmHeadline(false, 2)).toMatch(/waiting on a mentor/i);
    expect(feedbackCalmHeadline(false, 2)).not.toMatch(/respond/i);
  });
});
