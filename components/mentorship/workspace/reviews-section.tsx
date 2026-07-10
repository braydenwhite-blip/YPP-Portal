import {
  ButtonLink,
  CardV2,
  EmptyStateV2,
  StatusBadge,
  type StatusTone,
} from "@/components/ui-v2";
import { MenteeReviewAck } from "@/components/gr/mentee-review-ack";
import { RatingLegend } from "@/components/mentorship/rating-legend";
import { LearnMore } from "@/components/mentorship/learn-more";
import ReflectionForm from "@/app/(app)/my-program/reflect/reflection-form";
import type { MentorshipWorkspace } from "@/lib/mentorship/workspace";
import { prisma } from "@/lib/prisma";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import { getGoalRatingCopy } from "@/lib/mentorship-rubric-copy";
import { resolveReflectionQuestions } from "@/lib/mentorship/reflection-questions";

import { CycleStrip } from "./cycle-strip";
import { QuarterlyReviewSection } from "./quarterly-review-section";

/**
 * Reviews — the monthly loop as one lifecycle, not a set of components:
 * reflection → Mentor Check-in → Monthly Progress Update → approval → release → acknowledgment →
 * what came out of it (next steps + follow-up commitments).
 *
 * Self view: the cycle strip, the reflection composer when it's your move,
 * every review released to you (with your reaction), and the outcomes.
 * Mentor/leadership view: the same strip, the one review action if it's your
 * move, the mentee's reaction once they've read it, and the past record.
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

export async function ReviewsSection({
  workspace,
  sectionHref,
}: {
  workspace: MentorshipWorkspace;
  sectionHref: (sectionId: string) => string;
}) {
  const { isSelf, lifecycle, cycleStrip, nextAction, person, capabilities } = workspace;
  const firstName = person.name.split(" ")[0];

  // Everything released to this person, plus the mentee's reactions and the
  // follow-up commitments each review spawned.
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
        title="No reviews yet"
        body={
          isSelf
            ? "Monthly reviews start once you're paired with a mentor and the kickoff happens."
            : `Monthly reviews start once ${firstName} has an active mentorship.`
        }
      />
    );
  }

  const showReflectionComposer =
    isSelf && lifecycle.kickoffComplete && lifecycle.cycleStage === "REFLECTION_DUE";
  const reviewActionKeys = new Set([
    "record-mentor-check-in",
    "write-review",
    "revise-review",
    "approve-review",
  ]);
  const showCycleCta = !isSelf && nextAction.href && reviewActionKeys.has(nextAction.key);

  return (
    <div className="flex flex-col gap-4">
      {/* Quarterly Committee Review dominates once due — committee-internal
          deliberation, never shown to the mentee themselves. */}
      {capabilities.canRunQuarterlyReview ? <QuarterlyReviewSection workspace={workspace} /> : null}

      {lifecycle.hasActiveMentorship && lifecycle.kickoffComplete ? (
        <CycleStrip steps={cycleStrip} cycleLabel={lifecycle.cycleLabel} />
      ) : null}

      {showCycleCta ? (
        <div className="flex">
          <ButtonLink href={nextAction.href!} size="sm">
            {nextAction.label} →
          </ButtonLink>
        </div>
      ) : null}

      {showReflectionComposer ? <SelfReflectionComposer personId={person.id} /> : null}

      {releasedReviews.length === 0 ? (
        <CardV2 padding="lg" className="text-center">
          <p className="m-0 text-[15px] font-semibold text-ink">
            {isSelf ? "Your progress story starts soon" : "No reviews released yet"}
          </p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-ink-muted">
            {isSelf
              ? "After your first monthly review is shared with you, you'll see the feedback and encouragement your mentor wrote here. Nothing here is a grade — it's a picture of your growth."
              : `Once a monthly review is approved and released, it appears here along with ${firstName}'s reaction.`}
          </p>
        </CardV2>
      ) : (
        <section className="flex flex-col gap-3">
          <h3 className="m-0 text-[15px] font-bold text-ink">
            {isSelf ? "Feedback released to you" : "Released reviews"}
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
                  <StatusBadge
                    tone={RATING_TONE[rating] ?? "info"}
                    title={isSelf ? cfg.menteeDescription : cfg.mentorDescription}
                    withDot
                  >
                    {isSelf ? cfg.menteeLabel : cfg.label}
                  </StatusBadge>
                </div>

                {review.overallComments ? (
                  <p className="m-0 mt-2.5 text-[13px] leading-relaxed text-ink">
                    {review.overallComments}
                  </p>
                ) : null}

                {review.planOfAction ? (
                  <div className="mt-2.5 rounded-lg bg-surface-soft px-3 py-2.5">
                    <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.05em] text-ink-muted">
                      {isSelf ? "Your next steps" : "Plan for next cycle"}
                    </p>
                    <p className="m-0 mt-1 text-[13px] text-ink">{review.planOfAction}</p>
                  </div>
                ) : null}

                {review.followUpActionItems.length > 0 ? (
                  <div className="mt-2.5">
                    <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.05em] text-ink-muted">
                      What came out of this review
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

                {/* Acknowledgment closes the loop. */}
                {isSelf && isLatest ? (
                  <MenteeReviewAck
                    reviewId={review.id}
                    existingAck={review.reviewAck}
                  />
                ) : null}
                {!isSelf && review.reviewAck ? (
                  <p className="m-0 mt-2.5 text-[12.5px] text-ink-muted">
                    {firstName}&apos;s reaction:{" "}
                    <strong className="text-ink">
                      {review.reviewAck.reaction.toLowerCase().replace(/_/g, " ")}
                    </strong>
                    {review.reviewAck.note ? ` — “${review.reviewAck.note}”` : ""}
                  </p>
                ) : null}
                {!isSelf && isLatest && !review.reviewAck ? (
                  <p className="m-0 mt-2.5 text-[12.5px] italic text-ink-muted">
                    {firstName} hasn&apos;t reacted to this review yet.
                  </p>
                ) : null}
              </CardV2>
            );
          })}
        </section>
      )}

      {isSelf && releasedReviews.length > 0 ? (
        <LearnMore summary="What do these status colors mean?">
          <RatingLegend audience="mentee" />
        </LearnMore>
      ) : null}

      {isSelf && !showReflectionComposer && lifecycle.cycleStage === "REFLECTION_SUBMITTED" ? (
        <p className="m-0 text-[12.5px] text-ink-muted">
          Your {lifecycle.cycleLabel} reflection is in — {lifecycle.mentorName ?? "your mentor"}{" "}
          is writing your review.
        </p>
      ) : null}

      {!isSelf && capabilities.canDraftReview ? (
        <p className="m-0 text-[12.5px] text-ink-muted">
          Need the full review history?{" "}
          <a
            href={sectionHref("reviews") + "&panel=draft"}
            className="font-semibold text-brand-700 hover:underline"
          >
            Open the Monthly Progress Update writer →
          </a>
        </p>
      ) : !isSelf ? null : (
        <p className="m-0 text-[12.5px] text-ink-muted">
          Your goals and their latest ratings live in{" "}
          <a href={sectionHref("goals")} className="font-semibold text-brand-700 hover:underline">
            Goals
          </a>
          .
        </p>
      )}
    </div>
  );
}

/** The monthly reflection composer — inline, only when it's the mentee's move. */
async function SelfReflectionComposer({ personId }: { personId: string }) {
  const person = await prisma.user.findUnique({
    where: { id: personId },
    select: { primaryRole: true },
  });
  const menteeRoleType = toMenteeRoleType(person?.primaryRole ?? "");

  const [mentorship, goals, cycleParticipant] = await Promise.all([
    prisma.mentorship.findFirst({
      where: { menteeId: personId, status: "ACTIVE" },
      select: {
        id: true,
        selfReflections: {
          orderBy: { cycleNumber: "desc" },
          take: 1,
          select: { cycleNumber: true },
        },
      },
    }),
    menteeRoleType
      ? prisma.mentorshipProgramGoal.findMany({
          where: { roleType: menteeRoleType, isActive: true },
          orderBy: { sortOrder: "asc" },
          select: { id: true, title: true, description: true },
        })
      : [],
    // A Chief of Staff/admin can retune this cycle's reflection prompt
    // wording (ReviewCycle.reflectionQuestionsJson) without touching the
    // form itself — falls back to the standard copy when no active cycle
    // covers this person.
    prisma.reviewCycleParticipant.findFirst({
      where: { userId: personId, cycle: { status: "active" } },
      orderBy: { addedAt: "desc" },
      select: { cycle: { select: { reflectionQuestionsJson: true } } },
    }),
  ]);
  if (!mentorship) return null;

  const cycleNumber = (mentorship.selfReflections[0]?.cycleNumber ?? 0) + 1;
  const isQuarterly = cycleNumber % 3 === 0;
  const questions = resolveReflectionQuestions(
    cycleParticipant?.cycle.reflectionQuestionsJson as
      | Parameters<typeof resolveReflectionQuestions>[0]
      | undefined
  );

  return (
    <details className="rounded-[12px] border border-brand-200 bg-brand-50/40 p-4" open>
      <summary className="cursor-pointer text-[14px] font-bold text-ink">
        Submit your{" "}
        {new Date().toLocaleDateString("en-US", { month: "long" })} reflection
        {isQuarterly ? " (quarterly)" : ""}
      </summary>
      <p className="m-0 mt-2 text-[12.5px] text-ink-muted">
        <strong className="text-ink">This is for you and your mentor.</strong> Be honest
        about what&apos;s going well and what&apos;s hard — your mentor reads this before
        writing your monthly review.
      </p>
      <div className="mt-3">
        <ReflectionForm
          goals={goals}
          cycleNumber={cycleNumber}
          isQuarterly={isQuarterly}
          questions={questions}
          returnHref={`/mentorship/people/${personId}?section=reviews`}
        />
      </div>
    </details>
  );
}
