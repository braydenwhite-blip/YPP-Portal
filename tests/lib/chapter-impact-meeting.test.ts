import { describe, it, expect } from "vitest";
import {
  chapterWeekNumber,
  weeklyMetricGroups,
  buildImpactMeetingPrep,
  IMPACT_NARRATIVE_PROMPTS,
  type ChapterImpactMetrics,
} from "@/lib/chapters/impact-meeting";

const NOW = new Date("2026-06-24T12:00:00.000Z");

function metrics(overrides: Partial<ChapterImpactMetrics> = {}): ChapterImpactMetrics {
  return {
    partnersTotal: 10,
    partnersContacted: 8,
    partnersResponded: 4,
    partnersMeetingScheduled: 2,
    partnersMeetingsCompleted: 1,
    partnersInConversation: 3,
    partnersConfirmed: 1,
    partnersClosed: 1,
    instructorApplicants: 12,
    instructorsUnderReview: 5,
    interviewsScheduled: 3,
    interviewsCompleted: 2,
    instructorsHired: 1,
    curriculaSubmitted: 2,
    curriculaApproved: 1,
    curriculaNeedsRevision: 1,
    classesTotal: 3,
    classesPublic: 1,
    classesLaunched: 0,
    classesRunning: 0,
    enrollmentTotal: 14,
    underEnrolledClasses: 1,
    ...overrides,
  };
}

describe("chapterWeekNumber", () => {
  it("is week 1 at the start and with no start date", () => {
    expect(chapterWeekNumber(NOW, NOW)).toBe(1);
    expect(chapterWeekNumber(null, NOW)).toBe(1);
  });
  it("counts 1-based weeks since the start date", () => {
    const start = new Date("2026-06-01T00:00:00.000Z"); // 23 days before NOW
    expect(chapterWeekNumber(start, NOW)).toBe(4); // floor(23/7)+1 = 4
  });
  it("clamps a future start date to week 1", () => {
    expect(chapterWeekNumber(new Date("2026-07-01T00:00:00Z"), NOW)).toBe(1);
  });
});

describe("weeklyMetricGroups", () => {
  it("week 4 flags missed targets as attention", () => {
    const groups = weeklyMetricGroups(4, metrics({ instructorApplicants: 12, instructorsHired: 1, partnersConfirmed: 0 }));
    const week4 = groups[0];
    expect(week4.title).toMatch(/Week 4/);
    const applicants = week4.metrics.find((m) => m.label === "Applicants");
    expect(applicants?.attention).toBe(true); // 12 < 25
    const hired = week4.metrics.find((m) => m.label === "Instructors hired");
    expect(hired?.attention).toBe(true); // 1 < 3
    const confirmed = week4.metrics.find((m) => m.label === "Confirmed partners");
    expect(confirmed?.attention).toBe(true); // 0 < 1
  });

  it("does not flag attention when targets are met", () => {
    const groups = weeklyMetricGroups(4, metrics({ instructorApplicants: 30, instructorsHired: 4, partnersConfirmed: 2 }));
    const week4 = groups[0];
    expect(week4.metrics.find((m) => m.label === "Applicants")?.attention).toBeFalsy();
    expect(week4.metrics.find((m) => m.label === "Instructors hired")?.attention).toBeFalsy();
  });

  it("always appends the pipeline snapshot", () => {
    const groups = weeklyMetricGroups(1, metrics());
    expect(groups[groups.length - 1].title).toBe("Pipeline snapshot");
  });

  it("falls back to the operating snapshot beyond week 10", () => {
    const groups = weeklyMetricGroups(14, metrics());
    expect(groups[0].title).toMatch(/Week 10\+/);
  });
});

describe("buildImpactMeetingPrep", () => {
  it("assembles week, focus, groups, blockers and narrative prompts", () => {
    const start = new Date("2026-06-01T00:00:00.000Z");
    const prep = buildImpactMeetingPrep({
      metrics: metrics(),
      startDate: start,
      now: NOW,
      blockers: ["2 curricula overdue for review"],
    });
    expect(prep.weekNumber).toBe(4);
    expect(prep.focus).toMatch(/Confirm partners/);
    expect(prep.groups.length).toBeGreaterThanOrEqual(2);
    expect(prep.blockers).toContain("2 curricula overdue for review");
    expect(prep.narrativePrompts).toEqual(IMPACT_NARRATIVE_PROMPTS);
    expect(prep.weekStartISO).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
