"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui-v2";
import { submitSelfReflection } from "@/lib/self-reflection-actions";
import { MONTHLY_PRESET_PROMPTS } from "@/lib/mentorship/feedback-prompts";

type Goal = { id: string; title: string };

/**
 * One-page monthly note — three presets, one Send.
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
  const [howGoing, setHowGoing] = useState("");
  const [whatGood, setWhatGood] = useState("");
  const [whatHard, setWhatHard] = useState("");
  const [error, setError] = useState<string | null>(null);

  const values = { howGoing, whatGood, whatHard };
  const setters = {
    howGoing: setHowGoing,
    whatGood: setWhatGood,
    whatHard: setWhatHard,
  };
  const filled = [howGoing, whatGood, whatHard].filter((v) => v.trim()).length;

  function submit() {
    if (!howGoing.trim()) {
      setError("Tell us how the month went — even a sentence is enough.");
      return;
    }
    if (!whatGood.trim()) {
      setError("Share one thing that went well.");
      return;
    }
    if (!whatHard.trim()) {
      setError("Share one thing that was hard or that you need help with.");
      return;
    }
    setError(null);

    const formData = new FormData();
    formData.set("overallReflection", howGoing.trim());
    formData.set("engagementOverall", howGoing.trim());
    formData.set("workingWell", whatGood.trim());
    formData.set("supportNeeded", whatHard.trim());
    formData.set("mentorHelpfulness", whatGood.trim());
    formData.set("collaborationAssessment", howGoing.trim());
    formData.set("teamMembersAboveAndBeyond", "");
    formData.set("collaborationImprovements", "");
    formData.set("additionalReflections", "");

    goals.forEach((g) => {
      formData.append("goalIds", g.id);
      formData.set(`goal_${g.id}_progressMade`, howGoing.trim());
      formData.set(`goal_${g.id}_objectiveAchieved`, "false");
      formData.set(`goal_${g.id}_accomplishments`, whatGood.trim());
      formData.set(`goal_${g.id}_blockers`, whatHard.trim());
      formData.set(`goal_${g.id}_nextMonthPlans`, whatHard.trim());
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
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={
              filled >= n
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
            <span className="mt-0.5 block text-[12.5px] text-ink-muted">{prompt.hint}</span>
            <textarea
              className="mt-3 w-full resize-y rounded-[10px] border border-transparent bg-surface-soft px-3.5 py-3 text-[15px] leading-relaxed text-ink outline-none placeholder:text-ink-muted/65 focus:border-brand-300 focus:bg-surface"
              rows={prompt.rows}
              value={values[prompt.key]}
              onChange={(e) => setters[prompt.key](e.target.value)}
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
          {filled === 3 ? "Ready to send" : `${filled} of 3 answered`}
        </p>
        <Button variant="primary" size="md" onClick={submit} loading={pending}>
          Send to mentor
        </Button>
      </div>
    </div>
  );
}
