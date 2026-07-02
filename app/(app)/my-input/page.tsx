import { redirect } from "next/navigation";

import {
  ContributorFeedbackForm,
  SelfInputForm,
} from "@/components/development/cycle-forms";
import { PageHeaderV2, RecordSection, StatusBadge } from "@/components/ui-v2";
import { getSession } from "@/lib/auth-supabase";
import { loadMyReviewInput } from "@/lib/development/cycle-load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review Input — Pathways Portal" };

/**
 * The reviewee/contributor side of the review flow: submit your
 * self-reflection, answer feedback requests about teammates, and read your
 * released review summaries. Strictly scoped to the signed-in person —
 * nothing here exposes other people's answers or reviewer notes.
 */
export default async function MyInputPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const input = await loadMyReviewInput();
  const nothingHere =
    input.selfInputs.length === 0 &&
    input.feedbackRequests.length === 0 &&
    input.releasedSummaries.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-1 pb-12 pt-4">
      <PageHeaderV2
        eyebrow="Leadership development"
        title="Review input"
        subtitle="Your self-reflection, feedback requests about teammates, and your released review summaries."
      />

      {nothingHere ? (
        <div className="flex flex-col items-center gap-2 rounded-[16px] border border-dashed border-line-soft bg-surface-soft/50 px-6 py-10 text-center">
          <p className="m-0 max-w-sm text-[13.5px] text-ink-muted">
            Nothing waiting on you right now. You&apos;ll see your self-reflection
            here when a review starts, and feedback forms when a teammate&apos;s
            review asks for your input.
          </p>
        </div>
      ) : null}

      {input.selfInputs.map((item) => (
        <RecordSection
          key={item.cycleId}
          title="Your self-reflection"
          description={`For your ${item.typeLabel.toLowerCase()}${
            item.dueLabel ? ` · due ${item.dueLabel}` : ""
          }. Honest beats polished — this goes straight to your reviewer.`}
          action={
            item.submitted ? <StatusBadge tone="success">Submitted</StatusBadge> : undefined
          }
        >
          <SelfInputForm
            cycleId={item.cycleId}
            initialAnswers={item.answers}
            submitted={item.submitted}
          />
        </RecordSection>
      ))}

      {input.feedbackRequests.map((item) => (
        <RecordSection
          key={item.feedbackId}
          title={`Feedback: ${item.aboutName}`}
          description={
            item.reason
              ? `Why you: ${item.reason}${item.dueLabel ? ` · Reply by ${item.dueLabel}` : ""}`
              : `Your answers are confidential to the review${
                  item.dueLabel ? ` · Reply by ${item.dueLabel}` : ""
                }.`
          }
          action={
            item.submitted ? <StatusBadge tone="success">Submitted</StatusBadge> : undefined
          }
        >
          <ContributorFeedbackForm
            feedbackId={item.feedbackId}
            cycleType={item.cycleType}
            initialAnswers={item.answers}
            submitted={item.submitted}
          />
        </RecordSection>
      ))}

      {input.releasedSummaries.map((summary) => (
        <RecordSection
          key={summary.cycleId}
          title="Your review summary"
          description={`${summary.typeLabel} · released ${summary.releasedAt.toLocaleDateString(
            "en-US",
            { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }
          )}`}
        >
          <div className="flex flex-col gap-3">
            {summary.strengths ? (
              <div>
                <p className="m-0 text-[12px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                  Strengths
                </p>
                <p className="m-0 mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">
                  {summary.strengths}
                </p>
              </div>
            ) : null}
            {summary.growthAreas ? (
              <div>
                <p className="m-0 text-[12px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                  Growth areas
                </p>
                <p className="m-0 mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">
                  {summary.growthAreas}
                </p>
              </div>
            ) : null}
            {summary.recommendedNextStep ? (
              <div>
                <p className="m-0 text-[12px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                  Your recommended next step
                </p>
                <p className="m-0 mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">
                  {summary.recommendedNextStep}
                </p>
              </div>
            ) : null}
            {summary.followUpDueAt ? (
              <p className="m-0 text-[13px] text-ink">
                <span className="font-semibold">Next check-in:</span>{" "}
                {summary.followUpDueAt.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  timeZone: "UTC",
                })}
              </p>
            ) : null}
          </div>
        </RecordSection>
      ))}
    </div>
  );
}
