"use client";

import {
  ReviewerAssignDropdown,
  type ReviewerCandidate,
} from "@/components/instructor-applicants/ReviewerAssignDropdown";
import {
  LeadInterviewerHeaderControl,
  type LeadInterviewerCandidate,
} from "@/components/instructor-applicants/LeadInterviewerAssignDropdown";

function ReviewerReadOnlyChip({ name }: { name: string | null | undefined }) {
  return (
    <div className="inline-flex shrink-0 flex-col items-end gap-0.5 rounded-[10px] border border-line-soft bg-surface px-3.5 py-2 text-right">
      <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted">
        Reviewer
      </span>
      <span className="text-[13px] font-semibold text-ink">{name ?? "Unassigned"}</span>
    </div>
  );
}

export function ApplicantAssignmentHeaderControls({
  applicationId,
  reviewerName,
  reviewerId,
  canChangeReviewer,
  reviewerCandidates,
  leadAssignment,
  canChangeLeadInterviewer,
  leadInterviewerCandidates,
}: {
  applicationId: string;
  reviewerName: string | null | undefined;
  reviewerId: string | null;
  canChangeReviewer: boolean;
  reviewerCandidates: ReviewerCandidate[];
  leadAssignment: {
    id: string;
    interviewer: { id: string; name: string | null };
  } | null;
  canChangeLeadInterviewer: boolean;
  leadInterviewerCandidates: LeadInterviewerCandidate[];
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
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
      <LeadInterviewerHeaderControl
        canChange={canChangeLeadInterviewer}
        applicationId={applicationId}
        currentAssignment={leadAssignment}
        candidates={leadInterviewerCandidates}
      />
    </div>
  );
}
