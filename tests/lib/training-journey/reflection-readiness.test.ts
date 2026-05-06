import { describe, it, expect } from "vitest";
import {
  findUnsubmittedReflectionBeats,
  isReflectionSubmitted,
} from "@/lib/training-journey/reflection-readiness";

// ---------------------------------------------------------------------------
// isReflectionSubmitted — the atomic presence check
// ---------------------------------------------------------------------------

describe("isReflectionSubmitted", () => {
  it("returns false when there is no attempt", () => {
    expect(isReflectionSubmitted(null)).toBe(false);
    expect(isReflectionSubmitted(undefined)).toBe(false);
  });

  it("returns false when response is not a plain object", () => {
    expect(isReflectionSubmitted({ response: null })).toBe(false);
    expect(isReflectionSubmitted({ response: undefined })).toBe(false);
    expect(isReflectionSubmitted({ response: "string" })).toBe(false);
    expect(isReflectionSubmitted({ response: 123 })).toBe(false);
    expect(isReflectionSubmitted({ response: ["text"] })).toBe(false);
  });

  it("returns false when text is missing or non-string", () => {
    expect(isReflectionSubmitted({ response: {} })).toBe(false);
    expect(isReflectionSubmitted({ response: { text: undefined } })).toBe(false);
    expect(isReflectionSubmitted({ response: { text: null } })).toBe(false);
    expect(isReflectionSubmitted({ response: { text: 42 } })).toBe(false);
  });

  it("returns false when text is empty or whitespace-only", () => {
    expect(isReflectionSubmitted({ response: { text: "" } })).toBe(false);
    expect(isReflectionSubmitted({ response: { text: "   " } })).toBe(false);
    expect(isReflectionSubmitted({ response: { text: "\n\t  " } })).toBe(false);
  });

  it("returns true for any non-whitespace text", () => {
    expect(isReflectionSubmitted({ response: { text: "x" } })).toBe(true);
    expect(isReflectionSubmitted({ response: { text: "  Yes  " } })).toBe(true);
    expect(
      isReflectionSubmitted({
        response: { text: "A long thoughtful reflection about teaching." },
      })
    ).toBe(true);
  });

  it("is a presence-only check — does not enforce minimum length", () => {
    // Length rules belong to the reflection scorer at submit time. This
    // gate only ensures the learner submitted something before the
    // journey can complete.
    expect(isReflectionSubmitted({ response: { text: "x" } })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// findUnsubmittedReflectionBeats — the readiness gate as exercised by the
// journey completion action
// ---------------------------------------------------------------------------

type TestBeat = { id: string; kind: string };

const reflection = (id: string): TestBeat => ({ id, kind: "REFLECTION" });
const scenario = (id: string): TestBeat => ({ id, kind: "SCENARIO_CHOICE" });

const allVisible = () => true;
const allHidden = () => false;

describe("findUnsubmittedReflectionBeats", () => {
  it("flags a visible reflection with no attempt as unsubmitted (case 1: zero attempts)", () => {
    const result = findUnsubmittedReflectionBeats({
      beats: [reflection("r1")],
      isVisible: allVisible,
      latestByBeatId: new Map(),
    });
    expect(result.map((b) => b.id)).toEqual(["r1"]);
  });

  it("flags a visible reflection whose latest attempt is empty / whitespace as unsubmitted (case 2)", () => {
    const result = findUnsubmittedReflectionBeats({
      beats: [reflection("r1"), reflection("r2")],
      isVisible: allVisible,
      latestByBeatId: new Map([
        ["r1", { response: { text: "" } }],
        ["r2", { response: { text: "   \n\t   " } }],
      ]),
    });
    expect(result.map((b) => b.id).sort()).toEqual(["r1", "r2"]);
  });

  it("does NOT flag a visible reflection with meaningful text (case 3: completion proceeds)", () => {
    const result = findUnsubmittedReflectionBeats({
      beats: [reflection("r1")],
      isVisible: allVisible,
      latestByBeatId: new Map([
        ["r1", { response: { text: "I learned to listen first before responding." } }],
      ]),
    });
    expect(result).toEqual([]);
  });

  it("does NOT flag a reflection that is hidden by showWhen (case 4: not visible, not gated)", () => {
    // Reflection r1 is hidden, has no attempt — it must not block completion.
    const result = findUnsubmittedReflectionBeats({
      beats: [reflection("r1")],
      isVisible: allHidden,
      latestByBeatId: new Map(),
    });
    expect(result).toEqual([]);
  });

  it("ignores non-reflection beat kinds entirely", () => {
    // Scored beats with no attempt are handled by the scored-beat readiness
    // loop in completeInteractiveJourney — this helper must not double-gate
    // them.
    const result = findUnsubmittedReflectionBeats({
      beats: [scenario("s1"), scenario("s2")],
      isVisible: allVisible,
      latestByBeatId: new Map(),
    });
    expect(result).toEqual([]);
  });

  it("evaluates a mixed set: only the unsubmitted, visible reflections are flagged", () => {
    const result = findUnsubmittedReflectionBeats({
      beats: [
        reflection("r-empty"),
        reflection("r-filled"),
        reflection("r-hidden"),
        scenario("s1"),
      ],
      isVisible: (b) => b.id !== "r-hidden",
      latestByBeatId: new Map([
        ["r-empty", { response: { text: "" } }],
        ["r-filled", { response: { text: "Good reflection text." } }],
      ]),
    });
    expect(result.map((b) => b.id)).toEqual(["r-empty"]);
  });
});
