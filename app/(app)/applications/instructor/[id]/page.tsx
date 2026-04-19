import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import {
  getHiringActor,
  assertCanViewApplicant,
  isAssignedReviewer,
  isAssignedInterviewer,
  assertCanActAsChair,
  isAdmin,
  isHiringChair,
  isChapterLead,
  canSeeChairQueue,
} from "@/lib/chapter-hiring-permissions";
import { isInstructorApplicantWorkflowV1Enabled } from "@/lib/feature-flags";
import ApplicantCockpitHeader from "@/components/instructor-applicants/ApplicantCockpitHeader";
import ApplicantCockpitSidebar from "@/components/instructor-applicants/ApplicantCockpitSidebar";
import ApplicantNextActionBar from "@/components/instructor-applicants/ApplicantNextActionBar";
import ApplicantTimelineFeed from "@/components/instructor-applicants/ApplicantTimelineFeed";
import InterviewSchedulingInlinePanel from "@/components/instructor-applicants/InterviewSchedulingInlinePanel";
import ApplicationReviewEditor from "@/components/instructor-review/application-review-editor";
import {
  saveInstructorApplicationReviewAction,
  getInstructorApplicationReviewWorkspace,
} from "@/lib/instructor-review-actions";
import { PROGRESS_RATING_OPTIONS } from "@/lib/instructor-review-config";

export const dynamic = "force-dynamic";

async function fetchCockpitData(applicationId: string) {
  return prisma.instructorApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      status: true,
      motivation: true,
      motivationVideoUrl: true,
      teachingExperience: true,
      availability: true,
      legalName: true,
      preferredFirstName: true,
      schoolName: true,
      graduationYear: true,
      subjectsOfInterest: true,
      reviewerId: true,
      reviewerAssignedAt: true,
      materialsReadyAt: true,
      chairQueuedAt: true,
      archivedAt: true,
      applicant: {
        select: {
          id: true,
          name: true,
          email: true,
          chapterId: true,
          chapter: { select: { id: true, name: true } },
        },
      },
      reviewer: { select: { id: true, name: true } },
      interviewerAssignments: {
        where: { removedAt: null },
        select: {
          id: true,
          interviewerId: true,
          role: true,
          assignedAt: true,
          interviewer: { select: { id: true, name: true, email: true } },
        },
      },
      documents: {
        where: { supersededAt: null },
        select: {
          id: true,
          kind: true,
          fileUrl: true,
          originalName: true,
          uploadedAt: true,
          supersededAt: true,
        },
        orderBy: { uploadedAt: "desc" },
      },
      timeline: {
        select: {
          id: true,
          applicationId: true,
          kind: true,
          actorId: true,
          payload: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
      offeredSlots: {
        select: {
          id: true,
          scheduledAt: true,
          durationMinutes: true,
          confirmedAt: true,
          offeredBy: { select: { name: true } },
        },
        orderBy: { scheduledAt: "asc" },
      },
      availabilityWindows: {
        select: { id: true, startAt: true, endAt: true, note: true },
        orderBy: { startAt: "asc" },
      },
      interviewReviews: {
        where: { status: "SUBMITTED" },
        select: {
          id: true,
          reviewerId: true,
          overallRating: true,
          recommendation: true,
          summary: true,
          submittedAt: true,
          reviewer: { select: { id: true, name: true } },
          categories: { select: { category: true, rating: true, notes: true } },
        },
      },
    },
  });
}

export default async function ApplicantCockpitPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/signin");

  const { id } = await params;

  if (!isInstructorApplicantWorkflowV1Enabled()) {
    redirect("/admin/instructor-applicants");
  }

  const application = await fetchCockpitData(id);
  if (!application) notFound();

  const actor = await getHiringActor(session.user.id);

  const appCtx = {
    id: application.id,
    applicantId: application.applicant.id,
    reviewerId: application.reviewerId,
    applicantChapterId: application.applicant.chapterId,
    interviewerAssignments: application.interviewerAssignments,
  };

  try {
    assertCanViewApplicant(actor, appCtx);
  } catch {
    redirect("/");
  }

  const actorIsAdmin = isAdmin(actor);
  const actorIsChair = isHiringChair(actor);
  const actorIsReviewer = isAssignedReviewer(actor, appCtx);
  const actorIsInterviewer = isAssignedInterviewer(actor, appCtx);
  const actorCanSeeChair = canSeeChairQueue(actor);

  let canActAsChairBool = false;
  try {
    assertCanActAsChair(actor);
    canActAsChairBool = true;
  } catch {
    // not a chair
  }

  const canAssignReviewer =
    actorIsAdmin || (isChapterLead(actor) && actor.chapterId === application.applicant.chapterId);
  const canAssignInterviewers =
    actorIsAdmin ||
    (isChapterLead(actor) && actor.chapterId === application.applicant.chapterId) ||
    actorIsReviewer;
  const canPostSlots = actorIsAdmin || actorIsReviewer || actorIsInterviewer;

  let reviewWorkspace: Awaited<ReturnType<typeof getInstructorApplicationReviewWorkspace>> | null = null;
  if (actorIsReviewer || actorIsAdmin || isChapterLead(actor)) {
    try {
      reviewWorkspace = await getInstructorApplicationReviewWorkspace(id);
    } catch {
      // applicant may not be in review stage yet
    }
  }

  const isReadOnlyReview = !actorIsReviewer && !actorIsAdmin && !isChapterLead(actor);
  const isHidden = !canAssignReviewer && !canAssignInterviewers && !actorIsReviewer && !actorIsInterviewer && !canActAsChairBool;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ padding: "12px 24px", borderBottom: "1px solid #e5e7eb" }}>
        <Link
          href={actorCanSeeChair ? "/admin/instructor-applicants" : "/chapter-lead/instructor-applicants"}
          style={{ fontSize: 13, color: "var(--muted)", textDecoration: "none" }}
        >
          ← Instructor Applicants
        </Link>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px 120px" }}>
        <ApplicantCockpitHeader application={application} />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 360px",
            gap: 24,
            alignItems: "start",
          }}
        >
          <main style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Applicant Summary */}
            <section id="section-summary" className="card" style={{ padding: "20px 24px" }}>
              <h2 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700 }}>Applicant Summary</h2>
              <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "160px 1fr", gap: "8px 12px" }}>
                <dt style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>Email</dt>
                <dd style={{ margin: 0, fontSize: 13 }}>{application.applicant.email}</dd>
                <dt style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>Teaching Experience</dt>
                <dd style={{ margin: 0, fontSize: 13, whiteSpace: "pre-wrap" }}>{application.teachingExperience}</dd>
                <dt style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>Availability</dt>
                <dd style={{ margin: 0, fontSize: 13 }}>{application.availability}</dd>
                {application.subjectsOfInterest && (
                  <>
                    <dt style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>Subjects</dt>
                    <dd style={{ margin: 0, fontSize: 13 }}>{application.subjectsOfInterest}</dd>
                  </>
                )}
              </dl>
            </section>

            {/* Motivation */}
            <section id="section-motivation" className="card" style={{ padding: "20px 24px" }}>
              <h2 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700 }}>Motivation</h2>
              {application.motivationVideoUrl && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>
                    Motivation Video
                  </p>
                  <a
                    href={application.motivationVideoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="button outline"
                    style={{ fontSize: 13 }}
                  >
                    ▶ Watch Video
                  </a>
                </div>
              )}
              {application.motivation ? (
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                  {application.motivation}
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>No written motivation provided.</p>
              )}
            </section>

            {/* Initial Review */}
            <section id="section-review" className="card" style={{ padding: "20px 24px" }}>
              <h2 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700 }}>Initial Review</h2>
              {reviewWorkspace ? (
                <ApplicationReviewEditor
                  action={saveInstructorApplicationReviewAction}
                  applicationId={id}
                  returnTo={`/applications/instructor/${id}`}
                  initialReview={reviewWorkspace.myReview}
                  canEdit={!isReadOnlyReview && reviewWorkspace.myReview?.status !== "SUBMITTED"}
                  isLeadReviewer={reviewWorkspace.isLeadReviewer}
                  isAdmin={actorIsAdmin}
                  drafts={reviewWorkspace.drafts}
                  selectedDraftId={reviewWorkspace.selectedDraftId}
                />
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                  {isReadOnlyReview
                    ? "Review visible to assigned reviewer and admins only."
                    : "Review not yet available for this application."}
                </p>
              )}
            </section>

            {/* Scheduling */}
            <InterviewSchedulingInlinePanel
              applicationId={application.id}
              offeredSlots={application.offeredSlots}
              availabilityWindows={application.availabilityWindows}
              canPostSlots={canPostSlots}
            />

            {/* Interview Reviews summary */}
            {application.interviewReviews.length > 0 && (
              <section id="section-interview-reviews" className="card" style={{ padding: "20px 24px" }}>
                <h2 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700 }}>Interview Reviews</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {application.interviewReviews.map((review) => {
                    const recOpt = PROGRESS_RATING_OPTIONS.find((o) => o.value === review.overallRating);
                    return (
                      <div
                        key={review.id}
                        style={{
                          padding: "14px 16px",
                          background: "#f9fafb",
                          border: "1px solid #e5e7eb",
                          borderRadius: 8,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                          <strong style={{ fontSize: 14 }}>{review.reviewer.name ?? "Interviewer"}</strong>
                          {recOpt && (
                            <span
                              style={{
                                fontSize: 12,
                                padding: "2px 8px",
                                borderRadius: 99,
                                background: recOpt.bg,
                                color: recOpt.color,
                                fontWeight: 600,
                              }}
                            >
                              {recOpt.shortLabel}
                            </span>
                          )}
                          {review.recommendation && (
                            <span className="pill pill-info" style={{ fontSize: 12 }}>
                              {review.recommendation.replace(/_/g, " ")}
                            </span>
                          )}
                        </div>
                        {review.summary && (
                          <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
                            {review.summary}
                          </p>
                        )}
                        {actorIsInterviewer && review.reviewerId === actor.id && (
                          <Link
                            href={`/applications/instructor/${id}/interview`}
                            style={{ display: "inline-block", marginTop: 8, fontSize: 12, color: "#6b21c8" }}
                          >
                            Edit my review →
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {actorIsInterviewer && (
              <div
                className="card"
                style={{
                  padding: "16px 24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>Interviewer Workspace</p>
                  <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--muted)" }}>
                    Pre-interview brief, materials, and evaluation form.
                  </p>
                </div>
                <Link
                  href={`/applications/instructor/${id}/interview`}
                  className="button outline"
                  style={{ fontSize: 13 }}
                >
                  Open →
                </Link>
              </div>
            )}

            {/* Full Timeline */}
            <section id="section-timeline" className="card" style={{ padding: "20px 24px" }}>
              <h2 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700 }}>Timeline</h2>
              <ApplicantTimelineFeed events={application.timeline} />
            </section>
          </main>

          {/* Sidebar */}
          <ApplicantCockpitSidebar
            application={application}
            canAssignReviewer={canAssignReviewer}
            canAssignInterviewers={canAssignInterviewers}
            currentUserId={actor.id}
          />
        </div>
      </div>

      <ApplicantNextActionBar
        application={{
          id: application.id,
          status: application.status,
          reviewerId: application.reviewerId,
          materialsReadyAt: application.materialsReadyAt,
          interviewerAssignments: application.interviewerAssignments,
        }}
        canAssignReviewer={canAssignReviewer}
        canAssignInterviewers={canAssignInterviewers}
        isAssignedReviewer={actorIsReviewer}
        isAssignedInterviewer={actorIsInterviewer}
        canActAsChair={canActAsChairBool}
        isAdmin={actorIsAdmin}
        hidden={isHidden}
      />
    </div>
  );
}
