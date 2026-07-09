import { CardV2, StatusBadge, type StatusTone } from "@/components/ui-v2";
import { loadQuarterlyPacket } from "@/lib/mentorship/quarterly-review";
import type { MentorshipWorkspace } from "@/lib/mentorship/workspace";
import { getGoalRatingCopy } from "@/lib/mentorship-rubric-copy";

import { QuarterlyReviewForm } from "../quarterly-committee-review-form";

const RATING_TONE: Record<string, StatusTone> = {
  ABOVE_AND_BEYOND: "brand",
  ACHIEVED: "success",
  GETTING_STARTED: "warning",
  BEHIND_SCHEDULE: "danger",
};

function formatMonth(value: Date) {
  return value.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

/**
 * The Quarterly Committee Review packet — dominates the Reviews section once
 * every 3rd cycle's monthly review is released, until the committee's
 * Pathway Decision (if any) is fully approved. Renders on /people/[id]
 * itself; there is no separate quarterly-review page for a single person.
 */
export async function QuarterlyReviewSection({ workspace }: { workspace: MentorshipWorkspace }) {
  const { lifecycle, capabilities, person, activeMentorshipId } = workspace;
  if (!lifecycle.quarterlyDue || !activeMentorshipId) return null;
  if (lifecycle.quarterlyStatus === "APPROVED") return null; // dominance ends once approved

  const packet = await loadQuarterlyPacket({
    mentorshipId: activeMentorshipId,
    menteeId: person.id,
  });

  return (
    <CardV2 padding="lg" className="border-l-4 border-l-brand-600">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="m-0 text-[15px] font-bold text-ink">Quarterly Committee Review — {packet.quarter}</p>
          <p className="m-0 mt-1 text-[12.5px] text-ink-muted">
            Every third cycle, the Role Committee reviews the last three monthly reviews plus gathered
            feedback and may record a Pathway Decision for {person.name.split(" ")[0]}.
          </p>
        </div>
        <StatusBadge tone={packet.existingReview ? "info" : "warning"} withDot>
          {packet.existingReview ? statusLabel(packet.existingReview.status) : "Not started"}
        </StatusBadge>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {packet.monthlyReviews.map((r) => {
          const cfg = getGoalRatingCopy(r.overallRating);
          return (
            <div key={r.id} className="rounded-lg bg-surface-soft p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold text-ink-muted">{formatMonth(r.cycleMonth)}</span>
                <StatusBadge tone={RATING_TONE[r.overallRating] ?? "info"} withDot>
                  {cfg.label}
                </StatusBadge>
              </div>
              <p className="m-0 mt-2 line-clamp-3 text-[12.5px] text-ink">{r.overallComments}</p>
            </div>
          );
        })}
        {packet.monthlyReviews.length === 0 && (
          <p className="col-span-3 m-0 text-[12.5px] text-ink-muted">No released monthly reviews yet.</p>
        )}
      </div>

      {packet.feedback.length > 0 && (
        <div className="mt-4">
          <p className="m-0 text-[12px] font-bold uppercase tracking-[0.05em] text-ink-muted">
            Stakeholder feedback ({packet.feedback.length})
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {packet.feedback.slice(0, 5).map((f) => (
              <div key={f.id} className="rounded-lg bg-surface-soft p-2.5 text-[12.5px]">
                <span className="font-semibold text-ink">
                  {f.respondentRole} · {f.overallRating}/5
                </span>
                <p className="m-0 mt-1 text-ink-muted">{f.strengths}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="m-0 mt-3 text-[12px] text-ink-muted">
        {packet.pointsThisQuarter} achievement points earned across these reviews.
      </p>

      <div className="mt-4">
        <QuarterlyReviewForm
          mentorshipId={activeMentorshipId}
          review={
            packet.existingReview
              ? {
                  id: packet.existingReview.id,
                  status: packet.existingReview.status,
                  broaderFeedbackSummary: packet.existingReview.broaderFeedbackSummary,
                  committeeNotes: packet.existingReview.committeeNotes,
                  decision: packet.existingReview.decision,
                  decisionRationale: packet.existingReview.decisionRationale,
                  chairComments: packet.existingReview.chairComments,
                }
              : null
          }
          canRecommend={capabilities.canRecommendPathwayDecision}
          canApprove={capabilities.canApprovePathwayDecision}
          personName={person.name}
          feedbackRequestTokens={packet.feedbackRequestTokens}
          quarterNumber={packet.quarterNumber}
        />
      </div>
    </CardV2>
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "PENDING_CHAIR_APPROVAL":
      return "Pending committee approval";
    case "CHANGES_REQUESTED":
      return "Changes requested";
    case "PENDING_BOARD_APPROVAL":
      return "Pending Board approval";
    case "APPROVED":
      return "Approved";
    default:
      return status;
  }
}
