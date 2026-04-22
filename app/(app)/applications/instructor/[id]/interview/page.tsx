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
        select: { id: true, scheduledAt: true, durationMinutes: true, confirmedAt: true },
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
      <div style={{ padding: "12px 24px", borderBottom: "1px solid #e5e7eb" }}>
        <Link
          href={`/applications/instructor/${id}`}
          style={{ fontSize: 13, color: "var(--muted)", textDecoration: "none" }}
        >
          ← Back to Applicant Workspace
        </Link>
      </div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 24px 60px" }}>
        {/* Pre-interview brief */}
        <InterviewerBriefCard
          application={application}
          documents={application.documents}
          confirmedSlots={application.offeredSlots}
          reviewerNote={reviewerNote}
        />

        {/* Live interview workspace */}
        <div className="card" style={{ padding: "24px 28px" }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>Live Interview Workspace</h2>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--muted)" }}>
            Run the interview, save live notes as you go, and submit the final evaluation when the
            conversation is complete.
          </p>

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
              style={{
                padding: "20px",
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: 8,
                fontSize: 13,
                color: "#b45309",
              }}
            >
              Interview evaluation is not yet available. The applicant must be in the interview
              stage first.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
