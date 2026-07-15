"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui-v2";
import { completeOnboardingStep, undoOnboardingStep } from "@/lib/session8/instructor-development-actions";

export function OnboardingStepActions({ stepKey, completed }: { stepKey: string; completed: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData: FormData) => {
        startTransition(async () => {
          if (completed) {
            await undoOnboardingStep(formData);
          } else {
            await completeOnboardingStep(formData);
          }
        });
      }}
    >
      <input type="hidden" name="stepKey" value={stepKey} />
      <Button type="submit" variant={completed ? "ghost" : "primary"} size="sm" loading={pending}>
        {completed ? "Mark incomplete" : "Mark complete"}
      </Button>
    </form>
  );
}
