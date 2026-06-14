"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button, cn } from "@/components/ui-v2";
import type { CoSAnswer, CoSPrompt } from "@/lib/help-agent/types";

import { ChiefOfStaffAnswerView } from "./chief-of-staff-answer";

/**
 * The Chief of Staff "Ask" surface. Type an operational question, get back
 * structured answer blocks built deterministically from the portal's data.
 *
 * AI is OPTIONAL and additive: the "Ask with AI" toggle only appears when the
 * server reports an AI key is configured (`aiAvailable`), defaults OFF, and when
 * off the exact same answer is returned with no model call. Turning it on adds a
 * grounded narrative on top — never different data.
 */
export function HelpAgentAsk({
  prompts,
  aiAvailable,
  context,
  defaultQuestion,
  className,
}: {
  prompts: CoSPrompt[];
  aiAvailable: boolean;
  context?: { entityType: string; entityId: string };
  defaultQuestion?: string;
  className?: string;
}) {
  const [question, setQuestion] = useState(defaultQuestion ?? "");
  const [answer, setAnswer] = useState<CoSAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useAI, setUseAI] = useState(false);
  const ranInitial = useRef(false);

  const ask = useCallback(
    async (q: string, withAI: boolean) => {
      const trimmed = q.trim();
      if (!trimmed) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/help-agent/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: trimmed, useAI: withAI, context }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Something went wrong. Please try again.");
        }
        setAnswer((await res.json()) as CoSAnswer);
      } catch (err) {
        setError((err as Error).message);
        setAnswer(null);
      } finally {
        setLoading(false);
      }
    },
    [context]
  );

  // Auto-run a question passed in via the URL (e.g. from the ⌘K palette).
  useEffect(() => {
    if (ranInitial.current) return;
    ranInitial.current = true;
    if (defaultQuestion && defaultQuestion.trim()) {
      void ask(defaultQuestion, false);
    }
  }, [defaultQuestion, ask]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void ask(question, useAI);
  };

  const runPrompt = (q: string) => {
    setQuestion(q);
    void ask(q, useAI);
  };

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="flex items-end gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-[12px] border border-line bg-surface px-4 py-3 shadow-card focus-within:border-brand-400">
            <span aria-hidden className="text-[16px] text-brand-600">
              ✦
            </span>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask the Chief of Staff — e.g. “What needs attention today?”"
              aria-label="Ask the Chief of Staff"
              className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-muted/60"
            />
          </div>
          <Button type="submit" disabled={loading || question.trim().length === 0}>
            {loading ? "Thinking…" : "Ask"}
          </Button>
        </div>

        {aiAvailable ? (
          <label className="flex w-fit cursor-pointer items-center gap-2 text-[12.5px] text-ink-muted">
            <input
              type="checkbox"
              checked={useAI}
              onChange={(e) => setUseAI(e.target.checked)}
              className="size-3.5 accent-brand-600"
            />
            Add an AI-written summary on top of the answer (optional)
          </label>
        ) : null}
      </form>

      {prompts.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="m-0 text-[11px] font-bold uppercase tracking-[0.07em] text-ink-muted">
            Try asking
          </p>
          <div className="flex flex-wrap gap-2">
            {prompts.map((p) => (
              <button
                key={p.question}
                type="button"
                onClick={() => runPrompt(p.question)}
                className={cn(
                  "rounded-full border border-line bg-surface px-3 py-1.5 text-left text-[12.5px] font-medium text-brand-800",
                  "transition-colors hover:border-brand-400 hover:bg-brand-50"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[10px] border border-danger-200 bg-danger-50 px-4 py-3 text-[13px] text-danger-700">
          {error}
        </div>
      ) : null}

      {loading && !answer ? (
        <div className="flex items-center gap-2 text-[13px] text-ink-muted">
          <span
            aria-hidden
            className="size-3.5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600"
          />
          Reading across meetings, actions, and records…
        </div>
      ) : null}

      {answer ? <ChiefOfStaffAnswerView answer={answer} /> : null}
    </div>
  );
}
