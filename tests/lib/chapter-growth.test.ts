import { describe, it, expect } from "vitest";
import {
  goalRowStatus,
  goalEvidenceRow,
  trendEvidenceRow,
  growthEvidenceRows,
  summarizeGrowth,
  growthHealth,
  growthNeedsYou,
  growthInsights,
  growthNextAction,
  type GoalRecord,
  type GrowthSignals,
  type TrendRecord,
} from "@/lib/chapters/chapter-growth";

const NOW = new Date("2026-06-24T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

function goal(o: Partial<GoalRecord> = {}): GoalRecord {
  return {
    id: "g1",
    title: "Enroll students",
    currentValue: 5,
    targetValue: 10,
    unit: "students",
    status: "ACTIVE",
    deadline: null,
    ...o,
  };
}

function signals(o: Partial<GrowthSignals> = {}): GrowthSignals {
  return {
    weekNumber: 3,
    focus: "Partner outreach",
    impactSubmittedThisWeek: true,
    hasUpcomingMeeting: true,
    lastMeetingDaysAgo: 3,
    launchTargetPassed: false,
    launched: true,
    ...o,
  };
}

describe("goalRowStatus", () => {
  it("classifies done / behind / upcoming / on_track", () => {
    expect(goalRowStatus(goal({ currentValue: 10 }), NOW)).toBe("done");
    expect(goalRowStatus(goal({ status: "COMPLETED" }), NOW)).toBe("done");
    expect(goalRowStatus(goal({ currentValue: 0 }), NOW)).toBe("upcoming");
    expect(goalRowStatus(goal({ deadline: new Date(NOW.getTime() - DAY) }), NOW)).toBe("behind");
    expect(goalRowStatus(goal(), NOW)).toBe("on_track");
  });
});

describe("goalEvidenceRow", () => {
  it("shows current, target, and progress", () => {
    expect(goalEvidenceRow(goal(), NOW)).toMatchObject({
      label: "Enroll students",
      current: "5 students",
      target: "10 students",
      trend: "50% of target",
      status: "on_track",
    });
  });
});

describe("trendEvidenceRow", () => {
  it("renders week-over-week deltas with direction", () => {
    expect(trendEvidenceRow({ key: "members", label: "Members", current: 12, previous: 9, unit: "" })).toMatchObject({
      current: "12",
      trend: "▲ +3",
      trendTone: "good",
      status: "on_track",
    });
    expect(trendEvidenceRow({ key: "ret", label: "Retention", current: 70, previous: 80, unit: "%" })).toMatchObject({
      trend: "▼ -10%",
      trendTone: "warn",
      status: "behind",
    });
    expect(trendEvidenceRow({ key: "new", label: "New", current: 3, previous: null, unit: "" }).trend).toBe(
      "New this week"
    );
    expect(trendEvidenceRow({ key: "s", label: "S", current: 5, previous: 5, unit: "" }).trend).toBe("Steady");
  });
});

describe("growthEvidenceRows", () => {
  it("lists goals first, then KPI trends, skipping cancelled goals", () => {
    const rows = growthEvidenceRows(
      [goal({ id: "g1" }), goal({ id: "g2", status: "CANCELLED" })],
      [{ key: "members", label: "Members", current: 12, previous: 9, unit: "" }],
      NOW
    );
    expect(rows.map((r) => r.id)).toEqual(["g1", "kpi:members"]);
  });
});

describe("summarizeGrowth + health", () => {
  it("counts goal states", () => {
    const s = summarizeGrowth([goal(), goal({ id: "g2", currentValue: 10 })], signals(), NOW);
    expect(s.goalsTotal).toBe(2);
    expect(s.goalsOnTrack).toBe(1);
    expect(s.goalsDone).toBe(1);
    expect(s.goalsBehind).toBe(0);
    expect(s.weekNumber).toBe(3);
  });
  it("maps chapter health onto the room", () => {
    expect(growthHealth("ON_TRACK", []).status).toBe("strong");
    expect(growthHealth("NEEDS_SUPPORT", ["x"]).status).toBe("needs_attention");
    expect(growthHealth("AT_RISK", ["Launch target has passed"]).status).toBe("critical");
    expect(growthHealth("AT_RISK", ["a", "b", "c", "d"]).reasons).toHaveLength(3);
  });
});

describe("growthNeedsYou", () => {
  it("flags launch, meeting cadence, impact, and behind goals", () => {
    expect(growthNeedsYou([], signals({ launchTargetPassed: true, launched: false }), NOW).some((i) => i.key === "growth-launch-overdue" && i.severity === "critical")).toBe(true);
    expect(growthNeedsYou([], signals({ hasUpcomingMeeting: false }), NOW).some((i) => i.key === "growth-no-meeting")).toBe(true);
    expect(growthNeedsYou([], signals({ impactSubmittedThisWeek: false }), NOW).some((i) => i.key === "growth-impact-missing")).toBe(true);
    expect(
      growthNeedsYou([goal({ deadline: new Date(NOW.getTime() - DAY), currentValue: 1 })], signals(), NOW).some(
        (i) => i.key === "growth-goal-behind:g1"
      )
    ).toBe(true);
  });
  it("is quiet when everything is healthy", () => {
    expect(growthNeedsYou([goal()], signals(), NOW)).toHaveLength(0);
  });
});

describe("growthInsights + nextAction", () => {
  it("leads insights with the week focus", () => {
    expect(growthInsights(summarizeGrowth([], signals(), NOW), [])[0].text).toMatch(/Week 3/);
  });
  it("prioritises the next action", () => {
    expect(growthNextAction(signals({ launchTargetPassed: true, launched: false }), summarizeGrowth([], signals(), NOW)).text).toMatch(/launch plan/);
    expect(growthNextAction(signals({ impactSubmittedThisWeek: false }), summarizeGrowth([], signals(), NOW)).cta).toBe("Write Impact");
  });
});
