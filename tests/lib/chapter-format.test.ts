import { describe, it, expect } from "vitest";
import { relativeAgo, shortDate } from "@/lib/chapters/format";

const NOW = new Date("2026-06-24T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

describe("relativeAgo", () => {
  it("handles null and future dates", () => {
    expect(relativeAgo(null, NOW)).toBe("—");
    expect(relativeAgo(new Date(NOW.getTime() + DAY), NOW)).toBe("Just now");
  });
  it("renders today / yesterday / days", () => {
    expect(relativeAgo(NOW, NOW)).toBe("Today");
    expect(relativeAgo(new Date(NOW.getTime() - DAY), NOW)).toBe("Yesterday");
    expect(relativeAgo(new Date(NOW.getTime() - 5 * DAY), NOW)).toBe("5 days ago");
    expect(relativeAgo(new Date(NOW.getTime() - 13 * DAY), NOW)).toBe("13 days ago");
  });
  it("rolls into weeks then months", () => {
    expect(relativeAgo(new Date(NOW.getTime() - 14 * DAY), NOW)).toBe("2 weeks ago");
    expect(relativeAgo(new Date(NOW.getTime() - 75 * DAY), NOW)).toBe("2 months ago");
  });
});

describe("shortDate", () => {
  it("formats a stable UTC date", () => {
    expect(shortDate(new Date("2025-06-15T00:00:00.000Z"))).toBe("Jun 15, 2025");
    expect(shortDate(new Date("2025-01-01T00:00:00.000Z"))).toBe("Jan 1, 2025");
  });
  it("falls back to TBD when missing", () => {
    expect(shortDate(null)).toBe("TBD");
  });
});
