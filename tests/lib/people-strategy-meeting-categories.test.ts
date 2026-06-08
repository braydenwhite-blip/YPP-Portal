import { describe, expect, it } from "vitest";

import {
  MEETING_CATEGORY_VALUES,
  isMeetingCategory,
  meetingCategoryIdentity,
  meetingCategoryLabel,
  meetingCategoryTone,
  parseMeetingCategory,
} from "@/lib/people-strategy/meeting-categories";

describe("isMeetingCategory", () => {
  it("accepts known categories and rejects everything else", () => {
    expect(isMeetingCategory("LEADERSHIP")).toBe(true);
    expect(isMeetingCategory("MENTORSHIP")).toBe(true);
    expect(isMeetingCategory("leadership")).toBe(false); // case-sensitive guard
    expect(isMeetingCategory("NOPE")).toBe(false);
    expect(isMeetingCategory(null)).toBe(false);
    expect(isMeetingCategory(42)).toBe(false);
  });

  it("covers every value with a label and identity", () => {
    for (const value of MEETING_CATEGORY_VALUES) {
      expect(meetingCategoryLabel(value)).toBeTruthy();
      const id = meetingCategoryIdentity(value);
      expect(id.icon).toBeTruthy();
      expect(typeof id.hue).toBe("number");
    }
  });
});

describe("meetingCategoryLabel", () => {
  it("maps known values and falls back gracefully", () => {
    expect(meetingCategoryLabel("PARTNERSHIPS")).toBe("Partnerships");
    expect(meetingCategoryLabel(null)).toBe("Other");
    expect(meetingCategoryLabel("")).toBe("Other");
    expect(meetingCategoryLabel("CUSTOM_X")).toBe("CUSTOM_X");
  });
});

describe("meetingCategoryTone", () => {
  it("produces oklch colors and neutralizes OTHER (chroma 0)", () => {
    const lead = meetingCategoryTone("LEADERSHIP");
    expect(lead.bg).toContain("oklch");
    expect(lead.dot).toContain("270"); // leadership hue

    const other = meetingCategoryTone("OTHER");
    // chroma 0 → all-zero chroma component
    expect(other.bg).toBe("oklch(0.962 0 0)");
    expect(other.dot).toBe("oklch(0.63 0 0)");
  });

  it("falls back to OTHER for unknown input", () => {
    expect(meetingCategoryTone("???")).toEqual(meetingCategoryTone("OTHER"));
    expect(meetingCategoryTone(null)).toEqual(meetingCategoryTone("OTHER"));
  });
});

describe("parseMeetingCategory", () => {
  it("treats empty / null as a valid null category", () => {
    expect(parseMeetingCategory("")).toEqual({ ok: true, value: null });
    expect(parseMeetingCategory(null)).toEqual({ ok: true, value: null });
    expect(parseMeetingCategory(undefined)).toEqual({ ok: true, value: null });
  });

  it("upper-cases and accepts known members", () => {
    expect(parseMeetingCategory("leadership")).toEqual({ ok: true, value: "LEADERSHIP" });
    expect(parseMeetingCategory("  Classes ")).toEqual({ ok: true, value: "CLASSES" });
  });

  it("rejects unknown values", () => {
    const res = parseMeetingCategory("finance-and-ops");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Unknown meeting category/);
  });
});
