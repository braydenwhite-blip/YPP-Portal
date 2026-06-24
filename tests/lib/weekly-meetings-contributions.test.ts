import { describe, expect, it } from "vitest";

import {
  buildContributions,
  mentorshipSessionTypeLabel,
} from "@/lib/weekly-meetings/contribution-types";

describe("mentorshipSessionTypeLabel", () => {
  it("maps known session types and falls back gracefully", () => {
    expect(mentorshipSessionTypeLabel("CHECK_IN")).toBe("Check-in");
    expect(mentorshipSessionTypeLabel("KICKOFF")).toBe("Kickoff");
    expect(mentorshipSessionTypeLabel("WHATEVER")).toBe("Session");
  });
});

describe("buildContributions", () => {
  const names = { m1: "Alex Rivera", u9: "Jordan Lee" };

  it("builds one suggestion per source, newest first", () => {
    const out = buildContributions({
      sessions: [
        { id: "s1", title: "", type: "CHECK_IN", menteeId: "m1", completedISO: "2026-06-23T15:00:00.000Z" },
      ],
      mentorReviews: [
        { id: "r1", menteeId: "m1", isQuarterly: false, updatedISO: "2026-06-25T12:00:00.000Z" },
      ],
      quarterlyReviews: [
        { id: "q1", userId: "u9", quarter: "2026-Q2", createdISO: "2026-06-24T09:00:00.000Z" },
      ],
      names,
    });

    expect(out.map((c) => c.kind)).toEqual([
      "mentor_review", // 06-25 newest
      "quarterly_review", // 06-24
      "mentorship_session", // 06-23
    ]);
    expect(out.every((c) => c.key && c.type && c.whatGoal && c.evidenceNext)).toBe(true);
  });

  it("uses the session title when present, else a mentee-named fallback", () => {
    const [titled, untitled] = buildContributions({
      sessions: [
        { id: "s1", title: "Roadmap deep-dive", type: "CHECK_IN", menteeId: "m1", completedISO: "2026-06-23T15:00:00.000Z" },
        { id: "s2", title: "", type: "KICKOFF", menteeId: "mX", completedISO: "2026-06-22T15:00:00.000Z" },
      ],
      mentorReviews: [],
      quarterlyReviews: [],
      names,
    });
    expect(titled.whatGoal).toBe("Roadmap deep-dive");
    // Unknown mentee id falls back to a friendly placeholder, not the raw id.
    expect(untitled.whatGoal).toBe("Kickoff with a teammate");
  });

  it("labels monthly vs quarterly mentor reviews and names the subject", () => {
    const [review] = buildContributions({
      sessions: [],
      mentorReviews: [{ id: "r1", menteeId: "m1", isQuarterly: true, updatedISO: "2026-06-25T12:00:00.000Z" }],
      quarterlyReviews: [],
      names,
    });
    expect(review.whatGoal).toBe("Quarterly mentorship review for Alex Rivera");
  });
});
