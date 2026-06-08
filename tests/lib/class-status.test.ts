import { describe, it, expect } from "vitest";
import {
  derivePublicClassStatus,
  formatScheduleSummary,
  formatClassDateRange,
  formatMeetingDays,
} from "@/lib/class-status";

const NOW = new Date("2026-06-08T12:00:00Z");
const inDays = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

describe("derivePublicClassStatus", () => {
  const base = {
    status: "PUBLISHED" as const,
    enrollmentOpen: true,
    capacity: 20,
    enrolledCount: 5,
    startDate: inDays(30),
    endDate: inDays(60),
    now: NOW,
  };

  it("is OPEN with room and a distant start", () => {
    const s = derivePublicClassStatus(base);
    expect(s.status).toBe("OPEN");
    expect(s.canSignUp).toBe(true);
    expect(s.isWaitlist).toBe(false);
    expect(s.cta).toBe("Sign up");
  });

  it("is ALMOST_FULL when few seats remain", () => {
    const s = derivePublicClassStatus({ ...base, enrolledCount: 18 });
    expect(s.status).toBe("ALMOST_FULL");
    expect(s.spotsLeft).toBe(2);
    expect(s.helper).toMatch(/2 spots left/);
    expect(s.canSignUp).toBe(true);
  });

  it("is FULL_WAITLIST when at capacity (waitlist always available)", () => {
    const s = derivePublicClassStatus({ ...base, enrolledCount: 20 });
    expect(s.status).toBe("FULL_WAITLIST");
    expect(s.cta).toBe("Join waitlist");
    expect(s.canSignUp).toBe(true);
    expect(s.isWaitlist).toBe(true);
  });

  it("prefers full over an imminent start", () => {
    const s = derivePublicClassStatus({ ...base, enrolledCount: 20, startDate: inDays(2) });
    expect(s.status).toBe("FULL_WAITLIST");
  });

  it("is STARTS_SOON when the start is near and seats remain", () => {
    const s = derivePublicClassStatus({ ...base, startDate: inDays(3) });
    expect(s.status).toBe("STARTS_SOON");
    expect(s.canSignUp).toBe(true);
  });

  it("is REGISTRATION_CLOSED when enrollment is off", () => {
    const s = derivePublicClassStatus({ ...base, enrollmentOpen: false });
    expect(s.status).toBe("REGISTRATION_CLOSED");
    expect(s.canSignUp).toBe(false);
  });

  it("is RUNNING for an in-progress class regardless of seats", () => {
    const s = derivePublicClassStatus({
      ...base,
      status: "IN_PROGRESS",
      startDate: inDays(-2),
      endDate: inDays(20),
    });
    expect(s.status).toBe("RUNNING");
    expect(s.canSignUp).toBe(false);
  });

  it("is COMPLETED when the end date has passed", () => {
    const s = derivePublicClassStatus({ ...base, startDate: inDays(-60), endDate: inDays(-5) });
    expect(s.status).toBe("COMPLETED");
    expect(s.canSignUp).toBe(false);
  });

  it("is CANCELLED and never offers signup", () => {
    const s = derivePublicClassStatus({ ...base, status: "CANCELLED" });
    expect(s.status).toBe("CANCELLED");
    expect(s.canSignUp).toBe(false);
  });

  it("never contradicts itself: canSignUp implies an action CTA", () => {
    for (const enrolledCount of [0, 5, 18, 20]) {
      for (const enrollmentOpen of [true, false]) {
        const s = derivePublicClassStatus({ ...base, enrolledCount, enrollmentOpen });
        if (s.canSignUp) {
          expect(["Sign up", "Join waitlist"]).toContain(s.cta);
        } else {
          expect(["Sign up", "Join waitlist"]).not.toContain(s.cta);
        }
      }
    }
  });
});

describe("schedule formatting", () => {
  it("summarizes a multi-session course", () => {
    expect(
      formatScheduleSummary({
        sessionCount: 4,
        meetingDays: ["Monday", "Wednesday"],
        meetingTime: "4:00 PM",
        startDate: new Date("2026-07-08"),
        endDate: new Date("2026-07-29"),
      }),
    ).toContain("4 sessions");
  });

  it("labels a one-time workshop", () => {
    const out = formatScheduleSummary({
      sessionCount: 1,
      meetingTime: "7:00 PM",
      startDate: new Date("2026-07-14"),
      endDate: new Date("2026-07-14"),
    });
    expect(out).toMatch(/One-time workshop/);
  });

  it("formats day abbreviations and date ranges", () => {
    expect(formatMeetingDays(["Monday", "Wednesday"])).toBe("Mon/Wed");
    expect(formatClassDateRange(new Date("2026-07-08"), new Date("2026-07-29"))).toMatch(/Jul/);
  });
});
