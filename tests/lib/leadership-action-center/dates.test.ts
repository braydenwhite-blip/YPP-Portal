import { describe, expect, it } from "vitest";

import {
  daysUntil,
  endOfOperatingWeek,
  formatDueDate,
  isDueThisWeek,
  isDueToday,
  isOverdue,
  parseDateInput,
  startOfOperatingWeek,
  toDateInputValue,
} from "@/lib/leadership-action-center/dates";

describe("operating week helpers", () => {
  it("returns Monday 00:00 for any day in the week", () => {
    // Wednesday
    const wednesday = new Date(2026, 4, 13); // 2026-05-13
    const start = startOfOperatingWeek(wednesday);
    expect(start.getDay()).toBe(1); // Monday
    expect(start.getHours()).toBe(0);
    expect(start.getDate()).toBe(11);
  });

  it("returns Sunday 23:59 for end of week", () => {
    const wednesday = new Date(2026, 4, 13);
    const end = endOfOperatingWeek(wednesday);
    expect(end.getDay()).toBe(0); // Sunday
    expect(end.getHours()).toBe(23);
    expect(end.getDate()).toBe(17);
  });

  it("treats Sunday as the last day of the prior week", () => {
    const sunday = new Date(2026, 4, 17); // Sunday May 17
    const start = startOfOperatingWeek(sunday);
    expect(start.getDate()).toBe(11); // Monday May 11
  });
});

describe("due-date predicates", () => {
  const now = new Date(2026, 4, 13, 10, 0, 0);

  it("flags overdue items", () => {
    expect(isOverdue(new Date(2026, 4, 12), now)).toBe(true);
    expect(isOverdue(new Date(2026, 4, 13), now)).toBe(false);
    expect(isOverdue(null, now)).toBe(false);
  });

  it("flags due-today items", () => {
    expect(isDueToday(new Date(2026, 4, 13, 23, 0), now)).toBe(true);
    expect(isDueToday(new Date(2026, 4, 14), now)).toBe(false);
  });

  it("flags due-this-week items", () => {
    expect(isDueThisWeek(new Date(2026, 4, 11), now)).toBe(true);
    expect(isDueThisWeek(new Date(2026, 4, 17, 22, 0), now)).toBe(true);
    expect(isDueThisWeek(new Date(2026, 4, 18), now)).toBe(false);
  });

  it("computes daysUntil correctly", () => {
    expect(daysUntil(new Date(2026, 4, 13, 23, 0), now)).toBe(0);
    expect(daysUntil(new Date(2026, 4, 14), now)).toBe(1);
    expect(daysUntil(new Date(2026, 4, 11), now)).toBe(-2);
  });
});

describe("date input round-trip", () => {
  it("parses YYYY-MM-DD into a local Date", () => {
    const parsed = parseDateInput("2026-05-13");
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(4);
    expect(parsed?.getDate()).toBe(13);
  });

  it("rejects empty / invalid strings", () => {
    expect(parseDateInput("")).toBeNull();
    expect(parseDateInput("notadate")).toBeNull();
  });

  it("formats a Date back to YYYY-MM-DD", () => {
    expect(toDateInputValue(new Date(2026, 4, 13))).toBe("2026-05-13");
    expect(toDateInputValue(null)).toBe("");
  });

  it("formats due dates with a fallback", () => {
    expect(formatDueDate(null)).toBe("No deadline");
    expect(formatDueDate(new Date(2026, 4, 13))).toMatch(/May/);
  });
});
