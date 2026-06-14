import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { buttonVariants } from "@/components/ui-v2";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import {
  getHiringActor,
  isAdmin,
  isAssignedInterviewer,
} from "@/lib/chapter-hiring-permissions";
import { isInstructorApplicantWorkflowV1Enabled } from "@/lib/feature-flags";
import InterviewReviewEditor from "@/components/instructor-review/interview-review-editor";
import InterviewerBriefCard from "@/components/instructor-applicants/InterviewerBriefCard";
import {
  getInstructorInterviewReviewWorkspace,
  saveInstructorInterviewLiveDraftAction,
  saveInstructorInterviewReviewAction,
} from "@/lib/instructor-review-actions";
import { formatApplicantDisplayName } from "@/lib/applicant-display-name";

export const dynamic = "force-dynamic";

export default async function InterviewerWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  if (!isInstructorApplicantWorkflowV1Enabled()) {
    redirect(`/applications/instructor/${id}`);
  }

  const actor = await getHiringActor(session.user.id);

  // Fetch the application for permission check and brief card
  const application = await prisma.instructorApplication.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      interviewRound: true,
      subjectsOfInterest: true,
      courseIdea: true,
      textbook: true,
      courseOutline: true,
      firstClassPlan: true,
      motivationVideoUrl: true,
      preferredFirstName: true,
      lastName: true,
      legalName: true,
      reviewerId: true,
      applicationTrack: true,
      workshopOutline: true,
      applicant: {
        select: { id: true, name: true, chapterId: true },
      },
      interviewerAssignments: {
        where: { removedAt: null },
        select: { interviewerId: true, round: true, removedAt: true },
      },
      documents: {
        where: { supersededAt: null },
        select: { id: true, kind: true, fileUrl: true, originalName: true, uploadedAt: true },
        orderBy: { uploadedAt: "desc" },
      },
      offeredSlots: {
        where: { confirmedAt: { not: null } },
        select: { id: true, scheduledAt: true, durationMinutes: true, meetingUrl: true, confirmedAt: true },
        orderBy: { scheduledAt: "asc" },
      },
      applicationReviews: {
        where: { isLeadReview: true, status: "SUBMITTED" },
        select: { summary: true, notes: true },
        take: 1,
      },
    },
  });

  if (!application) notFound();

  const appCtx = {
    id: application.id,
    applicantId: application.applicant.id,
    reviewerId: application.reviewerId,
    interviewRound: application.interviewRound,
    applicantChapterId: application.applicant.chapterId,
    interviewerAssignments: application.interviewerAssignments,
  };

  const actorIsAdmin = isAdmin(actor);
  const actorIsInterviewer = isAssignedInterviewer(actor, appCtx);

  if (!actorIsAdmin && !actorIsInterviewer) {
    redirect(`/applications/instructor/${id}`);
  }

  let workspace: Awaited<ReturnType<typeof getInstructorInterviewReviewWorkspace>> | null = null;
  try {
    workspace = await getInstructorInterviewReviewWorkspace(id);
  } catch (err) {
    // Application may not be in interview stage
  }

  const reviewerNote = application.applicationReviews[0] ?? null;
  const applicantDisplayName = formatApplicantDisplayName(application);

  // Orientation + "what submitting does" context, so an interviewer is never
  // unsure whether their evaluation actually advances the candidate.
  const round = application.interviewRound ?? 1;
  const activeInterviewerCount = application.interviewerAssignments.length;
  const alreadySubmitted = workspace?.myReview?.status === "SUBMITTED";
  const submitOutcomeHint = alreadySubmitted
    ? "Your evaluation is submitted. It's locked unless an admin reopens it."
    : activeInterviewerCount > 1
      ? `Submitting records your recommendation. Once all ${activeInterviewerCount} assigned interviewers submit, this candidate moves to Chair Review automatically.`
      : "Submitting records your recommendation and moves this candidate into Chair Review.";

  return (
    <div className="min-h-screen bg-surface-soft pb-10">
      {/* Sticky workspace top bar */}
      <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 border-b border-line-soft bg-surface/95 px-6 py-2.5 backdrop-blur">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <Link
            href={`/applications/instructor/${id}`}
            className="whitespace-nowrap text-[13px] font-semibold text-brand-700 hover:underline"
          >
            ← Back to Applicant
          </Link>
          <span className="flex min-w-0 items-center text-[14px] font-bold text-ink">
            Live Interview Workspace
            <span className="ml-2.5 truncate border-l border-line pl-2.5 font-semibold text-ink-muted">
              with {applicantDisplayName}
            </span>
            {round > 1 ? (
              <span className="ml-2.5 inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">
                Round {round}
              </span>
            ) : null}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {actorIsAdmin ? (
            <Link
              href={`/admin/instructor-applicants/${id}`}
              className="whitespace-nowrap text-[12.5px] font-semibold text-brand-700 hover:underline"
            >
              Application 360 →
            </Link>
          ) : null}
          <Link
            href="#section-pre-brief"
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            View brief
          </Link>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 px-6 py-5">
        {workspace ? (
          <>
            <div
              className="flex items-start gap-2.5 rounded-[12px] border border-line-soft bg-surface px-4 py-3 shadow-card"
              role="note"
            >
              <span aria-hidden className="mt-0.5 text-[15px]">
                {alreadySubmitted ? "✅" : "🎯"}
              </span>
              <div className="min-w-0">
                <p className="m-0 text-[13px] font-bold text-ink">
                  {alreadySubmitted ? "Evaluation submitted" : "What happens when you submit"}
                </p>
                <p className="m-0 text-[12.5px] leading-snug text-ink-muted">
                  {submitOutcomeHint}
                </p>
              </div>
            </div>
            <InterviewReviewEditor
              action={saveInstructorInterviewReviewAction as (fd: FormData) => void}
              liveDraftAction={saveInstructorInterviewLiveDraftAction}
              applicationId={id}
              returnTo={`/applications/instructor/${id}`}
              initialReview={workspace.myReview}
              canEdit={workspace.myReview?.status !== "SUBMITTED" || actorIsAdmin}
              isLeadReviewer={workspace.myReview?.isLeadReview ?? false}
              canFinalizeRecommendation={workspace.canFinalizeRecommendation}
              questionBank={workspace.questionBank}
            />
          </>
        ) : (
          <div
            className="rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900"
            role="status"
          >
            <p className="m-0 font-bold">Interview evaluation isn&apos;t open yet</p>
            <p className="m-0 mt-0.5 text-amber-800">
              This candidate needs to reach the interview stage first — send and confirm an
              interview time from the applicant page, then come back here to record your
              evaluation.
            </p>
            <Link
              href={`/applications/instructor/${id}`}
              className="mt-2 inline-block font-semibold text-amber-900 underline"
            >
              ← Back to applicant
            </Link>
          </div>
        )}

        {/* Pre-interview brief — sibling, always available, collapsed by default */}
        <section id="section-pre-brief" aria-labelledby="section-pre-brief-heading">
          <details>
            <summary
              className="mb-3 cursor-pointer rounded-[12px] border border-line-soft bg-surface px-4 py-3 text-[14px] font-bold text-ink shadow-card hover:bg-surface-soft"
              id="section-pre-brief-heading"
            >
              Pre-Interview Brief (initial review)
            </summary>
            <InterviewerBriefCard
              application={{
                ...application,
                // Prisma returns JsonValue for the JSON column; the card knows
                // the workshopOutline shape so we cast at the boundary.
                workshopOutline:
                  (application.workshopOutline as
                    | import("@/lib/summer-workshop").WorkshopOutline
                    | null
                    | undefined) ?? null,
              }}
              documents={application.documents}
              confirmedSlots={application.offeredSlots}
              reviewerNote={reviewerNote}
            />
          </details>
        </section>
      </div>
    </div>
  );
}
