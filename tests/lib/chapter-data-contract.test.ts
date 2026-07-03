import { describe, it, expect } from "vitest";
import {
  parseChapterSnapshotRows,
  snapshotRowToKpiInput,
  snapshotRowToWeeklyKpiRow,
} from "@/lib/chapters/data-contract";

const VALID_ROW = {
  chapterSlug: "springfield",
  weekStart: "2026-06-29",
  partnersContacted: 5,
  confirmedPartners: 2,
  instructorApplicants: "12", // workbook cells arrive as strings — coerced
  studentsEnrolled: 22,
  attendancePercent: 84,
};

describe("parseChapterSnapshotRows", () => {
  it("accepts valid rows and coerces numeric strings", () => {
    const { rows, errors } = parseChapterSnapshotRows([VALID_ROW]);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0].instructorApplicants).toBe(12);
  });

  it("returns per-row errors without rejecting the whole batch", () => {
    const { rows, errors } = parseChapterSnapshotRows([
      VALID_ROW,
      { weekStart: "2026-06-29" }, // no chapter identifier
      { chapterSlug: "x", weekStart: "June 29" }, // bad week format
      { chapterSlug: "y", weekStart: "2026-06-29", attendancePercent: 140 }, // out of range
    ]);
    expect(rows).toHaveLength(1);
    expect(errors.map((e) => e.index)).toEqual([1, 2, 3]);
    for (const e of errors) expect(e.message.length).toBeGreaterThan(0);
  });

  it("rejects non-array input with a single explanatory error", () => {
    const { rows, errors } = parseChapterSnapshotRows({ not: "an array" });
    expect(rows).toEqual([]);
    expect(errors).toEqual([{ index: -1, message: "Expected an array of snapshot rows" }]);
  });
});

describe("snapshot row mapping", () => {
  it("maps a contract row to the growth model's KPI input", () => {
    const { rows } = parseChapterSnapshotRows([VALID_ROW]);
    const input = snapshotRowToKpiInput(rows[0], 5);
    expect(input.weekStartISO).toBe("2026-06-29");
    expect(input.weekNumber).toBe(5);
    expect(input.values.confirmedPartners).toBe(2);
    expect(input.values.instructorsHired).toBeUndefined(); // absent stays absent
  });

  it("maps a contract row to the persisted weekly-KPI columns with zero defaults", () => {
    const { rows } = parseChapterSnapshotRows([VALID_ROW]);
    const dbRow = snapshotRowToWeeklyKpiRow(rows[0]);
    expect(dbRow.partnersContacted).toBe(5);
    expect(dbRow.feedbackCount).toBe(0);
    expect(dbRow.unresolvedBlockers).toBe(0);
  });
});
