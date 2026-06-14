import {
  getClassFeedbackSummary,
  getClassOutcome,
  getStudentFeedbackForOffering,
} from "@/lib/class-feedback";
import {
  OUTCOME_STATUS_LABELS,
  REPEAT_RECOMMENDATION_LABELS,
} from "@/lib/class-feedback-constants";
import { StarRating } from "@/components/classes/star-rating";
import { RecordSection, StatusBadge } from "@/components/ui-v2";
import { AdminOutcomeForm } from "../admin-outcome-form";
import { loadClassAdminDetail } from "../_components/loaders";

export const dynamic = "force-dynamic";

export default async function AdminClassFeedbackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, feedbackSummary, studentFeedback, outcome] = await Promise.all([
    loadClassAdminDetail(id),
    getClassFeedbackSummary(id),
    getStudentFeedbackForOffering(id),
    getClassOutcome(id),
  ]);

  const feedbackEligible = Math.max(
    detail.feedbackEligibleCount,
    feedbackSummary.responseCount
  );
  const responseRate =
    feedbackEligible > 0 ? feedbackSummary.responseCount / feedbackEligible : null;

  return (
    <div className="flex flex-col gap-5">
      <RecordSection title="Student feedback" description="Ratings from enrolled students.">
        {feedbackSummary.responseCount > 0 ? (
          <>
            <div className="mb-4 flex flex-wrap gap-6">
              <div>
                <p className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                  Average rating
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[22px] font-bold text-ink">
                    {feedbackSummary.avgRating.toFixed(1)}
                  </span>
                  <StarRating value={Math.round(feedbackSummary.avgRating)} size={16} />
                </div>
              </div>
              <div>
                <p className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                  Responses
                </p>
                <p className="m-0 mt-1 text-[15px] font-semibold text-ink">
                  {feedbackSummary.responseCount}
                  {responseRate !== null
                    ? ` · ${Math.round(responseRate * 100)}%`
                    : ""}
                </p>
              </div>
              {feedbackSummary.recommendPct !== null ? (
                <div>
                  <p className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                    Would recommend
                  </p>
                  <p className="m-0 mt-1 text-[15px] font-semibold text-ink">
                    {Math.round(feedbackSummary.recommendPct * 100)}%
                  </p>
                </div>
              ) : null}
            </div>

            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {studentFeedback.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-[10px] border border-line-soft bg-surface-soft/50 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="m-0 text-[14px] font-semibold text-ink">
                      {entry.studentName}
                    </p>
                    <div className="flex items-center gap-2">
                      <StarRating value={entry.rating} size={14} />
                      {entry.wouldRecommend != null ? (
                        <StatusBadge tone={entry.wouldRecommend ? "success" : "danger"}>
                          {entry.wouldRecommend ? "Recommends" : "Would not"}
                        </StatusBadge>
                      ) : null}
                    </div>
                  </div>
                  {entry.liked ? (
                    <p className="mb-0 mt-2 text-[13px] text-ink-muted">
                      <span className="font-medium text-ink">Liked:</span> {entry.liked}
                    </p>
                  ) : null}
                  {entry.improve ? (
                    <p className="mb-0 mt-1 text-[13px] text-ink-muted">
                      <span className="font-medium text-ink">Improve:</span> {entry.improve}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="m-0 text-[13px] text-ink-muted">
            No student feedback yet. Students are prompted after the class wraps up.
          </p>
        )}
      </RecordSection>

      <RecordSection title="Instructor reflection">
        {outcome?.hasInstructorReflection ? (
          <div className="flex flex-col gap-3 text-[13px] text-ink">
            {outcome.instructorWentWell ? (
              <Quote label="What went well" body={outcome.instructorWentWell} />
            ) : null}
            {outcome.instructorChallenges ? (
              <Quote label="What was hard" body={outcome.instructorChallenges} />
            ) : null}
            {outcome.instructorStudentImpact ? (
              <Quote label="Student impact" body={outcome.instructorStudentImpact} />
            ) : null}
            {outcome.instructorWouldTeachAgain != null ? (
              <p className="m-0">
                <span className="font-semibold">Would teach again:</span>{" "}
                {outcome.instructorWouldTeachAgain ? "Yes" : "No"}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="m-0 text-[13px] text-ink-muted">
            The instructor has not added a wrap-up reflection yet.
          </p>
        )}
      </RecordSection>

      <RecordSection title="Completion outcome" description="Record the final admin verdict.">
        <AdminOutcomeForm
          offeringId={detail.id}
          defaultStatus={outcome?.status ?? "PENDING"}
          defaultRepeat={outcome?.repeatRecommendation ?? ""}
          defaultGotGoodFeedback={outcome?.gotGoodFeedback ?? false}
          defaultNotes={outcome?.adminNotes ?? ""}
          recordedAt={outcome?.recordedAt ?? null}
        />
        {outcome && outcome.status !== "PENDING" ? (
          <p className="mb-0 mt-3 text-[12px] text-ink-muted">
            Current: {OUTCOME_STATUS_LABELS[outcome.status]}
            {outcome.repeatRecommendation
              ? ` · ${REPEAT_RECOMMENDATION_LABELS[outcome.repeatRecommendation]}`
              : ""}
          </p>
        ) : null}
      </RecordSection>
    </div>
  );
}

function Quote({ label, body }: { label: string; body: string }) {
  return (
    <div className="rounded-[10px] border border-line-soft bg-surface-soft/50 px-4 py-3">
      <p className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
        {label}
      </p>
      <p className="mb-0 mt-1 whitespace-pre-line text-[13px] text-ink">{body}</p>
    </div>
  );
}
