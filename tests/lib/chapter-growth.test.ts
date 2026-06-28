import { describe, it, expect } from "vitest";
import {
  buildChapterKpiSnapshot,
  compareKpiSnapshots,
  getPlaybookTargetsForWeek,
  getChapterGrowthStatus,
  getChapterGrowthSignals,
  getChapterGrowthNextAction,
  summarizeChapterGrowth,
  KPI_KEYS,
  type KpiSnapshot,
  type KpiSnapshotInput,
} from "@/lib/chapters/chapter-growth";

function snap(values: Partial<Record<(typeof KPI_KEYS)[number], number>>, weekNumber = 5): KpiSnapshot {
  return buildChapterKpiSnapshot({ weekStartISO: "2026-06-22", weekNumber, values });
}

describe("buildChapterKpiSnapshot", () => {
  it("normalizes a partial input to all KPI keys (missing → 0)", () => {
    const s = buildChapterKpiSnapshot({ weekStartISO: "2026-06-22", weekNumber: 4, values: { confirmedPartners: 2 } });
    expect(s.values.confirmedPartners).toBe(2);
    for (const k of KPI_KEYS) expect(typeof s.values[k]).toBe("number");
    expect(s.values.studentsEnrolled).toBe(0);
  });
});

describe("compareKpiSnapshots", () => {
  it("reports per-KPI deltas, trends, and direction", () => {
    const current = snap({ confirmedPartners: 3, unresolvedBlockers: 2 });
    const previous = snap({ confirmedPartners: 1, unresolvedBlockers: 5 });
    const changes = compareKpiSnapshots(current, previous);
    const partners = changes.find((c) => c.key === "confirmedPartners")!;
    expect(partners).toMatchObject({ delta: 2, trend: "up", direction: "good" });
    // Fewer blockers is good even though the number went down.
    const blockers = changes.find((c) => c.key === "unresolvedBlockers")!;
    expect(blockers).toMatchObject({ delta: -3, trend: "down", direction: "good", lowerIsBetter: true });
  });
  it("marks every metric as new with no baseline", () => {
    const changes = compareKpiSnapshots(snap({ confirmedPartners: 3 }), null);
    expect(changes.every((c) => c.trend === "new" && c.previous === null)).toBe(true);
  });
});

describe("getPlaybookTargetsForWeek", () => {
  it("returns cumulative targets active by the given week", () => {
    const w4 = getPlaybookTargetsForWeek(4);
    const byKey = Object.fromEntries(w4.map((t) => [t.key, t.target]));
    expect(byKey.confirmedPartners).toBe(1);
    expect(byKey.instructorApplicants).toBe(25); // week-4 threshold supersedes week-2's 5
    expect(byKey.instructorsHired).toBe(3);
  });
  it("has fewer targets in early weeks", () => {
    expect(getPlaybookTargetsForWeek(1).length).toBeLessThan(getPlaybookTargetsForWeek(9).length);
  });
});

describe("getChapterGrowthStatus", () => {
  const targets = getPlaybookTargetsForWeek(5);
  it("returns No Baseline Yet with no prior snapshot", () => {
    const current = snap({ confirmedPartners: 1 });
    expect(getChapterGrowthStatus(compareKpiSnapshots(current, null), targets, current)).toBe("No Baseline Yet");
  });
  it("returns Slipping when metrics regress", () => {
    // Two regressions (not enough for Critical) and no gains → net slide.
    const current = snap({ confirmedPartners: 1, instructorsHired: 1, studentsEnrolled: 8 });
    const previous = snap({ confirmedPartners: 3, instructorsHired: 4, studentsEnrolled: 8 });
    expect(getChapterGrowthStatus(compareKpiSnapshots(current, previous), targets, current)).toBe("Slipping");
  });
  it("returns Critical on a broad collapse", () => {
    const current = snap({ confirmedPartners: 0, instructorsHired: 0, studentsEnrolled: 0, curriculaApproved: 0 });
    const previous = snap({ confirmedPartners: 3, instructorsHired: 4, studentsEnrolled: 8, curriculaApproved: 2 });
    expect(getChapterGrowthStatus(compareKpiSnapshots(current, previous), targets, current)).toBe("Critical");
  });
  it("returns Improving when progress outweighs regression", () => {
    const current = snap({ confirmedPartners: 3, instructorsHired: 4, studentsEnrolled: 9 });
    const previous = snap({ confirmedPartners: 1, instructorsHired: 2, studentsEnrolled: 9 });
    expect(getChapterGrowthStatus(compareKpiSnapshots(current, previous), targets, current)).toBe("Improving");
  });
});

describe("getChapterGrowthSignals", () => {
  it("separates growth from regression signals", () => {
    const changes = compareKpiSnapshots(
      snap({ confirmedPartners: 3, studentsEnrolled: 2 }),
      snap({ confirmedPartners: 1, studentsEnrolled: 8 })
    );
    const { growth, regression } = getChapterGrowthSignals(changes);
    expect(growth.some((s) => /Confirmed partners up 2/.test(s))).toBe(true);
    expect(regression.some((s) => /Students enrolled down 6/.test(s))).toBe(true);
  });
});

describe("getChapterGrowthNextAction", () => {
  it("guides toward the next missed target", () => {
    const current = snap({ confirmedPartners: 0 }, 5);
    const targets = getPlaybookTargetsForWeek(5);
    const changes = compareKpiSnapshots(current, snap({ confirmedPartners: 0 }, 4));
    const action = getChapterGrowthNextAction({ status: "Flat", changes, targets, current, weekNumber: 5 });
    expect(action.length).toBeGreaterThan(0);
  });
  it("explains the no-baseline case", () => {
    const current = snap({}, 1);
    const action = getChapterGrowthNextAction({
      status: "No Baseline Yet",
      changes: compareKpiSnapshots(current, null),
      targets: getPlaybookTargetsForWeek(1),
      current,
      weekNumber: 1,
    });
    expect(action).toMatch(/week-over-week/);
  });
});

describe("summarizeChapterGrowth", () => {
  it("assembles a deterministic summary", () => {
    const current: KpiSnapshotInput = {
      weekStartISO: "2026-06-22",
      weekNumber: 5,
      values: { confirmedPartners: 2, instructorsHired: 3, studentsEnrolled: 12, curriculaApproved: 1, classesCreated: 2 },
    };
    const previous: KpiSnapshotInput = {
      weekStartISO: "2026-06-15",
      weekNumber: 4,
      values: { confirmedPartners: 1, instructorsHired: 2, studentsEnrolled: 6, curriculaApproved: 0, classesCreated: 1 },
    };
    const a = summarizeChapterGrowth({ weekNumber: 5, current, previous });
    const b = summarizeChapterGrowth({ weekNumber: 5, current, previous });
    expect(a).toEqual(b); // deterministic
    expect(a.changes).toHaveLength(KPI_KEYS.length);
    expect(a.evidence.length).toBeGreaterThan(0);
    expect(a.milestones.find((m) => m.label === "3+ instructors hired")?.achieved).toBe(true);
    expect(a.status).not.toBe("No Baseline Yet");
  });

  it("reports No Baseline Yet for a brand-new chapter", () => {
    const current: KpiSnapshotInput = { weekStartISO: "2026-06-22", weekNumber: 1, values: { partnersContacted: 3 } };
    const s = summarizeChapterGrowth({ weekNumber: 1, current, previous: null });
    expect(s.status).toBe("No Baseline Yet");
    expect(s.previous).toBeNull();
  });
});
