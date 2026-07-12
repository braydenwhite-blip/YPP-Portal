"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui-v2";
import {
  addMonthlyFeedbackQuestion,
  removeMonthlyFeedbackQuestion,
  sendMonthlyFeedbackForm,
  submitMonthlyFeedbackAnswers,
} from "@/lib/mentorship/feedback-prompt-actions";
import {
  SUGGESTED_ADDITIONAL_PROMPTS,
  type MonthlyFeedbackForm,
} from "@/lib/mentorship/feedback-prompts";

const fieldInput =
  "w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[13.5px] text-ink outline-none focus:border-brand-400";

/**
 * Current month: mentor builds + sends questions; mentee answers.
 * Past months: read-only answered (and still-waiting) forms.
 */
export function MonthlyFeedbackPanel({
  mentorshipId,
  current,
  past,
  canCompose,
  canAnswer,
  menteeFirstName,
}: {
  mentorshipId: string;
  current: MonthlyFeedbackForm;
  past: MonthlyFeedbackForm[];
  canCompose: boolean;
  canAnswer: boolean;
  menteeFirstName: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <CurrentMonthCard
        mentorshipId={mentorshipId}
        form={current}
        canCompose={canCompose}
        canAnswer={canAnswer}
        menteeFirstName={menteeFirstName}
      />
      <PastMonthsSection past={past} isSelf={canAnswer && !canCompose} />
    </div>
  );
}

function CurrentMonthCard({
  mentorshipId,
  form,
  canCompose,
  canAnswer,
  menteeFirstName,
}: {
  mentorshipId: string;
  form: MonthlyFeedbackForm;
  canCompose: boolean;
  canAnswer: boolean;
  menteeFirstName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [question, setQuestion] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(form.questions.map((q) => [q.id, q.answer ?? ""]))
  );
  const [error, setError] = useState<string | null>(null);

  const existing = new Set(form.questions.map((q) => q.text.trim().toLowerCase()));
  const suggested = SUGGESTED_ADDITIONAL_PROMPTS.filter(
    (q) => !existing.has(q.toLowerCase())
  );

  function run(fn: () => Promise<unknown>, clearQuestion = false) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        if (clearQuestion) setQuestion("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-[16px] border border-line bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.07em] text-ink-muted">
            Current month
          </p>
          <h3 className="m-0 mt-1 text-[18px] font-bold tracking-[-0.3px] text-ink">
            {form.cycleLabel}
          </h3>
          <p className="m-0 mt-1 text-[13px] text-ink-muted">
            {form.status === "DRAFT" && canCompose
              ? "Build the question list, then send it to them."
              : form.status === "DRAFT" && canAnswer
                ? "Your mentor hasn’t sent this month’s questions yet."
                : form.status === "SENT" && canCompose
                  ? `Waiting on ${menteeFirstName} to answer.`
                  : form.status === "SENT" && canAnswer
                    ? "Answer each question, then send."
                    : "Answers are in for this month."}
          </p>
        </div>
        <StatusPill status={form.status} />
      </div>

      {form.status === "DRAFT" && canCompose ? (
        <>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {form.questions.map((q, i) => (
              <li
                key={q.id}
                className="flex items-start justify-between gap-3 rounded-[12px] border border-line-soft bg-surface-soft/40 px-3.5 py-3"
              >
                <p className="m-0 text-[13.5px] font-semibold text-ink">
                  <span className="mr-1.5 text-ink-muted">{i + 1}.</span>
                  {q.text}
                  {q.kind === "preset" ? (
                    <span className="ml-2 text-[11px] font-medium text-ink-muted">
                      preset
                    </span>
                  ) : null}
                </p>
                {form.questions.length > 1 ? (
                  <button
                    type="button"
                    disabled={pending}
                    className="shrink-0 text-[12px] font-medium text-ink-muted hover:text-danger-700"
                    onClick={() =>
                      run(() =>
                        removeMonthlyFeedbackQuestion({
                          mentorshipId,
                          questionId: q.id,
                        })
                      )
                    }
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>

          {suggested.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <p className="m-0 text-[12px] font-semibold text-ink-muted">Quick add</p>
              <div className="flex flex-wrap gap-1.5">
                {suggested.map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        addMonthlyFeedbackQuestion({ mentorshipId, question: q })
                      )
                    }
                    className="rounded-full border border-line bg-surface px-3 py-1.5 text-left text-[12.5px] text-ink hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50"
                  >
                    + {q}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
              Add a question
            </span>
            <textarea
              className={`${fieldInput} resize-y`}
              rows={2}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Write another question…"
              disabled={pending}
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-3">
            <Button
              variant="secondary"
              size="sm"
              loading={pending}
              onClick={() =>
                run(
                  () =>
                    addMonthlyFeedbackQuestion({
                      mentorshipId,
                      question: question.trim(),
                    }),
                  true
                )
              }
            >
              Add to list
            </Button>
            <Button
              variant="primary"
              size="md"
              loading={pending}
              onClick={() =>
                run(() => sendMonthlyFeedbackForm({ mentorshipId }))
              }
            >
              Send to {menteeFirstName}
            </Button>
          </div>
        </>
      ) : null}

      {form.status === "DRAFT" && canAnswer ? (
        <p className="m-0 rounded-[12px] border border-dashed border-line bg-surface-soft/40 px-4 py-4 text-[13.5px] text-ink-muted">
          Nothing to fill out yet. You’ll see the questions here once your mentor sends them.
        </p>
      ) : null}

      {form.status === "SENT" && canAnswer ? (
        <>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {form.questions.map((q, i) => (
              <li key={q.id} className="flex flex-col gap-1.5">
                <label className="text-[13.5px] font-semibold text-ink">
                  <span className="mr-1.5 text-ink-muted">{i + 1}.</span>
                  {q.text}
                </label>
                <textarea
                  className={`${fieldInput} resize-y`}
                  rows={3}
                  value={drafts[q.id] ?? ""}
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [q.id]: e.target.value }))
                  }
                  placeholder="Your answer…"
                  disabled={pending}
                />
              </li>
            ))}
          </ul>
          <div className="flex justify-end border-t border-line-soft pt-3">
            <Button
              variant="primary"
              size="md"
              loading={pending}
              onClick={() =>
                run(() =>
                  submitMonthlyFeedbackAnswers({
                    mentorshipId,
                    answers: drafts,
                  })
                )
              }
            >
              Send answers
            </Button>
          </div>
        </>
      ) : null}

      {form.status === "SENT" && canCompose ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {form.questions.map((q, i) => (
            <li
              key={q.id}
              className="rounded-[12px] border border-line-soft px-3.5 py-3 text-[13.5px] font-semibold text-ink"
            >
              <span className="mr-1.5 text-ink-muted">{i + 1}.</span>
              {q.text}
            </li>
          ))}
        </ul>
      ) : null}

      {form.status === "ANSWERED" ? (
        <p className="m-0 rounded-[12px] border border-line-soft bg-surface-soft/40 px-4 py-3 text-[13.5px] text-ink-muted">
          Done for {form.cycleLabel}. Open it under{" "}
          <strong className="font-semibold text-ink">Past months</strong> to read the answers.
        </p>
      ) : null}

      {error ? (
        <p className="m-0 text-[12.5px] font-medium text-danger-700">{error}</p>
      ) : null}
    </section>
  );
}

function PastMonthsSection({
  past,
  isSelf,
}: {
  past: MonthlyFeedbackForm[];
  isSelf: boolean;
}) {
  if (past.length === 0) {
    return (
      <section className="rounded-[16px] border border-dashed border-line bg-surface-soft/30 px-5 py-5">
        <h3 className="m-0 text-[15px] font-bold text-ink">Past months</h3>
        <p className="m-0 mt-1 text-[13px] text-ink-muted">
          {isSelf
            ? "After you send answers, earlier months will show up here."
            : "Answered months will collect here after they send their responses."}
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="m-0 text-[15px] font-bold text-ink">Past months</h3>
        <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">
          Open a month to read the questions and answers.
        </p>
      </div>
      {past.map((form) => (
        <details
          key={form.id}
          className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-sm"
        >
          <summary className="cursor-pointer list-none px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-[14px] text-ink">{form.cycleLabel}</strong>
              <StatusPill status={form.status} />
            </div>
          </summary>
          <div className="border-t border-line-soft px-4 py-4">
            {form.status === "ANSWERED" ? (
              <AnsweredList form={form} />
            ) : (
              <p className="m-0 text-[13px] text-ink-muted">
                Sent — still waiting on answers.
              </p>
            )}
          </div>
        </details>
      ))}
    </section>
  );
}

function AnsweredList({ form }: { form: MonthlyFeedbackForm }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {form.questions.map((q, i) => (
        <li key={q.id}>
          <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.05em] text-ink-muted">
            {i + 1}. {q.text}
          </p>
          <p className="m-0 mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">
            {q.answer || "—"}
          </p>
        </li>
      ))}
    </ul>
  );
}

function StatusPill({ status }: { status: MonthlyFeedbackForm["status"] }) {
  const label =
    status === "DRAFT" ? "Draft" : status === "SENT" ? "Sent" : "Answered";
  const cls =
    status === "ANSWERED"
      ? "bg-complete-50 text-complete-800"
      : status === "SENT"
        ? "bg-brand-50 text-brand-800"
        : "bg-surface-soft text-ink-muted";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}
