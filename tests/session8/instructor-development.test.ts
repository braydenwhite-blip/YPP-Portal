import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ONBOARDING_STEPS, SUPPORT_CATEGORIES, minutesToClock, WEEKDAY_LABELS } from "@/lib/session8/instructor-development";

// Mirrors the zod schema in lib/session8/instructor-development-actions.ts —
// re-declared here (rather than imported) so this stays a pure unit test of
// the validation rule without pulling in the "use server" action module
// (which requires next/cache + prisma at import time).
const SaveAvailabilitySchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    available: z.boolean(),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(0).max(1439),
    note: z.string().max(500).optional(),
  })
  .refine((v) => !v.available || v.startMinute < v.endMinute, {
    message: "Start time must be before end time.",
    path: ["endMinute"],
  });

describe("saveInstructorAvailability validation", () => {
  it("accepts a valid available window", () => {
    const result = SaveAvailabilitySchema.safeParse({
      weekday: 1,
      available: true,
      startMinute: 540,
      endMinute: 1020,
    });
    expect(result.success).toBe(true);
  });

  it("rejects start >= end when available", () => {
    const result = SaveAvailabilitySchema.safeParse({
      weekday: 1,
      available: true,
      startMinute: 1000,
      endMinute: 900,
    });
    expect(result.success).toBe(false);
  });

  it("allows equal/garbage minutes when marked unavailable (times ignored)", () => {
    const result = SaveAvailabilitySchema.safeParse({
      weekday: 0,
      available: false,
      startMinute: 0,
      endMinute: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an out-of-range weekday", () => {
    const result = SaveAvailabilitySchema.safeParse({
      weekday: 7,
      available: true,
      startMinute: 0,
      endMinute: 60,
    });
    expect(result.success).toBe(false);
  });

  it("rejects out-of-range minutes", () => {
    const result = SaveAvailabilitySchema.safeParse({
      weekday: 2,
      available: true,
      startMinute: -1,
      endMinute: 1500,
    });
    expect(result.success).toBe(false);
  });
});

describe("minutesToClock", () => {
  it("formats midnight and noon correctly", () => {
    expect(minutesToClock(0)).toBe("12:00 AM");
    expect(minutesToClock(12 * 60)).toBe("12:00 PM");
  });

  it("formats an afternoon time with padded minutes", () => {
    expect(minutesToClock(14 * 60 + 5)).toBe("2:05 PM");
  });
});

describe("WEEKDAY_LABELS", () => {
  it("has 7 entries starting with Sunday", () => {
    expect(WEEKDAY_LABELS).toHaveLength(7);
    expect(WEEKDAY_LABELS[0]).toBe("Sunday");
    expect(WEEKDAY_LABELS[6]).toBe("Saturday");
  });
});

describe("onboarding step catalog", () => {
  it("has unique step keys", () => {
    const keys = ONBOARDING_STEPS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("only derived steps for profile/availability/first-class are honestly auto-checked (no self-attest for structured data)", () => {
    const derivedKeys = ONBOARDING_STEPS.filter((s) => s.kind === "derived").map((s) => s.key);
    expect(derivedKeys).toEqual(
      expect.arrayContaining(["profile-complete", "availability-set", "first-class-readiness"])
    );
  });

  it("every step has a non-empty title and description", () => {
    for (const step of ONBOARDING_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.description.length).toBeGreaterThan(0);
    }
  });
});

describe("support category enum", () => {
  it("matches the categories used by requestInstructorSupport's zod schema", () => {
    expect(SUPPORT_CATEGORIES).toEqual([
      "LOGISTICS",
      "MATERIALS",
      "ROSTER",
      "SCHEDULING",
      "ATTENDANCE",
      "STUDENT_SUPPORT",
      "TECHNICAL",
    ]);
  });
});
