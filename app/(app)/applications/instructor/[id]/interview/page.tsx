import { redirect, notFound } from "next/navigation";
import Link from "next/link";
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

export const dynamic = "force-dynamic";

export default async function InterviewerWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/signin");

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
      legalName: true,
      reviewerId: true,
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

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div className="iv-live-topbar">
        <div className="iv-live-topbar-left">
          <Link href={`/applications/instructor/${id}`} className="iv-live-topbar-back">
            ← Back to Applicant
          </Link>
          <span className="iv-live-topbar-title">Live Interview Workspace</span>
        </div>
        <div className="iv-live-topbar-right">
          <Link
            href="#section-pre-brief"
            className="button outline small"
            style={{ textDecoration: "none" }}
          >
            View brief
          </Link>
        </div>
      </div>

      <div className="iv-live-content">
        {workspace ? (
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
        ) : (
          <div
            className="iv-card iv-card-tone-warning iv-card-body"
            role="status"
            style={{ fontSize: 13 }}
          >
            Interview evaluation is not yet available. The applicant must be in the interview stage
            first.
          </div>
        )}

        {/* Pre-interview brief — sibling, always available, collapsed by default */}
        <section id="section-pre-brief" aria-labelledby="section-pre-brief-heading">
          <details className="interview-brief-collapsible">
            <summary
              className="iv-card iv-card-body"
              style={{
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 700,
                color: "var(--text)",
                listStyle: "revert",
                marginBottom: 12,
              }}
              id="section-pre-brief-heading"
            >
              Pre-Interview Brief (initial review)
            </summary>
            <InterviewerBriefCard
              application={application}
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
