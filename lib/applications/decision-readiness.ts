import {
  computeReadinessSignals,
  type ReadinessInput,
  type ReadinessSignals,
} from "@/lib/readiness-signals";

/** Minimal slice of {@link ApplicationRecord} for the readiness checklist. */
export type DecisionReadinessRecord = {
  status: string;
  materialsReadyAtISO: string | null;
  materials: { courseOutline: boolean; firstClassPlan: boolean };
  infoRequest: string | null;
  applicantResponse: string | null;
  reviewer: { id: string; name: string } | null;
  applicationReviews: Array<{
    reviewerName: string;
    isLeadReview: boolean;
    status: string;
    nextStep: string | null;
    summary: string | null;
  }>;
  interviewReviews: Array<{
    reviewerName: string;
    status: string;
  }>;
  interviewerAssignments: Array<{ interviewer: { id: string; name: string } }>;
};

export type BuildDecisionReadinessOptions = {
  applicationId: string;
  /** Signed-in user — personalizes copy and CTA labels. */
  actorId?: string;
  /** Application 360 embeds review forms — link to on-page anchors. */
  inlineForms?: boolean;
};

export function instructorReviewFormHref(
  applicationId: string,
  inlineForms = false
): string {
  return inlineForms
    ? "#inline-initial-review"
    : `/applications/instructor/${applicationId}#section-review`;
}

export function instructorInterviewFormHref(
  applicationId: string,
  inlineForms = false
): string {
  return inlineForms
    ? "#inline-interview-review"
    : `/applications/instructor/${applicationId}/interview`;
}

export type DecisionReadinessCheck = {
  label: string;
  done: boolean;
  detail?: string;
  href?: string;
  linkLabel?: string;
};

const POST_INTERVIEW_STATUSES = new Set([
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_COMPLETED",
  "CHAIR_REVIEW",
]);

function materialsComplete(record: DecisionReadinessRecord): boolean {
  return (
    Boolean(record.materialsReadyAtISO) ||
    (record.materials.courseOutline && record.materials.firstClassPlan)
  );
}

function submittedInterviewCount(record: DecisionReadinessRecord): number {
  return record.interviewReviews.filter((r) => r.status === "SUBMITTED").length;
}

function leadReview(record: DecisionReadinessRecord) {
  return (
    record.applicationReviews.find((r) => r.isLeadReview) ??
    record.applicationReviews[0] ??
    null
  );
}

function leadReviewComplete(record: DecisionReadinessRecord): boolean {
  const review = leadReview(record);
  if (!review || review.status !== "SUBMITTED") return false;
  return Boolean(review.summary?.trim() || review.nextStep);
}

function interviewFeedbackComplete(record: DecisionReadinessRecord): boolean {
  const assigned = record.interviewerAssignments.length;
  const submitted = submittedInterviewCount(record);
  if (assigned > 0) return submitted >= assigned;
  return submitted > 0;
}

function infoRequestClear(record: DecisionReadinessRecord): boolean {
  if (record.status === "INFO_REQUESTED" && !record.applicantResponse?.trim()) {
    return false;
  }
  return !record.infoRequest?.trim();
}

/** Build readiness input shared by signal computation and the checklist. */
export function readinessInputFromRecord(
  record: DecisionReadinessRecord
): ReadinessInput {
  return {
    status: record.status,
    interviewReviews: record.interviewReviews.filter((r) => r.status === "SUBMITTED"),
    applicationReviews: record.applicationReviews.filter((r) => r.status === "SUBMITTED"),
    interviewerAssignmentCount: record.interviewerAssignments.length,
    materialsReadyAt: record.materialsReadyAtISO,
    materials: record.materials,
    infoRequest: record.infoRequest,
  };
}

export function readinessSignalsFromRecord(
  record: DecisionReadinessRecord
): ReadinessSignals {
  return computeReadinessSignals(readinessInputFromRecord(record));
}

/**
 * Stage-aware checklist for Application 360 — only the checks that matter now,
 * with links to the forms where staff actually submit reviews.
 */
export function buildDecisionReadinessChecks(
  record: DecisionReadinessRecord,
  options?: BuildDecisionReadinessOptions
): DecisionReadinessCheck[] {
  const checks: DecisionReadinessCheck[] = [];
  const reviewFormHref = options?.applicationId
    ? instructorReviewFormHref(options.applicationId, options.inlineForms)
    : "#reviews";
  const interviewFormHref = options?.applicationId
    ? instructorInterviewFormHref(options.applicationId, options.inlineForms)
    : "#reviews";
  const actorIsReviewer =
    Boolean(options?.actorId) && record.reviewer?.id === options?.actorId;
  const actorIsInterviewer =
    Boolean(options?.actorId) &&
    record.interviewerAssignments.some((a) => a.interviewer.id === options?.actorId);

  const materialsDone = materialsComplete(record);
  checks.push({
    label: "Course materials",
    done: materialsDone,
    detail: materialsDone
      ? "Marked as on file"
      : "Mark as on file when course outline and first-class plan are ready",
    href: materialsDone ? undefined : options?.inlineForms ? "#readiness" : "#application",
    linkLabel: materialsDone ? undefined : "Mark materials",
  });

  const review = leadReview(record);
  const initialDone = leadReviewComplete(record);
  const reviewerName = record.reviewer?.name ?? review?.reviewerName;
  checks.push({
    label: "Initial review",
    done: initialDone,
    detail: initialDone
      ? `${review!.reviewerName} submitted their recommendation`
      : review
        ? review.status === "DRAFT"
          ? actorIsReviewer
            ? "You started a draft — finish and submit below"
            : `${review.reviewerName} has a draft — open the form below`
          : actorIsReviewer
            ? "Submit your recommendation in the form below"
            : `${review.reviewerName} submits in the form below`
        : record.reviewer
          ? actorIsReviewer
            ? "Submit your recommendation in the form below"
            : `${reviewerName} submits in the form below`
          : "Assign a reviewer, then they submit in the form below",
    href: initialDone ? undefined : reviewFormHref,
    linkLabel: actorIsReviewer ? "Open review form" : "Open review form",
  });

  const showInterview =
    Boolean(record.reviewer?.id) ||
    POST_INTERVIEW_STATUSES.has(record.status) ||
    record.interviewerAssignments.length > 0;
  if (showInterview) {
    const assigned = record.interviewerAssignments.length;
    const submitted = submittedInterviewCount(record);
    const interviewDone = interviewFeedbackComplete(record);
    const waitingOn =
      assigned > 0
        ? record.interviewerAssignments.filter(
            (assignment) =>
              !record.interviewReviews.some(
                (r) =>
                  r.reviewerName === assignment.interviewer.name && r.status === "SUBMITTED"
              )
          )
        : [];

    checks.push({
      label: "Interview feedback",
      done: interviewDone,
      detail: interviewDone
        ? assigned > 0
          ? `${submitted} of ${assigned} interviewer review${assigned === 1 ? "" : "s"} in`
          : "Interview review submitted"
        : assigned > 0
          ? waitingOn.length > 0
            ? actorIsInterviewer && waitingOn.some((a) => a.interviewer.id === options?.actorId)
              ? "Submit your interview feedback in the form below"
              : `Waiting on ${waitingOn
                  .slice(0, 2)
                  .map((a) => a.interviewer.name)
                  .join(", ")}${waitingOn.length > 2 ? ` +${waitingOn.length - 2} more` : ""} — use the form below`
            : `${submitted} of ${assigned} interviewer reviews submitted`
          : record.status === "INTERVIEW_SCHEDULED"
            ? "Interview is scheduled — feedback goes in the form below"
            : record.reviewer
              ? actorIsInterviewer
                ? "Submit your interview feedback in the form below"
                : "After the interview, submit feedback in the form below"
              : "Interview feedback is submitted in the form below",
      href: interviewDone ? undefined : interviewFormHref,
      linkLabel: actorIsInterviewer ? "Open interview form" : "Open interview form",
    });
  }

  const showInfo =
    record.status === "INFO_REQUESTED" || Boolean(record.infoRequest?.trim());
  if (showInfo) {
    const infoDone = infoRequestClear(record);
    checks.push({
      label: "Info request",
      done: infoDone,
      detail: infoDone
        ? "Applicant has responded — no open info request"
        : record.applicantResponse?.trim()
          ? "Applicant responded — resume the review"
          : "Waiting on the applicant to respond",
      href: infoDone ? undefined : "#application",
      linkLabel: "View application",
    });
  }

  return checks;
}

export function readinessSummary(
  checks: DecisionReadinessCheck[]
): { readyCount: number; total: number; headline: string } {
  const readyCount = checks.filter((c) => c.done).length;
  const total = checks.length;
  const headline =
    total === 0
      ? ""
      : readyCount === total
        ? "Ready for chair decision"
        : `${readyCount} of ${total} complete`;
  return { readyCount, total, headline };
}

export function readinessFactValue(checks: DecisionReadinessCheck[]): string {
  const { readyCount, total } = readinessSummary(checks);
  return total === 0 ? "—" : `${readyCount}/${total}`;
}

/** Percent complete from the same checklist shown in #readiness. */
export function readinessPercentFromChecks(checks: DecisionReadinessCheck[]): number {
  if (checks.length === 0) return 100;
  const readyCount = checks.filter((c) => c.done).length;
  return Math.round((readyCount / checks.length) * 100);
}

/**
 * Map stage-aware checklist rows to the four legacy warning signals used by
 * the final-review dock. Omitted checklist rows count as satisfied.
 */
export function readinessSignalsFromChecks(
  checks: DecisionReadinessCheck[]
): ReadinessSignals {
  const done = (label: string) => checks.find((c) => c.label === label)?.done;
  const includes = (label: string) => checks.some((c) => c.label === label);

  return {
    hasMaterialsComplete: includes("Course materials") ? Boolean(done("Course materials")) : true,
    hasReviewerRecommendation: includes("Initial review") ? Boolean(done("Initial review")) : true,
    hasSubmittedInterviewReviews: includes("Interview feedback")
      ? Boolean(done("Interview feedback"))
      : true,
    hasNoOpenInfoRequest: includes("Info request") ? Boolean(done("Info request")) : true,
  };
}

/** Short copy for the decision card when the chair dock is not active yet. */
export function decisionAwaitingMessage(status: string): string {
  switch (status) {
    case "SUBMITTED":
    case "UNDER_REVIEW":
      return "Opens after initial review and interview are complete.";
    case "INFO_REQUESTED":
      return "Resolve the open info request, then continue the review.";
    case "PRE_APPROVED":
      return "Schedule and complete the interview before chair review.";
    case "INTERVIEW_SCHEDULED":
      return "Complete the interview and collect interviewer feedback first.";
    case "INTERVIEW_COMPLETED":
      return "Move this application to the chair queue when feedback is in.";
    case "CHAIR_REVIEW":
      return "Submit your decision below.";
    default:
      return "Not ready for a chair decision yet.";
  }
}
