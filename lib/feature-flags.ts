/**
 * Feature flag helpers.
 * All flags default to enabled ("true") unless explicitly set to "false".
 * Toggle via environment variables — no deploy needed for quick kill-switch.
 */

/** Master gate for the Instructor Applicant Workflow V1 feature set. */
export function isInstructorApplicantWorkflowV1Enabled(): boolean {
  return process.env.ENABLE_INSTRUCTOR_APPLICANT_WORKFLOW_V1 !== "false";
}

/** Existing gate — controls downstream onboarding sync on APPROVED. */
export function isNativeInstructorGateEnabled(): boolean {
  return process.env.ENABLE_NATIVE_INSTRUCTOR_GATE !== "false";
}

/**
 * Final Review Cockpit redesign (Phases 1–2).
 * Off by default during rollout — set ENABLE_FINAL_REVIEW_V2=true to opt in.
 * The legacy ChairDecisionWorkspace remains the default until this flips.
 */
export function isFinalReviewV2Enabled(): boolean {
  return process.env.ENABLE_FINAL_REVIEW_V2 === "true";
}
