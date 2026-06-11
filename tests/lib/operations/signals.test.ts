import { describe, expect, it } from "vitest";

import type { OperationalDigestCounts } from "@/lib/people-strategy/operational-digest";
import {
  buildTodaysBrief,
  deriveClassReadiness,
  derivePartnerHealth,
  derivePersonProfileCompleteness,
  latestActivityISO,
  recencyLabel,
} from "@/lib/operations/signals";
import type { OrgWideCounts } from "@/lib/operations/metrics";

const NOW = new Date("2026-06-11T12:00:00.000Z");

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

function daysAhead(days: number): Date {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);
}

// --- class readiness ---------------------------------------------------------------

function classInput(overrides: Partial<Parameters<typeof deriveClassReadiness>[0]> = {}) {
  return {
    status: "PUBLISHED",
    startDate: daysAhead(20),
    endDate: daysAhead(80),
    hasInstructor: true,
    sessionCount: 4,
    enrolledCount: 12,
    ...overrides,
  };
}

describe("deriveClassReadiness", () => {
  it("reads ready when nothing is missing", () => {
    const r = deriveClassReadiness(classInput(), NOW);
    expect(r?.level).toBe("ready");
    expect(r?.missing).toEqual([]);
  });

  it("reads almost ready with one gap, needs setup with two", () => {
    expect(
      deriveClassReadiness(classInput({ enrolledCount: 0 }), NOW)?.level
    ).toBe("almost");
    const two = deriveClassReadiness(
      classInput({ enrolledCount: 0, sessionCount: 0 }),
      NOW
    );
    expect(two?.level).toBe("needs_setup");
    expect(two?.missing).toEqual(["session schedule", "student enrollment"]);
  });

  it("escalates to at risk when gaps remain near or past the start date", () => {
    expect(
      deriveClassReadiness(
        classInput({ sessionCount: 0, startDate: daysAhead(3) }),
        NOW
      )?.level
    ).toBe("at_risk");
    expect(
      deriveClassReadiness(
        classInput({ sessionCount: 0, startDate: daysAgo(2) }),
        NOW
      )?.level
    ).toBe("at_risk");
  });

  it("lists missing items in fix-first order", () => {
    const r = deriveClassReadiness(
      classInput({
        hasInstructor: false,
        sessionCount: 0,
        status: "DRAFT",
        enrolledCount: 0,
      }),
      NOW
    );
    expect(r?.missing).toEqual([
      "instructor",
      "session schedule",
      "publish the class",
      "student enrollment",
    ]);
  });

  it("returns null for terminal or already-ended classes", () => {
    expect(deriveClassReadiness(classInput({ status: "CANCELLED" }), NOW)).toBeNull();
    expect(deriveClassReadiness(classInput({ status: "COMPLETED" }), NOW)).toBeNull();
    expect(
      deriveClassReadiness(
        classInput({ startDate: daysAgo(90), endDate: daysAgo(10) }),
        NOW
      )
    ).toBeNull();
  });
});

// --- partner health ----------------------------------------------------------------

function partnerInput(
  overrides: Partial<Parameters<typeof derivePartnerHealth>[0]> = {}
) {
  return {
    stage: "IN_CONVERSATION",
    nextFollowUpAt: daysAhead(7) as Date | null,
    lastContactedAt: daysAgo(5) as Date | null,
    openActions: 2,
    overdueActions: 0,
    ...overrides,
  };
}

describe("derivePartnerHealth", () => {
  it("reads healthy with a scheduled future follow-up and no overdue work", () => {
    const h = derivePartnerHealth(partnerInput(), NOW);
    expect(h?.level).toBe("healthy");
    expect(h?.reasons).toEqual([]);
  });

  it("reads needs follow-up when the next step is missing but contact is recent", () => {
    const h = derivePartnerHealth(partnerInput({ nextFollowUpAt: null }), NOW);
    expect(h?.level).toBe("needs_follow_up");
    expect(h?.reasons).toContain("No next step scheduled");
  });

  it("reads stalled when there is no next step and no recent contact", () => {
    const h = derivePartnerHealth(
      partnerInput({ nextFollowUpAt: null, lastContactedAt: daysAgo(45) }),
      NOW
    );
    expect(h?.level).toBe("stalled");
    expect(h?.reasons).toContain("No contact in 45 days");
  });

  it("reads at risk on a long-overdue follow-up or overdue linked work", () => {
    expect(
      derivePartnerHealth(partnerInput({ nextFollowUpAt: daysAgo(20) }), NOW)?.level
    ).toBe("at_risk");
    expect(
      derivePartnerHealth(partnerInput({ overdueActions: 1 }), NOW)?.level
    ).toBe("at_risk");
  });

  it("a short-overdue follow-up is needs follow-up, not yet at risk", () => {
    const h = derivePartnerHealth(partnerInput({ nextFollowUpAt: daysAgo(3) }), NOW);
    expect(h?.level).toBe("needs_follow_up");
    expect(h?.reasons[0]).toContain("3 days overdue");
  });

  it("returns null for inactive pipeline stages", () => {
    expect(derivePartnerHealth(partnerInput({ stage: "CLOSED" }), NOW)).toBeNull();
    expect(derivePartnerHealth(partnerInput({ stage: null }), NOW)).toBeNull();
  });
});

// --- person completeness / recency -----------------------------------------------------

describe("derivePersonProfileCompleteness", () => {
  it("scores a full profile at 100 with nothing missing", () => {
    const c = derivePersonProfileCompleteness({
      hasBio: true,
      hasAvatar: true,
      hasPhone: true,
      hasSchool: true,
      hasLocation: true,
      hasChapter: true,
    });
    expect(c).toEqual({ percent: 100, missing: [] });
  });

  it("names what is missing in display order", () => {
    const c = derivePersonProfileCompleteness({
      hasBio: false,
      hasAvatar: false,
      hasPhone: true,
      hasSchool: true,
      hasLocation: true,
      hasChapter: false,
    });
    expect(c.percent).toBe(50);
    expect(c.missing).toEqual(["bio", "photo", "chapter"]);
  });
});

describe("latestActivityISO / recencyLabel", () => {
  it("picks the newest of mixed date inputs, skipping empties", () => {
    expect(
      latestActivityISO([
        daysAgo(10),
        "2026-06-10T00:00:00.000Z",
        null,
        undefined,
        daysAgo(30),
      ])
    ).toBe("2026-06-10T00:00:00.000Z");
    expect(latestActivityISO([null, undefined])).toBeNull();
  });

  it("labels recency in human terms", () => {
    expect(recencyLabel(NOW.toISOString(), NOW)).toBe("today");
    expect(recencyLabel(daysAgo(1).toISOString(), NOW)).toBe("yesterday");
    expect(recencyLabel(daysAgo(5).toISOString(), NOW)).toBe("5 days ago");
    expect(recencyLabel(daysAgo(40).toISOString(), NOW)).toMatch(/^May \d{1,2}$/);
    expect(recencyLabel(null, NOW)).toBe("no activity yet");
  });
});

// --- today's brief ----------------------------------------------------------------------

function counts(overrides: Partial<OperationalDigestCounts> = {}): OperationalDigestCounts {
  return {
    openActions: 0,
    overdueActions: 0,
    dueTodayActions: 0,
    dueSoonActions: 0,
    blockedActions: 0,
    unassignedActions: 0,
    meetingsThisWeek: 0,
    upcomingMeetings: 0,
    meetingsWithoutActions: 0,
    unresolvedFollowUps: 0,
    unconvertedFollowUps: 0,
    criticalEntities: 0,
    warningEntities: 0,
    recentDecisions: 0,
    decisionsNeedingAction: 0,
    recentlyCompletedActions: 0,
    newActionsThisWeek: 0,
    ...overrides,
  };
}

function org(overrides: Partial<OrgWideCounts> = {}): OrgWideCounts {
  return {
    activeClasses: 0,
    activeInitiatives: 0,
    initiativesAtRisk: 0,
    applicantsInReview: 0,
    applicantsStuck: 0,
    activeMentorships: 0,
    mentorshipsQuiet: 0,
    partnersNeedingFollowUp: 0,
    ...overrides,
  };
}

describe("buildTodaysBrief", () => {
  it("reads worst news first, wins last, capped at six lines", () => {
    const brief = buildTodaysBrief({
      counts: counts({
        overdueActions: 4,
        blockedActions: 1,
        unassignedActions: 2,
        dueSoonActions: 6,
        meetingsThisWeek: 3,
        recentlyCompletedActions: 5,
        decisionsNeedingAction: 1,
      }),
      org: org({ partnersNeedingFollowUp: 2, applicantsStuck: 3 }),
    });
    expect(brief[0]).toBe("4 actions are overdue.");
    expect(brief).toContain("2 partners need follow-up.");
    expect(brief).toHaveLength(6);
  });

  it("uses singular grammar correctly", () => {
    const brief = buildTodaysBrief({
      counts: counts({ overdueActions: 1 }),
      org: org({ mentorshipsQuiet: 1 }),
    });
    expect(brief).toEqual([
      "1 action is overdue.",
      "1 mentorship has gone quiet.",
    ]);
  });

  it("gives a calm org one calm sentence", () => {
    expect(buildTodaysBrief({ counts: counts(), org: org() })).toEqual([
      "All clear — nothing overdue, blocked, or waiting on a decision.",
    ]);
  });
});
