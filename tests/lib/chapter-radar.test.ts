import { describe, it, expect } from "vitest";
import {
  buildChapterRadarRow,
  deriveChapterBottlenecks,
  emptyRadarCounts,
  summarizeChapterRadar,
  STALLED_ACTIVITY_DAYS,
  type ChapterRadarInput,
} from "@/lib/chapters/radar";

function input(overrides: Partial<ChapterRadarInput> = {}): ChapterRadarInput {
  return {
    id: "ch1",
    lifecycleStatus: "ACTIVE",
    healthLabel: "ON_TRACK",
    counts: {
      ...emptyRadarCounts(),
      confirmedPartners: 8,
      partnersInFlight: 2,
      instructorApplicants: 30,
      instructorsHired: 15,
      studentsEnrolled: 80,
      classesTotal: 5,
      classesRunning: 3,
    },
    weeklyUpdate: "SUBMITTED",
    daysSinceActivity: 1,
    ...overrides,
  };
}

describe("deriveChapterBottlenecks", () => {
  it("a healthy operating chapter has no bottlenecks", () => {
    expect(deriveChapterBottlenecks(input())).toEqual([]);
  });

  it("no confirmed partners on an operating chapter is a partner bottleneck", () => {
    const bs = deriveChapterBottlenecks(
      input({ counts: { ...input().counts, confirmedPartners: 0, partnersInFlight: 4 } })
    );
    expect(bs.some((b) => b.key === "partners" && b.label === "No confirmed partners")).toBe(true);
  });

  it("3+ overdue partner follow-ups flags follow-up pile-up regardless of stage", () => {
    const bs = deriveChapterBottlenecks(
      input({
        lifecycleStatus: "LAUNCHING",
        counts: { ...input().counts, partnerFollowUpsOverdue: 4 },
      })
    );
    expect(bs.some((b) => b.label === "Needs partner follow-up")).toBe(true);
  });

  it("classes planned with zero instructors hired is an instructor bottleneck", () => {
    const bs = deriveChapterBottlenecks(
      input({ counts: { ...input().counts, instructorsHired: 0 } })
    );
    expect(bs.some((b) => b.key === "instructors" && b.label === "Classes need instructors")).toBe(true);
  });

  it("partners and instructors ready but nothing running is a class bottleneck", () => {
    const bs = deriveChapterBottlenecks(
      input({ counts: { ...input().counts, classesRunning: 0 } })
    );
    expect(bs.some((b) => b.key === "classes" && b.label === "Classes not running yet")).toBe(true);
  });

  it("classes with zero enrollment is a student bottleneck", () => {
    const bs = deriveChapterBottlenecks(
      input({ counts: { ...input().counts, studentsEnrolled: 0 } })
    );
    expect(bs.some((b) => b.key === "students" && b.label === "No students enrolled")).toBe(true);
  });

  it("launching chapters are not judged on operating bottlenecks", () => {
    const bs = deriveChapterBottlenecks(
      input({
        lifecycleStatus: "LAUNCHING",
        counts: { ...emptyRadarCounts() },
      })
    );
    expect(bs).toEqual([]);
  });
});

describe("buildChapterRadarRow", () => {
  it("a strong, up-to-date chapter is ready to scale with no attention reasons", () => {
    const row = buildChapterRadarRow(input());
    expect(row.needsAttention).toBe(false);
    expect(row.attentionReasons).toEqual([]);
    expect(row.readyToScale).toBe(true);
    expect(row.expectations.readyToScale).toBe(true);
  });

  it("a missing weekly update needs attention and blocks ready-to-scale", () => {
    const row = buildChapterRadarRow(input({ weeklyUpdate: "MISSING" }));
    expect(row.needsAttention).toBe(true);
    expect(row.attentionReasons).toContain("Missing weekly update");
    expect(row.readyToScale).toBe(false);
  });

  it("decisions, overdue actions, support requests, and stalls all become plain reasons", () => {
    const row = buildChapterRadarRow(
      input({
        weeklyUpdate: "DRAFT",
        daysSinceActivity: STALLED_ACTIVITY_DAYS + 6,
        counts: {
          ...input().counts,
          decisionsNeeded: 2,
          overdueActions: 1,
          openSupportRequests: 1,
        },
      })
    );
    expect(row.attentionReasons).toContain("Weekly update not submitted");
    expect(row.attentionReasons).toContain("2 decisions needed");
    expect(row.attentionReasons).toContain("1 overdue action");
    expect(row.attentionReasons).toContain("Support needed from Global");
    expect(row.attentionReasons).toContain(`No recent activity (${STALLED_ACTIVITY_DAYS + 6} days)`);
  });

  it("an unhealthy chapter needs attention even with no counted reasons", () => {
    const row = buildChapterRadarRow(input({ healthLabel: "AT_RISK" }));
    expect(row.needsAttention).toBe(true);
    expect(row.readyToScale).toBe(false);
  });
});

describe("summarizeChapterRadar", () => {
  it("rolls the rows into national tiles", () => {
    const rows = [
      buildChapterRadarRow(input()),
      buildChapterRadarRow(input({ id: "ch2", weeklyUpdate: "MISSING" })),
      buildChapterRadarRow(
        input({
          id: "ch3",
          counts: { ...input().counts, confirmedPartners: 0, decisionsNeeded: 1 },
        })
      ),
    ];
    const s = summarizeChapterRadar(rows);
    expect(s.readyToScale).toBe(1);
    expect(s.missingWeeklyUpdate).toBe(1);
    expect(s.decisionsNeeded).toBe(1);
    expect(s.partnerBottlenecks).toBe(1);
    expect(s.needsAttention).toBe(2);
  });
});
