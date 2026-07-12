import { describe, expect, it } from "vitest";

import { attainmentPercent, eightWeekBuckets, formatReportingPeriod, reportingPeriod } from "@/lib/chapters/operations-model";

describe("chapter operations model", () => {
  it("anchors weekly reports to Monday UTC and uses an exclusive end", () => {
    const period = reportingPeriod(new Date("2026-07-10T18:30:00Z"), "WEEKLY");
    expect(period.start.toISOString()).toBe("2026-07-06T00:00:00.000Z");
    expect(period.end.toISOString()).toBe("2026-07-13T00:00:00.000Z");
  });

  it("anchors monthly reports to the first day and handles month length", () => {
    const period = reportingPeriod(new Date("2026-02-18T09:00:00Z"), "MONTHLY");
    expect(period.start.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(period.end.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

  it("builds eight chronological non-overlapping week buckets", () => {
    const buckets = eightWeekBuckets(new Date("2026-07-10T18:30:00Z"));
    expect(buckets).toHaveLength(8);
    expect(buckets[0].start.toISOString()).toBe("2026-05-18T00:00:00.000Z");
    expect(buckets[7].start.toISOString()).toBe("2026-07-06T00:00:00.000Z");
    expect(buckets[0].end.toISOString()).toBe(buckets[1].start.toISOString());
  });

  it("calculates target attainment without dividing by zero", () => {
    expect(attainmentPercent(6, 8)).toBe(75);
    expect(attainmentPercent(10, 8)).toBe(125);
    expect(attainmentPercent(4, 0)).toBe(0);
  });

  it("formats an exclusive reporting range as inclusive UTC calendar dates", () => {
    expect(formatReportingPeriod(new Date("2026-07-06T00:00:00Z"), new Date("2026-07-13T00:00:00Z"))).toBe("Jul 6 – Jul 12, 2026");
  });
});
