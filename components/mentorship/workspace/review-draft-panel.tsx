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
    <section className="overflow-hidden rounded-[22px] border border-line bg-surface shadow-card">
      <div className="grid lg:grid-cols-[minmax(320px,0.92fr)_minmax(0,1.28fr)]">
        {/* Evidence rail */}
        <aside className="border-b border-line-soft bg-[linear-gradient(180deg,#faf7ff_0%,#ffffff_28%)] lg:border-b-0 lg:border-r lg:border-line-soft">
          <div className="sticky top-0 flex flex-col gap-4 px-5 py-5 sm:px-6 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto lg:py-6">
            <div>
              <p className="m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-700">
                {cycleMonthLabel}
              </p>
              <h3 className="m-0 mt-1.5 text-[17px] font-bold tracking-[-0.02em] text-ink">
                Evidence while you write
              </h3>
              <p className="m-0 mt-1 text-[13px] leading-relaxed text-ink-muted">
                Open work, parent and officer notes, and prior reviews stay here
                so you never leave the page.
              </p>
            </div>

            <LinkedWorkEvidence menteeId={menteeId} commitments={commitments} />

            <div className="flex flex-col gap-5 border-t border-line-soft pt-4 [&_h3]:text-[14px]">
              <InstructorReviewFeedbackContext
                instructorId={menteeId}
                reviewId={review?.id}
                density="full"
              />
            </div>
          </div>
        </aside>

        {/* Writer */}
        <div className="flex min-w-0 flex-col bg-surface">
          <div className="border-b border-line-soft px-5 py-5 sm:px-7 sm:py-6">
            <p className="m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
              Your rating
            </p>
            <h3 className="m-0 mt-1.5 text-[22px] font-semibold tracking-[-0.03em] text-ink">
              Write this month&apos;s review
            </h3>
            <p className="m-0 mt-1.5 max-w-[46ch] text-[14px] leading-relaxed text-ink-muted">
              Capture how {mentee.name ?? menteeName} did, what they should know,
              and one clear focus for next month.
            </p>
          </div>

          <div className="px-5 py-5 sm:px-7 sm:py-6">
            {review?.status === "CHANGES_REQUESTED" && review.chairComments ? (
              <div className="mb-5">
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
