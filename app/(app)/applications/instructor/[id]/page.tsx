import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { buttonVariants } from "@/components/ui-v2";
import skin from "@/components/ui-v2/portal-skin.module.css";
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
import {
  canBypassInstructorGate,
  isInstructorApplicantWorkflowV1Enabled,
  isRegularInstructorEnabled,
} from "@/lib/feature-flags";
import { getCandidateReviewers, getCandidateInterviewers } from "@/lib/instructor-applicant-board-queries";
import ApplicantCockpitHeader from "@/components/instructor-applicants/ApplicantCockpitHeader";
import ExternalIntakePanel from "@/components/external-intake/ExternalIntakePanel";
import ManualEmailGuidancePanel from "@/components/external-intake/ManualEmailGuidancePanel";
import { listManualEmailTasksForInstructorApplication } from "@/lib/manual-email-tasks";
import { suggestedEmailKindsForStatus } from "@/lib/application-source-config";
import ApplicantCockpitSidebar from "@/components/instructor-applicants/ApplicantCockpitSidebar";
import ApplicantNextActionBar from "@/components/instructor-applicants/ApplicantNextActionBar";
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
import {
  isInitialReviewLocked,
  INITIAL_REVIEW_LOCKED_MESSAGE,
} from "@/lib/applicant-review-stage";
import NotificationFailureBanner from "@/components/instructor-applicants/NotificationFailureBanner";
import ReviewSubmissionWarningsBanner from "@/components/instructor-applicants/ReviewSubmissionWarningsBanner";
import WorkshopOutlinePanel from "@/components/instructor-applicants/WorkshopOutlinePanel";
import PromoteToFullInstructorButton from "@/components/instructor-applicants/PromoteToFullInstructorButton";
import type { PromotionEligibility, WorkshopOutline } from "@/lib/summer-workshop";
import { formatApplicantDisplayName } from "@/lib/applicant-display-name";

// Design System 2.0 panel vocabulary for this rebuilt workspace (Tailwind).
const PANEL = "rounded-[12px] border border-line-soft bg-surface p-[22px] shadow-card";
const KICKER = "text-[11px] font-bold uppercase tracking-[0.11em] text-brand-700";
const HEADING = "mb-4 grid gap-0.5";
const H2 = "m-0 text-[17px] font-bold text-ink";
const PROSE = "m-0 whitespace-pre-wrap text-[14px] leading-[1.72] text-ink";
const MUTED = "m-0 text-[13px] text-ink-muted";
const DETAIL_GRID =
  "grid grid-cols-[minmax(120px,220px)_minmax(0,1fr)] gap-x-[18px] gap-y-2.5 " +
  "[&_dt]:m-0 [&_dt]:text-[11.5px] [&_dt]:font-bold [&_dt]:uppercase [&_dt]:tracking-[0.05em] [&_dt]:text-ink-muted " +
  "[&_dd]:m-0 [&_dd]:whitespace-pre-wrap [&_dd]:text-[13.5px] [&_dd]:text-ink";

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
      applicationTrack: true,
      instructorSubtype: true,
      workshopOutline: true,
      promotionEligibility: true,
      legalName: true,
      preferredFirstName: true,
      lastName: true,
      phoneNumber: true,
      schoolName: true,
      graduationYear: true,
      subjectsOfInterest: true,
      isReapplication: true,
      previousApplicationId: true,
      reviewerId: true,
      interviewRound: true,
      reviewerAssignedAt: true,
      interviewScheduledAt: true,
      materialsReadyAt: true,
      chairQueuedAt: true,
      archivedAt: true,
      lastNotificationError: true,
      lastNotificationErrorAt: true,
      source: true,
      externalSubmittedAt: true,
      externalImportedAt: true,
      externalResponseUrl: true,
      externalAnswersCopy: true,
      internalNotes: true,
      importedBy: { select: { id: true, name: true } },
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
          round: true,
          overallRating: true,
          recommendation: true,
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
  searchParams: Promise<{
    notice?: string;
    reviewWarnings?: string;
    adminPreview?: string;
    full?: string;
  }>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const { notice, reviewWarnings, adminPreview, full } = await searchParams;

  if (!isInstructorApplicantWorkflowV1Enabled()) {
    // Admins/chairs go to the admin board; applicants and other roles get
    // the applicant-facing status page (the admin board redirects them to
    // home, which is jarring).
    if (
      canBypassInstructorGate({
        roles: session.user.roles,
        primaryRole: session.user.primaryRole,
        adminPreviewParam: null,
      })
    ) {
      redirect("/admin/instructor-applicants");
    }
    redirect("/application-status");
  }

  const application = await fetchCockpitData(id);
  if (!application) notFound();
  if (!application.applicant) notFound();

  // Privacy: applicants must NOT see the reviewer cockpit (reviewer notes,
  // internal timeline, interview reviewer summaries). Send them to the
  // applicant-facing status page instead. Admins still pass through with
  // ?adminPreview=1 if they need to spot-check.
  if (
    application.applicant.id === session.user.id &&
    !canBypassInstructorGate({
      roles: session.user.roles,
      primaryRole: session.user.primaryRole,
      adminPreviewParam: adminPreview ?? null,
    })
  ) {
    redirect("/application-status");
  }

  const currentInterviewerAssignments = application.interviewerAssignments.filter(
    (assignment) => assignment.round === application.interviewRound
  );
  // Only show interview reviews that belong to the current interview round.
  // If a chair triggered REQUEST_SECOND_INTERVIEW, prior-round reviews would
  // otherwise mingle with current-round signal and confuse the CP/chair.
  const currentInterviewReviews = application.interviewReviews.filter(
    (review) => review.round == null || review.round === application.interviewRound
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

  // Officers browsing from the board land on Application 360 — the single
  // scrollable record. Assigned reviewers/interviewers keep the operational
  // cockpit for review editors and scheduling tools.
  const wantsFullCockpit = adminPreview === "1" || full === "1";
  const isAssignedToWorkflow = actorIsReviewer || actorIsInterviewer;
  if (!wantsFullCockpit && !isAssignedToWorkflow) {
    redirect(`/admin/instructor-applicants/${id}`);
  }

  // SW-only mode gate: while the Standard track is paused, public access to
  // an in-flight Standard application is hidden. But anyone with a legitimate
  // role-based reason to view this applicant — admin, hiring chair, same-
  // chapter CP, assigned reviewer/interviewer — should still get through so
  // they can finish work that pre-dates the gate. The applicant themselves
  // is already redirected to /application-status earlier in this file.
  const isLegitimateReviewer =
    actorIsAdmin ||
    actorIsChair ||
    actorIsReviewer ||
    actorIsInterviewer ||
    isChapterLead(actor);
  if (
    !isRegularInstructorEnabled() &&
    application.applicationTrack !== "SUMMER_WORKSHOP_INSTRUCTOR" &&
    !isLegitimateReviewer &&
    !canBypassInstructorGate({
      roles: session.user.roles,
      primaryRole: session.user.primaryRole,
      adminPreviewParam: adminPreview ?? null,
    })
  ) {
    redirect("/applications/summer-workshop");
  }

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
  // Same-chapter Chapter Presidents can route a completed interview to the
  // chair queue themselves (the server action already authorizes this via
  // assertCanManageApplication; we only need to surface the button).
  const canSendToChair =
    !actorIsAdmin && isChapterLead(actor) && actor.chapterId === application.applicant.chapterId;
  const canPostSlots = actorIsAdmin || actorIsLeadInterviewer;
  const canSendInterviewTimes =
    canPostSlots &&
    !application.interviewScheduledAt &&
    (application.status === "INTERVIEW_SCHEDULED" ||
      leadApplicationReview?.nextStep === "MOVE_TO_INTERVIEW");

  // Interview scheduling state — surfaced as a focused workspace card so the
  // current required step is obvious in the main canvas (not buried).
  const applicantSelectedTime =
    Boolean(application.interviewScheduledAt) ||
    application.offeredSlots.some((slot) => slot.confirmedAt);
  const interviewTimesSent = application.offeredSlots.length > 0;
  const pendingSlotCount = application.offeredSlots.filter((slot) => !slot.confirmedAt).length;
  const schedulingIsActiveStep =
    application.status === "INTERVIEW_SCHEDULED" || canSendInterviewTimes;
  const showSchedulingNeedsTime = schedulingIsActiveStep && !applicantSelectedTime;

  // Surface this interviewer's existing upcoming interview times for *other*
  // applicants so they can avoid double-booking themselves when sending out
  // new times for this applicant.
  let myInterviewCommitments: {
    id: string;
    scheduledAt: Date;
    durationMinutes: number;
    confirmed: boolean;
    applicantName: string;
  }[] = [];
  if (canSendInterviewTimes) {
    const otherSlots = await prisma.offeredInterviewSlot.findMany({
      where: {
        offeredByUserId: session.user.id,
        instructorApplicationId: { not: application.id },
        scheduledAt: { gte: new Date() },
      },
      select: {
        id: true,
        scheduledAt: true,
        durationMinutes: true,
        confirmedAt: true,
        instructorApplication: {
          select: {
            preferredFirstName: true,
            lastName: true,
            legalName: true,
            applicant: { select: { name: true } },
          },
        },
      },
      orderBy: { scheduledAt: "asc" },
    });
    myInterviewCommitments = otherSlots.map((slot) => ({
      id: slot.id,
      scheduledAt: slot.scheduledAt,
      durationMinutes: slot.durationMinutes,
      confirmed: slot.confirmedAt != null,
      applicantName: formatApplicantDisplayName({
        ...slot.instructorApplication,
        fallback: "Another applicant",
      }),
    }));
  }

  let reviewWorkspace: Awaited<ReturnType<typeof getInstructorApplicationReviewWorkspace>> | null = null;
  if (actorIsReviewer || actorIsAdmin || isChapterLead(actor)) {
    try {
      reviewWorkspace = await getInstructorApplicationReviewWorkspace(id);
    } catch {
      // applicant may not be in review stage yet
    }
  }

  // Initial reviews lock permanently once the applicant advances past the
  // initial-review stage. After that the editor is read-only for everyone
  // (including admins) and existing reviews stay visible as evidence.
  const initialReviewLocked = isInitialReviewLocked(application.status);
  const isReadOnlyReview =
    initialReviewLocked || (!actorIsReviewer && !actorIsAdmin && !isChapterLead(actor));
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

  // Manual email tracking — non-blocking. Failures here must not stop the
  // cockpit from rendering (the rest of the workflow is more critical).
  let manualEmailTasks: Awaited<
    ReturnType<typeof listManualEmailTasksForInstructorApplication>
  > = [];
  try {
    manualEmailTasks = await listManualEmailTasksForInstructorApplication(id);
  } catch (err) {
    console.error("[applicant-cockpit] manual email task query failed", err);
  }
  const manualEmailSuggestedKinds = suggestedEmailKindsForStatus(application.status);
  const canEditManualEmail =
    actorIsAdmin || isChapterLead(actor) || isHiringChair(actor);

  return (
    <div className={`${skin.portalSkin} min-h-screen`}>
      {/* Sticky back bar */}
      <div className="sticky top-0 z-30 border-b border-line-soft bg-surface/95 px-6 py-2.5 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1700px] flex-wrap items-center justify-between gap-2">
          <Link
            href={actorCanSeeChair ? "/admin/instructor-applicants" : "/chapter-lead/instructor-applicants"}
            className="text-[13px] font-semibold text-brand-700 hover:underline"
          >
            ← Instructor Applicants
          </Link>
          {actorCanSeeChair ? (
            <Link
              href={`/admin/instructor-applicants/${application.id}`}
              className="text-[13px] font-semibold text-brand-700 hover:underline"
            >
              Application 360 →
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-4 px-6 py-5 lg:px-8">
        <ApplicantCockpitHeader application={application} />

        <ExternalIntakePanel
          source={application.source}
          externalSubmittedAt={application.externalSubmittedAt?.toISOString() ?? null}
          externalImportedAt={application.externalImportedAt?.toISOString() ?? null}
          externalResponseUrl={application.externalResponseUrl}
          externalAnswersCopy={application.externalAnswersCopy}
          internalNotes={application.internalNotes}
          importedBy={application.importedBy}
        />

        {application.isReapplication && application.previousApplicationId && (
          <div
            role="note"
            className="rounded-[10px] border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-amber-900"
          >
            This is a re-application. The applicant&apos;s prior submission is on
            file —{" "}
            <Link
              href={`/applications/instructor/${application.previousApplicationId}?adminPreview=1`}
              className="font-semibold text-amber-900 underline"
            >
              open the previous application
            </Link>{" "}
            for context.
          </div>
        )}

        {application.lastNotificationError && (
          <NotificationFailureBanner
            applicationId={application.id}
            error={application.lastNotificationError}
            at={application.lastNotificationErrorAt!}
            canResend={actorIsAdmin || actorIsChair}
          />
        )}

        <ReviewSubmissionWarningsBanner
          notice={notice ?? null}
          warningsJson={reviewWarnings ?? null}
        />

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="flex min-w-0 flex-col gap-4">
            {/* Next required leadership move — leads the review canvas */}
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
              canSendToChair={canSendToChair}
              isAdmin={actorIsAdmin}
              hidden={isHidden}
            />

            {/* Contact & profile — compact; header already shows name, chapter, school */}
            <section id="section-summary" className={`${PANEL} border-l-4 border-l-brand-600`}>
              <dl className={DETAIL_GRID}>
                <dt>Email</dt>
                <dd>{application.applicant.email}</dd>
                {application.phoneNumber ? (
                  <>
                    <dt>Phone</dt>
                    <dd>{application.phoneNumber}</dd>
                  </>
                ) : null}
                <dt>Teaching experience</dt>
                <dd>{application.teachingExperience}</dd>
                <dt>Availability</dt>
                <dd>{application.availability}</dd>
              </dl>
            </section>

            {/* Workshop Outline (Summer Workshop Instructor track only) */}
            {application.applicationTrack === "SUMMER_WORKSHOP_INSTRUCTOR" && (
              <WorkshopOutlinePanel
                outline={(application.workshopOutline as WorkshopOutline | null) ?? null}
              />
            )}

            {/* Promote to Full Instructor (admins/chairs, summer workshop
                subtype, AND only after chair-decide APPROVED — promotion
                is meaningless before approval and the server action also
                enforces this guard). */}
            {application.instructorSubtype === "SUMMER_WORKSHOP" &&
              application.status === "APPROVED" &&
              (isAdmin(actor) || isHiringChair(actor)) && (
                <section className={PANEL}>
                  <div className={HEADING}>
                    <span className={KICKER}>Subtype</span>
                    <h2 className={H2}>Promotion</h2>
                  </div>
                  <p className="m-0 mb-3 text-[13px] leading-relaxed text-ink-muted">
                    This applicant is on the Summer Workshop Instructor track. Promotion to
                    Full Instructor preserves all history; outstanding requirements (e.g.
                    Lesson Design Studio) become follow-ups, not waivers. Use this when the
                    applicant has demonstrated readiness and leadership beyond the focused
                    workshop role.
                  </p>
                  <PromoteToFullInstructorButton
                    applicationId={application.id}
                    applicantName={formatApplicantDisplayName(application)}
                    promotionEligibility={
                      (application.promotionEligibility as PromotionEligibility | null) ?? null
                    }
                  />
                </section>
              )}

            {/* Motivation */}
            <section id="section-motivation" className={PANEL}>
              <div className={HEADING}>
                <span className={KICKER}>Why they applied</span>
                <h2 className={H2}>Motivation</h2>
              </div>
              {application.motivationVideoUrl && (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-brand-200 bg-brand-50/60 px-3.5 py-2.5">
                  <p className="m-0 text-[13px] font-semibold text-ink">Motivation Video</p>
                  <a
                    href={application.motivationVideoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: "secondary", size: "sm" })}
                  >
                    Watch video
                  </a>
                </div>
              )}
              {application.motivation ? (
                <p className={PROSE}>
                  {application.motivation}
                </p>
              ) : (
                <p className={MUTED}>No written motivation provided.</p>
              )}
            </section>

            {/* Initial Review */}
            <section id="section-review" className="grid gap-4">
              <div className={HEADING.replace("mb-4", "mb-0")}>
                <span className={KICKER}>Evaluation</span>
                <h2 className={H2}>Initial Review</h2>
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
                  canEdit={!isReadOnlyReview}
                  lockedReason={initialReviewLocked ? INITIAL_REVIEW_LOCKED_MESSAGE : null}
                  isLeadReviewer={reviewWorkspace.isLeadReviewer}
                  hasLeadInterviewer={hasLeadInterviewer}
                />
              ) : (
                <p className={MUTED}>
                  {initialReviewLocked
                    ? INITIAL_REVIEW_LOCKED_MESSAGE
                    : isReadOnlyReview
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

            {/* Interview scheduling state — the current required step, stated plainly */}
            {showSchedulingNeedsTime ? (
              <section className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-warning-700/30 bg-warning-100/40 p-4">
                <div className="min-w-0">
                  <p className="m-0 text-[11px] font-bold uppercase tracking-[0.1em] text-warning-700">
                    Interview scheduling
                  </p>
                  <p className="m-0 mt-0.5 text-[16px] font-bold text-ink">
                    Applicant has not selected an interview time yet.
                  </p>
                  <p className="m-0 mt-0.5 text-[13px] text-ink-muted">
                    {interviewTimesSent
                      ? `${pendingSlotCount} time option${pendingSlotCount === 1 ? "" : "s"} sent — waiting for the applicant to pick one.`
                      : "No interview times have been sent yet."}
                  </p>
                </div>
                {canSendInterviewTimes ? (
                  <a href="#section-scheduling" className={buttonVariants({ variant: "primary", size: "md" })}>
                    {interviewTimesSent ? "Update interview time options" : "Send interview time options"}
                  </a>
                ) : null}
              </section>
            ) : applicantSelectedTime && application.status === "INTERVIEW_SCHEDULED" ? (
              <section className="rounded-[12px] border border-success-700/30 bg-success-100/40 p-4">
                <p className="m-0 text-[11px] font-bold uppercase tracking-[0.1em] text-success-700">
                  Interview scheduling
                </p>
                <p className="m-0 mt-0.5 text-[16px] font-bold text-ink">
                  Interview time confirmed.
                </p>
                <p className="m-0 mt-0.5 text-[13px] text-ink-muted">
                  {application.interviewScheduledAt
                    ? `Scheduled for ${new Date(application.interviewScheduledAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.`
                    : "The applicant picked a time. Run the interview, then mark it complete."}
                </p>
              </section>
            ) : null}

            {/* Scheduling */}
            <InterviewSchedulingInlinePanel
              applicationId={application.id}
              offeredSlots={application.offeredSlots}
              availabilityWindows={application.availabilityWindows}
              canPostSlots={canSendInterviewTimes}
              myCommitments={myInterviewCommitments}
            >
              {canAssignInterviewers && (
                <div className="grid gap-3 md:grid-cols-2">
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
            {currentInterviewReviews.length > 0 && (
              <section id="section-interview-reviews" className={PANEL}>
                <div className={HEADING}>
                  <span className={KICKER}>Interview signal</span>
                  <h2 className={H2}>Interview Reviews</h2>
                </div>
                <div className="grid gap-2.5">
                  {currentInterviewReviews.map((review) => {
                    const recOpt = PROGRESS_RATING_OPTIONS.find(
                      (o) => o.value === review.overallRating
                    );
                    return (
                      <article
                        key={review.id}
                        className="rounded-[10px] border border-line-soft bg-surface-soft px-3.5 py-3"
                      >
                        <header className="flex flex-wrap items-center gap-2">
                          <span className="text-[13.5px] font-semibold text-ink">
                            {review.reviewer.name ?? "Interviewer"}
                          </span>
                          {recOpt ? (
                            <span
                              className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold"
                              style={{ background: recOpt.bg, color: recOpt.color }}
                              aria-label={`Overall rating ${recOpt.shortLabel}`}
                            >
                              {recOpt.shortLabel}
                            </span>
                          ) : null}
                          {review.recommendation ? (
                            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                              {review.recommendation.replace(/_/g, " ")}
                            </span>
                          ) : null}
                        </header>
                        {actorIsInterviewer && review.reviewerId === actor.id ? (
                          <Link
                            href={`/applications/instructor/${id}/interview`}
                            className="mt-1.5 inline-block text-[12.5px] font-semibold text-brand-700 hover:underline"
                          >
                            Edit my review →
                          </Link>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {actorIsInterviewer && (
              <aside
                className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-brand-200 bg-brand-50/70 px-[22px] py-4"
                aria-label="Interviewer workspace"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className={KICKER}>Run the interview</span>
                  <p className="m-0 text-[15px] font-bold text-ink">Open Interviewer Workspace</p>
                  <p className="m-0 text-[12.5px] text-ink-muted">
                    Live question runner, pre-interview brief, autosave, and the rubric all in one
                    place.
                  </p>
                </div>
                <Link
                  href={`/applications/instructor/${id}/interview`}
                  className={buttonVariants({ variant: "primary", size: "md" })}
                >
                  Open Workspace →
                </Link>
              </aside>
            )}

            {/* Manual Email Tracking — only shown for non-portal applicants.
                Portal applicants get emails automatically; no manual tracking needed. */}
            {application.source && application.source !== "PORTAL" && (
              <ManualEmailGuidancePanel
                applicationId={application.id}
                tasks={manualEmailTasks}
                suggestedKinds={manualEmailSuggestedKinds}
                canEdit={canEditManualEmail}
              />
            )}

          </main>

          {/* Sidebar — compact supporting context only */}
          <ApplicantCockpitSidebar
            application={{
              ...application,
              applicationTrack: application.applicationTrack as string | null,
            }}
          />
        </div>
      </div>
    </div>
  );
}
