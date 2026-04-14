import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import { notFound, redirect } from "next/navigation";

import { MentorshipGuideCard } from "@/components/mentorship-guide-card";
import { ReviewNotesBanner } from "@/components/review-notes-banner";
import { GoalReviewForm } from "@/components/mentorship/goal-review-form";
import { POINT_TABLE, TIER_THRESHOLDS, computeTier } from "@/lib/goal-review-actions";
import { getGoalsForMentee, ensureReviewGoalRatings } from "@/lib/mentorship-gr-binding";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import { prisma } from "@/lib/prisma";

const MONTHLY_REVIEW_GUIDE_ITEMS = [
  {
    label: "Per-Goal Ratings (G&R backbone)",
    meaning:
      "Each row is a program goal pulled from the mentee's role lane. Their self-reflection sits inline so you can ground your rating in their actual words.",
    howToUse:
      "Read the reflection block, pick a rating chip, write a one-sentence why. Repeat for every goal.",
  },
  {
    label: "Live Award Preview",
    meaning:
      "The orange panel at the top updates as you change the overall rating and bonus points — it shows exactly what the chair's approval will trigger.",
    howToUse:
      "Use it as a sanity check. If the projected tier seems wrong, your overall rating and bonus probably need a second look.",
  },
  {
    label: "Overall Rating + Plan of Action",
    meaning:
      "The headline rating for the whole month, plus the next-month plan that becomes the mentee's marching orders.",
    howToUse:
      "Choose the color that matches the month overall, then write 1-3 concrete priorities in the plan of action.",
  },
  {
    label: "Save Draft vs Submit for Chair Approval",
    meaning:
      "Drafts stay editable. Submitting routes the review to the chair for the lane and locks editing until they approve or request changes.",
    howToUse:
      "Save drafts liberally; submit only when overall summary and plan of action are written.",
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

  const mentee = await prisma.user.findUnique({
    where: { id: menteeId },
    select: { id: true, name: true, email: true, primaryRole: true },
  });
  if (!mentee) notFound();

  const mentorship = await prisma.mentorship.findFirst({
    where: { menteeId, status: "ACTIVE" },
    select: { id: true, mentorId: true },
  });
  if (!mentorship) {
    return (
      <div>
        <div className="topbar">
          <h1 className="page-title">Write Monthly Review</h1>
        </div>
        <div className="card" style={{ padding: 24, textAlign: "center" }}>
          <p style={{ marginTop: 0 }}>
            {mentee.name} doesn&apos;t have an active mentorship yet, so there&apos;s no monthly review cycle to write.
          </p>
          <Link href={`/mentorship/mentees/${menteeId}`} className="button small">
            Back to workspace
          </Link>
        </div>
      </div>
    );
  }

  if (!isAdmin && mentorship.mentorId !== userId) {
    redirect("/mentorship/mentees");
  }

  // Latest reflection that doesn't yet have a released review.
  const latestReflection = await prisma.monthlySelfReflection.findFirst({
    where: { mentorshipId: mentorship.id },
    orderBy: { cycleNumber: "desc" },
    include: {
      goalResponses: {
        select: {
          goalId: true,
          progressMade: true,
          accomplishments: true,
          blockers: true,
          nextMonthPlans: true,
          objectiveAchieved: true,
        },
      },
      goalReview: {
        include: {
          goalRatings: { select: { goalId: true, rating: true, comments: true } },
        },
      },
    },
  });

  if (!latestReflection) {
    return (
      <div>
        <div className="topbar">
          <h1 className="page-title">Write Monthly Review</h1>
        </div>
        <div className="card" style={{ padding: 24 }}>
          <p style={{ marginTop: 0 }}>
            <strong>{mentee.name}</strong> hasn&apos;t submitted this cycle&apos;s self-reflection yet.
          </p>
          <p className="muted">
            The monthly review form opens once the mentee submits their reflection. The cycle status block on
            their workspace shows where things stand.
          </p>
          <Link href={`/mentorship/mentees/${menteeId}`} className="button small" style={{ marginTop: 8 }}>
            Back to workspace
          </Link>
        </div>
      </div>
    );
  }

  // Make sure the underlying GoalReviewRating rows exist for every active G&R
  // goal so the form can render without null gaps.
  if (latestReflection.goalReview) {
    await ensureReviewGoalRatings({
      id: latestReflection.goalReview.id,
      menteeId,
      cycleNumber: latestReflection.cycleNumber,
    });
  }

  const goals = await getGoalsForMentee(menteeId, latestReflection.cycleNumber);
  const ratingByGoal = new Map(
    (latestReflection.goalReview?.goalRatings ?? []).map((r) => [r.goalId, r])
  );

  const goalRows = goals.map((g) => {
    const existing = ratingByGoal.get(g.id);
    return {
      id: g.id,
      title: g.title,
      description: g.description ?? null,
      currentRating: existing?.rating ?? "GETTING_STARTED",
      currentComments: existing?.comments ?? null,
    };
  });

  const reflectionResponses = latestReflection.goalResponses.map((r) => ({
    goalId: r.goalId,
    progressMade: r.progressMade,
    accomplishments: r.accomplishments,
    blockers: r.blockers,
    nextMonthPlans: r.nextMonthPlans,
    objectiveAchieved: r.objectiveAchieved,
  }));

  const review = latestReflection.goalReview;
  const initialReview = review
    ? {
        overallRating: review.overallRating,
        overallComments: review.overallComments ?? "",
        planOfAction: review.planOfAction ?? "",
        bonusPoints: review.bonusPoints ?? 0,
        bonusReason: review.bonusReason ?? "",
        status: review.status,
      }
    : null;

  // Award projection inputs (computed once on the server, made interactive in
  // the client form via pure recomputation).
  const menteeRoleType = toMenteeRoleType(mentee.primaryRole);
  const pointsByRating: Record<string, number> = {};
  if (menteeRoleType) {
    Object.entries(POINT_TABLE).forEach(([rating, byRole]) => {
      pointsByRating[rating] = byRole[menteeRoleType] ?? 0;
    });
  } else {
    Object.keys(POINT_TABLE).forEach((rating) => (pointsByRating[rating] = 0));
  }

  const summary = await prisma.achievementPointSummary.findUnique({
    where: { userId: menteeId },
    select: { totalPoints: true, currentTier: true },
  });
  const runningTotalPoints = summary?.totalPoints ?? 0;
  const currentTier = summary?.currentTier ?? computeTier(runningTotalPoints);

  const cycleMonthLabel = latestReflection.cycleMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const isLocked = review?.status === "APPROVED";

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href={`/mentorship/mentees/${menteeId}`} style={{ color: "var(--muted)", fontSize: 13 }}>
            &larr; Back to {mentee.name}
          </Link>
          <p className="badge">Monthly Review</p>
          <h1 className="page-title">Write Monthly Review</h1>
          <p className="page-subtitle">
            {cycleMonthLabel} · Cycle {latestReflection.cycleNumber} · For {mentee.name}
          </p>
        </div>
      </div>

      <MentorshipGuideCard
        title="How To Complete A Monthly Goal Review"
        intro="The form is built around the program's G&R goals. The mentee's reflection sits inline so you can rate each goal in context. The orange panel previews exactly what chair approval will award."
        items={MONTHLY_REVIEW_GUIDE_ITEMS}
      />

      {review?.status === "CHANGES_REQUESTED" && review.chairComments && (
        <ReviewNotesBanner
          status="RETURNED"
          reviewNotes={review.chairComments}
          reviewerName={null}
        />
      )}

      {isLocked ? (
        <div className="card" style={{ padding: 24 }}>
          <strong style={{ color: "#16a34a" }}>This review has been approved and released.</strong>
          <p className="muted" style={{ marginTop: 6 }}>
            Approved reviews are read-only. The mentee can see it on their /my-program timeline.
          </p>
        </div>
      ) : (
        <GoalReviewForm
          reflectionId={latestReflection.id}
          menteeName={mentee.name ?? "your mentee"}
          cycleNumber={latestReflection.cycleNumber}
          cycleMonthLabel={cycleMonthLabel}
          goals={goalRows}
          reflectionResponses={reflectionResponses}
          initialReview={initialReview}
          isQuarterly={latestReflection.cycleNumber % 3 === 0}
          pointsByRating={pointsByRating}
          runningTotalPoints={runningTotalPoints}
          currentTier={currentTier}
          tierThresholds={TIER_THRESHOLDS as { tier: string; min: number }[]}
        />
      )}
    </div>
  );
}
