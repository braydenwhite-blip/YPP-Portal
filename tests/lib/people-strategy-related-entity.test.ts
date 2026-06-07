import { describe, expect, it } from "vitest";

import {
  RELATED_ENTITY_TYPE_VALUES,
  isRelatedEntityType,
  parseRelatedEntityRef,
  parseRelatedEntityUpdate,
  relatedEntityTypeLabel,
} from "@/lib/people-strategy/constants";

describe("isRelatedEntityType", () => {
  it("accepts each shipped polymorphic value", () => {
    for (const value of RELATED_ENTITY_TYPE_VALUES) {
      expect(isRelatedEntityType(value)).toBe(true);
    }
  });

  it("rejects excluded / unknown values", () => {
    // DEPARTMENT, OFFICER_MEETING, LEADERSHIP_PATHWAY are deliberately NOT
    // shipped as polymorphic link targets.
    expect(isRelatedEntityType("DEPARTMENT")).toBe(false);
    expect(isRelatedEntityType("OFFICER_MEETING")).toBe(false);
    expect(isRelatedEntityType("LEADERSHIP_PATHWAY")).toBe(false);
    expect(isRelatedEntityType("NONSENSE")).toBe(false);
    expect(isRelatedEntityType("")).toBe(false);
    expect(isRelatedEntityType(null)).toBe(false);
    expect(isRelatedEntityType(undefined)).toBe(false);
    expect(isRelatedEntityType(123)).toBe(false);
  });
});

describe("relatedEntityTypeLabel", () => {
  it("labels shipped and excluded values", () => {
    expect(relatedEntityTypeLabel("CLASS_OFFERING")).toBe("Class");
    expect(relatedEntityTypeLabel("MENTORSHIP")).toBe("Mentorship");
    expect(relatedEntityTypeLabel("USER")).toBe("Person");
    expect(relatedEntityTypeLabel("INSTRUCTOR_APPLICATION")).toBe(
      "Instructor Application"
    );
    expect(relatedEntityTypeLabel("PARTNER")).toBe("Partner");
    // Retained-but-not-shipped labels are still available.
    expect(relatedEntityTypeLabel("DEPARTMENT")).toBe("Department");
  });

  it("falls back to the raw value when unknown", () => {
    expect(relatedEntityTypeLabel("MYSTERY")).toBe("MYSTERY");
  });
});

describe("parseRelatedEntityRef", () => {
  it("returns a null ref when neither field is provided", () => {
    expect(parseRelatedEntityRef({})).toEqual({ ok: true, ref: null });
    expect(
      parseRelatedEntityRef({ relatedEntityType: "", relatedEntityId: "" })
    ).toEqual({ ok: true, ref: null });
    expect(
      parseRelatedEntityRef({ relatedEntityType: null, relatedEntityId: null })
    ).toEqual({ ok: true, ref: null });
  });

  it("trims and accepts a valid pair", () => {
    expect(
      parseRelatedEntityRef({
        relatedEntityType: "  CLASS_OFFERING  ",
        relatedEntityId: "  class_1  ",
      })
    ).toEqual({ ok: true, ref: { type: "CLASS_OFFERING", id: "class_1" } });
  });

  it("rejects a type without an id (both-or-neither)", () => {
    const result = parseRelatedEntityRef({ relatedEntityType: "USER" });
    expect(result.ok).toBe(false);
  });

  it("rejects an id without a type (both-or-neither)", () => {
    const result = parseRelatedEntityRef({ relatedEntityId: "user_1" });
    expect(result.ok).toBe(false);
  });

  it("rejects an unknown / excluded type even with an id", () => {
    expect(
      parseRelatedEntityRef({
        relatedEntityType: "DEPARTMENT",
        relatedEntityId: "dept_1",
      }).ok
    ).toBe(false);
    expect(
      parseRelatedEntityRef({
        relatedEntityType: "NONSENSE",
        relatedEntityId: "x",
      }).ok
    ).toBe(false);
  });
});

describe("parseRelatedEntityUpdate", () => {
  it("is unchanged when BOTH fields are omitted", () => {
    expect(parseRelatedEntityUpdate({})).toEqual({ kind: "unchanged" });
    expect(
      parseRelatedEntityUpdate({
        relatedEntityType: undefined,
        relatedEntityId: undefined,
      })
    ).toEqual({ kind: "unchanged" });
  });

  it("clears the link when sent empty / null", () => {
    expect(
      parseRelatedEntityUpdate({ relatedEntityType: "", relatedEntityId: "" })
    ).toEqual({ kind: "clear" });
    expect(
      parseRelatedEntityUpdate({
        relatedEntityType: null,
        relatedEntityId: null,
      })
    ).toEqual({ kind: "clear" });
  });

  it("sets the link for a valid pair", () => {
    expect(
      parseRelatedEntityUpdate({
        relatedEntityType: "MENTORSHIP",
        relatedEntityId: "m_1",
      })
    ).toEqual({ kind: "set", ref: { type: "MENTORSHIP", id: "m_1" } });
  });

  it("errors on a half-supplied or invalid pair", () => {
    expect(
      parseRelatedEntityUpdate({ relatedEntityType: "USER" }).kind
    ).toBe("error");
    expect(
      parseRelatedEntityUpdate({ relatedEntityId: "u_1" }).kind
    ).toBe("error");
    expect(
      parseRelatedEntityUpdate({
        relatedEntityType: "DEPARTMENT",
        relatedEntityId: "d_1",
      }).kind
    ).toBe("error");
  });
});
