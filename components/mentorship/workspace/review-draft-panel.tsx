import { CardV2 } from "@/components/ui-v2";
import { ReviewNotesBanner } from "@/components/review-notes-banner";
import { GoalReviewForm } from "@/components/mentorship/goal-review-form";
import { LinkedWorkEvidence } from "@/components/mentorship/workspace/linked-work-evidence";
import { TIER_THRESHOLDS, computeTier } from "@/lib/achievement-tier-utils";
import { getGoalsForMentee, ensureReviewGoalRatings } from "@/lib/mentorship-gr-binding";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import { POINT_TABLE } from "@/lib/mentorship-point-table";
import { prisma } from "@/lib/prisma";
import type { WorkspaceCommitment } from "@/lib/mentorship/workspace";

/**
 * The monthly review writer, inline on /people/[id] (?panel=draft) — the
 * mentor's step of the loop happens where everything else about the person
 * already lives, not on a separate route. The page gates rendering on
 * capabilities.canDraftReview + cycle stage; this panel only assembles the
 * form inputs (same recipe the retired /mentorship/reviews/[menteeId] page
 * used) and defers every write to saveGoalReview.
 */
export async function ReviewDraftPanel({
  menteeId,
  menteeName,
  commitments,
}: {
  menteeId: string;
  menteeName: string;
  commitments: WorkspaceCommitment[];
}) {
  const mentee = await prisma.user.findUnique({
    where: { id: menteeId },
    select: { id: true, name: true, primaryRole: true },
  });
  const mentorship = mentee
    ? await prisma.mentorship.findFirst({
        where: { menteeId, status: "ACTIVE" },
        select: { id: true },
      })
    : null;
  if (!mentee || !mentorship) {
    return (
      <CardV2 padding="md">
        <p className="m-0 text-[13px] text-ink-muted">
          {menteeName} has no active mentorship, so there&apos;s no review cycle to write for.
        </p>
      </CardV2>
    );
  }

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
          goalRatings: {
            select: { goalId: true, grDocumentGoalId: true, rating: true, comments: true },
          },
        },
      },
    },
  });
  if (!latestReflection) {
    return (
      <CardV2 padding="md">
        <p className="m-0 text-[13px] text-ink-muted">
          Waiting on {menteeName}&apos;s self-reflection — the review form opens the moment it&apos;s
          in.
        </p>
      </CardV2>
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

  const existingRatings = latestReflection.goalReview?.goalRatings ?? [];
  const ratingByGoalId = new Map(existingRatings.map((r) => [r.goalId, r]));
  const ratingByGrGoalId = new Map(
    existingRatings
      .filter((r): r is typeof r & { grDocumentGoalId: string } => !!r.grDocumentGoalId)
      .map((r) => [r.grDocumentGoalId, r])
  );

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

  const grGoalDetails = goals.some((g) => g.grDocumentGoalId)
    ? await prisma.gRDocumentGoal.findMany({
        where: { id: { in: goals.map((g) => g.grDocumentGoalId).filter(Boolean) as string[] } },
        select: {
          id: true,
          timePhase: true,
          priority: true,
          progressState: true,
          lifecycleStatus: true,
          dueDate: true,
        },
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

  const review = latestReflection.goalReview;
  const initialReview = review
    ? {
        overallRating: review.overallRating,
        overallComments: review.overallComments ?? "",
        planOfAction: review.planOfAction ?? "",
        bonusPoints: review.bonusPoints ?? 0,
        bonusReason: review.bonusReason ?? "",
        status: review.status,
        nextMonthGoalDraftsJson: review.nextMonthGoalDraftsJson ?? undefined,
      }
    : null;

  // Award projection inputs (computed once on the server, made interactive in
  // the client form via pure recomputation).
  const menteeRoleType = toMenteeRoleType(mentee.primaryRole);
  const pointsByRating: Record<string, number> = {};
  Object.entries(POINT_TABLE).forEach(([rating, byRole]) => {
    pointsByRating[rating] = menteeRoleType ? (byRole[menteeRoleType] ?? 0) : 0;
  });

  const summary = await prisma.achievementPointSummary.findUnique({
    where: { userId: menteeId },
    select: { totalPoints: true, currentTier: true },
  });
  const runningTotalPoints = summary?.totalPoints ?? 0;
  const currentTier = summary?.currentTier ?? computeTier(runningTotalPoints);

  const cycleMonthLabel = latestReflection.cycleMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  if (review?.status === "APPROVED") {
    return (
      <CardV2 padding="md" className="border-l-4 border-l-complete-700">
        <strong className="text-[14px] text-complete-700">
          Approved and released to {menteeName}.
        </strong>
        <p className="m-0 mt-1 text-[13px] text-ink-muted">
          Approved reviews are read-only — it now shows under Released reviews below.
        </p>
      </CardV2>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="m-0 text-[15px] font-bold text-ink">
        Write the {cycleMonthLabel} review · Cycle {latestReflection.cycleNumber}
      </h3>

      <LinkedWorkEvidence menteeId={menteeId} commitments={commitments} />

      {review?.status === "CHANGES_REQUESTED" && review.chairComments ? (
        <ReviewNotesBanner status="RETURNED" reviewNotes={review.chairComments} reviewerName={null} />
      ) : null}

      <GoalReviewForm
        reflectionId={latestReflection.id}
        menteeId={menteeId}
        menteeName={mentee.name ?? "your mentee"}
        cycleNumber={latestReflection.cycleNumber}
        cycleMonthLabel={cycleMonthLabel}
        goals={goalRows}
        reflectionResponses={latestReflection.goalResponses}
        hasReflection={latestReflection.goalResponses.length > 0}
        initialReview={initialReview}
        isQuarterly={latestReflection.cycleNumber % 3 === 0}
        pointsByRating={pointsByRating}
        runningTotalPoints={runningTotalPoints}
        currentTier={currentTier}
        tierThresholds={TIER_THRESHOLDS as { tier: string; min: number }[]}
        maxActiveMonthlyGoals={grDoc?.template?.maxActiveMonthlyGoals ?? 5}
        currentActiveMonthlyCount={grDoc?.goals?.length ?? 0}
      />
    </section>
  );
}
