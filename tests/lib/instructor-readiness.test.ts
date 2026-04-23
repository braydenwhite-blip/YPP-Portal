import { describe, expect, it } from "vitest";
import {
  assertReadinessAllowsPublish,
  buildInstructorReadinessFromSnapshot,
} from "@/lib/instructor-readiness";

describe("assertReadinessAllowsPublish", () => {
  it("allows publish when readiness is complete", () => {
    expect(() =>
      assertReadinessAllowsPublish({ baseReadinessComplete: true })
    ).not.toThrow();
  });

  it("blocks publish when readiness is incomplete", () => {
    expect(() =>
      assertReadinessAllowsPublish({ baseReadinessComplete: false })
    ).toThrow(
      "Publishing blocked. Complete academy modules, Lesson Design Studio capstone, and interview readiness first."
    );
  });
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

const makeModule = (
  overrides: Partial<
    Parameters<typeof buildInstructorReadinessFromSnapshot>[0]["requiredModules"][number]
  > = {}
) => ({
  id: "m1",
  title: "M1",
  type: "WORKSHOP",
  videoUrl: null,
  videoProvider: null,
  requiresQuiz: false,
  requiresEvidence: false,
  checkpoints: [],
  quizQuestions: [],
  interactiveJourney: null,
  ...overrides,
});

/** Builds a snapshot with the given required modules + a COMPLETE assignment for each. */
const snapshotWithModules = (
  modules: ReturnType<typeof makeModule>[],
  assignmentStatus = "COMPLETE"
) =>
  buildInstructorReadinessFromSnapshot({
    instructorId: "i1",
    featureEnabled: true,
    interviewRequired: false,
    requiredModules: modules,
    assignments: modules.map((m) => ({
      userId: "i1",
      moduleId: m.id,
      status: assignmentStatus,
    })),
    interviewGate: null,
    legacyExemptOfferingCount: 0,
    studioCapstoneComplete: true,
  });

// ---------------------------------------------------------------------------
// Regression suite — pre-existing module shapes (R1 lock-down)
// ---------------------------------------------------------------------------

describe("buildInstructorReadinessFromSnapshot — regression: pre-existing module shapes", () => {
  it("R1a: video-only module with COMPLETE assignment → academyModulesComplete, no TRAINING_CONFIGURATION_REQUIRED", () => {
    const result = snapshotWithModules([
      makeModule({ videoUrl: "https://example.com/v.mp4", videoProvider: "CUSTOM" }),
    ]);
    expect(result.academyModulesComplete).toBe(true);
    expect(
      result.missingRequirements.find((r) => r.code === "TRAINING_CONFIGURATION_REQUIRED")
    ).toBeUndefined();
  });

  it("R1b: checkpoint-only module (1 required checkpoint) with COMPLETE assignment → complete, no config issue", () => {
    const result = snapshotWithModules([
      makeModule({ checkpoints: [{ id: "cp1" }] }),
    ]);
    expect(result.academyModulesComplete).toBe(true);
    expect(
      result.missingRequirements.find((r) => r.code === "TRAINING_CONFIGURATION_REQUIRED")
    ).toBeUndefined();
  });

  it("R1c: quiz-only module (requiresQuiz=true, one quiz question) with COMPLETE assignment → complete, no config issue", () => {
    const result = snapshotWithModules([
      makeModule({ requiresQuiz: true, quizQuestions: [{ id: "q1" }] }),
    ]);
    expect(result.academyModulesComplete).toBe(true);
    expect(
      result.missingRequirements.find((r) => r.code === "TRAINING_CONFIGURATION_REQUIRED")
    ).toBeUndefined();
  });

  it("R1d: evidence-only module (requiresEvidence=true) with COMPLETE assignment → complete, no config issue", () => {
    const result = snapshotWithModules([
      makeModule({ requiresEvidence: true }),
    ]);
    expect(result.academyModulesComplete).toBe(true);
    expect(
      result.missingRequirements.find((r) => r.code === "TRAINING_CONFIGURATION_REQUIRED")
    ).toBeUndefined();
  });

  it("R1e: module with NONE of the four paths and type !== INTERACTIVE_JOURNEY → flags TRAINING_CONFIGURATION_REQUIRED", () => {
    const result = snapshotWithModules([
      makeModule({ type: "WORKSHOP" }), // no video, no checkpoints, no quiz, no evidence, not IJ
    ]);
    expect(
      result.missingRequirements.find((r) => r.code === "TRAINING_CONFIGURATION_REQUIRED")
    ).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// New-path suite — INTERACTIVE_JOURNEY patch (J1, J2)
// ---------------------------------------------------------------------------

describe("buildInstructorReadinessFromSnapshot — new path: INTERACTIVE_JOURNEY", () => {
  it("J1: INTERACTIVE_JOURNEY with attached interactiveJourney + COMPLETE assignment → academyModulesComplete, no TRAINING_CONFIGURATION_REQUIRED", () => {
    const result = snapshotWithModules([
      makeModule({
        type: "INTERACTIVE_JOURNEY",
        interactiveJourney: { id: "j1" },
      }),
    ]);
    expect(result.academyModulesComplete).toBe(true);
    expect(
      result.missingRequirements.find((r) => r.code === "TRAINING_CONFIGURATION_REQUIRED")
    ).toBeUndefined();
  });

  it("J2: INTERACTIVE_JOURNEY with interactiveJourney=null → flags TRAINING_CONFIGURATION_REQUIRED (dangling journey module)", () => {
    const result = snapshotWithModules([
      makeModule({
        type: "INTERACTIVE_JOURNEY",
        interactiveJourney: null,
      }),
    ]);
    expect(
      result.missingRequirements.find((r) => r.code === "TRAINING_CONFIGURATION_REQUIRED")
    ).toBeDefined();
  });
});
