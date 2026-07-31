"use client";

import {
  useEffect,
  useState,
  useTransition,
  type Dispatch,
  type SetStateAction,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui-v2";
import {
  addMonthlyFeedbackQuestion,
  removeMonthlyFeedbackQuestion,
  resetMonthlyFeedbackForTesting,
  sendMonthlyFeedbackForm,
  submitMonthlyFeedbackAnswers,
  updateMonthlyFeedbackQuestionGuide,
} from "@/lib/mentorship/feedback-prompt-actions";
import {
  SUGGESTED_ADDITIONAL_PROMPTS,
  defaultGuideAsStored,
  resolveAnswerGuide,
  type AnswerGuideExample,
  type MonthlyFeedbackForm,
  type MonthlyFeedbackQuestion,
  type StoredAnswerGuide,
} from "@/lib/mentorship/feedback-prompts";

const fieldInput =
  "w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[13.5px] text-ink outline-none focus:border-brand-400";

/**
 * Current month: mentor builds + sends questions; mentee answers.
 * Past months: read-only answered (and still-waiting) forms.
 */
export function MonthlyFeedbackPanel({
  mentorshipId,
  personId,
  current,
  past,
  canCompose,
  canAnswer,
  menteeFirstName,
  roleLabel,
  progressHref,
}: {
  mentorshipId: string;
  personId: string;
  current: MonthlyFeedbackForm;
  past: MonthlyFeedbackForm[];
  canCompose: boolean;
  canAnswer: boolean;
  menteeFirstName: string;
  /** Role / cohort label for the shared Goals column (e.g. Instructor). */
  roleLabel?: string | null;
  /** Mentor step 4 links here when answers are in. */
  progressHref?: string;
}) {
  const pastOnly = past.filter((f) => f.id !== current.id);
  const audience = canCompose ? "mentor" : "mentee";
  const [form, setForm] = useState(current);

  useEffect(() => {
    setForm(current);
  }, [current]);

  return (
    <div className="flex flex-col gap-5">
      <FeedbackProcessSteps
        status={form.status}
        questionCount={form.questions.length}
        menteeFirstName={menteeFirstName}
        audience={audience}
        progressHref={progressHref}
      />
      <CurrentMonthCard
        mentorshipId={mentorshipId}
        form={form}
        setForm={setForm}
        canCompose={canCompose}
        roleLabel={roleLabel ?? null}
        canAnswer={canAnswer}
        menteeFirstName={menteeFirstName}
      />
      <PastMonthsSection
        past={pastOnly}
        isSelf={canAnswer && !canCompose}
        personId={personId}
      />
    </div>
  );
}

/** Live stepper — follows form status (and question count while drafting). */
function FeedbackProcessSteps({
  status,
  questionCount,
  menteeFirstName,
  audience,
  progressHref,
}: {
  status: MonthlyFeedbackForm["status"];
  questionCount: number;
  menteeFirstName: string;
  audience: "mentor" | "mentee";
  progressHref?: string;
}) {
  const active =
    status === "ANSWERED"
      ? 4
      : status === "SENT"
        ? 3
        : questionCount > 0
          ? 2
          : 1;

  const steps =
    audience === "mentor"
      ? [
          { n: 1, label: "Build questions" },
          { n: 2, label: `Send to ${menteeFirstName}` },
          { n: 3, label: "They answer" },
          { n: 4, label: "Write progress update" },
        ]
      : [
          { n: 1, label: "Mentor builds questions" },
          { n: 2, label: "Mentor sends form" },
          { n: 3, label: "You answer" },
          { n: 4, label: "Mentor writes update" },
        ];

  return (
    <ol
      className="m-0 flex list-none flex-wrap gap-2 p-0"
      aria-label="Feedback steps"
    >
      {steps.map((s) => {
        const isDone = s.n < active;
        const isCurrent = s.n === active;
        const pillClass = isCurrent
          ? "rounded-full bg-brand-600 px-3 py-1 text-[12px] font-semibold text-white"
          : isDone
            ? "rounded-full bg-brand-50 px-3 py-1 text-[12px] font-semibold text-brand-800"
            : "rounded-full bg-surface-soft px-3 py-1 text-[12px] font-medium text-ink-muted";
        const label = (
          <>
            <span className="opacity-70">{s.n}.</span> {s.label}
          </>
        );

        if (isCurrent && s.n === 4 && progressHref && audience === "mentor") {
          return (
            <li key={s.n}>
              <Link href={progressHref} className={`${pillClass} no-underline`}>
                {label}
              </Link>
            </li>
          );
        }

        return (
          <li
            key={s.n}
            className={pillClass}
            aria-current={isCurrent ? "step" : undefined}
          >
            {label}
          </li>
        );
      })}
    </ol>
  );
}

function CurrentMonthCard({
  mentorshipId,
  form,
  setForm,
  canCompose,
  canAnswer,
  menteeFirstName,
  roleLabel,
}: {
  mentorshipId: string;
  form: MonthlyFeedbackForm;
  setForm: Dispatch<SetStateAction<MonthlyFeedbackForm>>;
  canCompose: boolean;
  canAnswer: boolean;
  menteeFirstName: string;
  roleLabel: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [question, setQuestion] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(form.questions.map((q) => [q.id, q.answer ?? ""]))
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(
      Object.fromEntries(form.questions.map((q) => [q.id, q.answer ?? ""]))
    );
  }, [form.id, form.status, form.questions]);

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

  function runSend() {
    setError(null);
    startTransition(async () => {
      try {
        await sendMonthlyFeedbackForm({ mentorshipId });
        setForm((prev) => ({
          ...prev,
          status: "SENT",
          sentAt: new Date().toISOString(),
        }));
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function runSubmitAnswers() {
    setError(null);
    startTransition(async () => {
      try {
        await submitMonthlyFeedbackAnswers({
          mentorshipId,
          answers: drafts,
        });
        setForm((prev) => ({
          ...prev,
          status: "ANSWERED",
          answeredAt: new Date().toISOString(),
          questions: prev.questions.map((q) => ({
            ...q,
            answer: drafts[q.id] ?? q.answer,
          })),
        }));
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-[14px] border border-line bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="m-0 text-[17px] font-semibold tracking-[-0.2px] text-ink">
              {form.cycleLabel}
            </h3>
            <p className="m-0 mt-0.5 max-w-[58ch] text-[12.5px] leading-relaxed text-ink-muted">
              {form.status === "DRAFT" && canCompose
                ? `${roleLabel ?? "Role"} goals on the left; examples for ${menteeFirstName} on the right.`
                : form.status === "DRAFT" && canAnswer
                  ? "Preview of this month’s questions — examples appear on the side as you focus each one. You’ll submit for real after your mentor sends the form."
                  : form.status === "SENT" && canCompose
                    ? `Waiting on ${menteeFirstName}. Goals stay role-shared; you can still tune their personal examples.`
                    : form.status === "SENT" && canAnswer
                      ? "Answer each question — tap an example to use it."
                      : form.status === "ANSWERED" && canCompose
                        ? `${menteeFirstName} answered — read below, or start the month over to try the flow again.`
                        : "Answers are in for this month."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={form.status} />
            {canCompose ? (
              <button
                type="button"
                disabled={pending}
                className="text-[12px] font-medium text-ink-muted hover:text-ink"
                onClick={() => {
                  if (
                    !window.confirm(
                      "Reset this month to a fresh draft? Past months on this mentorship will be cleared too."
                    )
                  ) {
                    return;
                  }
                  run(() => resetMonthlyFeedbackForTesting({ mentorshipId }));
                }}
              >
                Start over
              </button>
            ) : null}
          </div>
        </div>

      {form.status === "DRAFT" && canCompose ? (
        <>
          <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] rounded-t-[10px] border border-b-0 border-line-soft bg-surface-soft sm:grid">
            <p className="m-0 border-r border-line-soft px-3 py-2 text-[12px] font-semibold text-ink-muted">
              {roleLabel ?? "Role"} goals
            </p>
            <p className="m-0 px-3 py-2 text-[12px] font-semibold text-ink-muted">
              Examples for {menteeFirstName}
            </p>
          </div>

          <ul className="m-0 flex list-none flex-col overflow-hidden rounded-[10px] border border-line-soft p-0 sm:rounded-t-none">
            {form.questions.map((q, i) => (
              <MentorQuestionCard
                key={q.id}
                index={i}
                question={q}
                canRemove={form.questions.length > 1}
                pending={pending}
                roleLabel={roleLabel}
                menteeFirstName={menteeFirstName}
                defaultExamplesOpen={false}
                onRemove={() =>
                  run(() =>
                    removeMonthlyFeedbackQuestion({
                      mentorshipId,
                      questionId: q.id,
                    })
                  )
                }
                onSaveGuide={(guide) =>
                  run(() =>
                    updateMonthlyFeedbackQuestionGuide({
                      mentorshipId,
                      questionId: q.id,
                      guide,
                    })
                  )
                }
              />
            ))}
          </ul>

          <details className="rounded-[10px] border border-line-soft">
            <summary className="cursor-pointer list-none px-3 py-2.5 text-[12.5px] font-semibold text-brand-700 marker:content-none [&::-webkit-details-marker]:hidden">
              + Add another question
            </summary>
            <div className="flex flex-col gap-3 border-t border-line-soft p-3">
              {suggested.length > 0 ? (
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
                      className="rounded-full border border-line px-2.5 py-1 text-left text-[12px] text-ink hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50"
                    >
                      + {q}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row">
                <textarea
                  className={`${fieldInput} resize-y`}
                  rows={2}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Write another question…"
                  disabled={pending}
                />
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
                  Add
                </Button>
              </div>
            </div>
          </details>
          <div className="flex justify-end border-t border-line-soft pt-3">
            <Button
              variant="primary"
              size="md"
              loading={pending}
              onClick={runSend}
            >
              Send to {menteeFirstName}
            </Button>
          </div>
        </>
      ) : null}

      {form.status === "DRAFT" && canAnswer ? (
        <MenteeAnswerWorkspace
          form={form}
          drafts={drafts}
          setDrafts={setDrafts}
          pending={pending}
          error={error}
          preview
          onSubmit={() => undefined}
        />
      ) : null}

      {form.status === "SENT" && canAnswer ? (
        <MenteeAnswerWorkspace
          form={form}
          drafts={drafts}
          setDrafts={setDrafts}
          pending={pending}
          error={error}
          onSubmit={runSubmitAnswers}
        />
      ) : null}

      {form.status === "SENT" && canCompose ? (
        <>
          <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] rounded-t-[10px] border border-b-0 border-line-soft bg-surface-soft sm:grid">
            <p className="m-0 border-r border-line-soft px-3 py-2 text-[12px] font-semibold text-ink-muted">
              {roleLabel ?? "Role"} goals
            </p>
            <p className="m-0 px-3 py-2 text-[12px] font-semibold text-ink-muted">
              Examples for {menteeFirstName}
            </p>
          </div>
          <ul className="m-0 flex list-none flex-col overflow-hidden rounded-[10px] border border-line-soft p-0 sm:rounded-t-none">
            {form.questions.map((q, i) => (
              <MentorQuestionCard
                key={q.id}
                index={i}
                question={q}
                canRemove={false}
                pending={pending}
                roleLabel={roleLabel}
                menteeFirstName={menteeFirstName}
                defaultExamplesOpen={false}
                onRemove={() => undefined}
                onSaveGuide={(guide) =>
                  run(() =>
                    updateMonthlyFeedbackQuestionGuide({
                      mentorshipId,
                      questionId: q.id,
                      guide,
                    })
                  )
                }
              />
            ))}
          </ul>
        </>
      ) : null}

      {form.status === "ANSWERED" ? (
        <AnsweredList form={form} />
      ) : null}

      {error ? (
        <p className="m-0 text-[12.5px] font-medium text-danger-700">{error}</p>
      ) : null}
    </section>
  );
}

function MentorQuestionCard({
  index,
  question,
  canRemove,
  pending,
  roleLabel,
  menteeFirstName,
  defaultExamplesOpen = false,
  onRemove,
  onSaveGuide,
}: {
  index: number;
  question: MonthlyFeedbackQuestion;
  canRemove: boolean;
  pending: boolean;
  roleLabel: string | null;
  menteeFirstName: string;
  defaultExamplesOpen?: boolean;
  onRemove: () => void;
  onSaveGuide: (guide: StoredAnswerGuide | null) => void;
}) {
  const [open, setOpen] = useState(defaultExamplesOpen);
  const hasCustom = Boolean(question.guide);
  const hidden = question.guide?.hide === true;
  const resolved = resolveAnswerGuide(question);
  const examplePreview = (resolved?.examples ?? []).slice(0, 1);

  return (
    <li className="overflow-hidden border-b border-line-soft bg-surface last:border-b-0">
      <div className="grid gap-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* Goals column — shared by role / cohort */}
        <div className="flex border-b border-line-soft px-3 py-2.5 sm:border-b-0 sm:border-r">
          <div className="min-w-0 flex-1">
          <p className="m-0 text-[11px] font-medium text-ink-muted sm:hidden">
            {roleLabel ?? "Role"} goal
          </p>
          <p className="m-0 text-[13px] font-medium leading-snug text-ink">
            <span className="mr-2 text-[12px] font-normal text-ink-muted">
              {index + 1}
            </span>
            {question.text}
          </p>
          {question.kind !== "preset" ? (
            <p className="m-0 mt-1 text-[11px] text-ink-muted">
              Added for {menteeFirstName}
            </p>
          ) : null}
          </div>
          {canRemove ? (
            <button
              type="button"
              disabled={pending}
              aria-label={`Delete question ${index + 1}`}
              title="Delete question"
              className="ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-ink-muted transition-colors hover:bg-danger-50 hover:text-danger-700 disabled:opacity-40"
              onClick={() => {
                if (window.confirm("Delete this question?")) onRemove();
              }}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <path d="M4.5 6h11M8 3.75h4M6.5 6l.6 10h5.8l.6-10M8.25 8.5v5M11.75 8.5v5" />
              </svg>
            </button>
          ) : null}
        </div>

        {/* Examples column — personal, mentor-set */}
        <div className="flex flex-col gap-1.5 px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="m-0 text-[11px] font-medium text-ink-muted sm:hidden">
                Examples for {menteeFirstName}
              </p>
              <p className="m-0 text-[12px] text-ink-muted">
                {hidden
                  ? "Hidden for mentee"
                  : hasCustom
                    ? `${question.guide?.examples?.length ?? 0} custom for ${menteeFirstName}`
                    : "Role defaults — personalize for them"}
              </p>
              {!open && !hidden && examplePreview.length > 0 ? (
                <ul className="m-0 mt-1 list-none p-0">
                  {examplePreview.map((ex) => (
                    <li
                      key={`${ex.label}-${ex.detail.slice(0, 24)}`}
                      className="truncate text-[12px] text-ink"
                    >
                      <span className="font-medium">{ex.label}</span>
                      <span className="text-ink-muted"> — {ex.detail}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <button
              type="button"
              disabled={pending}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] border border-line bg-surface px-2.5 text-[12px] font-medium text-ink transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800 disabled:opacity-40"
              onClick={() => setOpen((v) => !v)}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              >
                {open ? (
                  <path d="m6 6 8 8M14 6l-8 8" />
                ) : (
                  <path d="m4 14.5-.5 2 2-.5L15 6.5 13.5 5 4 14.5ZM12.5 6l1.5 1.5" />
                )}
              </svg>
              {open ? "Close" : "Edit"}
            </button>
          </div>
        </div>
      </div>
      {open ? (
        <QuestionGuideEditor
          question={question}
          menteeFirstName={menteeFirstName}
          pending={pending}
          onSave={onSaveGuide}
          onCancel={() => setOpen(false)}
        />
      ) : null}
    </li>
  );
}

function emptyExample(): AnswerGuideExample {
  return { label: "", detail: "" };
}

function QuestionGuideEditor({
  question,
  menteeFirstName,
  pending,
  onSave,
  onCancel,
}: {
  question: MonthlyFeedbackQuestion;
  menteeFirstName: string;
  pending: boolean;
  onSave: (guide: StoredAnswerGuide | null) => void;
  onCancel: () => void;
}) {
  const defaults = defaultGuideAsStored(question.text);
  const initial = question.guide ?? defaults;
  const [hide, setHide] = useState(Boolean(initial.hide));
  const [examples, setExamples] = useState<AnswerGuideExample[]>(
    (initial.examples?.length ? initial.examples : defaults.examples ?? []).map(
      (e) => ({ ...e })
    )
  );

  function loadDefaults() {
    const d = defaultGuideAsStored(question.text);
    setHide(false);
    setExamples((d.examples ?? []).map((e) => ({ ...e })));
  }

  function save() {
    if (hide) {
      onSave({ hide: true });
      return;
    }
    const cleaned = examples
      .map((e) => ({
        label: e.label.trim(),
        detail: e.detail.trim(),
        ...(e.insertText?.trim() ? { insertText: e.insertText.trim() } : {}),
      }))
      .filter((e) => e.label && e.detail);

    onSave({
      ...(question.guide ?? {}),
      hide: false,
      examples: cleaned,
    });
  }

  return (
    <div className="flex flex-col gap-4 border-t border-line-soft bg-surface-soft/40 p-4">
      <div>
        <p className="m-0 text-[14px] font-semibold text-ink">
          Examples for {menteeFirstName}
        </p>
        <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">
          They can tap one while answering.
        </p>
      </div>

      <label className="flex items-center gap-2 text-[12.5px] text-ink-muted">
        <input
          type="checkbox"
          checked={!hide}
          disabled={pending}
          onChange={(e) => setHide(!e.target.checked)}
        />
        Show examples
      </label>

      {!hide ? (
        <div className="flex flex-col gap-2">
            {examples.map((ex, i) => (
              <div
                key={i}
                className="grid gap-2 rounded-[10px] border border-line-soft bg-surface p-2.5 sm:grid-cols-[9rem_minmax(0,1fr)_2rem]"
              >
                <input
                  className={fieldInput}
                  value={ex.label}
                  disabled={pending}
                  aria-label={`Example ${i + 1} label`}
                  placeholder="Short label"
                  onChange={(e) =>
                    setExamples((rows) =>
                      rows.map((row, idx) =>
                        idx === i ? { ...row, label: e.target.value } : row
                      )
                    )
                  }
                />
                <textarea
                  className={`${fieldInput} resize-y`}
                  rows={2}
                  value={ex.detail}
                  disabled={pending}
                  aria-label={`Example ${i + 1} answer`}
                  placeholder="Example answer"
                  onChange={(e) =>
                    setExamples((rows) =>
                      rows.map((row, idx) =>
                        idx === i ? { ...row, detail: e.target.value } : row
                      )
                    )
                  }
                />
                <button
                  type="button"
                  disabled={pending}
                  aria-label={`Delete example ${i + 1}`}
                  title="Delete example"
                  className="flex h-8 w-8 items-center justify-center rounded-[7px] text-ink-muted hover:bg-danger-50 hover:text-danger-700 disabled:opacity-40"
                  onClick={() =>
                    setExamples((rows) => rows.filter((_, idx) => idx !== i))
                  }
                >
                  ×
                </button>
              </div>
            ))}

            <button
              type="button"
              disabled={pending || examples.length >= 12}
              className="self-start rounded-[8px] border border-line bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink hover:border-brand-300 hover:text-brand-800 disabled:opacity-50"
              onClick={() => setExamples((rows) => [...rows, emptyExample()])}
            >
              Add example
            </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-3">
        <button
          type="button"
          disabled={pending}
          className="text-[12px] font-medium text-ink-muted hover:text-ink"
          onClick={loadDefaults}
        >
          Use defaults
        </button>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" disabled={pending} onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" loading={pending} onClick={save}>
            Save examples
          </Button>
        </div>
      </div>
    </div>
  );
}

function parseScaleAnswer(raw: string): { score: number | null; note: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { score: null, note: "" };
  const match = trimmed.match(/^(\d{1,2})\s*(?:[-–—,:]\s*)?(.*)$/);
  if (!match) return { score: null, note: trimmed };
  const score = Number(match[1]);
  if (!Number.isFinite(score) || score < 1 || score > 20) {
    return { score: null, note: trimmed };
  }
  return { score, note: (match[2] ?? "").trim() };
}

function formatScaleAnswer(score: number, note: string) {
  const clean = note.trim();
  return clean ? `${score} — ${clean}` : String(score);
}

function MenteeAnswerWorkspace({
  form,
  drafts,
  setDrafts,
  pending,
  error,
  onSubmit,
  preview = false,
}: {
  form: MonthlyFeedbackForm;
  drafts: Record<string, string>;
  setDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  pending: boolean;
  error: string | null;
  onSubmit: () => void;
  /** Mentor hasn’t sent yet — UI is interactive so you can see examples, submit stays off. */
  preview?: boolean;
}) {
  const questions =
    form.questions.length > 0
      ? form.questions
      : [
          {
            id: "preview_1",
            text: "How was this month?",
            kind: "preset" as const,
            answer: null,
          },
          {
            id: "preview_2",
            text: "What went well?",
            kind: "preset" as const,
            answer: null,
          },
          {
            id: "preview_3",
            text: "What was hard?",
            kind: "preset" as const,
            answer: null,
          },
        ];

  const [focusedId, setFocusedId] = useState(questions[0]?.id ?? "");
  const focused =
    questions.find((q) => q.id === focusedId) ?? questions[0] ?? null;
  const guide = focused ? resolveAnswerGuide(focused) : null;

  function useExample(ex: AnswerGuideExample) {
    if (!focused) return;
    const insert = (ex.insertText ?? ex.detail).trim();
    if (!insert) return;
    const g = resolveAnswerGuide(focused);
    if (g?.kind === "scale") {
      const parsed = parseScaleAnswer(insert);
      if (parsed.score != null) {
        setDrafts((d) => ({
          ...d,
          [focused.id]: formatScaleAnswer(parsed.score!, parsed.note),
        }));
        return;
      }
    }
    setDrafts((d) => ({ ...d, [focused.id]: insert }));
  }

  return (
    <div className="flex flex-col gap-4">
      {preview ? (
        <div className="rounded-[12px] border border-dashed border-brand-200 bg-brand-50/50 px-3.5 py-2.5 text-[12.5px] text-ink">
          <strong className="font-semibold">Preview</strong>
          <span className="text-ink-muted">
            {" "}
            — click each question to see examples on the right. Your mentor still needs to
            send the form before you can submit.
          </span>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(240px,300px)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {questions.map((q, i) => (
              <AnswerQuestionField
                key={q.id}
                index={i}
                question={q}
                value={drafts[q.id] ?? ""}
                active={focused?.id === q.id}
                pending={pending}
                onFocus={() => setFocusedId(q.id)}
                onChange={(next) => setDrafts((d) => ({ ...d, [q.id]: next }))}
              />
            ))}
          </ul>
          <div className="flex justify-end border-t border-line-soft pt-3">
            <Button
              variant="primary"
              size="md"
              loading={pending}
              disabled={preview}
              onClick={onSubmit}
            >
              {preview ? "Waiting on mentor to send" : "Send answers"}
            </Button>
          </div>
          {error ? (
            <p className="m-0 text-[12.5px] font-medium text-danger-700">{error}</p>
          ) : null}
        </div>

        {guide ? (
          <aside className="rounded-[14px] border border-line bg-surface p-4 shadow-sm lg:sticky lg:top-4">
            <p className="m-0 text-[11px] font-bold uppercase tracking-[0.07em] text-brand-700">
              Examples
            </p>
            <h4 className="m-0 mt-1 text-[15px] font-semibold text-ink">{guide.title}</h4>
            {guide.tip ? (
              <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                {guide.tip}
              </p>
            ) : null}
            {guide.examples.length > 0 ? (
              <ul className="m-0 mt-3 flex list-none flex-col gap-2.5 p-0">
                {guide.examples.map((ex) => (
                  <li key={`${ex.label}-${ex.detail}`}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => useExample(ex)}
                      className="w-full rounded-[10px] border border-line-soft bg-surface-soft px-3 py-2.5 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/60 disabled:opacity-50"
                    >
                      <p className="m-0 text-[12.5px] font-semibold text-ink">
                        {ex.label}
                      </p>
                      <p className="m-0 mt-0.5 text-[12.5px] leading-relaxed text-ink-muted">
                        {ex.detail}
                      </p>
                      <p className="m-0 mt-1.5 text-[11px] font-medium text-brand-700">
                        Tap to use
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 mt-3 text-[12.5px] text-ink-muted">
                No sample answers for this one — write whatever feels true.
              </p>
            )}
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function AnswerQuestionField({
  index,
  question,
  value,
  active,
  pending,
  onFocus,
  onChange,
}: {
  index: number;
  question: MonthlyFeedbackQuestion;
  value: string;
  active: boolean;
  pending: boolean;
  onFocus: () => void;
  onChange: (next: string) => void;
}) {
  const guide = resolveAnswerGuide(question) ?? {
    kind: "text" as const,
    title: "",
    tip: "",
    examples: [],
  };
  const { score, note } = parseScaleAnswer(value);
  const max = guide.scaleMax ?? 10;

  return (
    <li
      className={
        active
          ? "flex flex-col gap-2 rounded-[12px] border border-brand-200 bg-brand-50/40 p-3"
          : "flex flex-col gap-2 rounded-[12px] border border-transparent p-3"
      }
      onFocusCapture={onFocus}
    >
      <label className="text-[13.5px] font-semibold text-ink">
        <span className="mr-1.5 text-ink-muted">{index + 1}.</span>
        {question.text}
      </label>

      {guide.kind === "scale" ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
              const selected = score === n;
              return (
                <button
                  key={n}
                  type="button"
                  disabled={pending}
                  onClick={() => onChange(formatScaleAnswer(n, note))}
                  className={
                    selected
                      ? "h-9 min-w-9 rounded-[8px] bg-ink px-2.5 text-[13px] font-semibold text-white"
                      : "h-9 min-w-9 rounded-[8px] border border-line bg-surface px-2.5 text-[13px] font-semibold text-ink hover:border-brand-300"
                  }
                >
                  {n}
                </button>
              );
            })}
          </div>
          <textarea
            className={`${fieldInput} resize-y`}
            rows={2}
            value={note}
            onChange={(e) =>
              onChange(
                score != null
                  ? formatScaleAnswer(score, e.target.value)
                  : e.target.value
              )
            }
            placeholder="Optional note (why that number)…"
            disabled={pending}
          />
        </>
      ) : (
        <textarea
          className={`${fieldInput} resize-y`}
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Your answer…"
          disabled={pending}
        />
      )}
    </li>
  );
}

function PastMonthsSection({
  past,
  isSelf,
  personId,
}: {
  past: MonthlyFeedbackForm[];
  isSelf: boolean;
  personId: string;
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
              <div className="flex items-center gap-2">
                <StatusPill status={form.status} />
              </div>
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
