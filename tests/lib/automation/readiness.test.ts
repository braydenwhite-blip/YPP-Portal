import { describe, it, expect } from "vitest";
import { computeChapterReadiness } from "@/lib/automation/readiness";
import { facts, NOW } from "./_fixtures";
import { addDays, isoOrNull } from "@/lib/automation/date-helpers";

describe("automation/readiness", () => {
  it("a fresh chapter is not ready with blocking gaps across 5 areas", () => {
    const r = computeChapterReadiness(facts(), NOW);
    expect(r.ready).toBe(false);
    expect(r.areas.length).toBe(5);
    expect(r.blockingGaps.length).toBeGreaterThan(0);
    expect(r.daysUntilLaunch).toBeNull();
  });

  it("a fully prepared chapter is ready with no blocking gaps", () => {
    const r = computeChapterReadiness(
      facts({
        partnersConfirmed: 1,
        partnersConfirmedLogisticsIncomplete: 0,
        instructorsHired: 2,
        interviewDecisionsOverdue: 0,
        classesTotal: 2,
        curriculaSubmitted: 2,
        curriculaApproved: 2,
        curriculaCpReviewOverdue: 0,
        classesPublic: 2,
        classesLaunchingSoonNotReady: 0,
        enrollmentTotal: 12,
        classesUnderEnrolled: 0,
      }),
      NOW
    );
    expect(r.ready).toBe(true);
    expect(r.blockingGaps).toEqual([]);
    expect(r.readyAreas).toBe(r.totalAreas);
  });

  it("flags launch risk when launch is near with blocking gaps", () => {
    const r = computeChapterReadiness(
      facts({ launchTargetISO: isoOrNull(addDays(NOW, 7)), partnersConfirmed: 0 }),
      NOW
    );
    expect(r.daysUntilLaunch).toBe(7);
    expect(r.launchRiskReasons.length).toBeGreaterThan(0);
  });
});
