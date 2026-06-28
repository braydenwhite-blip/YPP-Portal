import { describe, it, expect } from "vitest";
import {
  buildChapterKpiSnapshot,
  kpiSnapshotToRow,
  rowToKpiSnapshotInput,
  pickPreviousSnapshot,
  summarizeChapterGrowth,
  KPI_KEYS,
  type WeeklyKpiRow,
  type KpiSnapshotInput,
} from "@/lib/chapters/chapter-growth";

const FULL_VALUES = {
  partnersContacted: 8,
  partnerMeetingsScheduled: 3,
  confirmedPartners: 2,
  instructorApplicants: 25,
  interviewsCompleted: 6,
  instructorsHired: 3,
  curriculaSubmitted: 4,
  curriculaApproved: 2,
  classesCreated: 3,
  classesReady: 1,
  studentsEnrolled: 18,
  attendancePercent: 82,
  retentionPercent: 88,
  feedbackCollected: 9,
  unresolvedBlockers: 4,
} as const;

describe("kpiSnapshotToRow", () => {
  it("maps every KPI to a column, renaming feedbackCollected → feedbackCount", () => {
    const snap = buildChapterKpiSnapshot({ weekStartISO: "2026-06-22", weekNumber: 5, values: FULL_VALUES });
    const row = kpiSnapshotToRow(snap);
    expect(row.feedbackCount).toBe(9);
    expect(row.partnersContacted).toBe(8);
    expect(row.unresolvedBlockers).toBe(4);
    // exactly the 15 numeric columns, all numbers
    expect(Object.keys(row)).toHaveLength(KPI_KEYS.length);
    expect(Object.values(row).every((v) => typeof v === "number")).toBe(true);
  });
});

describe("rowToKpiSnapshotInput", () => {
  it("round-trips a snapshot through the persisted row shape", () => {
    const snap = buildChapterKpiSnapshot({ weekStartISO: "2026-06-22", weekNumber: 5, values: FULL_VALUES });
    const row = kpiSnapshotToRow(snap);
    const back = rowToKpiSnapshotInput(row, { weekStartISO: "2026-06-15", weekNumber: 4 });
    const rebuilt = buildChapterKpiSnapshot(back);
    expect(rebuilt.values).toEqual(snap.values); // values preserved exactly
    expect(rebuilt.weekNumber).toBe(4);
  });
});

describe("pickPreviousSnapshot", () => {
  const persisted: KpiSnapshotInput = { weekStartISO: "p", weekNumber: 4, values: { confirmedPartners: 5 } };
  const reconstructed: KpiSnapshotInput = { weekStartISO: "r", weekNumber: 4, values: { confirmedPartners: 1 } };

  it("prefers a persisted snapshot", () => {
    expect(pickPreviousSnapshot(persisted, reconstructed)).toMatchObject({ source: "persisted", previous: persisted });
  });
  it("falls back to reconstruction", () => {
    expect(pickPreviousSnapshot(null, reconstructed)).toMatchObject({ source: "reconstructed", previous: reconstructed });
  });
  it("reports none when neither exists", () => {
    expect(pickPreviousSnapshot(null, null)).toMatchObject({ source: "none", previous: null });
  });
});

describe("growth comparison using a persisted snapshot baseline", () => {
  it("computes week-over-week trend from the persisted prior week", () => {
    // Last week persisted as a real row, then mapped back into the baseline.
    const lastWeekRow: WeeklyKpiRow = kpiSnapshotToRow(
      buildChapterKpiSnapshot({ weekStartISO: "2026-06-15", weekNumber: 4, values: { confirmedPartners: 1, studentsEnrolled: 6, feedbackCollected: 2 } })
    );
    const previous = rowToKpiSnapshotInput(lastWeekRow, { weekStartISO: "2026-06-15", weekNumber: 4 });
    const current: KpiSnapshotInput = {
      weekStartISO: "2026-06-22",
      weekNumber: 5,
      values: { confirmedPartners: 2, studentsEnrolled: 12, feedbackCollected: 5 },
    };

    const summary = summarizeChapterGrowth({ weekNumber: 5, current, previous });
    const enrolled = summary.changes.find((c) => c.key === "studentsEnrolled")!;
    expect(enrolled).toMatchObject({ previous: 6, current: 12, delta: 6, direction: "good" });
    const feedback = summary.changes.find((c) => c.key === "feedbackCollected")!;
    expect(feedback.previous).toBe(2); // feedbackCount → feedbackCollected mapped back correctly
    expect(summary.status).not.toBe("No Baseline Yet");
  });
});
