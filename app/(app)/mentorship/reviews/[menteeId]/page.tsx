import { getSession } from "@/lib/auth-supabase";
import { notFound, redirect } from "next/navigation";

import skin from "@/components/ui-v2/portal-skin.module.css";
import { ButtonLink, CardV2, PageHeaderV2 } from "@/components/ui-v2";
import { MentorshipGuideCard } from "@/components/mentorship-guide-card";
import { ReviewNotesBanner } from "@/components/review-notes-banner";
import { GoalReviewForm } from "@/components/mentorship/goal-review-form";
import { TIER_THRESHOLDS, computeTier } from "@/lib/achievement-tier-utils";
import { getGoalsForMentee, ensureReviewGoalRatings } from "@/lib/mentorship-gr-binding";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import { POINT_TABLE } from "@/lib/mentorship-point-table";
import { prisma } from "@/lib/prisma";
import { EmptyStateEditorial } from "../../_components/empty-state-editorial";

export const metadata = { title: "Write review — Mentorship" };

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
      <div className={`${skin.portalSkin} flex flex-col gap-6`}>
        <PageHeaderV2
          eyebrow="Mentorship · Mentor console"
          title="Write review"
          backHref="/mentorship/reviews"
          backLabel="Review inbox"
        />
        <EmptyStateEditorial
          title="No review cycle to write yet."
          body={`${mentee.name} doesn't have an active mentorship, so there's no monthly review cycle running for them. Their workspace still holds their history, requests, and progress signals.`}
          link={{
            label: "Open their workspace",
            href: `/mentorship/people/${menteeId}`,
          }}
        />
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
          goalRatings: { select: { goalId: true, grDocumentGoalId: true, rating: true, comments: true } },
        },
      },
    },
  });

  if (!latestReflection) {
    return (
      <div className={`${skin.portalSkin} flex flex-col gap-6`}>
        <PageHeaderV2
          eyebrow="Mentorship · Mentor console"
          title="Write review"
          backHref="/mentorship/reviews"
          backLabel="Review inbox"
        />
        <EmptyStateEditorial
          title="Waiting on their self-input."
          body={`${mentee.name} hasn't submitted this cycle's self-input yet. The review form opens the moment they do — the cycle status block on their workspace shows exactly where things stand.`}
          link={{
            label: "Open their workspace",
            href: `/mentorship/people/${menteeId}`,
          }}
        />
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

  // Build rating lookup by both legacy goalId and grDocumentGoalId
  const existingRatings = latestReflection.goalReview?.goalRatings ?? [];
  const ratingByGoalId = new Map(existingRatings.map((r) => [r.goalId, r]));
  const ratingByGrGoalId = new Map(
    existingRatings
      .filter((r): r is typeof r & { grDocumentGoalId: string } => !!r.grDocumentGoalId)
      .map((r) => [r.grDocumentGoalId, r])
  );

  // Fetch G&R document data for enrichment + cap info
  const grDoc = await prisma.gRDocument.findFirst({
    where: { userId: menteeId, status: "ACTIVE" },
    select: {
      template: { select: { maxActiveMonthlyGoals: true } },
      goals: {
        where: { lifecycleStatus: "ACTIVE", timePhase: "MONTHLY" },
        select: { id: true },
      },
    },
  });

  // Enrich goals with G&R fields when available
  const grGoalDetails =
    goals.some((g) => g.grDocumentGoalId)
      ? await prisma.gRDocumentGoal.findMany({
          where: { id: { in: goals.map((g) => g.grDocumentGoalId).filter(Boolean) as string[] } },
          select: { id: true, timePhase: true, priority: true, progressState: true, lifecycleStatus: true, dueDate: true },
        })
      : [];
  const grGoalDetailMap = new Map(grGoalDetails.map((g) => [g.id, g]));

  const goalRows = goals.map((g) => {
    const existing = g.grDocumentGoalId
      ? ratingByGrGoalId.get(g.grDocumentGoalId)
      : ratingByGoalId.get(g.legacyGoalId ?? "");
    const grDetail = g.grDocumentGoalId ? grGoalDetailMap.get(g.grDocumentGoalId) : null;
    return {
      id: g.id,
      title: g.title,
      description: g.description ?? null,
      currentRating: existing?.rating ?? "GETTING_STARTED",
      currentComments: existing?.comments ?? null,
      grDocumentGoalId: g.grDocumentGoalId ?? null,
      timePhase: grDetail?.timePhase ?? null,
      priority: grDetail?.priority ?? null,
      currentProgressState: grDetail?.progressState ?? null,
      currentLifecycleStatus: grDetail?.lifecycleStatus ?? null,
      dueDate: grDetail?.dueDate?.toISOString() ?? null,
    };
  });

  const maxActiveMonthlyGoals = grDoc?.template?.maxActiveMonthlyGoals ?? 5;
  const currentActiveMonthlyCount = grDoc?.goals?.length ?? 0;

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
    <div className={`${skin.portalSkin} flex flex-col gap-6`}>
      <PageHeaderV2
        eyebrow="Mentorship · Mentor console"
        title="Write monthly review"
        subtitle={`${cycleMonthLabel} · Cycle ${latestReflection.cycleNumber} · For ${mentee.name}`}
        backHref="/mentorship/reviews"
        backLabel="Review inbox"
        actions={
          <ButtonLink
            href={`/mentorship/people/${menteeId}`}
            variant="secondary"
            size="sm"
          >
            {mentee.name}&apos;s workspace →
          </ButtonLink>
        }
      />

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
        <CardV2 padding="md" className="border-l-4 border-l-success-700">
          <strong className="text-[14px] text-success-700">
            Approved and released to the mentee.
          </strong>
          <p className="m-0 mt-1 text-[13px] text-ink-muted">
            Approved reviews are read-only. The mentee can see it on their /my-program timeline.
          </p>
        </CardV2>
      ) : (
        <GoalReviewForm
          reflectionId={latestReflection.id}
          menteeName={mentee.name ?? "your mentee"}
          cycleNumber={latestReflection.cycleNumber}
          cycleMonthLabel={cycleMonthLabel}
          goals={goalRows}
          reflectionResponses={reflectionResponses}
          hasReflection={latestReflection.goalResponses.length > 0}
          initialReview={initialReview}
          isQuarterly={latestReflection.cycleNumber % 3 === 0}
          pointsByRating={pointsByRating}
          runningTotalPoints={runningTotalPoints}
          currentTier={currentTier}
          tierThresholds={TIER_THRESHOLDS as { tier: string; min: number }[]}
          maxActiveMonthlyGoals={maxActiveMonthlyGoals}
          currentActiveMonthlyCount={currentActiveMonthlyCount}
        />
      )}
    </div>
  );
}
