import { describe, expect, it } from "vitest";

import {
  FOLLOW_UP_TONES,
  generateFollowUp,
  momentumScore,
  scoreMomentum,
  type MomentumFactors,
} from "@/lib/people-strategy/momentum";

const ZERO: MomentumFactors = {
  openCount: 0,
  completedRecent: 0,
  overdue: 0,
  flagged: 0,
  hasRecentActivity: false,
};

describe("momentum scoring", () => {
  it("weights completions up, overdue and flagged down, activity slightly up", () => {
    expect(momentumScore({ ...ZERO, completedRecent: 2 })).toBe(4);
    expect(momentumScore({ ...ZERO, overdue: 2 })).toBe(-4);
    expect(momentumScore({ ...ZERO, flagged: 1 })).toBe(-1);
    expect(momentumScore({ ...ZERO, hasRecentActivity: true })).toBe(1);
  });

  it("labels strong / steady / needs-support / at-risk by score", () => {
    expect(scoreMomentum({ ...ZERO, openCount: 1, completedRecent: 2, hasRecentActivity: true }).label).toBe("STRONG");
    expect(scoreMomentum({ ...ZERO, openCount: 2, completedRecent: 1 }).label).toBe("STEADY");
    expect(scoreMomentum({ ...ZERO, openCount: 2, overdue: 1, hasRecentActivity: true }).label).toBe("NEEDS_SUPPORT");
    expect(scoreMomentum({ ...ZERO, openCount: 3, overdue: 2, flagged: 1 }).label).toBe("AT_RISK");
  });

  it("returns NO_SIGNAL only when there is genuinely nothing to say", () => {
    expect(scoreMomentum(ZERO).label).toBe("NO_SIGNAL");
    // Open work, even with a poor score, is never "no signal".
    expect(scoreMomentum({ ...ZERO, openCount: 1 }).label).not.toBe("NO_SIGNAL");
  });
});

describe("follow-up generator", () => {
  const overdueCtx = {
    itemTitle: "Confirm camp partnership",
    ownerName: "Jordan Lee",
    dueLabel: "Jun 1",
    daysOverdue: 5,
  };

  it("produces a distinct draft per tone and uses the owner's first name", () => {
    const drafts = FOLLOW_UP_TONES.map((t) => generateFollowUp(t.key, overdueCtx));
    expect(new Set(drafts).size).toBe(FOLLOW_UP_TONES.length);
    for (const draft of drafts) {
      expect(draft).toContain("Jordan");
      expect(draft).toContain("Confirm camp partnership");
    }
  });

  it("acknowledges overdue days when past due but not when upcoming", () => {
    expect(generateFollowUp("accountability", overdueCtx)).toContain("5 days overdue");
    const upcoming = generateFollowUp("accountability", { ...overdueCtx, daysOverdue: 0 });
    expect(upcoming).not.toContain("overdue");
  });

  it("references the meeting in recap tone when provided", () => {
    const recap = generateFollowUp("recap", { ...overdueCtx, meetingLabel: "the Jun 1 officer meeting" });
    expect(recap).toContain("the Jun 1 officer meeting");
  });
});
