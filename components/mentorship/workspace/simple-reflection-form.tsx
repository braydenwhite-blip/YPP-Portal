"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui-v2";
import { submitSelfReflection } from "@/lib/self-reflection-actions";
import {
  MONTHLY_PRESET_PROMPTS,
  type MonthlyPresetKey,
} from "@/lib/mentorship/feedback-prompts";

type Goal = { id: string; title: string };

const PRESET_COUNT = MONTHLY_PRESET_PROMPTS.length;

/**
 * One-page monthly note — staff presets, one Send.
 */
export function SimpleReflectionForm({
  goals,
  returnHref,
}: {
  goals: Goal[];
  returnHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [answers, setAnswers] = useState<Record<MonthlyPresetKey, string>>(
    () =>
      Object.fromEntries(
        MONTHLY_PRESET_PROMPTS.map((p) => [p.key, ""]),
      ) as Record<MonthlyPresetKey, string>,
  );
  const [error, setError] = useState<string | null>(null);

  const filled = MONTHLY_PRESET_PROMPTS.filter((p) =>
    answers[p.key]?.trim(),
  ).length;

  function submit() {
    const missing = MONTHLY_PRESET_PROMPTS.find((p) => !answers[p.key]?.trim());
    if (missing) {
      setError(`Please answer: ${missing.label}`);
      return;
    }
    setError(null);

    const pastMonth = answers.pastMonth.trim();
    const yppOverall = answers.yppOverall.trim();
    const goingWell = answers.goingWellChallenges.trim();
    const changes = answers.recommendedChanges.trim();
    const hours = answers.hoursPerWeek.trim();

    const formData = new FormData();
    formData.set("overallReflection", pastMonth);
    formData.set("engagementOverall", pastMonth);
    formData.set("workingWell", goingWell);
    formData.set("supportNeeded", changes);
    formData.set("mentorHelpfulness", yppOverall);
    formData.set("collaborationAssessment", yppOverall);
    formData.set("teamMembersAboveAndBeyond", "");
    formData.set("collaborationImprovements", changes);
    formData.set(
      "additionalReflections",
      `Hours per week on YPP: ${hours}`,
    );

    goals.forEach((g) => {
      formData.append("goalIds", g.id);
      formData.set(`goal_${g.id}_progressMade`, pastMonth);
      formData.set(`goal_${g.id}_objectiveAchieved`, "false");
      formData.set(`goal_${g.id}_accomplishments`, goingWell);
      formData.set(`goal_${g.id}_blockers`, changes);
      formData.set(`goal_${g.id}_nextMonthPlans`, changes);
    });

    startTransition(async () => {
      try {
        await submitSelfReflection(formData);
        router.push(returnHref);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not send. Try again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2" aria-hidden>
        {MONTHLY_PRESET_PROMPTS.map((prompt, index) => (
          <span
            key={prompt.key}
            className={
              filled > index
                ? "h-1.5 flex-1 rounded-full bg-brand-600"
                : "h-1.5 flex-1 rounded-full bg-line"
            }
          />
        ))}
      </div>

      {MONTHLY_PRESET_PROMPTS.map((prompt) => (
        <label
          key={prompt.key}
          className="flex gap-3 rounded-[14px] border border-line bg-surface px-4 py-4 shadow-sm"
        >
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[12.5px] font-bold text-brand-800">
            {prompt.n}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14.5px] font-semibold tracking-[-0.15px] text-ink">
              {prompt.label}
            </span>
            <textarea
              className="mt-3 w-full resize-y rounded-[10px] border border-transparent bg-surface-soft px-3.5 py-3 text-[15px] leading-relaxed text-ink outline-none placeholder:text-ink-muted/65 focus:border-brand-300 focus:bg-surface"
              rows={prompt.rows}
              value={answers[prompt.key]}
              onChange={(e) =>
                setAnswers((prev) => ({ ...prev, [prompt.key]: e.target.value }))
              }
              placeholder={prompt.placeholder}
              disabled={pending}
            />
          </span>
        </label>
      ))}

      {error ? (
        <p className="m-0 text-[13px] font-medium text-danger-700">{error}</p>
      ) : (
        <p className="m-0 text-[12.5px] text-ink-muted">
          Your mentor is the only person who needs to read this.
        </p>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-line-soft pt-4">
        <p className="m-0 text-[12.5px] text-ink-muted">
          {filled === PRESET_COUNT
            ? "Ready to send"
            : `${filled} of ${PRESET_COUNT} answered`}
        </p>
        <Button variant="primary" size="md" onClick={submit} loading={pending}>
          Send to mentor
        </Button>
      </div>
    </div>
  );
}
