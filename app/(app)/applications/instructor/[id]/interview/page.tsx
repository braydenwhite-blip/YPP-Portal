import Link from "next/link";
import { redirect } from "next/navigation";

import InterviewReviewEditor from "@/components/instructor-review/interview-review-editor";
import {
  getInstructorInterviewReviewWorkspace,
  updateInstructorInterviewScheduleAction,
  saveInstructorInterviewReviewAction,
} from "@/lib/instructor-review-actions";
import { PROGRESS_RATING_OPTIONS } from "@/lib/instructor-review-config";

function progressBadge(value?: string | null) {
  if (!value) return null;
  return PROGRESS_RATING_OPTIONS.find((option) => option.value === value) ?? null;
}

function formatDate(value?: string | Date | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toDateTimeLocal(value?: Date | null) {
  if (!value) return "";
  const local = new Date(value);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 16);
}

function NoticeBanner({ notice }: { notice?: string }) {
  if (!notice) return null;

  const messages: Record<string, string> = {
    "interview-scheduled": "Interview schedule updated.",
    "interview-review-saved": "Interview review draft saved.",
    "interview-review-submitted": "Interview review submitted.",
  };

  const message = messages[notice];
  if (!message) return null;

  return (
    <div
      className="card"
      style={{
        background: "#eff6ff",
        border: "1px solid #bfdbfe",
        color: "#1d4ed8",
        marginBottom: 16,
      }}
    >
      <p style={{ margin: 0, fontSize: 14 }}>{message}</p>
    </div>
  );
}

export default async function InstructorInterviewReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ notice?: string }>;
}) {
  const { id } = await params;
  const notice = (await searchParams)?.notice;
  let workspace;
  try {
    workspace = await getInstructorInterviewReviewWorkspace(id);
  } catch (error) {
    if (error instanceof Error && error.message.includes("has not reached the interview workflow")) {
      redirect(`/applications/instructor/${id}`);
    }
    throw error;
  }

  const {
    actor,
    application,
    applicationReviews,
    drafts,
    selectedDraftId,
    reviews,
    myReview,
    questionBank,
    isLeadReviewer,
    canFinalizeRecommendation,
  } = workspace;

  const canEdit =
    !myReview || myReview.status !== "SUBMITTED" || workspace.canEditSubmittedReview;
  const backHref = actor.roles.includes("ADMIN")
    ? "/admin/instructor-applicants"
    : "/chapter-lead/instructor-applicants";
  const selectedDraft = drafts.find((draft) => draft.id === selectedDraftId) ?? drafts[0] ?? null;
  const leadApplicationReview =
    applicationReviews.find((review) => review.isLeadReview) ?? applicationReviews[0] ?? null;
  const otherInterviewReviews = reviews.filter((review) => review.reviewerId !== actor.id);
  const canSchedule =
    actor.roles.includes("ADMIN") || actor.roles.includes("CHAPTER_PRESIDENT");

  return (
    <div className="page-shell">
      <NoticeBanner notice={notice} />

      <div className="page-header" style={{ alignItems: "start" }}>
        <div>
          <Link href={`/applications/instructor/${application.id}`} style={{ color: "var(--muted)", fontSize: 13 }}>
            &larr; Back to application review
          </Link>
          <h1 className="page-title" style={{ marginBottom: 6 }}>
            Instructor Interview Workflow
          </h1>
          <p className="page-subtitle" style={{ marginBottom: 10 }}>
            {application.legalName || application.applicant.name} · {application.subjectsOfInterest || "Instructor applicant"}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="pill pill-small">
              Status: {application.status.replace(/_/g, " ")}
            </span>
            {application.applicant.chapter?.name ? (
              <span className="pill pill-small pill-info">
                Chapter: {application.applicant.chapter.name}
              </span>
            ) : null}
            {application.reviewer?.name ? (
              <span className="pill pill-small pill-purple">
                Lead Reviewer: {application.reviewer.name}
              </span>
            ) : null}
            {selectedDraft ? (
              <span className="pill pill-small pill-success">
                Draft: {selectedDraft.status.replace(/_/g, " ")}
              </span>
            ) : (
              <span className="pill pill-small pill-pending">Draft missing</span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "end" }}>
          <Link href={backHref} className="button secondary" style={{ textDecoration: "none" }}>
            Applicant Queue
          </Link>
          {isLeadReviewer ? (
            <div className="card" style={{ padding: "10px 12px" }}>
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                You can submit the final recommendation from this page.
              </p>
            </div>
          ) : (
            <div className="card" style={{ padding: "10px 12px" }}>
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                Your interview notes feed into the lead reviewer’s final recommendation.
              </p>
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(320px, 1fr)",
          gap: 20,
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: 20 }}>
          <div className="card" style={{ display: "grid", gap: 14 }}>
            <div>
              <h2 style={{ margin: "0 0 6px" }}>Application Snapshot</h2>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
                The interview should review both the candidate and the draft they bring into the room.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              <div className="card" style={{ background: "var(--surface-alt)", padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>
                  Why they want to teach
                </div>
                <div style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{application.motivation}</div>
              </div>
              <div className="card" style={{ background: "var(--surface-alt)", padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>
                  Teaching experience
                </div>
                <div style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{application.teachingExperience}</div>
              </div>
            </div>

            {leadApplicationReview ? (
              <div
                style={{
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--surface-alt)",
                  padding: 14,
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <div style={{ fontWeight: 700 }}>
                    Lead application review
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {leadApplicationReview.overallRating ? (
                      <span
                        className="pill pill-small"
                        style={{
                          background:
                            progressBadge(leadApplicationReview.overallRating)?.bg,
                          color: progressBadge(leadApplicationReview.overallRating)?.color,
                        }}
                      >
                        {progressBadge(leadApplicationReview.overallRating)?.label}
                      </span>
                    ) : null}
                    {leadApplicationReview.nextStep ? (
                      <span className="pill pill-small">
                        {leadApplicationReview.nextStep.replace(/_/g, " ")}
                      </span>
                    ) : null}
                  </div>
                </div>
                {leadApplicationReview.summary ? (
                  <p style={{ margin: 0, fontSize: 14 }}>{leadApplicationReview.summary}</p>
                ) : null}
                {leadApplicationReview.concerns ? (
                  <p style={{ margin: 0, fontSize: 14, color: "#92400e" }}>
                    Concerns: {leadApplicationReview.concerns}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          {canSchedule ? (
            <div className="card" style={{ display: "grid", gap: 12 }}>
              <div>
                <h2 style={{ margin: "0 0 6px" }}>Interview Scheduling</h2>
                <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
                  Scheduling lives on the interview page so reviewers can move naturally from preparation to live evaluation.
                </p>
              </div>

              <div
                style={{
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--surface-alt)",
                  padding: 14,
                }}
              >
                <div style={{ fontWeight: 700 }}>Current interview time</div>
                <div style={{ fontSize: 14, color: "var(--muted)", marginTop: 6 }}>
                  {application.interviewScheduledAt
                    ? formatDate(application.interviewScheduledAt)
                    : "No time booked yet"}
                </div>
              </div>

              <form action={updateInstructorInterviewScheduleAction} className="form-grid">
                <input type="hidden" name="applicationId" value={application.id} />
                <input
                  type="hidden"
                  name="returnTo"
                  value={`/applications/instructor/${application.id}/interview`}
                />
                <label className="form-row">
                  Interview date and time
                  <input
                    className="input"
                    type="datetime-local"
                    name="scheduledAt"
                    defaultValue={toDateTimeLocal(application.interviewScheduledAt)}
                    required
                  />
                </label>
                <label className="form-row">
                  Scheduling note
                  <textarea
                    className="input"
                    name="scheduleNotes"
                    rows={2}
                    placeholder="Optional meeting link, prep note, or scheduling context..."
                  />
                </label>
                <button className="button secondary" type="submit">
                  Save Interview Time
                </button>
              </form>
            </div>
          ) : null}

          <InterviewReviewEditor
            action={saveInstructorInterviewReviewAction}
            applicationId={application.id}
            returnTo={`/applications/instructor/${application.id}/interview`}
            initialReview={
              myReview
                ? {
                    status: myReview.status,
                    overallRating: myReview.overallRating,
                    recommendation: myReview.recommendation,
                    summary: myReview.summary,
                    overallNotes: myReview.overallNotes,
                    curriculumFeedback: myReview.curriculumFeedback,
                    revisionRequirements: myReview.revisionRequirements,
                    applicantMessage: myReview.applicantMessage,
                    flagForLeadership: myReview.flagForLeadership,
                    curriculumDraftId: myReview.curriculumDraftId,
                    categories: myReview.categories.map((category) => ({
                      category: category.category,
                      rating: category.rating,
                      notes: category.notes,
                    })),
                    questionResponses: myReview.questionResponses.map((question) => ({
                      id: question.id,
                      questionBankId: question.questionBankId,
                      source: question.source,
                      prompt: question.prompt,
                      followUpPrompt: question.followUpPrompt,
                      notes: question.notes,
                      sortOrder: question.sortOrder,
                    })),
                  }
                : null
            }
            canEdit={canEdit}
            isLeadReviewer={isLeadReviewer}
            canFinalizeRecommendation={canFinalizeRecommendation}
            drafts={drafts.map((draft) => ({
              ...draft,
              updatedAt: draft.updatedAt.toISOString(),
            }))}
            selectedDraftId={selectedDraftId}
            questionBank={questionBank}
          />
        </div>

        <div style={{ display: "grid", gap: 20 }}>
          <div className="card" style={{ display: "grid", gap: 12 }}>
            <div>
              <h2 style={{ margin: "0 0 6px" }}>Draft Reference</h2>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
                The latest working draft is foregrounded first, but reviewers can still inspect recent draft history.
              </p>
            </div>

            {drafts.length === 0 ? (
              <div
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: "#fff7ed",
                  border: "1px solid #fdba74",
                  color: "#9a3412",
                  fontSize: 14,
                }}
              >
                No draft is available to review.
              </div>
            ) : (
              <>
                {selectedDraft ? (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "var(--surface-alt)",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{selectedDraft.title || "Untitled curriculum"}</div>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                      {selectedDraft.status.replace(/_/g, " ")} · Updated {formatDate(selectedDraft.updatedAt)}
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <Link
                        href={`/instructor/lesson-design-studio/print?draftId=${selectedDraft.id}&type=instructor`}
                        className="button small outline"
                        style={{ textDecoration: "none" }}
                      >
                        Open Draft
                      </Link>
                    </div>
                  </div>
                ) : null}

                <div style={{ display: "grid", gap: 10 }}>
                  {drafts.map((draft) => (
                    <div
                      key={draft.id}
                      style={{
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        padding: 12,
                        background: draft.id === selectedDraftId ? "var(--surface-alt)" : "var(--surface)",
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{draft.title || "Untitled curriculum"}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                        {draft.status.replace(/_/g, " ")} · Updated {formatDate(draft.updatedAt)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="card" style={{ display: "grid", gap: 12 }}>
            <div>
              <h2 style={{ margin: "0 0 6px" }}>Other Interview Reviews</h2>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
                Separate reviewer perspectives stay visible here so the final recommendation does not lose important nuance.
              </p>
            </div>

            {otherInterviewReviews.length === 0 ? (
              <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
                No other structured interview reviews yet.
              </p>
            ) : (
              otherInterviewReviews.map((review) => {
                const overall = progressBadge(review.overallRating);
                return (
                  <div
                    key={review.id}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      padding: 12,
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                      <div style={{ fontWeight: 700 }}>{review.reviewer.name}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {review.isLeadReview ? <span className="pill pill-small pill-purple">Lead</span> : null}
                        {overall ? (
                          <span className="pill pill-small" style={{ background: overall.bg, color: overall.color }}>
                            {overall.label}
                          </span>
                        ) : null}
                        {review.recommendation ? (
                          <span className="pill pill-small">
                            {review.recommendation.replace(/_/g, " ")}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {review.summary ? <p style={{ margin: 0, fontSize: 14 }}>{review.summary}</p> : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
