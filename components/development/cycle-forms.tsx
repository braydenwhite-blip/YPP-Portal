"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ReviewCycleType } from "@prisma/client";

import { Button, cn } from "@/components/ui-v2";
import {
  submitCycleFeedback,
  submitCycleSelfInput,
} from "@/lib/development/cycle-actions";
import {
  FEEDBACK_PROMPTS,
  SELF_INPUT_PROMPTS,
  feedbackTopicsForType,
} from "@/lib/development/cycle-flow";

/**
 * Reviewee + contributor forms for the review flow (`/my-input`). Calm,
 * structured-but-not-painful: every prompt optional, one submit, plain
 * language. Manager-side forms live in cycle-manager-forms.tsx.
 */

function PromptField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-ink">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="w-full resize-y rounded-[10px] border border-line bg-surface px-3 py-2 text-[13.5px] leading-relaxed text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-400"
      />
    </label>
  );
}

function FormError({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="m-0 text-[12.5px] font-medium text-danger-700">{error}</p>;
}

// ── Reviewee self-reflection ─────────────────────────────────────────────────

export function SelfInputForm({
  cycleId,
  initialAnswers,
  submitted,
}: {
  cycleId: string;
  initialAnswers: Record<string, string | null>;
  submitted: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      SELF_INPUT_PROMPTS.map((prompt) => [
        prompt.key,
        initialAnswers[prompt.key] ?? "",
      ])
    )
  );

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        await submitCycleSelfInput({ cycleId, ...answers });
        setSaved(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not submit.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {SELF_INPUT_PROMPTS.map((prompt) => (
        <PromptField
          key={prompt.key}
          label={prompt.label}
          value={answers[prompt.key] ?? ""}
          onChange={(value) =>
            setAnswers((prev) => ({ ...prev, [prompt.key]: value }))
          }
        />
      ))}
      <FormError error={error} />
      <div className="flex items-center gap-3">
        <Button variant="primary" loading={isPending} onClick={handleSubmit}>
          {submitted ? "Update self-reflection" : "Submit self-reflection"}
        </Button>
        {(submitted || saved) && !isPending ? (
          <span className="text-[12.5px] font-medium text-success-700">
            Submitted — you can revise it until the review moves on.
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ── Contributor feedback ─────────────────────────────────────────────────────

export function ContributorFeedbackForm({
  feedbackId,
  cycleType,
  initialAnswers,
  submitted,
}: {
  feedbackId: string;
  cycleType: ReviewCycleType;
  initialAnswers: {
    doingWell: string | null;
    needsSupport: string | null;
    concerns: string | null;
    examples: string | null;
    suggestedNextStep: string | null;
    topics: string[];
    flagForLeadership: boolean;
  };
  submitted: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      FEEDBACK_PROMPTS.map((prompt) => [
        prompt.key,
        initialAnswers[prompt.key] ?? "",
      ])
    )
  );
  const [topics, setTopics] = useState<string[]>(initialAnswers.topics);
  const [flagForLeadership, setFlagForLeadership] = useState(
    initialAnswers.flagForLeadership
  );

  const topicOptions = feedbackTopicsForType(cycleType);

  function toggleTopic(value: string) {
    setTopics((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
    );
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        await submitCycleFeedback({
          feedbackId,
          ...answers,
          topics,
          flagForLeadership,
        });
        setSaved(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not submit.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="m-0 mb-2 text-[13px] font-semibold text-ink">
          What does this cover?
        </p>
        <div className="flex flex-wrap gap-1.5">
          {topicOptions.map((topic) => {
            const active = topics.includes(topic.value);
            return (
              <button
                key={topic.value}
                type="button"
                onClick={() => toggleTopic(topic.value)}
                aria-pressed={active}
                className={cn(
                  "rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors",
                  active
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-line bg-surface text-ink-muted hover:border-brand-400 hover:text-brand-700"
                )}
              >
                {topic.label}
              </button>
            );
          })}
        </div>
      </div>

      {FEEDBACK_PROMPTS.map((prompt) => (
        <PromptField
          key={prompt.key}
          label={prompt.label}
          value={answers[prompt.key] ?? ""}
          onChange={(value) =>
            setAnswers((prev) => ({ ...prev, [prompt.key]: value }))
          }
        />
      ))}

      <label className="flex items-center gap-2 text-[13px] text-ink">
        <input
          type="checkbox"
          checked={flagForLeadership}
          onChange={(event) => setFlagForLeadership(event.target.checked)}
          className="size-4 accent-brand-600"
        />
        Leadership should look at this directly
      </label>

      <FormError error={error} />
      <div className="flex items-center gap-3">
        <Button variant="primary" loading={isPending} onClick={handleSubmit}>
          {submitted ? "Update feedback" : "Submit feedback"}
        </Button>
        {(submitted || saved) && !isPending ? (
          <span className="text-[12.5px] font-medium text-success-700">
            Submitted — thank you.
          </span>
        ) : null}
      </div>
    </div>
  );
}
