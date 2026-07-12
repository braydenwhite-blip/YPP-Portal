import {
  CardV2,
  EmptyStateV2,
  StatusBadge,
  ButtonLink,
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
import { ReviewDraftPanel } from "./review-draft-panel";

/**
 * Feedback — mentor builds/sends a monthly question list; mentee answers;
 * past months live in their own section. Meetings stay on Meetings.
 */

const RATING_TONE: Record<string, StatusTone> = {
  ABOVE_AND_BEYOND: "brand",
  ACHIEVED: "success",
  GETTING_STARTED: "warning",
  BEHIND_SCHEDULE: "danger",
};

const RATING_ACCENT: Record<string, string> = {
  ABOVE_AND_BEYOND: "border-l-brand-600",
  ACHIEVED: "border-l-complete-700",
  GETTING_STARTED: "border-l-progress-700",
  BEHIND_SCHEDULE: "border-l-blocked-700",
};

function formatMonth(value: Date) {
  return value.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function monthKey(value: Date) {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function ReviewsSection({
  workspace,
}: {
  workspace: MentorshipWorkspace;
  sectionHref: (sectionId: string) => string;
}) {
  const {
    isSelf,
    lifecycle,
    nextAction,
    person,
    capabilities,
    commitments,
    activeMentorshipId,
  } = workspace;

  const releasedReviews = await prisma.mentorGoalReview.findMany({
    where: { menteeId: person.id, releasedToMenteeAt: { not: null } },
    orderBy: { releasedToMenteeAt: "desc" },
    take: 12,
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
    (nextAction.key === "write-review" ||
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

    // Persist a new current-month draft when the mentor opens Feedback.
    const alreadyHad = existing.forms.some(
      (f) => f.cycleMonthKey === ensured.current.cycleMonthKey
    );
    if (canCompose && !alreadyHad) {
      await prisma.mentorship.update({
        where: { id: activeMentorshipId },
        data: {
          customPromptsJson: ensured.store as unknown as Prisma.InputJsonValue,
        },
      });
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex max-w-[52ch] flex-col gap-3 sm:max-w-none sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-[52ch]">
          <h2 className="m-0 text-[18px] font-bold tracking-[-0.3px] text-ink">
            Monthly feedback
          </h2>
          <p className="m-0 mt-1 text-[13.5px] leading-relaxed text-ink-muted">
            {isSelf
              ? "When your mentor sends questions, answer them here. Past months stay available to reopen."
              : `Build ${menteeFirst}'s question list for this month, send it, then read answers under Past months.`}
          </p>
        </div>
        {activeMentorshipId && currentForm ? (
          <ButtonLink
            href={`/mentorship/people/${person.id}/monthly-update/print?month=${currentForm.cycleMonthKey}`}
            variant="secondary"
            size="sm"
          >
            Monthly update PDF
          </ButtonLink>
        ) : null}
      </header>

      {activeMentorshipId && currentForm ? (
        <MonthlyFeedbackPanel
          mentorshipId={activeMentorshipId}
          personId={person.id}
          current={currentForm}
          past={pastForms}
          canCompose={canCompose}
          canAnswer={canAnswer}
          menteeFirstName={menteeFirst}
        />
      ) : null}

      {canWriteInline ? (
        <details className="rounded-[16px] border border-line bg-surface shadow-sm">
          <summary className="cursor-pointer list-none px-5 py-4 marker:content-none [&::-webkit-details-marker]:hidden">
            <p className="m-0 text-[15px] font-bold text-ink">
              Optional: send a written rating
            </p>
            <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">
              Only if you want a formal note with ratings — not required every month.
            </p>
          </summary>
          <div className="border-t border-line-soft px-5 py-4">
            <ReviewDraftPanel
              menteeId={person.id}
              menteeName={person.name}
              commitments={commitments}
            />
          </div>
        </details>
      ) : null}

      {capabilities.canRunQuarterlyReview && lifecycle.quarterlyDue ? (
        <details className="rounded-[12px] border border-line-soft bg-surface-soft/60 px-3.5 py-2.5">
          <summary className="cursor-pointer text-[12.5px] font-semibold text-ink-muted">
            Quarterly review (committee)
          </summary>
          <div className="mt-3">
            <QuarterlyReviewSection workspace={workspace} />
          </div>
        </details>
      ) : null}

      {releasedReviews.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h3 className="m-0 text-[15px] font-bold text-ink">
            {isSelf ? "Written feedback from your mentor" : "Written feedback you’ve shared"}
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
                    {review.isQuarterly ? " · Quarterly" : ""}
                  </strong>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      tone={RATING_TONE[rating] ?? "info"}
                      title={isSelf ? cfg.menteeDescription : cfg.mentorDescription}
                      withDot
                    >
                      {isSelf ? cfg.menteeLabel : cfg.label}
                    </StatusBadge>
                    <ButtonLink
                      href={`/mentorship/people/${person.id}/monthly-update/print?reviewId=${review.id}&month=${monthKey(review.cycleMonth)}`}
                      variant="secondary"
                      size="sm"
                    >
                      Monthly update PDF
                    </ButtonLink>
                  </div>
                </div>

                {review.overallComments ? (
                  <p className="m-0 mt-2.5 text-[13px] leading-relaxed text-ink">
                    {review.overallComments}
                  </p>
                ) : null}

                {review.planOfAction ? (
                  <div className="mt-2.5 rounded-lg bg-surface-soft px-3 py-2.5">
                    <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.05em] text-ink-muted">
                      Next steps
                    </p>
                    <p className="m-0 mt-1 text-[13px] text-ink">{review.planOfAction}</p>
                  </div>
                ) : null}

                {review.followUpActionItems.length > 0 ? (
                  <div className="mt-2.5">
                    <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.05em] text-ink-muted">
                      Follow-ups
                    </p>
                    <ul className="m-0 mt-1 flex list-none flex-col gap-1 p-0">
                      {review.followUpActionItems.map((item) => (
                        <li key={item.id} className="flex items-center gap-2 text-[13px]">
                          <span
                            aria-hidden
                            className={`size-1.5 shrink-0 rounded-full ${
                              item.completedAt ? "bg-complete-700" : "bg-brand-400"
                            }`}
                          />
                          <span
                            className={
                              item.completedAt ? "text-ink-muted line-through" : "text-ink"
                            }
                          >
                            {item.title}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {isSelf && isLatest ? (
                  <MenteeReviewAck reviewId={review.id} existingAck={review.reviewAck} />
                ) : null}
                {!isSelf && review.reviewAck ? (
                  <p className="m-0 mt-2.5 text-[12.5px] text-ink-muted">
                    Their reaction:{" "}
                    <strong className="text-ink">
                      {review.reviewAck.reaction.toLowerCase().replace(/_/g, " ")}
                    </strong>
                    {review.reviewAck.note ? ` — “${review.reviewAck.note}”` : ""}
                  </p>
                ) : null}
              </CardV2>
            );
          })}
        </section>
      ) : null}

      {isSelf && releasedReviews.length > 0 ? (
        <LearnMore summary="What do these status colors mean?">
          <RatingLegend audience="mentee" />
        </LearnMore>
      ) : null}
    </div>
  );
}
