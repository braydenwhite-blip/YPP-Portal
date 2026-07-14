"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui-v2";
import {
  addMentorshipCustomPrompt,
  answerMentorshipCustomPrompt,
} from "@/lib/mentorship/feedback-prompt-actions";
import {
  MONTHLY_PRESET_PROMPTS,
  SUGGESTED_ADDITIONAL_PROMPTS,
  type MentorshipCustomPrompt,
  type MonthlyPresetAnswers,
} from "@/lib/mentorship/feedback-prompts";

const fieldInput =
  "w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[13.5px] text-ink outline-none focus:border-brand-400";

/**
 * This month’s questions: fixed presets first, then mentor-added extras.
 */
export function FeedbackPromptsPanel({
  mentorshipId,
  prompts,
  presetAnswers,
  canAsk,
  canAnswer,
}: {
  mentorshipId: string;
  prompts: MentorshipCustomPrompt[];
  /** Latest monthly form answers for the three presets (null = not sent yet). */
  presetAnswers: MonthlyPresetAnswers;
  canAsk: boolean;
  canAnswer: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [question, setQuestion] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const open = prompts.filter((p) => !p.answer);
  const done = prompts.filter((p) => p.answer);
  const existingQuestions = new Set(prompts.map((p) => p.question.trim().toLowerCase()));
  const suggested = SUGGESTED_ADDITIONAL_PROMPTS.filter(
    (q) => !existingQuestions.has(q.toLowerCase())
  );

  function ask(text?: string) {
    const q = (text ?? question).trim();
    if (!q) {
      setError("Write a question first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await addMentorshipCustomPrompt({
          mentorshipId,
          question: q,
        });
        if (!text) setQuestion("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not add question.");
      }
    });
  }

  function answer(promptId: string) {
    const text = (drafts[promptId] ?? "").trim();
    if (!text) {
      setError("Write an answer first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await answerMentorshipCustomPrompt({
          mentorshipId,
          promptId,
          answer: text,
        });
        setDrafts((d) => {
          const next = { ...d };
          delete next[promptId];
          return next;
        });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save answer.");
      }
    });
  }

  if (!canAsk && prompts.length === 0 && !canAnswer) return null;

  const presetsAnswered = Boolean(presetAnswers);

  return (
    <section className="flex flex-col gap-5 rounded-[16px] border border-line bg-surface p-5 shadow-sm">
      <div>
        <h3 className="m-0 text-[15px] font-bold text-ink">
          {canAsk ? "This month’s questions" : "Your questions"}
        </h3>
        <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">
          {canAsk
            ? "Three presets every month, plus anything else you want to ask."
            : "Answer the monthly form and any extras your mentor added."}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">
          Preset
        </p>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {MONTHLY_PRESET_PROMPTS.map((preset) => {
            const answer = presetAnswers?.[preset.key]?.trim() || null;
            return (
              <li
                key={preset.key}
                className="rounded-[12px] border border-line-soft bg-surface-soft/40 px-3.5 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="m-0 text-[13.5px] font-semibold text-ink">
                    <span className="mr-1.5 text-ink-muted">{preset.n}.</span>
                    {preset.label}
                  </p>
                  <span
                    className={
                      answer
                        ? "text-[11.5px] font-semibold text-complete-700"
                        : "text-[11.5px] font-semibold text-ink-muted"
                    }
                  >
                    {answer ? "Answered" : "Waiting"}
                  </span>
                </div>
                {canAnswer && !presetsAnswered ? (
                  <p className="m-0 mt-1 text-[12.5px] text-ink-muted">
                    Answer these in the monthly form above.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
        {!presetsAnswered && canAsk ? (
          <p className="m-0 text-[12.5px] text-ink-muted">
            Answers show under Monthly answers once they send the form.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 border-t border-line-soft pt-4">
        <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">
          Additional
        </p>

        {open.length === 0 && done.length === 0 && !canAsk ? (
          <p className="m-0 text-[13px] text-ink-muted">No extra questions right now.</p>
        ) : null}

        {open.map((p) => (
          <div
            key={p.id}
            className="rounded-[12px] border border-brand-200 bg-brand-50/30 px-3.5 py-3"
          >
            <p className="m-0 text-[13.5px] font-semibold text-ink">{p.question}</p>
            {canAnswer ? (
              <div className="mt-2 flex flex-col gap-2">
                <textarea
                  className={`${fieldInput} resize-y`}
                  rows={3}
                  value={drafts[p.id] ?? ""}
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [p.id]: e.target.value }))
                  }
                  placeholder="Your answer…"
                  disabled={pending}
                />
                <div className="flex justify-end">
                  <Button
                    variant="primary"
                    size="sm"
                    loading={pending}
                    onClick={() => answer(p.id)}
                  >
                    Send answer
                  </Button>
                </div>
              </div>
            ) : (
              <p className="m-0 mt-1 text-[12.5px] italic text-ink-muted">
                Waiting on an answer…
              </p>
            )}
          </div>
        ))}

        {done.map((p) => (
          <div key={p.id} className="rounded-[12px] border border-line-soft px-3.5 py-3">
            <p className="m-0 text-[12px] font-bold uppercase tracking-[0.05em] text-ink-muted">
              Q
            </p>
            <p className="m-0 mt-0.5 text-[13.5px] font-semibold text-ink">{p.question}</p>
            <p className="m-0 mt-2 text-[12px] font-bold uppercase tracking-[0.05em] text-ink-muted">
              A
            </p>
            <p className="m-0 mt-0.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">
              {p.answer}
            </p>
          </div>
        ))}

        {canAsk ? (
          <div className="flex flex-col gap-3 pt-1">
            {suggested.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <p className="m-0 text-[12px] font-semibold text-ink-muted">
                  Quick add
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {suggested.map((q) => (
                    <button
                      key={q}
                      type="button"
                      disabled={pending}
                      onClick={() => ask(q)}
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
                Write your own
              </span>
              <textarea
                className={`${fieldInput} resize-y`}
                rows={2}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. How did the class observation go?"
                disabled={pending}
              />
            </label>
            <div className="flex justify-end">
              <Button variant="secondary" size="sm" loading={pending} onClick={() => ask()}>
                Add question
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="m-0 text-[12.5px] font-medium text-danger-700">{error}</p>
      ) : null}
    </section>
  );
}
