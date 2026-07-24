import { CardV2 } from "@/components/ui-v2";
import { ReviewNotesBanner } from "@/components/review-notes-banner";
import { SimpleFeedbackForm } from "@/components/mentorship/workspace/simple-feedback-form";
import { InstructorReviewFeedbackContext } from "@/components/mentorship/workspace/instructor-review-feedback-context";
import { LinkedWorkEvidence } from "@/components/mentorship/workspace/linked-work-evidence";
import { getGoalsForMentee, ensureReviewGoalRatings } from "@/lib/mentorship-gr-binding";
import { listInstructorReviewQuestions } from "@/lib/instructor-feedback-actions";
import { findActiveMentorshipForMentee } from "@/lib/mentorship-canonical";
import { prisma } from "@/lib/prisma";
import type { WorkspaceCommitment } from "@/lib/mentorship/workspace";

/**
 * Mentor monthly-review workspace — officer/parent feedback stays visible
 * beside (desktop) or above (mobile) the form. One page; no popups/dashboards.
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
    select: {
      id: true,
      name: true,
      primaryRole: true,
      roles: { select: { role: true } },
    },
  });
  const mentorship = mentee ? await findActiveMentorshipForMentee(menteeId) : null;

  const context = (
    <InstructorReviewFeedbackContext instructorId={menteeId} density="full" />
  );

  if (!mentee || !mentorship) {
    return (
      <section className="flex flex-col gap-5">
        <CardV2 padding="md">
          <p className="m-0 text-[13px] text-ink-muted">
            {menteeName} has no active mentorship, so there&apos;s no review to write yet.
          </p>
        </CardV2>
        {context}
      </section>
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
          reviewAnswers: {
            select: { questionId: true, answer: true, rating: true },
          },
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
      <section className="flex flex-col gap-5">
        <CardV2 padding="md">
          <p className="m-0 text-[14px] font-semibold text-ink">Waiting on reflection</p>
          <p className="m-0 mt-1 text-[13px] text-ink-muted">
            Feedback opens once {menteeName}&apos;s monthly reflection is in. Context below stays
            available now.
          </p>
        </CardV2>
        {context}
      </section>
    );
  }

  if (!latestReflection.mentorCycleCheckIn && !latestReflection.goalReview) {
    return (
      <section className="flex flex-col gap-5">
        <CardV2 padding="md" className="border-l-4 border-l-progress-700">
          <p className="m-0 text-[14px] font-semibold text-ink">Log the meeting first</p>
          <p className="m-0 mt-1 text-[13px] text-ink-muted">
            Mark that you checked in, then come back here to write the review.
          </p>
        </CardV2>
        {context}
      </section>
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
      <section className="flex flex-col gap-5">
        <CardV2 padding="md" className="border-l-4 border-l-complete-700">
          <strong className="text-[14px] text-complete-700">Feedback shared</strong>
          <p className="m-0 mt-1 text-[13px] text-ink-muted">
            This month is released. Prior reviews and notes remain below.
          </p>
        </CardV2>
        <InstructorReviewFeedbackContext
          instructorId={menteeId}
          reviewId={review.id}
          density="full"
        />
      </section>
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

  // Configurable questions apply to every mentee role — not instructors only.
  const questions = await listInstructorReviewQuestions({ activeOnly: true });

  return (
    <section className="overflow-hidden rounded-[16px] border border-line bg-surface shadow-card">
      <div className="border-b border-line-soft bg-surface-soft/70 px-5 py-4 sm:px-6">
        <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.07em] text-ink-muted">
          {cycleMonthLabel}
        </p>
        <h3 className="m-0 mt-1 text-[18px] font-bold tracking-[-0.3px] text-ink">
          Write this month&apos;s review
        </h3>
        <p className="m-0 mt-1 max-w-[48ch] text-[13.5px] leading-relaxed text-ink-muted">
          Officer and parent feedback stay visible while you write — no popups, no extra pages.
        </p>
      </div>

      <div className="px-5 py-5 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start">
          <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1">
            <LinkedWorkEvidence menteeId={menteeId} commitments={commitments} />
            <InstructorReviewFeedbackContext
              instructorId={menteeId}
              reviewId={review?.id}
              density="full"
            />
          </aside>

          <div className="min-w-0">
            {review?.status === "CHANGES_REQUESTED" && review.chairComments ? (
              <div className="mb-4">
                <ReviewNotesBanner
                  status="RETURNED"
                  reviewNotes={review.chairComments}
                  reviewerName={null}
                />
              </div>
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
              reviewId={review?.id}
              questions={questions}
              initialAnswers={review?.reviewAnswers ?? []}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
