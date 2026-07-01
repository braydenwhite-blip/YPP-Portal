import { describe, it, expect } from "vitest";

import {
  bucketDatesByWeek,
  bucketWeightedByWeek,
  trailingWeekStarts,
} from "@/lib/data-360/week-buckets";
import { weekStartFor, addWeeks } from "@/lib/weekly-meetings/week";

// A fixed Wednesday so the reporting week (Mon 00:00 UTC) is deterministic.
const NOW = new Date("2026-06-24T12:00:00.000Z");

describe("trailingWeekStarts", () => {
  it("returns `weeks` ascending week starts ending at the current week", () => {
    const starts = trailingWeekStarts(NOW, 4);
    expect(starts).toHaveLength(4);
    // ascending
    for (let i = 1; i < starts.length; i += 1) {
      expect(starts[i].getTime()).toBeGreaterThan(starts[i - 1].getTime());
    }
    // last bucket is the week containing NOW
    expect(starts[starts.length - 1].getTime()).toBe(weekStartFor(NOW).getTime());
  });
});

describe("bucketDatesByWeek", () => {
  it("produces a dense series of the requested length", () => {
    const points = bucketDatesByWeek([], NOW, 12);
    expect(points).toHaveLength(12);
    expect(points.every((p) => p.value === 0)).toBe(true);
  });

  it("counts a date in the current week into the last bucket", () => {
    const points = bucketDatesByWeek([NOW], NOW, 6);
    expect(points[points.length - 1].value).toBe(1);
    expect(points.slice(0, -1).every((p) => p.value === 0)).toBe(true);
  });

  it("places a date from one week ago into the second-to-last bucket", () => {
    const oneWeekAgo = addWeeks(weekStartFor(NOW), -1);
    const points = bucketDatesByWeek([oneWeekAgo], NOW, 6);
    expect(points[points.length - 2].value).toBe(1);
  });

  it("excludes dates outside the trailing window", () => {
    const wayBefore = addWeeks(weekStartFor(NOW), -20);
    const points = bucketDatesByWeek([wayBefore, NOW, NOW], NOW, 6);
    const total = points.reduce((s, p) => s + p.value, 0);
    expect(total).toBe(2); // only the two NOW dates land in-window
  });
});

describe("bucketWeightedByWeek", () => {
  it("sums weights by default", () => {
    const points = bucketWeightedByWeek(
      [
        { date: NOW, weight: 3 },
        { date: NOW, weight: 4 },
      ],
      NOW,
      4
    );
    expect(points[points.length - 1].value).toBe(7);
  });

  it("averages weights when average=true", () => {
    const points = bucketWeightedByWeek(
      [
        { date: NOW, weight: 80 },
        { date: NOW, weight: 100 },
      ],
      NOW,
      4,
      true
    );
    expect(points[points.length - 1].value).toBe(90);
  });
});
