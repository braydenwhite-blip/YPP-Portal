"use client";

import {
  ReviewerAssignDropdown,
  type ReviewerCandidate,
} from "@/components/instructor-applicants/ReviewerAssignDropdown";
import {
  InterviewerHeaderControl,
  type LeadInterviewerCandidate,
} from "@/components/instructor-applicants/LeadInterviewerAssignDropdown";

function ReviewerReadOnlyChip({ name }: { name: string | null | undefined }) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-0.5 rounded-[10px] border border-line-soft bg-surface px-3.5 py-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted">
        Reviewer
      </span>
      <span className="truncate text-[13px] font-semibold text-ink">{name ?? "Unassigned"}</span>
    </div>
  );
}

type Assignment = {
  id: string;
  interviewer: { id: string; name: string | null };
} | null;

export function ApplicantAssignmentHeaderControls({
  applicationId,
  reviewerName,
  reviewerId,
  canChangeReviewer,
  reviewerCandidates,
  leadAssignment,
  secondAssignment,
  canChangeLeadInterviewer,
  leadInterviewerCandidates,
  secondInterviewerCandidates,
}: {
  applicationId: string;
  reviewerName: string | null | undefined;
  reviewerId: string | null;
  canChangeReviewer: boolean;
  reviewerCandidates: ReviewerCandidate[];
  leadAssignment: Assignment;
  secondAssignment: Assignment;
  canChangeLeadInterviewer: boolean;
  leadInterviewerCandidates: LeadInterviewerCandidate[];
  secondInterviewerCandidates: LeadInterviewerCandidate[];
}) {
  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {canChangeReviewer ? (
        <ReviewerAssignDropdown
          applicationId={applicationId}
          currentReviewerId={reviewerId}
          candidates={reviewerCandidates}
          label={reviewerName ?? "Assign reviewer"}
        />
      ) : (
        <ReviewerReadOnlyChip name={reviewerName} />
      )}
      <InterviewerHeaderControl
        role="LEAD"
        canChange={canChangeLeadInterviewer}
        applicationId={applicationId}
        currentAssignment={leadAssignment}
        candidates={leadInterviewerCandidates}
      />
      <InterviewerHeaderControl
        role="SECOND"
        canChange={canChangeLeadInterviewer}
        applicationId={applicationId}
        currentAssignment={secondAssignment}
        candidates={secondInterviewerCandidates}
      />
    </div>
  );
}
