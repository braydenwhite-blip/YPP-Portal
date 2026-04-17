import Link from "next/link";

import ApplicationReviewEditor from "@/components/instructor-review/application-review-editor";
import {
  claimInstructorApplicationLeadReviewerAction,
  getInstructorApplicationReviewWorkspace,
  saveInstructorApplicationReviewAction,
} from "@/lib/instructor-review-actions";
import { PROGRESS_RATING_OPTIONS } from "@/lib/instructor-review-config";

function statusLabel(status: string, hasInterviewDate: boolean) {
  if (status === "INTERVIEW_SCHEDULED" && !hasInterviewDate) {
    return "Interview Stage";
  }
  return status.replace(/_/g, " ");
}

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

function NoticeBanner({ notice }: { notice?: string }) {
  if (!notice) return null;

  const messages: Record<string, string> = {
    "application-review-saved": "Application review draft saved.",
    "application-review-submitted": "Application review submitted.",
    "lead-reviewer-claimed": "You are now the lead reviewer for this applicant.",
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

function DetailBlock({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  if (!value) return null;
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 14,
        background: "var(--surface)",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{value}</div>
    </div>
  );
}

export default async function InstructorApplicationReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ notice?: string }>;
}) {
  const { id } = await params;
  const notice = (await searchParams)?.notice;
  const workspace = await getInstructorApplicationReviewWorkspace(id);

  const { application, actor, drafts, selectedDraftId, reviews, myReview, isLeadReviewer } =
    workspace;
  const backHref = actor.roles.includes("ADMIN")
    ? "/admin/instructor-applicants"
    : "/chapter-lead/instructor-applicants";
  const canEdit =
    !myReview || myReview.status !== "SUBMITTED" || workspace.canEditSubmittedReview;
  const selectedDraft = drafts.find((draft) => draft.id === selectedDraftId) ?? drafts[0] ?? null;
  const otherReviews = reviews.filter((review) => review.reviewerId !== actor.id);

  return (
    <div className="page-shell">
      <NoticeBanner notice={notice} />

      <div className="page-header" style={{ alignItems: "start" }}>
        <div>
          <Link href={backHref} style={{ color: "var(--muted)", fontSize: 13 }}>
            &larr; Back to instructor applicants
          </Link>
          <h1 className="page-title" style={{ marginBottom: 6 }}>
            Instructor Application Review
          </h1>
          <p className="page-subtitle" style={{ marginBottom: 10 }}>
            {application.legalName || application.applicant.name} · {application.applicant.email}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="pill pill-small">
              Status: {statusLabel(application.status, Boolean(application.interviewScheduledAt))}
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
            ) : (
              <span className="pill pill-small">Lead reviewer not assigned</span>
            )}
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
          {application.status === "INTERVIEW_SCHEDULED" ||
          application.status === "INTERVIEW_COMPLETED" ||
          application.status === "ON_HOLD" ||
          application.status === "APPROVED" ||
          application.status === "REJECTED" ? (
            <Link
              href={`/applications/instructor/${application.id}/interview`}
              className="button secondary"
              style={{ textDecoration: "none" }}
            >
              Open Interview Page
            </Link>
          ) : null}
          {!isLeadReviewer ? (
            <form action={claimInstructorApplicationLeadReviewerAction}>
              <input type="hidden" name="applicationId" value={application.id} />
              <input type="hidden" name="returnTo" value={`/applications/instructor/${application.id}`} />
              <button className="button" type="submit">
                Claim Lead Review
              </button>
            </form>
          ) : (
            <div className="card" style={{ padding: "10px 12px" }}>
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                You are the lead reviewer for this applicant.
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
          <div className="card" style={{ display: "grid", gap: 16 }}>
            <div>
              <h2 style={{ margin: "0 0 6px" }}>Applicant Snapshot</h2>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
                This page is for internal review only. Use it to decide whether the applicant is ready to move into the interview and curriculum-review stage.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              <DetailBlock label="What they want to teach" value={application.subjectsOfInterest} />
              <DetailBlock label="Availability" value={application.availability} />
              <DetailBlock label="Why they want to teach" value={application.motivation} />
              <DetailBlock label="Teaching experience" value={application.teachingExperience} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
              <DetailBlock label="School" value={application.schoolName} />
              <DetailBlock label="Graduation year" value={application.graduationYear} />
              <DetailBlock label="Hours per week" value={application.hoursPerWeek} />
              <DetailBlock label="Preferred start date" value={application.preferredStartDate} />
              <DetailBlock
                label="Location"
                value={[application.city, application.stateProvince, application.country]
                  .filter(Boolean)
                  .join(", ")}
              />
              <DetailBlock label="Phone" value={application.phoneNumber} />
            </div>

            {application.customResponses.length > 0 ? (
              <div style={{ display: "grid", gap: 12 }}>
                <h3 style={{ margin: 0 }}>Additional Submitted Responses</h3>
                {application.customResponses.map((response) => (
                  <DetailBlock
                    key={response.id}
                    label={response.field.label}
                    value={response.value}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <ApplicationReviewEditor
            action={saveInstructorApplicationReviewAction}
            applicationId={application.id}
            returnTo={`/applications/instructor/${application.id}`}
            initialReview={
              myReview
                ? {
                    status: myReview.status,
                    overallRating: myReview.overallRating,
                    nextStep: myReview.nextStep,
                    summary: myReview.summary,
                    notes: myReview.notes,
                    concerns: myReview.concerns,
                    applicantMessage: myReview.applicantMessage,
                    flagForLeadership: myReview.flagForLeadership,
                    draftOverrideUsed: myReview.draftOverrideUsed,
                    draftOverrideReason: myReview.draftOverrideReason,
                    curriculumDraftId: myReview.curriculumDraftId,
                    categories: myReview.categories.map((category) => ({
                      category: category.category,
                      rating: category.rating,
                      notes: category.notes,
                    })),
                  }
                : null
            }
            canEdit={canEdit}
            isLeadReviewer={isLeadReviewer}
            isAdmin={actor.roles.includes("ADMIN")}
            drafts={drafts.map((draft) => ({
              ...draft,
              updatedAt: draft.updatedAt.toISOString(),
            }))}
            selectedDraftId={selectedDraftId}
          />
        </div>

        <div style={{ display: "grid", gap: 20 }}>
          <div className="card" style={{ display: "grid", gap: 12 }}>
            <div>
              <h2 style={{ margin: "0 0 6px" }}>Curriculum Draft</h2>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
                Before interview, the applicant should already have something concrete in the Lesson Design Studio.
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
                No draft has been started yet.
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
              <h2 style={{ margin: "0 0 6px" }}>Other Reviewer Input</h2>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
                Supporting reviews stay separate, but the lead review drives the official next step.
              </p>
            </div>

            {otherReviews.length === 0 ? (
              <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
                No other structured reviews yet.
              </p>
            ) : (
              otherReviews.map((review) => {
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
                        <span className="pill pill-small">{review.status}</span>
                      </div>
                    </div>
                    {review.summary ? <p style={{ margin: 0, fontSize: 14 }}>{review.summary}</p> : null}
                    {review.nextStep ? (
                      <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                        Next step: {review.nextStep.replace(/_/g, " ")}
                      </p>
                    ) : null}
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
