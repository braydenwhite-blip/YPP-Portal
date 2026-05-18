import { describe, expect, it } from "vitest";

import {
  digestTallyHasWork,
  tallyMentorDigests,
  type DigestMentorshipInput,
} from "@/lib/mentor-digest";

function row(overrides: Partial<DigestMentorshipInput>): DigestMentorshipInput {
  return {
    mentorId: "m1",
    cycleStage: "REFLECTION_DUE",
    kickoffScheduledAt: null,
    hasRecentSession: true,
    hasRecentCheckIn: true,
    ...overrides,
  };
}

describe("tallyMentorDigests", () => {
  it("groups mentorships by mentor", () => {
    const tallies = tallyMentorDigests([
      row({ mentorId: "a" }),
      row({ mentorId: "a" }),
      row({ mentorId: "b" }),
    ]);
    expect(tallies).toHaveLength(2);
  });

  it("counts a submitted reflection and a changes-requested stage as reviews due", () => {
    const [tally] = tallyMentorDigests([
      row({ cycleStage: "REFLECTION_SUBMITTED" }),
      row({ cycleStage: "CHANGES_REQUESTED" }),
      row({ cycleStage: "APPROVED" }),
    ]);
    expect(tally.reviewsDue).toBe(2);
  });

  it("counts kickoff-pending only when no kickoff is scheduled", () => {
    const [tally] = tallyMentorDigests([
      row({ cycleStage: "KICKOFF_PENDING", kickoffScheduledAt: null }),
      row({ cycleStage: "KICKOFF_PENDING", kickoffScheduledAt: new Date() }),
    ]);
    expect(tally.kickoffsUnscheduled).toBe(1);
  });

  it("flags a mentee as quiet only with no recent session and no recent check-in", () => {
    const [tally] = tallyMentorDigests([
      row({ hasRecentSession: false, hasRecentCheckIn: false }),
      row({ hasRecentSession: true, hasRecentCheckIn: false }),
      row({ hasRecentSession: false, hasRecentCheckIn: true }),
    ]);
    expect(tally.quietMentees).toBe(1);
  });

  it("never flags COMPLETE or PAUSED mentorships as quiet", () => {
    const [tally] = tallyMentorDigests([
      row({ cycleStage: "COMPLETE", hasRecentSession: false, hasRecentCheckIn: false }),
      row({ cycleStage: "PAUSED", hasRecentSession: false, hasRecentCheckIn: false }),
    ]);
    expect(tally.quietMentees).toBe(0);
  });

  it("reports no work when every count is zero", () => {
    const [tally] = tallyMentorDigests([row({})]);
    expect(digestTallyHasWork(tally)).toBe(false);
  });
});
