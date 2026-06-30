import { describe, it, expect } from "vitest";
import {
  businessDaysBetween,
  daysBetween,
  hoursBetween,
  daysUntil,
  addDays,
  isoOrNull,
  toDate,
  isOverdue,
  relativeDueLabel,
} from "@/lib/automation/date-helpers";

const NOW = new Date("2026-06-24T12:00:00.000Z"); // a Wednesday

describe("automation/date-helpers", () => {
  it("counts business days Mon→Fri", () => {
    // Mon Jun 22 → Fri Jun 26 = Tue,Wed,Thu,Fri = 4
    expect(businessDaysBetween(new Date("2026-06-22T00:00:00Z"), new Date("2026-06-26T00:00:00Z"))).toBe(4);
    // weekend adds nothing: Fri → Mon = 1 (Mon)
    expect(businessDaysBetween(new Date("2026-06-26T00:00:00Z"), new Date("2026-06-29T00:00:00Z"))).toBe(1);
    expect(businessDaysBetween(NOW, NOW)).toBe(0);
  });

  it("computes whole-day and hour gaps", () => {
    expect(daysBetween(NOW, addDays(NOW, 3))).toBe(3);
    expect(daysBetween(addDays(NOW, 3), NOW)).toBe(-3);
    expect(hoursBetween(NOW, new Date(NOW.getTime() + 5 * 60 * 60 * 1000))).toBe(5);
    expect(hoursBetween(new Date(NOW.getTime() + 5 * 60 * 60 * 1000), NOW)).toBe(0);
  });

  it("computes daysUntil and overdue", () => {
    expect(daysUntil(addDays(NOW, 3), NOW)).toBe(3);
    expect(daysUntil(null, NOW)).toBeNull();
    expect(isOverdue(addDays(NOW, -1), NOW)).toBe(true);
    expect(isOverdue(addDays(NOW, 1), NOW)).toBe(false);
    expect(isOverdue(null, NOW)).toBe(false);
  });

  it("serializes dates safely", () => {
    expect(isoOrNull(null)).toBeNull();
    expect(isoOrNull(NOW)).toBe(NOW.toISOString());
    expect(toDate(null)).toBeNull();
    expect(toDate(NOW.toISOString())?.getTime()).toBe(NOW.getTime());
  });

  it("humanizes due labels", () => {
    expect(relativeDueLabel(NOW, NOW)).toBe("due today");
    expect(relativeDueLabel(addDays(NOW, 2), NOW)).toBe("due in 2 days");
    expect(relativeDueLabel(addDays(NOW, -3), NOW)).toBe("3 days overdue");
    expect(relativeDueLabel(null, NOW)).toBe("no due date");
  });
});
