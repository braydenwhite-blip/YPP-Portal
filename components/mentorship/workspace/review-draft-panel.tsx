import { CardV2 } from "@/components/ui-v2";
import { ReviewNotesBanner } from "@/components/review-notes-banner";
import { SimpleFeedbackForm } from "@/components/mentorship/workspace/simple-feedback-form";
import { getGoalsForMentee, ensureReviewGoalRatings } from "@/lib/mentorship-gr-binding";
import { prisma } from "@/lib/prisma";
import type { WorkspaceCommitment } from "@/lib/mentorship/workspace";

/**
 * Mentor feedback writer — one calm page on the Mentorship workspace.
 * Gates on capabilities + cycle stage upstream; this panel only loads inputs
 * and renders the simple form.
 */
export async function ReviewDraftPanel({
  menteeId,
  menteeName,
  commitments: _commitments,
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
          {menteeName} has no active mentorship, so there&apos;s no feedback to write yet.
        </p>
      </CardV2>
    );
  }

  const latestReflection = await prisma.monthlySelfReflection.findFirst({
    where: { mentorshipId: mentorship.id },
    orderBy: { cycleNumber: "desc" },
    select: {
      id: true,
      cycleNumber: true,
      cycleMonth: true,
      overallReflection: true,
      workingWell: true,
      supportNeeded: true,
      goalReview: {
        select: {
          id: true,
          status: true,
          overallRating: true,
          overallComments: true,
          planOfAction: true,
          chairComments: true,
          goalRatings: {
            select: { goalId: true, grDocumentGoalId: true, rating: true, comments: true },
          },
        },
      },
      mentorCycleCheckIn: { select: { id: true } },
    },
  });
  if (!latestReflection) {
    return (
      <CardV2 padding="md">
        <p className="m-0 text-[13px] text-ink-muted">
          Waiting on {menteeName}&apos;s reflection — feedback opens once it&apos;s in.
        </p>
      </CardV2>
    );
  }

  if (!latestReflection.mentorCycleCheckIn && !latestReflection.goalReview) {
    return (
      <CardV2 padding="md" className="border-l-4 border-l-progress-700">
        <p className="m-0 text-[14px] font-semibold text-ink">Log the meeting first</p>
        <p className="m-0 mt-1 text-[13px] text-ink-muted">
          Mark that you checked in, then come back here to send feedback — two minutes.
        </p>
      </CardV2>
    );
  }

  if (latestReflection.goalReview) {
    await ensureReviewGoalRatings({
      id: latestReflection.goalReview.id,
      menteeId,
      cycleNumber: latestReflection.cycleNumber,
    });
  }

  const goals = await getGoalsForMentee(menteeId, latestReflection.cycleNumber);
  const goalRows = goals.map((g) => ({
    id: g.id,
    title: g.title,
    grDocumentGoalId: g.grDocumentGoalId ?? null,
  }));

  const review = latestReflection.goalReview;
  const cycleMonthLabel = latestReflection.cycleMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  if (review?.status === "APPROVED") {
    return (
      <CardV2 padding="md" className="border-l-4 border-l-complete-700">
        <strong className="text-[14px] text-complete-700">Feedback shared.</strong>
        <p className="m-0 mt-1 text-[13px] text-ink-muted">It shows in the list below.</p>
      </CardV2>
    );
  }

  const reflectionBits = [
    latestReflection.overallReflection,
    latestReflection.workingWell
      ? `Went well: ${latestReflection.workingWell}`
      : null,
    latestReflection.supportNeeded
      ? `Needs help: ${latestReflection.supportNeeded}`
      : null,
  ].filter(Boolean);
  const reflectionBlurb =
    reflectionBits.length > 0 ? reflectionBits.join("\n\n") : null;

  return (
    <section className="overflow-hidden rounded-[16px] border border-line bg-surface shadow-card">
      <div className="border-b border-line-soft bg-surface-soft/70 px-5 py-4 sm:px-6">
        <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.07em] text-ink-muted">
          {cycleMonthLabel}
        </p>
        <h3 className="m-0 mt-1 text-[18px] font-bold tracking-[-0.3px] text-ink">
          Send feedback
        </h3>
        <p className="m-0 mt-1 max-w-[42ch] text-[13.5px] leading-relaxed text-ink-muted">
          Pick how {mentee.name ?? menteeName} did, write two short notes, and send.
        </p>
      </div>

      <div className="flex flex-col gap-4 px-5 py-5 sm:px-6">
        {review?.status === "CHANGES_REQUESTED" && review.chairComments ? (
          <ReviewNotesBanner
            status="RETURNED"
            reviewNotes={review.chairComments}
            reviewerName={null}
          />
        ) : null}

        <SimpleFeedbackForm
          reflectionId={latestReflection.id}
          menteeId={menteeId}
          menteeName={mentee.name ?? menteeName}
          goals={goalRows}
          initialRating={review?.overallRating}
          initialComments={review?.overallComments ?? ""}
          initialPlan={review?.planOfAction ?? ""}
          reflectionBlurb={reflectionBlurb}
        />
      </div>
    </section>
  );
}
