import { describe, expect, it } from "vitest";

import {
  ACTION_TYPE_GUIDANCE,
  ACTION_TYPE_LABELS,
  ACTION_TYPE_VALUES,
  actionTypeFromHint,
  actionTypeLabel,
  isActionType,
  parseActionType,
  parseActionTypeUpdate,
} from "@/lib/people-strategy/action-types";

describe("action type reference data", () => {
  it("has a label + guidance for every value", () => {
    for (const value of ACTION_TYPE_VALUES) {
      expect(ACTION_TYPE_LABELS[value]).toBeTruthy();
      expect(ACTION_TYPE_GUIDANCE[value].helper).toBeTruthy();
      expect(ACTION_TYPE_GUIDANCE[value].suggestedPriority).toBeTruthy();
    }
  });

  it("has no duplicate values", () => {
    expect(new Set(ACTION_TYPE_VALUES).size).toBe(ACTION_TYPE_VALUES.length);
  });
});

describe("isActionType", () => {
  it("accepts every known value", () => {
    for (const value of ACTION_TYPE_VALUES) {
      expect(isActionType(value)).toBe(true);
    }
  });

  it("rejects unknown / empty / non-string values", () => {
    expect(isActionType("NONSENSE")).toBe(false);
    expect(isActionType("outreach")).toBe(false); // case-sensitive enum value
    expect(isActionType("")).toBe(false);
    expect(isActionType(null)).toBe(false);
    expect(isActionType(undefined)).toBe(false);
    expect(isActionType(7)).toBe(false);
  });
});

describe("actionTypeLabel", () => {
  it("labels known values and falls back to the raw value", () => {
    expect(actionTypeLabel("PARTNERSHIP")).toBe("Partnership");
    expect(actionTypeLabel("MYSTERY")).toBe("MYSTERY");
  });
});

describe("parseActionType (create)", () => {
  it("treats empty / null / undefined as a valid untyped action", () => {
    expect(parseActionType(undefined)).toEqual({ ok: true, value: null });
    expect(parseActionType(null)).toEqual({ ok: true, value: null });
    expect(parseActionType("")).toEqual({ ok: true, value: null });
    expect(parseActionType("   ")).toEqual({ ok: true, value: null });
  });

  it("trims and accepts a known value", () => {
    expect(parseActionType("  OUTREACH  ")).toEqual({
      ok: true,
      value: "OUTREACH",
    });
  });

  it("rejects an unknown value", () => {
    expect(parseActionType("BOGUS").ok).toBe(false);
  });
});

describe("parseActionTypeUpdate", () => {
  it("is unchanged only when the field is omitted (undefined)", () => {
    expect(parseActionTypeUpdate(undefined)).toEqual({ kind: "unchanged" });
  });

  it("clears the type when sent empty / null", () => {
    expect(parseActionTypeUpdate("")).toEqual({ kind: "clear" });
    expect(parseActionTypeUpdate("   ")).toEqual({ kind: "clear" });
    expect(parseActionTypeUpdate(null)).toEqual({ kind: "clear" });
  });

  it("sets a known value", () => {
    expect(parseActionTypeUpdate("FOLLOW_UP")).toEqual({
      kind: "set",
      value: "FOLLOW_UP",
    });
  });

  it("errors on an unknown value", () => {
    expect(parseActionTypeUpdate("WAT").kind).toBe("error");
  });
});

describe("actionTypeFromHint", () => {
  it("matches labels, enum values, and spaced values case-insensitively", () => {
    expect(actionTypeFromHint("Outreach")).toBe("OUTREACH");
    expect(actionTypeFromHint("FOLLOW_UP")).toBe("FOLLOW_UP");
    expect(actionTypeFromHint("instructor recruiting")).toBe(
      "INSTRUCTOR_RECRUITING"
    );
    expect(actionTypeFromHint("Partnership")).toBe("PARTNERSHIP");
  });

  it("resolves common synonyms used by template categories", () => {
    expect(actionTypeFromHint("recruiting")).toBe("INSTRUCTOR_RECRUITING");
    expect(actionTypeFromHint("partner")).toBe("PARTNERSHIP");
    expect(actionTypeFromHint("ops")).toBe("OPERATIONS");
  });

  it("returns null for blank or unmappable hints", () => {
    expect(actionTypeFromHint(null)).toBeNull();
    expect(actionTypeFromHint("")).toBeNull();
    expect(actionTypeFromHint("Instruction")).toBeNull();
  });
});
