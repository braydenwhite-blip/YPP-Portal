import Link from "next/link";

import {
  ButtonLink,
  RecordSection,
  StatusBadge,
  cn,
  type StatusTone,
} from "@/components/ui-v2";
import {
  FEEDBACK_PROMPTS,
  SELF_INPUT_PROMPTS,
  feedbackTopicLabel,
} from "@/lib/development/cycle-flow";
import type { ReviewCycleDetail } from "@/lib/development/cycle-load";
import type { DevelopmentSignalTone } from "@/lib/development/signals";
import { RATING_LABELS } from "@/lib/people-strategy/check-in-rating";

import {
  CreateActionForm,
  CycleCompletionControls,
  OpenForInputButton,
  RequestFeedbackForm,
  ScheduleFollowUpForm,
  SynthesisForm,
} from "./cycle-manager-forms";

/**
 * The review cycle workspace — one full-screen page that walks the reviewer
 * through the whole cycle: collect input → read it in context → synthesize →
 * action plan → follow-up → complete. Server-rendered; the interactive forms
 * are the client islands from cycle-manager-forms.tsx.
 */

const SIGNAL_TONE_TO_BADGE: Record<DevelopmentSignalTone, StatusTone> = {
  danger: "danger",
  warning: "warning",
  info: "info",
  brand: "brand",
  success: "success",
  neutral: "neutral",
};

function StepsSpine({ steps }: { steps: ReviewCycleDetail["steps"] }) {
  return (
    <ol className="m-0 flex list-none flex-wrap gap-x-1 gap-y-2 p-0">
      {steps.map((step, index) => (
        <li key={step.key} className="flex items-center gap-1">
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold",
              step.status === "done" && "bg-success-100 text-success-700",
              step.status === "current" && "bg-brand-600 text-white",
              step.status === "todo" && "bg-surface-soft text-ink-muted"
            )}
            title={step.detail ?? undefined}
          >
            {step.status === "done" ? <span aria-hidden>✓</span> : null}
            {step.label}
          </span>
          {index < steps.length - 1 ? (
            <span aria-hidden className="text-ink-muted/50">
              →
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function AnswerBlock({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <p className="m-0 text-[12px] font-bold uppercase tracking-[0.06em] text-ink-muted">
        {label}
      </p>
      <p className="m-0 mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">
        {body}
      </p>
    </div>
  );
}

export function ReviewCycleDetailView({ detail }: { detail: ReviewCycleDetail }) {
  const managerCanEditSynthesis =
    detail.state === "COLLECTING" || detail.state === "ACTION_PLAN";
  const planOpen = detail.state === "ACTION_PLAN" || detail.state === "FOLLOW_UP";
  const collecting = detail.state === "DRAFT" || detail.state === "COLLECTING";
  const facts = detail.revieweeFacts;

  const answeredSelf = SELF_INPUT_PROMPTS.filter(
    (prompt) => detail.selfInput[prompt.key]
  );
  const submittedFeedback = detail.feedback.filter((f) => f.submittedAt);
  const pendingFeedback = detail.feedback.filter((f) => !f.submittedAt);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <Link
          href="/people/develop/reviews"
          className="text-[12.5px] font-semibold text-brand-700 hover:underline"
        >
          ← Review cycles
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="m-0 text-[12px] font-bold uppercase tracking-[0.1em] text-ink-muted">
              {detail.typeLabel}
            </p>
            <h1 className="m-0 mt-0.5 text-[24px] font-extrabold tracking-[-0.02em] text-ink">
              {detail.revieweeName}
            </h1>
            <p className="m-0 mt-1 text-[13px] text-ink-muted">
              {[
                detail.contextLabel,
                `Reviewer: ${detail.reviewerName}`,
                detail.dueLabel ? `Due ${detail.dueLabel}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge tone={detail.stateTone}>{detail.stateLabel}</StatusBadge>
            <ButtonLink
              href={`/people/develop/${detail.revieweeId}`}
              size="sm"
              variant="secondary"
            >
              Development record
            </ButtonLink>
          </div>
        </div>
        <StepsSpine steps={detail.steps} />
      </header>

      <section className="flex flex-col gap-2 rounded-[12px] border border-brand-200 bg-brand-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.1em] text-brand-700">
            Next step
          </p>
          <p className="m-0 mt-0.5 text-[14.5px] font-semibold text-ink">
            {detail.nextStepLabel}
          </p>
        </div>
        {detail.state === "DRAFT" ? <OpenForInputButton cycleId={detail.id} /> : null}
      </section>

      {facts ? (
        <RecordSection
          title="Context"
          description="What the development record already knows — read this before synthesizing."
          action={
            detail.priorCycle?.completedAt ? (
              <span className="text-[12px] text-ink-muted">
                Last review completed{" "}
                {detail.priorCycle.completedAt.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  timeZone: "UTC",
                })}
              </span>
            ) : undefined
          }
        >
          <div className="flex flex-col gap-3">
            {detail.revieweeSignals.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {detail.revieweeSignals.slice(0, 6).map((signal, index) => (
                  <StatusBadge
                    key={`${signal.kind}-${index}`}
                    tone={SIGNAL_TONE_TO_BADGE[signal.tone]}
                  >
                    {signal.label}
                  </StatusBadge>
                ))}
              </div>
            ) : (
              <p className="m-0 text-[13px] text-ink-muted">
                No open development signals — steady.
              </p>
            )}
            <div className="grid gap-x-6 gap-y-2 text-[13px] text-ink sm:grid-cols-2">
              {facts.mentorName ? <span>Mentor: {facts.mentorName}</span> : null}
              {facts.lastCheckInMonthLabel ? (
                <span>
                  Last check-in: {facts.lastCheckInMonthLabel}
                  {facts.lastCheckInRating
                    ? ` — ${RATING_LABELS[facts.lastCheckInRating]}`
                    : ""}
                </span>
              ) : (
                <span>No check-in on file</span>
              )}
              {facts.lastReviewQuarter ? (
                <span>
                  Last quarterly review: {facts.lastReviewQuarter}
                  {facts.lastReviewPerformance
                    ? ` — ${RATING_LABELS[facts.lastReviewPerformance]}`
                    : ""}
                </span>
              ) : (
                <span>No quarterly review on file</span>
              )}
              <span>
                Open work: {facts.openActionCount}{" "}
                {facts.openActionCount === 1 ? "action" : "actions"}
                {facts.overdueActionCount > 0
                  ? ` (${facts.overdueActionCount} overdue)`
                  : ""}
              </span>
            </div>
            {detail.priorCycle?.strengths || detail.priorCycle?.growthAreas ? (
              <div className="rounded-[10px] bg-surface-soft/60 p-3">
                <p className="m-0 text-[12px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                  From their last review
                </p>
                {detail.priorCycle.strengths ? (
                  <p className="m-0 mt-1 text-[13px] text-ink">
                    <span className="font-semibold">Strengths:</span>{" "}
                    {detail.priorCycle.strengths}
                  </p>
                ) : null}
                {detail.priorCycle.growthAreas ? (
                  <p className="m-0 mt-1 text-[13px] text-ink">
                    <span className="font-semibold">Growth areas:</span>{" "}
                    {detail.priorCycle.growthAreas}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </RecordSection>
      ) : null}

      <RecordSection
        title="Collect input"
        description="The reviewee's self-reflection plus structured feedback from the people who work with them."
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <StatusBadge tone={detail.selfInputSubmittedAt ? "success" : "info"}>
              {detail.selfInputSubmittedAt
                ? "Self-reflection submitted"
                : "Waiting on self-reflection"}
            </StatusBadge>
            {detail.feedback.length > 0 ? (
              <StatusBadge
                tone={pendingFeedback.length === 0 ? "success" : "info"}
              >
                {submittedFeedback.length} of {detail.feedback.length} feedback in
              </StatusBadge>
            ) : (
              <StatusBadge tone="neutral">No contributors asked yet</StatusBadge>
            )}
          </div>

          {detail.feedback.length > 0 ? (
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {detail.feedback.map((feedback) => (
                <li
                  key={feedback.id}
                  className="flex items-baseline justify-between gap-3 text-[13px]"
                >
                  <span className="font-medium text-ink">{feedback.contributorName}</span>
                  <span
                    className={cn(
                      "text-[12px]",
                      feedback.submittedAt ? "text-success-700" : "text-ink-muted"
                    )}
                  >
                    {feedback.submittedAt
                      ? "Submitted"
                      : `Asked ${feedback.requestedDaysAgo} ${
                          feedback.requestedDaysAgo === 1 ? "day" : "days"
                        } ago — waiting`}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {collecting ? (
            <RequestFeedbackForm
              cycleId={detail.id}
              contributorOptions={detail.contributorOptions.filter(
                (person) => person.id !== detail.reviewerId
              )}
              alreadyAskedIds={detail.feedback.map((f) => f.contributorId)}
            />
          ) : null}
        </div>
      </RecordSection>

      {answeredSelf.length > 0 ? (
        <RecordSection
          title="Self-reflection"
          description="What the reviewee shared, in their own words."
        >
          <div className="flex flex-col gap-4">
            {answeredSelf.map((prompt) => (
              <AnswerBlock
                key={prompt.key}
                label={prompt.label}
                body={detail.selfInput[prompt.key] as string}
              />
            ))}
          </div>
        </RecordSection>
      ) : null}

      {submittedFeedback.length > 0 ? (
        <RecordSection
          title="Feedback"
          description="Contributor answers are confidential to the review — never shown to the reviewee."
        >
          <div className="flex flex-col gap-5">
            {submittedFeedback.map((feedback) => (
              <div
                key={feedback.id}
                className="rounded-[10px] border border-line-soft bg-surface-soft/40 p-4"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold text-ink">
                    {feedback.contributorName}
                  </span>
                  {feedback.topics.map((topic) => (
                    <StatusBadge key={topic} tone="neutral">
                      {feedbackTopicLabel(topic)}
                    </StatusBadge>
                  ))}
                  {feedback.flagForLeadership ? (
                    <StatusBadge tone="danger">Flagged for leadership</StatusBadge>
                  ) : null}
                </div>
                <div className="flex flex-col gap-3">
                  {FEEDBACK_PROMPTS.map((prompt) => {
                    const body = feedback[prompt.key];
                    return body ? (
                      <AnswerBlock key={prompt.key} label={prompt.label} body={body} />
                    ) : null;
                  })}
                </div>
              </div>
            ))}
          </div>
        </RecordSection>
      ) : null}

      <RecordSection
        title="Synthesis"
        description="Strengths, growth areas, and the coaching direction — written by the reviewer, grounded in the input above."
      >
        {managerCanEditSynthesis ? (
          <SynthesisForm
            cycleId={detail.id}
            submitted={Boolean(detail.synthesisSubmittedAt)}
            initial={{
              strengths: detail.strengths,
              growthAreas: detail.growthAreas,
              concerns: detail.concerns,
              coachingNotes: detail.coachingNotes,
              recommendedNextStep: detail.recommendedNextStep,
              recognitionFlag: detail.recognitionFlag,
              leadershipFlag: detail.leadershipFlag,
            }}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {detail.strengths ? (
              <AnswerBlock label="Strengths" body={detail.strengths} />
            ) : null}
            {detail.growthAreas ? (
              <AnswerBlock label="Growth areas" body={detail.growthAreas} />
            ) : null}
            {detail.concerns ? (
              <AnswerBlock label="Concerns (leadership-only)" body={detail.concerns} />
            ) : null}
            {detail.coachingNotes ? (
              <AnswerBlock
                label="Coaching notes (leadership-only)"
                body={detail.coachingNotes}
              />
            ) : null}
            {detail.recommendedNextStep ? (
              <AnswerBlock
                label="Recommended next step"
                body={detail.recommendedNextStep}
              />
            ) : null}
            <div className="flex gap-2">
              {detail.recognitionFlag ? (
                <StatusBadge tone="brand">Recognition recommended</StatusBadge>
              ) : null}
              {detail.leadershipFlag ? (
                <StatusBadge tone="danger">Flagged for leadership</StatusBadge>
              ) : null}
            </div>
          </div>
        )}
      </RecordSection>

      {detail.synthesisSubmittedAt ? (
        <RecordSection
          title="Action plan & follow-up"
          description="Turn the review into operational work — coaching actions on the tracker, and the next check-in on the calendar."
        >
          <div className="flex flex-col gap-4">
            {detail.linkedActions.length > 0 ? (
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {detail.linkedActions.map((action) => (
                  <li
                    key={action.id}
                    className="flex items-baseline justify-between gap-3 py-1"
                  >
                    <Link
                      href={action.href}
                      className="min-w-0 truncate text-[13.5px] font-medium text-ink hover:text-brand-700 hover:underline"
                    >
                      {action.title}
                    </Link>
                    <span className="shrink-0 text-[12px] text-ink-muted">
                      {action.status === "COMPLETE" ? "Done" : action.dueLabel}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-[13px] text-ink-muted">
                No coaching actions yet — create the first one below.
              </p>
            )}

            {planOpen ? (
              <>
                <CreateActionForm cycleId={detail.id} />
                <ScheduleFollowUpForm
                  cycleId={detail.id}
                  currentDueAt={
                    detail.followUpDueAt
                      ? detail.followUpDueAt.toISOString().slice(0, 10)
                      : null
                  }
                  currentNote={detail.followUpNote}
                />
              </>
            ) : null}

            {detail.followUpDueLabel ? (
              <p className="m-0 text-[13px] text-ink">
                <span className="font-semibold">Follow-up:</span> {detail.followUpDueLabel}
                {detail.followUpNote ? ` — ${detail.followUpNote}` : ""}
              </p>
            ) : null}

            {detail.state !== "COMPLETED" ? (
              <CycleCompletionControls
                cycleId={detail.id}
                released={Boolean(detail.releasedToRevieweeAt)}
                canComplete={Boolean(detail.synthesisSubmittedAt)}
              />
            ) : (
              <StatusBadge tone="success">Review complete</StatusBadge>
            )}
          </div>
        </RecordSection>
      ) : null}
    </div>
  );
}
