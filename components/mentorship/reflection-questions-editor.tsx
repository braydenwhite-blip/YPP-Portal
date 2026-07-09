"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui-v2";
import { updateReflectionQuestions } from "@/lib/mentorship/cycle-actions";
import {
  REFLECTION_QUESTION_KEYS,
  resolveReflectionQuestions,
  type ReflectionQuestionKey,
  type ReflectionQuestionOverrides,
} from "@/lib/mentorship/reflection-questions";

const SECTION_GROUPS: { title: string; keys: ReflectionQuestionKey[] }[] = [
  { title: "Overall Reflection", keys: ["overallReflection"] },
  {
    title: "Engagement & Fulfillment",
    keys: ["engagementOverall", "workingWell", "supportNeeded", "mentorHelpfulness"],
  },
  {
    title: "Leadership Team Collaboration",
    keys: ["collaborationAssessment", "teamMembersAboveAndBeyond", "collaborationImprovements"],
  },
  {
    title: "Goal Progress (applies to every active goal)",
    keys: ["goalProgressMade", "goalAccomplishments", "goalBlockers", "goalNextMonthPlans"],
  },
  { title: "Additional Reflections", keys: ["additionalReflections"] },
];

/**
 * Retune this cycle's monthly self-reflection wording without rebuilding the
 * form engine — the underlying MonthlySelfReflection columns never change,
 * only the label/hint shown for each. Leave a field blank to keep the
 * standard copy.
 */
export function ReflectionQuestionsEditor({
  cycleId,
  currentOverrides,
}: {
  cycleId: string;
  currentOverrides: ReflectionQuestionOverrides | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const defaults = resolveReflectionQuestions(currentOverrides);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const formData = new FormData(e.currentTarget);
    const overrides: ReflectionQuestionOverrides = {};
    for (const key of REFLECTION_QUESTION_KEYS) {
      const label = String(formData.get(`${key}__label`) ?? "").trim();
      const hint = String(formData.get(`${key}__hint`) ?? "").trim();
      if (label || hint) {
        overrides[key] = {
          ...(label ? { label } : {}),
          ...(hint ? { hint } : {}),
        };
      }
    }
    startTransition(async () => {
      try {
        await updateReflectionQuestions({ cycleId, overrides });
        setSuccess(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save question wording");
      }
    });
  }

  return (
    <details className="rounded-[12px] border border-line-soft bg-surface p-4">
      <summary className="cursor-pointer text-[13.5px] font-bold text-ink">
        Edit reflection questions for this cycle
      </summary>
      <p className="m-0 mt-2 text-[12.5px] text-ink-muted">
        Override the wording mentees see for this cycle only. Leave a field blank to keep the
        standard prompt.
      </p>
      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-5">
        {SECTION_GROUPS.map((group) => (
          <fieldset key={group.title} className="m-0 flex flex-col gap-3 border-0 p-0">
            <legend className="text-[12px] font-bold uppercase tracking-[0.05em] text-ink-muted">
              {group.title}
            </legend>
            {group.keys.map((key) => (
              <div key={key} className="flex flex-col gap-1.5 rounded-lg bg-surface-soft p-3">
                <input
                  type="text"
                  name={`${key}__label`}
                  defaultValue={currentOverrides?.[key]?.label ?? ""}
                  placeholder={defaults[key].label}
                  className="w-full rounded border border-line-soft px-2 py-1 text-[13px] font-semibold"
                />
                <textarea
                  name={`${key}__hint`}
                  defaultValue={currentOverrides?.[key]?.hint ?? ""}
                  placeholder={defaults[key].hint}
                  rows={2}
                  className="w-full resize-vertical rounded border border-line-soft px-2 py-1 text-[12.5px]"
                />
              </div>
            ))}
          </fieldset>
        ))}
        {error && <p className="m-0 text-[12.5px] font-semibold text-danger-700">{error}</p>}
        {success && <p className="m-0 text-[12.5px] font-semibold text-complete-700">Saved.</p>}
        <div>
          <Button type="submit" variant="secondary" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save question wording"}
          </Button>
        </div>
      </form>
    </details>
  );
}
