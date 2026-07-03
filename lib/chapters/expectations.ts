// Chapter operating expectations — the steady-state baselines every chapter
// works toward (distinct from the 10-week playbook ramp in chapter-growth.ts,
// which paces a launch). These power the "progress toward expectations" strip,
// the Impact Meeting brief, and the leadership "ready to scale" signal.
//
// The numbers are progress language, not gates: a chapter below a baseline is
// "building toward" it, never failed. Pure + deterministic, fully unit testable.

export type ChapterExpectationKey =
  | "confirmedPartners"
  | "instructorApplicants"
  | "instructorsHired"
  | "studentsEnrolled"
  | "classesRunning";

export type ChapterExpectation = {
  key: ChapterExpectationKey;
  label: string;
  /** The baseline every chapter works toward. */
  min: number;
  /** The stretch end of the expected range (null = open-ended "N+"). */
  stretch: number | null;
};

/** Baseline expectations for a full-strength chapter. */
export const CHAPTER_EXPECTATIONS: ChapterExpectation[] = [
  { key: "confirmedPartners", label: "Confirmed partners", min: 8, stretch: 10 },
  { key: "instructorApplicants", label: "Instructor applicants", min: 30, stretch: null },
  { key: "instructorsHired", label: "Instructors hired", min: 15, stretch: 20 },
  { key: "studentsEnrolled", label: "Students enrolled", min: 80, stretch: 100 },
  { key: "classesRunning", label: "Classes running", min: 1, stretch: null },
];

export type ExpectationStatus = "met" | "close" | "building";

export const EXPECTATION_STATUS_LABELS: Record<ExpectationStatus, string> = {
  met: "Met",
  close: "Close",
  building: "Building",
};

export type ExpectationProgress = {
  key: ChapterExpectationKey;
  label: string;
  current: number;
  min: number;
  stretch: number | null;
  /** Progress toward the baseline, 0–100 (capped). */
  percent: number;
  status: ExpectationStatus;
  /** Plain progress phrase, e.g. "12 of 15" or "8 of 8–10". */
  summary: string;
};

export type ChapterExpectationCounts = Record<ChapterExpectationKey, number>;

/** Range phrase for an expectation target, e.g. "8–10" or "30+". */
export function expectationTargetLabel(e: ChapterExpectation): string {
  if (e.stretch != null && e.stretch !== e.min) return `${e.min}–${e.stretch}`;
  return `${e.min}+`;
}

/** Progress rows for every baseline expectation, in canonical order. */
export function buildExpectationsProgress(counts: Partial<ChapterExpectationCounts>): ExpectationProgress[] {
  return CHAPTER_EXPECTATIONS.map((e) => {
    const current = Math.max(0, counts[e.key] ?? 0);
    const percent = e.min > 0 ? Math.min(100, Math.round((current / e.min) * 100)) : 100;
    const status: ExpectationStatus = current >= e.min ? "met" : percent >= 60 ? "close" : "building";
    return {
      key: e.key,
      label: e.label,
      current,
      min: e.min,
      stretch: e.stretch,
      percent,
      status,
      summary: `${current} of ${expectationTargetLabel(e)}`,
    };
  });
}

export type ChapterExpectationsSummary = {
  rows: ExpectationProgress[];
  metCount: number;
  total: number;
  /** All baseline expectations met — the chapter is operating at full strength. */
  readyToScale: boolean;
  /** One-line progress statement, e.g. "3 of 5 chapter expectations met". */
  headline: string;
};

/** Roll expectation progress into the chapter-level summary. */
export function summarizeChapterExpectations(
  counts: Partial<ChapterExpectationCounts>
): ChapterExpectationsSummary {
  const rows = buildExpectationsProgress(counts);
  const metCount = rows.filter((r) => r.status === "met").length;
  const readyToScale = metCount === rows.length;
  return {
    rows,
    metCount,
    total: rows.length,
    readyToScale,
    headline: readyToScale
      ? "All chapter expectations met — ready to scale"
      : `${metCount} of ${rows.length} chapter expectations met`,
  };
}
