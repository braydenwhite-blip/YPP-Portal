import { getServerSession } from "next-auth";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { mentorshipRequiresChairApproval } from "@/lib/mentorship-canonical";
import { submitMonthlyGoalReview } from "@/lib/mentorship-program-actions";
import { prisma } from "@/lib/prisma";
import { FeedbackForm } from "../../feedback/[menteeId]/feedback-form";

export default async function MonthlyReviewEditorPage({
  params,
}: {
  params: Promise<{ menteeId: string }>;
}) {
  const { menteeId } = await params;
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const roles = session?.user?.roles ?? [];

  if (!userId) {
    redirect("/login");
  }

  const isMentor = roles.includes("MENTOR");
  const isChapterLead = roles.includes("CHAPTER_LEAD");
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
          <h1 className="page-title">Monthly Goal Review</h1>
        </div>
      </div>

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
