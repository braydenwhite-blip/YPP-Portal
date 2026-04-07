import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import { notFound, redirect } from "next/navigation";

import { MentorshipGuideCard } from "@/components/mentorship-guide-card";
import { ReviewNotesBanner } from "@/components/review-notes-banner";
import { mentorshipRequiresChairApproval } from "@/lib/mentorship-canonical";
import { submitMonthlyGoalReview } from "@/lib/mentorship-program-actions";
import { prisma } from "@/lib/prisma";
import { FeedbackForm } from "../../feedback/[menteeId]/feedback-form";

const MONTHLY_REVIEW_GUIDE_ITEMS = [
  {
    label: "Per-Goal Ratings",
    meaning:
      "This is where you score each goal one by one so the review is tied to actual goals instead of general impressions.",
    howToUse:
      "Read the goal title, choose the progress color that matches the month, and write short comments about wins, blockers, and next steps.",
  },
  {
    label: "Overall Progress",
    meaning:
      "This is the single monthly summary bar for the whole review.",
    howToUse:
      "Choose the color that best matches the month as a whole after you finish the per-goal ratings.",
  },
  {
    label: "Mentor Summary and Committee Notes",
    meaning:
      "These text areas explain the story behind the ratings for both the mentee and any chair or committee reviewer.",
    howToUse:
      "Use the mentor summary to speak clearly to the student, and use committee-facing notes to capture internal decision-making context.",
  },
  {
    label: "Plan Of Action and Submission",
    meaning:
      "The last section turns the review into a concrete plan and sends it into the right workflow.",
    howToUse:
      "Write the next month's priorities, then submit the review so it either publishes directly or moves into chair approval.",
  },
] as const;

export default async function MonthlyReviewEditorPage({
  params,
}: {
  params: Promise<{ menteeId: string }>;
}) {
  const { menteeId } = await params;
  const session = await getSession();
  const userId = session?.user?.id;
  const roles = session?.user?.roles ?? [];

  if (!userId) {
    redirect("/login");
  }

  const isMentor = roles.includes("MENTOR");
  const isChapterLead = roles.includes("CHAPTER_PRESIDENT");
  const isAdmin = roles.includes("ADMIN");

  if (!isMentor && !isChapterLead && !isAdmin) {
    redirect("/");
  }

  if (!isAdmin) {
    const mentorship = await prisma.mentorship.findFirst({
      where: {
        mentorId: userId,
        menteeId,
        status: "ACTIVE",
      },
    });

    if (!mentorship) {
      redirect("/mentorship/mentees");
    }
  }

  const mentee = await prisma.user.findUnique({
    where: { id: menteeId },
    include: {
      roles: true,
      chapter: true,
      goals: {
        include: {
          template: true,
          progress: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { template: { sortOrder: "asc" } },
      },
      menteePairs: {
        where: { status: "ACTIVE" },
        take: 1,
      },
    },
  });

  if (!mentee) {
    notFound();
  }

  const currentMonth = new Date();
  const normalizedMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth(),
    1
  );
  const existingReview = mentee.menteePairs[0]
    ? await prisma.monthlyGoalReview.findFirst({
        where: {
          mentorshipId: mentee.menteePairs[0].id,
          month: normalizedMonth,
        },
        include: {
          goalRatings: true,
          chair: {
            select: {
              name: true,
            },
          },
        },
      })
    : null;
  const activeMentorship = mentee.menteePairs[0] ?? null;
  const requiresChairApproval = activeMentorship
    ? mentorshipRequiresChairApproval({
        programGroup: activeMentorship.programGroup,
        governanceMode: activeMentorship.governanceMode,
      })
    : true;

  const goalsData = mentee.goals.map((goal) => ({
    id: goal.id,
    title: goal.template.title,
    description: goal.template.description,
    timetable: goal.timetable,
    currentStatus: goal.progress[0]?.status ?? null,
    currentComments: goal.progress[0]?.comments ?? null,
  }));

  return (
    <div>
      <div className="topbar">
        <div>
          <Link
            href={`/mentorship/mentees/${menteeId}`}
            style={{ color: "var(--muted)", fontSize: 13 }}
          >
            &larr; Back to {mentee.name}
          </Link>
          <h1 className="page-title">Write Monthly Review</h1>
          <p className="page-subtitle">
            Build the evidence, summary, and next-step plan that will move through approval and eventually be shown to the mentee.
          </p>
        </div>
      </div>

      <MentorshipGuideCard
        title="How To Complete A Monthly Goal Review"
        intro="Work from top to bottom. The review should show what happened this month, what it means, and what the mentee should do next."
        items={MONTHLY_REVIEW_GUIDE_ITEMS}
      />

      <div className="card">
        <div style={{ marginBottom: 24 }}>
          <div className="section-title">Review For</div>
          <h3 style={{ margin: 0 }}>{mentee.name}</h3>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
            {mentee.email} · {mentee.primaryRole.replace("_", " ")}
            {mentee.chapter && ` · ${mentee.chapter.name}`}
          </p>
          <p style={{ margin: "12px 0 0", color: "var(--muted)", fontSize: 13 }}>
            Build the mentor review for{" "}
            {normalizedMonth.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
            .{" "}
            {requiresChairApproval
              ? "This will move into chair approval once submitted."
              : "This will publish directly unless you intentionally escalate it to chair review."}
          </p>
        </div>

        {existingReview?.status === "RETURNED" && existingReview.chairDecisionNotes && (
          <ReviewNotesBanner
            status={existingReview.status}
            reviewNotes={existingReview.chairDecisionNotes}
            reviewerName={existingReview.chair?.name ?? null}
          />
        )}

        {mentee.goals.length === 0 ? (
          <div
            style={{
              padding: 24,
              textAlign: "center",
              color: "var(--muted)",
            }}
          >
            <p>This mentee has no goals assigned yet.</p>
            {isAdmin && (
              <Link
                href="/admin/goals"
                className="button small"
                style={{ marginTop: 12, display: "inline-block" }}
              >
                Assign Goals
              </Link>
            )}
          </div>
        ) : !activeMentorship ? (
          <div
            style={{
              padding: 24,
              textAlign: "center",
              color: "var(--muted)",
            }}
          >
            <p style={{ marginTop: 0 }}>
              This mentee does not have an active mentorship yet, so there is no monthly review cycle to submit.
            </p>
            <p style={{ margin: "8px 0 0" }}>
              Assign a mentor or activate the support relationship first, then come back here to write the review.
            </p>
            <Link
              href={`/mentorship/mentees/${menteeId}`}
              className="button small"
              style={{ marginTop: 12, display: "inline-block" }}
            >
              Back to Support Workspace
            </Link>
          </div>
        ) : (
          <FeedbackForm
            menteeId={menteeId}
            month={normalizedMonth.toISOString()}
            goals={goalsData}
            existingReview={
              existingReview
                ? {
                    overallStatus: existingReview.overallStatus,
                    overallComments: existingReview.overallComments,
                    strengths: existingReview.strengths,
                    focusAreas: existingReview.focusAreas,
                    collaborationNotes: existingReview.collaborationNotes,
                    promotionReadiness: existingReview.promotionReadiness,
                    nextMonthPlan: existingReview.nextMonthPlan,
                    mentorInternalNotes: existingReview.mentorInternalNotes,
                    status: existingReview.status,
                    characterCulturePoints:
                      existingReview.characterCulturePoints,
                    goalRatings: existingReview.goalRatings.map((rating) => ({
                      goalId: rating.goalId,
                      status: rating.status,
                      comments: rating.comments,
                    })),
                  }
                : null
            }
            requiresChairApproval={requiresChairApproval}
            allowChairEscalation={!requiresChairApproval}
            submitAction={submitMonthlyGoalReview}
          />
        )}
      </div>
    </div>
  );
}
