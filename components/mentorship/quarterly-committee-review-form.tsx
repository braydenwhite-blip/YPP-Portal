"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui-v2";
import {
  approveQuarterlyReview,
  boardApproveQuarterlyReview,
  requestQuarterlyReviewChanges,
  saveQuarterlyReviewDraft,
  startQuarterlyReview,
} from "@/lib/mentorship/quarterly-review-actions";
import { createFeedbackRequest } from "@/lib/goal-review-actions";

const DECISION_OPTIONS = [
  { value: "", label: "— no recommendation yet —" },
  { value: "CONTINUATION", label: "Continue current path" },
  { value: "PROMOTION", label: "Promotion consideration" },
  { value: "ACHIEVEMENT_AWARD", label: "Award recommendation" },
  { value: "ROLE_CHANGE", label: "Role change" },
  { value: "PIP", label: "Support plan / performance improvement" },
] as const;

export interface QuarterlyReviewRecord {
  id: string;
  status: "DRAFT" | "PENDING_CHAIR_APPROVAL" | "CHANGES_REQUESTED" | "PENDING_BOARD_APPROVAL" | "APPROVED";
  broaderFeedbackSummary: string | null;
  committeeNotes: string | null;
  decision: string | null;
  decisionRationale: string | null;
  chairComments: string | null;
}

interface Props {
  mentorshipId: string;
  review: QuarterlyReviewRecord | null;
  canRecommend: boolean;
  canApprove: boolean;
  personName: string;
  feedbackRequestTokens: { id: string; token: string; createdAt: Date }[];
  quarterNumber: number;
}

export function QuarterlyReviewForm({
  mentorshipId,
  review,
  canRecommend,
  canApprove,
  personName,
  feedbackRequestTokens,
  quarterNumber,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [broaderFeedbackSummary, setBroaderFeedbackSummary] = useState(review?.broaderFeedbackSummary ?? "");
  const [committeeNotes, setCommitteeNotes] = useState(review?.committeeNotes ?? "");
  const [decision, setDecision] = useState(review?.decision ?? "");
  const [decisionRationale, setDecisionRationale] = useState(review?.decisionRationale ?? "");
  const [chairComments, setChairComments] = useState("");

  function run(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  const isEditable = canRecommend && (!review || review.status === "DRAFT" || review.status === "CHANGES_REQUESTED");

  if (!review) {
    if (!canRecommend) {
      return <p className="m-0 text-[12.5px] text-ink-muted">Waiting on the assigned mentor to start this review.</p>;
    }
    return (
      <div>
        {error && <p className="m-0 mb-2 text-[12.5px] font-semibold text-danger-700">{error}</p>}
        <Button
          variant="primary"
          size="sm"
          disabled={pending}
          onClick={() => run(() => startQuarterlyReview({ mentorshipId }))}
        >
          {pending ? "Starting…" : "Start quarterly review"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {review.status === "CHANGES_REQUESTED" && review.chairComments && (
        <div className="rounded-lg bg-progress-50 p-2.5 text-[12.5px] text-ink">
          <strong>Chair requested changes:</strong> {review.chairComments}
        </div>
      )}

      {isEditable ? (
        <>
          <div>
            <label className="text-[12.5px] font-semibold text-ink">Broader feedback summary</label>
            <textarea
              value={broaderFeedbackSummary}
              onChange={(e) => setBroaderFeedbackSummary(e.target.value)}
              rows={3}
              placeholder="Synthesize what parents, students, school officials, leadership, and collaborators shared…"
              className="mt-1 w-full resize-vertical rounded border border-line-soft px-2 py-1.5 text-[13px]"
            />
            {feedbackRequestTokens.length === 0 && (
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    const fd = new FormData();
                    fd.set("mentorshipId", mentorshipId);
                    fd.set("quarterNumber", String(quarterNumber));
                    await createFeedbackRequest(fd);
                  })
                }
              >
                {pending ? "Requesting…" : "Request stakeholder feedback"}
              </Button>
            )}
          </div>

          <div>
            <label className="text-[12.5px] font-semibold text-ink">Committee discussion notes</label>
            <textarea
              value={committeeNotes}
              onChange={(e) => setCommitteeNotes(e.target.value)}
              rows={3}
              placeholder="What the Role Committee discussed about this quarter…"
              className="mt-1 w-full resize-vertical rounded border border-line-soft px-2 py-1.5 text-[13px]"
            />
          </div>

          <div>
            <label className="text-[12.5px] font-semibold text-ink">Pathway Decision</label>
            <select
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              className="mt-1 w-full rounded border border-line-soft px-2 py-1.5 text-[13px]"
            >
              {DECISION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[12.5px] font-semibold text-ink">Rationale</label>
            <textarea
              value={decisionRationale}
              onChange={(e) => setDecisionRationale(e.target.value)}
              rows={3}
              placeholder="Why the committee is recommending this path for {personName}…"
              className="mt-1 w-full resize-vertical rounded border border-line-soft px-2 py-1.5 text-[13px]"
            />
          </div>

          {error && <p className="m-0 text-[12.5px] font-semibold text-danger-700">{error}</p>}

          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(() =>
                  saveQuarterlyReviewDraft({
                    reviewId: review.id,
                    broaderFeedbackSummary,
                    committeeNotes,
                    decision: decision || undefined,
                    decisionRationale,
                  })
                )
              }
            >
              {pending ? "Saving…" : "Save draft"}
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={pending || !decision}
              onClick={() =>
                run(() =>
                  saveQuarterlyReviewDraft({
                    reviewId: review.id,
                    broaderFeedbackSummary,
                    committeeNotes,
                    decision: decision || undefined,
                    decisionRationale,
                    submitForApproval: true,
                  })
                )
              }
            >
              {pending ? "Submitting…" : "Submit for committee approval"}
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-2 text-[13px] text-ink">
          {review.broaderFeedbackSummary && (
            <p className="m-0">
              <strong>Feedback summary:</strong> {review.broaderFeedbackSummary}
            </p>
          )}
          {review.committeeNotes && (
            <p className="m-0">
              <strong>Committee notes:</strong> {review.committeeNotes}
            </p>
          )}
          {review.decision && (
            <p className="m-0">
              <strong>Recommended Pathway Decision:</strong>{" "}
              {DECISION_OPTIONS.find((o) => o.value === review.decision)?.label ?? review.decision}
            </p>
          )}
          {review.decisionRationale && <p className="m-0">{review.decisionRationale}</p>}
        </div>
      )}

      {canApprove && review.status === "PENDING_CHAIR_APPROVAL" && (
        <div className="mt-2 flex flex-col gap-2 border-t border-line-soft pt-3">
          <textarea
            value={chairComments}
            onChange={(e) => setChairComments(e.target.value)}
            rows={2}
            placeholder="Comments for the mentor (optional for approval, required for changes)…"
            className="w-full resize-vertical rounded border border-line-soft px-2 py-1.5 text-[13px]"
          />
          {error && <p className="m-0 text-[12.5px] font-semibold text-danger-700">{error}</p>}
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              disabled={pending}
              onClick={() => run(() => approveQuarterlyReview({ reviewId: review.id, chairComments }))}
            >
              {pending ? "Approving…" : "Approve"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={pending || !chairComments.trim()}
              onClick={() => run(() => requestQuarterlyReviewChanges({ reviewId: review.id, chairComments }))}
            >
              Request changes
            </Button>
          </div>
        </div>
      )}

      {canApprove && review.status === "PENDING_BOARD_APPROVAL" && (
        <div className="mt-2 flex flex-col gap-2 border-t border-line-soft pt-3">
          <p className="m-0 text-[12.5px] text-ink-muted">
            This Pathway Decision requires Board sign-off before it&apos;s final.
          </p>
          {error && <p className="m-0 text-[12.5px] font-semibold text-danger-700">{error}</p>}
          <div>
            <Button
              variant="primary"
              size="sm"
              disabled={pending}
              onClick={() => run(() => boardApproveQuarterlyReview({ reviewId: review.id }))}
            >
              {pending ? "Approving…" : "Board approve"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
