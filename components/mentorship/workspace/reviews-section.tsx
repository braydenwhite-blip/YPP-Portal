import Link from "next/link";
import {
  CardV2,
  EmptyStateV2,
  StatusBadge,
  type StatusTone,
} from "@/components/ui-v2";
import { MenteeReviewAck } from "@/components/gr/mentee-review-ack";
import { RatingLegend } from "@/components/mentorship/rating-legend";
import { LearnMore } from "@/components/mentorship/learn-more";
import type { MentorshipWorkspace } from "@/lib/mentorship/workspace";
import { prisma } from "@/lib/prisma";
import { getGoalRatingCopy } from "@/lib/mentorship-rubric-copy";
import {
  ensureCurrentMonthForm,
  pastMonthlyForms,
  readMonthlyFeedbackStore,
} from "@/lib/mentorship/feedback-prompts";
import { Prisma } from "@prisma/client";

import { MonthlyFeedbackPanel } from "./monthly-feedback-panel";
import { QuarterlyReviewSection } from "./quarterly-review-section";
import { ProgressUpdateSection } from "./progress-update-section";
import { InstructorReviewFeedbackContext } from "./instructor-review-feedback-context";

/**
 * Feedback tab — one calm job at a time.
 * Writing a review: focused writer + compact evidence.
 * Otherwise: short history + notes; question lists stay collapsed.
 */

const RATING_TONE: Record<string, StatusTone> = {
  ABOVE_AND_BEYOND: "brand",
  ACHIEVED: "success",
  GETTING_STARTED: "warning",
  BEHIND_SCHEDULE: "danger",
};

const RATING_ACCENT: Record<string, string> = {
  ABOVE_AND_BEYOND: "border-l-purple-600",
  ACHIEVED: "border-l-green-600",
  GETTING_STARTED: "border-l-yellow-600",
  BEHIND_SCHEDULE: "border-l-red-600",
};

function formatMonth(value: Date) {
  return value.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export async function ReviewsSection({
  workspace,
  sectionHref,
  forceDraft = false,
}: {
  workspace: MentorshipWorkspace;
  sectionHref: (sectionId: string) => string;
  forceDraft?: boolean;
}) {
  const {
    isSelf,
    lifecycle,
    nextAction,
    person,
    capabilities,
    activeMentorshipId,
  } = workspace;

  const releasedReviews = await prisma.mentorGoalReview.findMany({
    where: { menteeId: person.id, releasedToMenteeAt: { not: null } },
    orderBy: { releasedToMenteeAt: "desc" },
    take: isSelf ? 12 : 0,
    select: {
      id: true,
      cycleMonth: true,
      isQuarterly: true,
      overallRating: true,
      overallComments: true,
      planOfAction: true,
      releasedToMenteeAt: true,
      mentor: { select: { name: true, email: true } },
      reviewAck: { select: { reaction: true, note: true } },
      followUpActionItems: {
        select: { id: true, title: true, completedAt: true, dueAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!lifecycle.hasActiveMentorship && releasedReviews.length === 0) {
    return (
      <EmptyStateV2
        title="No feedback yet"
        body={
          isSelf
            ? "Once you have a mentor, monthly questions will show up here."
            : "Feedback starts after they have a mentor."
        }
      />
    );
  }

  const canCompose =
    !isSelf && (capabilities.canDraftReview || workspace.isAdmin);
  const canAnswer = isSelf;

  const canWriteInline =
    !isSelf &&
    capabilities.canDraftReview &&
    (forceDraft ||
      nextAction.key === "write-review" ||
      nextAction.key === "revise-review" ||
      lifecycle.cycleStage === "CHANGES_REQUESTED");

  const menteeFirst =
    person.name.trim().split(/\s+/)[0] || (isSelf ? "Your" : "Their");

  let currentForm = null as ReturnType<typeof ensureCurrentMonthForm>["current"] | null;
  let pastForms: ReturnType<typeof pastMonthlyForms> = [];

  if (activeMentorshipId) {
    const row = await prisma.mentorship.findUnique({
      where: { id: activeMentorshipId },
      select: { customPromptsJson: true, menteeId: true },
    });
    const existing = readMonthlyFeedbackStore(row?.customPromptsJson);
    const ensured = ensureCurrentMonthForm(existing);
    currentForm = ensured.current;
    pastForms = pastMonthlyForms(ensured.store, ensured.current.cycleMonthKey);
    if (ensured.current.status === "ANSWERED") {
      pastForms = [
        ensured.current,
        ...pastForms.filter((f) => f.id !== ensured.current.id),
      ];
    }

    const alreadyHad = existing.forms.some(
      (f) => f.cycleMonthKey === ensured.current.cycleMonthKey
    );
    const storeChanged =
      JSON.stringify(existing.forms) !== JSON.stringify(ensured.store.forms);
    if (canCompose && (!alreadyHad || storeChanged)) {
      await prisma.mentorship.update({
        where: { id: activeMentorshipId },
        data: {
          customPromptsJson: ensured.store as unknown as Prisma.InputJsonValue,
        },
      });
    }
  }

  if (canWriteInline) {
    // Same Performance Review surface as the Progress tab — mockup form +
    // evidence (open work, parent/officer feedback, month dossier).
    return <ProgressUpdateSection workspace={workspace} />;
  }

  // Mentee: questions + released feedback only.
  if (isSelf) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <header>
          <h2 className="m-0 text-[20px] font-semibold tracking-[-0.02em] text-ink">
            Feedback
          </h2>
          <p className="m-0 mt-1 text-[13.5px] text-ink-muted">
            Answer your mentor’s questions — examples stay on the side as you write.
          </p>
        </header>

        {activeMentorshipId && currentForm ? (
          <MonthlyFeedbackPanel
            mentorshipId={activeMentorshipId}
            personId={person.id}
            current={currentForm}
            past={pastForms}
            canCompose={false}
            canAnswer={canAnswer}
            menteeFirstName={menteeFirst}
            roleLabel={person.roleLabel}
          />
        ) : null}

        {releasedReviews.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h3 className="m-0 text-[15px] font-semibold text-ink">
              From your mentor
            </h3>
            {releasedReviews.map((review, i) => {
              const cfg = getGoalRatingCopy(review.overallRating);
              const rating = String(review.overallRating);
              const isLatest = i === 0;
              return (
                <CardV2
                  key={review.id}
                  padding="md"
                  className={`border-l-4 ${RATING_ACCENT[rating] ?? "border-l-brand-600"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <strong className="text-[14px] text-ink">
                      {formatMonth(review.cycleMonth)}
                    </strong>
                    <StatusBadge tone={RATING_TONE[rating] ?? "info"} withDot>
                      {cfg.menteeLabel}
                    </StatusBadge>
                  </div>
                  {review.overallComments ? (
                    <p className="m-0 mt-2.5 text-[13px] leading-relaxed text-ink">
                      {review.overallComments}
                    </p>
                  ) : null}
                  {review.planOfAction ? (
                    <p className="m-0 mt-2 text-[13px] text-ink-muted">
                      Next steps: {review.planOfAction}
                    </p>
                  ) : null}
                  {isLatest ? (
                    <MenteeReviewAck reviewId={review.id} existingAck={review.reviewAck} />
                  ) : null}
                </CardV2>
              );
            })}
          </section>
        ) : null}

        {releasedReviews.length > 0 ? (
          <LearnMore summary="What do these status colors mean?">
            <RatingLegend audience="mentee" />
          </LearnMore>
        ) : null}
      </div>
    );
  }

  // Mentor / admin — monthly Q&A is the main process; context stays secondary.
  const progressHref = sectionHref("progress");
  const feedbackAnswered = currentForm?.status === "ANSWERED";
  const canOfferWrite =
    capabilities.canDraftReview &&
    (feedbackAnswered ||
      nextAction.key === "write-review" ||
      nextAction.key === "revise-review" ||
      lifecycle.cycleStage === "CHANGES_REQUESTED" ||
      lifecycle.cycleStage === "REFLECTION_SUBMITTED");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header>
        <h2 className="m-0 text-[22px] font-semibold tracking-[-0.02em] text-ink">
          Feedback
        </h2>
        <p className="m-0 mt-1 text-[14px] text-ink-muted">
          Same split as G&amp;R: goals by role/cohort, examples for{" "}
          {menteeFirst} that you set — then send and write Progress.
        </p>
      </header>

      {activeMentorshipId && currentForm && canCompose ? (
        <MonthlyFeedbackPanel
          mentorshipId={activeMentorshipId}
          personId={person.id}
          current={currentForm}
          past={pastForms}
          canCompose={canCompose}
          canAnswer={false}
          menteeFirstName={menteeFirst}
          roleLabel={person.roleLabel}
          progressHref={progressHref}
        />
      ) : !activeMentorshipId ? (
        <EmptyStateV2
          title="No active mentorship"
          body="Monthly questions show up once a mentorship is active."
        />
      ) : null}

      {canOfferWrite ? (
        <Link
          href={progressHref}
          className="rounded-[14px] border border-line bg-surface px-4 py-3.5 no-underline transition-colors hover:border-brand-300 hover:bg-surface-soft"
        >
          <p className="m-0 text-[15px] font-semibold text-ink">
            {lifecycle.cycleStage === "CHANGES_REQUESTED"
              ? "Finish the performance review"
              : "Write performance review"}
          </p>
          <p className="m-0 mt-0.5 text-[13px] text-ink-muted">
            Opens Review — evidence stays visible while you write and send.
          </p>
        </Link>
      ) : null}

      <details className="rounded-[14px] border border-line-soft bg-surface px-4 py-3">
        <summary className="cursor-pointer list-none text-[14px] font-semibold text-ink marker:content-none [&::-webkit-details-marker]:hidden">
          What others said &amp; notes
        </summary>
        <div className="mt-4 border-t border-line-soft pt-4">
          <InstructorReviewFeedbackContext
            instructorId={person.id}
            density="calm"
          />
        </div>
      </details>

      {capabilities.canRunQuarterlyReview && lifecycle.quarterlyDue ? (
        <details className="rounded-[14px] border border-line-soft px-4 py-3">
          <summary className="cursor-pointer text-[13px] font-semibold text-ink-muted">
            Quarterly review
          </summary>
          <div className="mt-3">
            <QuarterlyReviewSection workspace={workspace} />
          </div>
        </details>
      ) : null}
    </div>
  );
}
