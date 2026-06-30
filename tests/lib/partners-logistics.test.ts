import { describe, it, expect } from "vitest";

import {
  parseLogistics,
  logisticsReadiness,
  isLogisticsComplete,
  isLogisticsIncomplete,
  isLogisticsRelevant,
  withLogisticsItem,
  LOGISTICS_ITEMS,
  LOGISTICS_KEYS,
} from "@/lib/partners/logistics";

describe("parseLogistics", () => {
  it("returns an empty map for null / garbage / arrays", () => {
    expect(parseLogistics(null)).toEqual({});
    expect(parseLogistics(undefined)).toEqual({});
    expect(parseLogistics("nope")).toEqual({});
    expect(parseLogistics([1, 2, 3])).toEqual({});
  });
  it("keeps only known keys with boolean values", () => {
    const parsed = parseLogistics({ room: true, supervision: false, bogus: true, dayTime: "yes" });
    expect(parsed).toEqual({ room: true, supervision: false });
  });
});

describe("logisticsReadiness", () => {
  it("reports counts, remaining, and completeness", () => {
    const r = logisticsReadiness({ room: true, dayTime: true });
    expect(r.total).toBe(LOGISTICS_ITEMS.length);
    expect(r.complete).toBe(2);
    expect(r.isComplete).toBe(false);
    expect(r.remaining).not.toContain("room");
    expect(r.percent).toBe(Math.round((2 / LOGISTICS_ITEMS.length) * 100));
  });
  it("is complete only when every item is checked", () => {
    const all = Object.fromEntries(LOGISTICS_KEYS.map((k) => [k, true]));
    expect(logisticsReadiness(all).isComplete).toBe(true);
    expect(isLogisticsComplete(all)).toBe(true);
    expect(logisticsReadiness(all).percent).toBe(100);
  });
});

describe("isLogisticsRelevant / isLogisticsIncomplete", () => {
  it("only matters for confirmed/active partners", () => {
    expect(isLogisticsRelevant("ACTIVE_PARTNERSHIP")).toBe(true);
    expect(isLogisticsRelevant("COMPLETED")).toBe(true);
    expect(isLogisticsRelevant("RESEARCHING")).toBe(false);
    expect(isLogisticsRelevant("MEETING_SCHEDULED")).toBe(false);
  });
  it("flags confirmed partners with unfinished logistics, not unconfirmed ones", () => {
    expect(isLogisticsIncomplete("ACTIVE_PARTNERSHIP", { room: true })).toBe(true);
    expect(isLogisticsIncomplete("RESEARCHING", {})).toBe(false);
    const all = Object.fromEntries(LOGISTICS_KEYS.map((k) => [k, true]));
    expect(isLogisticsIncomplete("ACTIVE_PARTNERSHIP", all)).toBe(false);
  });
});

describe("withLogisticsItem", () => {
  it("immutably toggles one item", () => {
    const base = { room: true };
    const next = withLogisticsItem(base, "supervision", true);
    expect(next).toEqual({ room: true, supervision: true });
    expect(base).toEqual({ room: true }); // unchanged
  });
});
