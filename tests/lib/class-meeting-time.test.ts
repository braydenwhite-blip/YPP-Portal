import { describe, expect, it } from "vitest";

import { formatMeetingTimeRange } from "@/lib/class-meeting-time";

describe("formatMeetingTimeRange", () => {
  it("converts 24h ranges to 12h with timezone", () => {
    expect(formatMeetingTimeRange("16:00-17:00", "America/New_York")).toMatch(
      /^4–5 pm E[SD]T$/
    );
  });

  it("keeps minutes when needed", () => {
    expect(formatMeetingTimeRange("16:30-17:45")).toBe("4:30–5:45 pm ET");
  });

  it("handles cross-meridiem ranges", () => {
    expect(formatMeetingTimeRange("11:00-13:00")).toBe("11 am–1 pm ET");
  });

  it("formats a single clock time", () => {
    expect(formatMeetingTimeRange("14:00", "America/New_York")).toMatch(
      /^2 pm E[SD]T$/
    );
  });

  it("accepts already-12h input", () => {
    expect(formatMeetingTimeRange("2:00 PM - 3:00 PM")).toBe("2–3 pm ET");
  });
});
