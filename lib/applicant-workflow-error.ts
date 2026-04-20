export const APPLICANT_WORKFLOW_ERROR_CODES = {
  STATUS_CHANGED: "STATUS_CHANGED",
  SYNC_FAILED: "SYNC_FAILED",
} as const;

export type ApplicantWorkflowErrorCode =
  (typeof APPLICANT_WORKFLOW_ERROR_CODES)[keyof typeof APPLICANT_WORKFLOW_ERROR_CODES];

/**
 * Structured error for Instructor Applicant Workflow invariant violations.
 * Callers can branch on `error.code` rather than parsing message strings.
 */
export class ApplicantWorkflowError extends Error {
  readonly code: ApplicantWorkflowErrorCode;
  constructor(code: ApplicantWorkflowErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "ApplicantWorkflowError";
  }
}
