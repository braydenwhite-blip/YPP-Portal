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
import { getCandidateReviewers, getCandidateInterviewers } from "@/lib/instructor-applicant-board-queries";
import ApplicantCockpitHeader from "@/components/instructor-applicants/ApplicantCockpitHeader";
import ApplicantCockpitSidebar from "@/components/instructor-applicants/ApplicantCockpitSidebar";
import ApplicantNextActionBar from "@/components/instructor-applicants/ApplicantNextActionBar";
import ApplicantTimelineFeed from "@/components/instructor-applicants/ApplicantTimelineFeed";
import CollapsibleAssignmentPanel from "@/components/instructor-applicants/CollapsibleAssignmentPanel";
import InterviewSchedulingInlinePanel from "@/components/instructor-applicants/InterviewSchedulingInlinePanel";
import InterviewerAssignPicker from "@/components/instructor-applicants/InterviewerAssignPicker";
import ReviewerAssignPicker from "@/components/instructor-applicants/ReviewerAssignPicker";
import ApplicationReviewEditor from "@/components/instructor-review/application-review-editor";
import {
  saveInstructorApplicationReviewAction,
  getInstructorApplicationReviewWorkspace,
} from "@/lib/instructor-review-actions";
import { PROGRESS_RATING_OPTIONS } from "@/lib/instructor-review-config";
import NotificationFailureBanner from "@/components/instructor-applicants/NotificationFailureBanner";

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
      courseIdea: true,
      textbook: true,
      courseOutline: true,
      firstClassPlan: true,
      legalName: true,
      preferredFirstName: true,
      schoolName: true,
      graduationYear: true,
      subjectsOfInterest: true,
      reviewerId: true,
      interviewRound: true,
      reviewerAssignedAt: true,
      interviewScheduledAt: true,
      materialsReadyAt: true,
      chairQueuedAt: true,
      archivedAt: true,
      lastNotificationError: true,
      lastNotificationErrorAt: true,
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
          round: true,
          role: true,
          assignedAt: true,
          removedAt: true,
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
          note: true,
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
          actor: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      offeredSlots: {
        select: {
          id: true,
          scheduledAt: true,
          durationMinutes: true,
          meetingUrl: true,
          confirmedAt: true,
          offeredBy: { select: { name: true } },
        },
        orderBy: { scheduledAt: "asc" },
      },
      applicationReviews: {
        where: { isLeadReview: true, status: "SUBMITTED" },
        select: {
          nextStep: true,
          summary: true,
          submittedAt: true,
          categories: {
            select: { category: true, rating: true, notes: true },
          },
        },
        take: 1,
      },
      availabilityWindows: {
        select: { id: true, dayOfWeek: true, startTime: true, endTime: true, timezone: true },
        orderBy: { dayOfWeek: "asc" },
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
  if (!application.applicant) notFound();
  const currentInterviewerAssignments = application.interviewerAssignments.filter(
    (assignment) => assignment.round === application.interviewRound
  );
  const leadInterviewerAssignment =
    currentInterviewerAssignments.find((assignment) => assignment.role === "LEAD") ?? null;
  const secondInterviewerAssignment =
    currentInterviewerAssignments.find((assignment) => assignment.role === "SECOND") ?? null;
  const hasLeadInterviewer = currentInterviewerAssignments.some(
    (assignment) => assignment.role === "LEAD"
  );
  const leadApplicationReview = application.applicationReviews[0] ?? null;

  let actor;
  try {
    actor = await getHiringActor(session.user.id);
  } catch {
    redirect("/");
  }

  const appCtx = {
    id: application.id,
    applicantId: application.applicant.id,
    reviewerId: application.reviewerId,
    interviewRound: application.interviewRound,
    applicantChapterId: application.applicant.chapterId,
    interviewerAssignments: currentInterviewerAssignments,
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
  const actorIsLeadInterviewer = currentInterviewerAssignments.some(
    (assignment) =>
      assignment.role === "LEAD" &&
      assignment.interviewerId === actor.id &&
      !assignment.removedAt
  );
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
  const canPostSlots = actorIsAdmin || actorIsLeadInterviewer;
  const canSendInterviewTimes =
    canPostSlots &&
    !application.interviewScheduledAt &&
    (application.status === "INTERVIEW_SCHEDULED" ||
      leadApplicationReview?.nextStep === "MOVE_TO_INTERVIEW");

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

  let reviewerCandidates: Awaited<ReturnType<typeof getCandidateReviewers>> = [];
  let interviewerCandidatesLead: Awaited<ReturnType<typeof getCandidateInterviewers>> = [];
  let interviewerCandidatesSecond: Awaited<ReturnType<typeof getCandidateInterviewers>> = [];
  if (canAssignReviewer || canAssignInterviewers) {
    try {
      [reviewerCandidates, interviewerCandidatesLead, interviewerCandidatesSecond] =
        await Promise.all([
          getCandidateReviewers(id),
          getCandidateInterviewers(id, { role: "LEAD" }),
          getCandidateInterviewers(id, { role: "SECOND" }),
        ]);
    } catch (err) {
      console.error("[applicant-cockpit] candidate picker queries failed", err);
    }
  }

  return (
    <div className="applicant-cockpit-page">
      <div className="applicant-cockpit-backbar">
        <Link
          href={actorCanSeeChair ? "/admin/instructor-applicants" : "/chapter-lead/instructor-applicants"}
          className="applicant-cockpit-backlink"
        >
          Back to Instructor Applicants
        </Link>
      </div>

      <div className="applicant-cockpit-container">
        <ApplicantCockpitHeader application={application} />

        {application.lastNotificationError && (
          <NotificationFailureBanner
            applicationId={application.id}
            error={application.lastNotificationError}
            at={application.lastNotificationErrorAt!}
            canResend={actorIsAdmin || actorIsChair}
          />
        )}

        <div className="applicant-cockpit-layout">
          <main className="applicant-cockpit-main">
            {/* Applicant Summary */}
            <section id="section-summary" className="cockpit-panel cockpit-panel-accent">
              <div className="cockpit-section-heading">
                <span className="cockpit-section-kicker">Profile</span>
                <h2>Applicant Summary</h2>
              </div>
              <dl className="cockpit-detail-grid">
                <dt>Email</dt>
                <dd>{application.applicant.email}</dd>
                <dt>Teaching Experience</dt>
                <dd>{application.teachingExperience}</dd>
                <dt>Availability</dt>
                <dd>{application.availability}</dd>
                {application.subjectsOfInterest && (
                  <>
                    <dt>Subjects</dt>
                    <dd>{application.subjectsOfInterest}</dd>
                  </>
                )}
              </dl>
            </section>

            {/* Motivation */}
            <section id="section-motivation" className="cockpit-panel">
              <div className="cockpit-section-heading">
                <span className="cockpit-section-kicker">Why they applied</span>
                <h2>Motivation</h2>
              </div>
              {application.motivationVideoUrl && (
                <div className="cockpit-video-callout">
                  <p>
                    Motivation Video
                  </p>
                  <a
                    href={application.motivationVideoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="button outline cockpit-inline-button"
                  >
                    Watch video
                  </a>
                </div>
              )}
              {application.motivation ? (
                <p className="cockpit-prose">
                  {application.motivation}
                </p>
              ) : (
                <p className="cockpit-muted">No written motivation provided.</p>
              )}
            </section>

            {/* Initial Review */}
            <section id="section-review" className="cockpit-review-workspace">
              <div className="cockpit-section-heading">
                <span className="cockpit-section-kicker">Evaluation</span>
                <h2>Initial Review</h2>
              </div>
              {reviewWorkspace ? (
                <ApplicationReviewEditor
                  action={saveInstructorApplicationReviewAction as (fd: FormData) => void}
                  applicationId={id}
                  returnTo={`/applications/instructor/${id}`}
                  initialReview={reviewWorkspace.myReview}
                  roughPlan={{
                    courseIdea: application.courseIdea ?? application.textbook,
                    courseOutline: application.courseOutline,
                    firstClassPlan: application.firstClassPlan,
                  }}
                  canEdit={!isReadOnlyReview && reviewWorkspace.myReview?.status !== "SUBMITTED"}
                  isLeadReviewer={reviewWorkspace.isLeadReviewer}
                  hasLeadInterviewer={hasLeadInterviewer}
                />
              ) : (
                <p className="cockpit-muted">
                  {isReadOnlyReview
                    ? "Review visible to assigned reviewer and admins only."
                    : "Review not yet available for this application."}
                </p>
              )}
              {canAssignReviewer && (
                <CollapsibleAssignmentPanel
                  title="Assigned Reviewer"
                  assigneeName={application.reviewer?.name}
                >
                  <ReviewerAssignPicker
                    applicationId={application.id}
                    currentReviewerId={application.reviewerId}
                    candidates={reviewerCandidates}
                  />
                </CollapsibleAssignmentPanel>
              )}
            </section>

            {/* Scheduling */}
            <InterviewSchedulingInlinePanel
              applicationId={application.id}
              offeredSlots={application.offeredSlots}
              availabilityWindows={application.availabilityWindows}
              canPostSlots={canSendInterviewTimes}
            >
              {canAssignInterviewers && (
                <div className="cockpit-assignment-panel-grid">
                  <CollapsibleAssignmentPanel
                    title="Lead Interviewer"
                    assigneeName={leadInterviewerAssignment?.interviewer.name}
                  >
                    <InterviewerAssignPicker
                      applicationId={application.id}
                      role="LEAD"
                      currentAssignment={leadInterviewerAssignment}
                      candidates={interviewerCandidatesLead}
                    />
                  </CollapsibleAssignmentPanel>
                  <CollapsibleAssignmentPanel
                    title="Second Interviewer"
                    assigneeName={secondInterviewerAssignment?.interviewer.name}
                  >
                    <InterviewerAssignPicker
                      applicationId={application.id}
                      role="SECOND"
                      currentAssignment={secondInterviewerAssignment}
                      candidates={interviewerCandidatesSecond}
                      disabled={!hasLeadInterviewer}
                    />
                  </CollapsibleAssignmentPanel>
                </div>
              )}
            </InterviewSchedulingInlinePanel>

            {/* Interview Reviews summary */}
            {application.interviewReviews.length > 0 && (
              <section id="section-interview-reviews" className="cockpit-panel">
                <div className="cockpit-section-heading">
                  <span className="cockpit-section-kicker">Interview signal</span>
                  <h2>Interview Reviews</h2>
                </div>
                <div className="cockpit-stack">
                  {application.interviewReviews.map((review) => {
                    const recOpt = PROGRESS_RATING_OPTIONS.find((o) => o.value === review.overallRating);
                    return (
                      <div
                        key={review.id}
                        className="cockpit-review-card"
                      >
                        <div className="cockpit-review-card-header">
                          <strong>{review.reviewer.name ?? "Interviewer"}</strong>
                          {recOpt && (
                            <span
                              className="cockpit-score-chip"
                              style={{ background: recOpt.bg, color: recOpt.color }}
                            >
                              {recOpt.shortLabel}
                            </span>
                          )}
                          {review.recommendation && (
                            <span className="pill pill-info pill-small">
                              {review.recommendation.replace(/_/g, " ")}
                            </span>
                          )}
                        </div>
                        {review.summary && (
                          <p className="cockpit-prose cockpit-prose-small">
                            {review.summary}
                          </p>
                        )}
                        {actorIsInterviewer && review.reviewerId === actor.id && (
                          <Link
                            href={`/applications/instructor/${id}/interview`}
                            className="cockpit-text-link"
                          >
                            Edit my review
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
                className="cockpit-panel cockpit-panel-compact cockpit-workspace-callout"
              >
                <div>
                  <p className="cockpit-callout-title">Interviewer Workspace</p>
                  <p className="cockpit-muted">
                    Pre-interview brief, materials, and evaluation form.
                  </p>
                </div>
                <Link
                  href={`/applications/instructor/${id}/interview`}
                  className="button outline cockpit-inline-button"
                >
                  Open
                </Link>
              </div>
            )}

            {/* Full Timeline */}
            <section id="section-timeline" className="cockpit-panel">
              <div className="cockpit-section-heading">
                <span className="cockpit-section-kicker">Audit trail</span>
                <h2>Timeline</h2>
              </div>
              <ApplicantTimelineFeed
                events={application.timeline.map((e) => ({
                  ...e,
                  payload: e.payload as Record<string, unknown>,
                }))}
              />
            </section>
          </main>

          {/* Sidebar */}
          <ApplicantCockpitSidebar
            application={application}
          />
        </div>
      </div>

      <ApplicantNextActionBar
        application={{
          id: application.id,
          status: application.status,
          reviewerId: application.reviewerId,
          materialsReadyAt: application.materialsReadyAt,
          interviewScheduledAt: application.interviewScheduledAt,
          leadReviewNextStep: leadApplicationReview?.nextStep ?? null,
          interviewerAssignments: currentInterviewerAssignments.map((a) => ({
            role: a.role as "LEAD" | "SECOND",
            removedAt: a.removedAt,
          })),
        }}
        canAssignReviewer={canAssignReviewer}
        canAssignInterviewers={canAssignInterviewers}
        isAssignedReviewer={actorIsReviewer}
        isAssignedInterviewer={actorIsInterviewer}
        isAssignedLeadInterviewer={actorIsLeadInterviewer}
        canActAsChair={canActAsChairBool}
        isAdmin={actorIsAdmin}
        hidden={isHidden}
      />
    </div>
  );
}
