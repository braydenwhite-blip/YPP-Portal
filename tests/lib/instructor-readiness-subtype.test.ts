import { describe, expect, it } from "vitest";
import { buildInstructorReadinessFromSnapshot } from "@/lib/instructor-readiness";

/**
 * Subtype-aware coverage for the readiness aggregator. These tests pin down
 * the contract that:
 *   * STANDARD applicants must finish the LDS capstone to clear training.
 *   * SUMMER_WORKSHOP applicants must finish a workshop submission instead.
 *   * The "missing requirement" surfaced to the user matches their subtype.
 *
 * Pure-function tests — no DB, no network. Lives alongside the existing
 * instructor-readiness regression suite.
 */

const makeModule = (id = "m1") => ({
  id,
  title: id,
  type: "INTERACTIVE_JOURNEY",
  contentKey: `academy_${id}`,
  videoUrl: null,
  videoProvider: null,
  requiresQuiz: false,
  requiresEvidence: false,
  checkpoints: [],
  quizQuestions: [],
  interactiveJourney: { id: `j-${id}` },
});

function snapshot({
  subtype,
  capstoneDone,
  modulesComplete = true,
}: {
  subtype: "STANDARD" | "SUMMER_WORKSHOP";
  capstoneDone: boolean;
  modulesComplete?: boolean;
}) {
  const mod = makeModule();
  return buildInstructorReadinessFromSnapshot({
    instructorId: "i1",
    featureEnabled: true,
    interviewRequired: false,
    requiredModules: [mod],
    assignments: [
      {
        userId: "i1",
        moduleId: mod.id,
        status: modulesComplete ? "COMPLETE" : "IN_PROGRESS",
      },
    ],
    interviewGate: null,
    legacyExemptOfferingCount: 0,
    studioCapstoneComplete: capstoneDone,
    instructorSubtype: subtype,
  });
}

describe("buildInstructorReadinessFromSnapshot — subtype-aware capstone", () => {
  it("STANDARD applicant with capstone done is training-complete", () => {
    const r = snapshot({ subtype: "STANDARD", capstoneDone: true });
    expect(r.instructorSubtype).toBe("STANDARD");
    expect(r.academyModulesComplete).toBe(true);
    expect(r.studioCapstoneComplete).toBe(true);
    expect(r.trainingComplete).toBe(true);
    expect(r.canRequestOfferingApproval).toBe(true);
    expect(
      r.missingRequirements.find(
        (req) =>
          req.code === "STUDIO_CAPSTONE_REQUIRED" ||
          req.code === "WORKSHOP_SUBMISSION_REQUIRED"
      )
    ).toBeUndefined();
  });

  it("STANDARD applicant without capstone surfaces STUDIO_CAPSTONE_REQUIRED, not workshop", () => {
    const r = snapshot({ subtype: "STANDARD", capstoneDone: false });
    const missing = r.missingRequirements.map((m) => m.code);
    expect(missing).toContain("STUDIO_CAPSTONE_REQUIRED");
    expect(missing).not.toContain("WORKSHOP_SUBMISSION_REQUIRED");
    expect(r.trainingComplete).toBe(false);
    expect(r.canRequestOfferingApproval).toBe(false);
    // The next-action href should point at LDS, not the workshop studio.
    const blocker = r.missingRequirements.find(
      (m) => m.code === "STUDIO_CAPSTONE_REQUIRED"
    )!;
    expect(blocker.href).toBe("/instructor/lesson-design-studio?entry=training");
  });

  it("SUMMER_WORKSHOP applicant with workshop submitted is training-complete", () => {
    const r = snapshot({ subtype: "SUMMER_WORKSHOP", capstoneDone: true });
    expect(r.instructorSubtype).toBe("SUMMER_WORKSHOP");
    expect(r.studioCapstoneComplete).toBe(true);
    expect(r.trainingComplete).toBe(true);
    expect(r.canRequestOfferingApproval).toBe(true);
    expect(
      r.missingRequirements.find(
        (req) =>
          req.code === "STUDIO_CAPSTONE_REQUIRED" ||
          req.code === "WORKSHOP_SUBMISSION_REQUIRED"
      )
    ).toBeUndefined();
  });

  it("SUMMER_WORKSHOP applicant without submission surfaces WORKSHOP_SUBMISSION_REQUIRED, not LDS", () => {
    const r = snapshot({ subtype: "SUMMER_WORKSHOP", capstoneDone: false });
    const missing = r.missingRequirements.map((m) => m.code);
    expect(missing).toContain("WORKSHOP_SUBMISSION_REQUIRED");
    expect(missing).not.toContain("STUDIO_CAPSTONE_REQUIRED");
    const blocker = r.missingRequirements.find(
      (m) => m.code === "WORKSHOP_SUBMISSION_REQUIRED"
    )!;
    expect(blocker.href).toBe("/instructor/workshop-design-studio");
    expect(blocker.title).toMatch(/workshop/i);
  });

  it("SUMMER_WORKSHOP applicant with academy incomplete still routes the missing-modules requirement", () => {
    const r = snapshot({
      subtype: "SUMMER_WORKSHOP",
      capstoneDone: false,
      modulesComplete: false,
    });
    const missing = r.missingRequirements.map((m) => m.code);
    expect(missing).toContain("TRAINING_INCOMPLETE");
    expect(missing).toContain("WORKSHOP_SUBMISSION_REQUIRED");
    expect(r.trainingComplete).toBe(false);
  });

  it("default subtype (omitted) is STANDARD — back-compat for legacy callers", () => {
    const mod = makeModule();
    const r = buildInstructorReadinessFromSnapshot({
      instructorId: "i1",
      featureEnabled: true,
      interviewRequired: false,
      requiredModules: [mod],
      assignments: [{ userId: "i1", moduleId: mod.id, status: "COMPLETE" }],
      interviewGate: null,
      legacyExemptOfferingCount: 0,
      studioCapstoneComplete: false,
      // instructorSubtype intentionally omitted
    });
    expect(r.instructorSubtype).toBe("STANDARD");
    expect(r.missingRequirements.map((m) => m.code)).toContain(
      "STUDIO_CAPSTONE_REQUIRED"
    );
  });
});
