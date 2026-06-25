import { describe, it, expect } from "vitest";
import { computeChapterHealth, type ChapterHealthSignals } from "@/lib/chapters/health";

const NOW = new Date("2026-06-24T00:00:00.000Z");

function baseSignals(overrides: Partial<ChapterHealthSignals> = {}): ChapterHealthSignals {
  return {
    lifecycleStatus: "ACTIVE",
    memberCount: 12,
    lastMeetingAt: new Date("2026-06-20T00:00:00.000Z"),
    nextMeetingAt: new Date("2026-06-30T00:00:00.000Z"),
    openActions: 1,
    overdueActions: 0,
    programsCompleted: 2,
    openSupportRequests: 0,
    launchChecklistTotal: 11,
    launchChecklistDone: 11,
    launchTargetDate: null,
    daysSinceCpActivity: null,
    now: NOW,
    ...overrides,
  };
}

describe("computeChapterHealth", () => {
  it("paused chapters are always PAUSED with no risk math", () => {
    const h = computeChapterHealth(baseSignals({ lifecycleStatus: "PAUSED", memberCount: 0, lastMeetingAt: null }));
    expect(h.label).toBe("PAUSED");
    expect(h.tone).toBe("neutral");
  });

  it("a well-run active chapter is ON_TRACK", () => {
    const h = computeChapterHealth(baseSignals());
    expect(h.label).toBe("ON_TRACK");
    expect(h.tone).toBe("success");
    expect(h.reasons.length).toBeGreaterThan(0);
  });

  it("an active chapter with no meeting and no members is AT_RISK", () => {
    const h = computeChapterHealth(
      baseSignals({ lastMeetingAt: null, nextMeetingAt: null, memberCount: 1 })
    );
    expect(h.label).toBe("AT_RISK");
    expect(h.reasons.some((r) => /meeting/i.test(r))).toBe(true);
  });

  it("a stale-but-not-dead active chapter is NEEDS_SUPPORT", () => {
    const h = computeChapterHealth(
      baseSignals({
        lastMeetingAt: new Date("2026-05-20T00:00:00.000Z"), // ~35 days
        nextMeetingAt: null,
        memberCount: 7,
      })
    );
    expect(h.label).toBe("NEEDS_SUPPORT");
  });

  it("a launching chapter past its target with an unfinished checklist is AT_RISK", () => {
    const h = computeChapterHealth(
      baseSignals({
        lifecycleStatus: "LAUNCHING",
        launchTargetDate: new Date("2026-06-01T00:00:00.000Z"),
        launchChecklistDone: 3,
        launchChecklistTotal: 11,
        overdueActions: 2,
        lastMeetingAt: null,
        nextMeetingAt: null,
      })
    );
    expect(h.label).toBe("AT_RISK");
    expect(h.reasons.some((r) => /target date/i.test(r))).toBe(true);
  });

  it("open support requests always add a reason", () => {
    const h = computeChapterHealth(baseSignals({ openSupportRequests: 2 }));
    expect(h.reasons.some((r) => /support request/i.test(r))).toBe(true);
  });

  it("score decreases as risk points accumulate", () => {
    const healthy = computeChapterHealth(baseSignals());
    const risky = computeChapterHealth(
      baseSignals({ lastMeetingAt: null, nextMeetingAt: null, memberCount: 1, overdueActions: 3 })
    );
    expect(healthy.score).toBeGreaterThan(risky.score);
  });
});
