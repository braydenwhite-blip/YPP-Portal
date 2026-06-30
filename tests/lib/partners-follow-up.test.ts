import { describe, it, expect } from "vitest";

import {
  addBusinessDays,
  businessDaysBetween,
  isWeekend,
  isFollowUpDue,
  daysOverdue,
  nextOutreachFollowUp,
  nextMeetingFollowUp,
  INITIAL_FOLLOW_UP_BUSINESS_DAYS,
} from "@/lib/partners/follow-up";

// 2026-06-01 is a Monday (UTC); 2026-06-05 is a Friday; 06/06 Sat, 06/07 Sun.
const MON = new Date("2026-06-01T09:30:00.000Z");
const FRI = new Date("2026-06-05T14:00:00.000Z");
const SAT = new Date("2026-06-06T10:00:00.000Z");

describe("isWeekend", () => {
  it("flags Saturday and Sunday, not weekdays", () => {
    expect(isWeekend(MON)).toBe(false);
    expect(isWeekend(FRI)).toBe(false);
    expect(isWeekend(SAT)).toBe(true);
    expect(isWeekend(new Date("2026-06-07T00:00:00.000Z"))).toBe(true); // Sun
  });
});

describe("addBusinessDays", () => {
  it("Monday + 5 business days lands on the next Monday", () => {
    expect(addBusinessDays(MON, 5).toISOString()).toBe("2026-06-08T09:30:00.000Z");
  });

  it("Friday + 5 business days lands on the next Friday (skips the weekend)", () => {
    expect(addBusinessDays(FRI, 5).toISOString()).toBe("2026-06-12T14:00:00.000Z");
  });

  it("Friday + 1 business day rolls over the weekend to Monday", () => {
    expect(addBusinessDays(FRI, 1).toISOString()).toBe("2026-06-08T14:00:00.000Z");
  });

  it("counting from a Saturday skips Sunday to the next weekday", () => {
    expect(addBusinessDays(SAT, 1).toISOString()).toBe("2026-06-08T10:00:00.000Z");
  });

  it("preserves the time of day", () => {
    const t = new Date("2026-06-01T23:17:42.000Z");
    expect(addBusinessDays(t, 5).toISOString()).toBe("2026-06-08T23:17:42.000Z");
  });

  it("returns a copy for non-positive / non-finite counts", () => {
    expect(addBusinessDays(MON, 0).toISOString()).toBe(MON.toISOString());
    expect(addBusinessDays(MON, -3).toISOString()).toBe(MON.toISOString());
    expect(addBusinessDays(MON, Number.NaN).toISOString()).toBe(MON.toISOString());
  });

  it("does not mutate the input date", () => {
    const before = MON.toISOString();
    addBusinessDays(MON, 5);
    expect(MON.toISOString()).toBe(before);
  });
});

describe("businessDaysBetween", () => {
  it("counts weekdays exclusive of the start, inclusive of the end", () => {
    // Mon -> next Mon spans Tue,Wed,Thu,Fri,Mon = 5 business days.
    expect(businessDaysBetween(MON, new Date("2026-06-08T09:30:00.000Z"))).toBe(5);
  });
  it("is zero when end is not after start", () => {
    expect(businessDaysBetween(MON, MON)).toBe(0);
    expect(businessDaysBetween(FRI, MON)).toBe(0);
  });
});

describe("scheduling helpers", () => {
  it("nextOutreachFollowUp uses the 5 business-day default", () => {
    expect(nextOutreachFollowUp(MON).toISOString()).toBe(
      addBusinessDays(MON, INITIAL_FOLLOW_UP_BUSINESS_DAYS).toISOString()
    );
    expect(INITIAL_FOLLOW_UP_BUSINESS_DAYS).toBe(5);
  });
  it("nextMeetingFollowUp is one business day out", () => {
    expect(nextMeetingFollowUp(FRI).toISOString()).toBe("2026-06-08T14:00:00.000Z");
  });
});

describe("isFollowUpDue / daysOverdue", () => {
  const now = new Date("2026-06-10T12:00:00.000Z");
  it("is due when the scheduled moment has passed", () => {
    expect(isFollowUpDue(new Date("2026-06-09T12:00:00.000Z"), now)).toBe(true);
    expect(isFollowUpDue(now, now)).toBe(true); // exactly due
  });
  it("is not due in the future or when unscheduled", () => {
    expect(isFollowUpDue(new Date("2026-06-11T12:00:00.000Z"), now)).toBe(false);
    expect(isFollowUpDue(null, now)).toBe(false);
    expect(isFollowUpDue(undefined, now)).toBe(false);
  });
  it("daysOverdue reports whole days late, 0 when not due", () => {
    expect(daysOverdue(new Date("2026-06-08T12:00:00.000Z"), now)).toBe(2);
    expect(daysOverdue(new Date("2026-06-11T12:00:00.000Z"), now)).toBe(0);
    expect(daysOverdue(null, now)).toBe(0);
  });
});
