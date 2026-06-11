import { describe, expect, it } from "vitest";

import type { OperationalDigestCounts } from "@/lib/people-strategy/operational-digest";
import {
  buildExecutiveSnapshot,
  type OrgWideCounts,
} from "@/lib/operations/metrics";

function counts(overrides: Partial<OperationalDigestCounts> = {}): OperationalDigestCounts {
  return {
    openActions: 12,
    overdueActions: 0,
    dueTodayActions: 1,
    dueSoonActions: 4,
    blockedActions: 0,
    unassignedActions: 2,
    meetingsThisWeek: 3,
    upcomingMeetings: 2,
    meetingsWithoutActions: 0,
    unresolvedFollowUps: 2,
    unconvertedFollowUps: 2,
    criticalEntities: 0,
    warningEntities: 0,
    recentDecisions: 5,
    decisionsNeedingAction: 0,
    recentlyCompletedActions: 3,
    newActionsThisWeek: 4,
    ...overrides,
  };
}

function org(overrides: Partial<OrgWideCounts> = {}): OrgWideCounts {
  return {
    activeClasses: 6,
    activeInitiatives: 8,
    initiativesAtRisk: 0,
    applicantsInReview: 4,
    applicantsStuck: 0,
    activeMentorships: 15,
    mentorshipsQuiet: 0,
    partnersNeedingFollowUp: 0,
    ...overrides,
  };
}

describe("buildExecutiveSnapshot", () => {
  it("returns the full ordered strip with stable keys", () => {
    const snapshot = buildExecutiveSnapshot({ counts: counts(), org: org() });
    expect(snapshot.map((m) => m.key)).toEqual([
      "open-actions",
      "overdue",
      "due-week",
      "blocked",
      "meetings-week",
      "initiatives",
      "classes",
      "applicants",
      "partners",
      "mentorships",
    ]);
  });

  it("folds unconverted follow-ups into open work with an explanatory hint", () => {
    const [open] = buildExecutiveSnapshot({ counts: counts(), org: org() });
    expect(open.value).toBe(14);
    expect(open.hint).toBe("2 from meetings, not yet tracked");
  });

  it("only alarms when something is actually wrong — zero is calm", () => {
    const calm = buildExecutiveSnapshot({ counts: counts(), org: org() });
    expect(calm.find((m) => m.key === "overdue")?.tone).toBe("default");
    expect(calm.find((m) => m.key === "initiatives")?.tone).toBe("default");

    const loud = buildExecutiveSnapshot({
      counts: counts({ overdueActions: 3, blockedActions: 1 }),
      org: org({ initiativesAtRisk: 2, applicantsStuck: 1, mentorshipsQuiet: 4 }),
    });
    expect(loud.find((m) => m.key === "overdue")?.tone).toBe("danger");
    expect(loud.find((m) => m.key === "blocked")?.tone).toBe("warning");
    expect(loud.find((m) => m.key === "initiatives")?.hint).toBe("2 at risk");
    expect(loud.find((m) => m.key === "applicants")?.hint).toBe("1 waiting too long");
    expect(loud.find((m) => m.key === "mentorships")?.hint).toBe("4 gone quiet");
  });
});
