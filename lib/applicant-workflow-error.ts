export const APPLICANT_WORKFLOW_ERROR_CODES = {
  STATUS_CHANGED: "STATUS_CHANGED",
  SYNC_FAILED: "SYNC_FAILED",
  SYNC_ROLLBACK: "SYNC_ROLLBACK",
  DEADLOCK_DETECTED: "DEADLOCK_DETECTED",
  CONDITIONS_REQUIRED: "CONDITIONS_REQUIRED",
  CONDITION_LABEL_INVALID: "CONDITION_LABEL_INVALID",
  CONDITION_LABEL_TOO_LONG: "CONDITION_LABEL_TOO_LONG",
  CONDITION_OWNER_NOT_FOUND: "CONDITION_OWNER_NOT_FOUND",
  TOO_MANY_CONDITIONS: "TOO_MANY_CONDITIONS",
  REJECT_REASON_REQUIRED: "REJECT_REASON_REQUIRED",
  RATIONALE_TOO_LONG: "RATIONALE_TOO_LONG",
  CONTRARIAN_OVERRIDE_MISSING: "CONTRARIAN_OVERRIDE_MISSING",
  UNAUTHORIZED: "UNAUTHORIZED",
  APPLICATION_NOT_FOUND: "APPLICATION_NOT_FOUND",
  RATE_LIMITED: "RATE_LIMITED",
} as const;

export type ApplicantWorkflowErrorCode =
  (typeof APPLICANT_WORKFLOW_ERROR_CODES)[keyof typeof APPLICANT_WORKFLOW_ERROR_CODES];

/**
 * Structured error for Instructor Applicant Workflow invariant violations.
 * Callers can branch on `error.code` rather than parsing message strings.
 *
 * The optional `context` carries machine-readable extras (winning chair name
 * for STATUS_CHANGED, condition index for CONDITION_LABEL_INVALID, etc.)
 * that the cockpit's failure surfaces consume.
 */
export class ApplicantWorkflowError extends Error {
  readonly code: ApplicantWorkflowErrorCode;
  readonly context?: Record<string, unknown>;
  constructor(
    code: ApplicantWorkflowErrorCode,
    message?: string,
    context?: Record<string, unknown>
  ) {
    super(message ?? code);
    this.code = code;
    this.context = context;
    this.name = "ApplicantWorkflowError";
  }
}

/** Human-friendly fallback copy keyed by error code. */
export const APPLICANT_WORKFLOW_ERROR_MESSAGES: Record<ApplicantWorkflowErrorCode, string> = {
  STATUS_CHANGED:
    "Application status changed before the decision was recorded — refresh and try again.",
  SYNC_FAILED:
    "Onboarding sync failed — the decision could not be finalised.",
  SYNC_ROLLBACK:
    "Decision was reversed because the onboarding pipeline didn't update.",
  DEADLOCK_DETECTED:
    "Database is busy. Wait a moment and try again.",
  CONDITIONS_REQUIRED: "Add at least one condition before approving with conditions.",
  CONDITION_LABEL_INVALID: "A condition is missing a label.",
  CONDITION_LABEL_TOO_LONG: "A condition label exceeds 300 characters.",
  CONDITION_OWNER_NOT_FOUND: "A condition owner could not be found.",
  TOO_MANY_CONDITIONS: "A maximum of 10 conditions is allowed.",
  REJECT_REASON_REQUIRED: "Pick a reason code or add free-text before rejecting.",
  RATIONALE_TOO_LONG: "Rationale exceeds the 10 000 character limit.",
  CONTRARIAN_OVERRIDE_MISSING:
    "Acknowledge the contrarian warning before continuing.",
  UNAUTHORIZED: "You don't have permission to record this decision.",
  APPLICATION_NOT_FOUND: "Application not found.",
  RATE_LIMITED: "You've hit the resend rate limit — try again shortly.",
};
