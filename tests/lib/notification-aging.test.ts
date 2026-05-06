import { describe, expect, it } from "vitest";
import {
  computeAgingSeverity,
  severityBackground,
  severityBorderColor,
} from "@/lib/notification-aging";

const NOW = new Date("2026-04-27T12:00:00Z");

function ago(minutes: number): string {
  return new Date(NOW.getTime() - minutes * 60_000).toISOString();
}

describe("computeAgingSeverity", () => {
  it("returns 'fresh' for failures under 5 minutes", () => {
    const result = computeAgingSeverity(ago(2), NOW);
    expect(result.severity).toBe("fresh");
    expect(result.ageMinutes).toBe(2);
    expect(result.copyHint).toBe("just failed");
  });

  it("returns 'amber' from 5 to 14 minutes", () => {
    expect(computeAgingSeverity(ago(5), NOW).severity).toBe("amber");
    expect(computeAgingSeverity(ago(14), NOW).severity).toBe("amber");
  });

  it("returns 'orange' from 15 to 29 minutes", () => {
    expect(computeAgingSeverity(ago(15), NOW).severity).toBe("orange");
    expect(computeAgingSeverity(ago(29), NOW).severity).toBe("orange");
  });

  it("returns 'red' once the failure is at least 30 minutes old", () => {
    const result = computeAgingSeverity(ago(45), NOW);
    expect(result.severity).toBe("red");
    expect(result.copyHint).toContain("hasn't been notified");
  });

  it("falls back to 'fresh' for null or unparseable timestamps", () => {
    expect(computeAgingSeverity(null, NOW).severity).toBe("fresh");
    expect(computeAgingSeverity("not-a-date", NOW).severity).toBe("fresh");
  });

  it("never returns negative ageMinutes for clock skew", () => {
    const future = new Date(NOW.getTime() + 60_000).toISOString();
    expect(computeAgingSeverity(future, NOW).ageMinutes).toBe(0);
  });
});

describe("severity tone helpers", () => {
  it("escalates background tint with severity", () => {
    const fresh = severityBackground("fresh");
    const red = severityBackground("red");
    expect(fresh).toContain("234, 179, 8"); // amber-tinted
    expect(red).toContain("239, 68, 68"); // red-tinted
  });

  it("returns a CSS-valid border color for every severity", () => {
    for (const severity of ["fresh", "amber", "orange", "red"] as const) {
      expect(severityBorderColor(severity)).toMatch(/^var|#|rgba|hsl/);
    }
  });
});
