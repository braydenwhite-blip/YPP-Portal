"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { enrollInNextPathwayStep } from "@/lib/onboarding-actions";

interface StepEnrollButtonProps {
  pathwayId: string;
  label?: string;
}

export function StepEnrollButton({ pathwayId, label = "Enroll in Next Step" }: StepEnrollButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleEnroll() {
    startTransition(async () => {
      const result = await enrollInNextPathwayStep(pathwayId);
      if (result && "error" in result && result.error) {
        alert(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <button className="button" onClick={handleEnroll} disabled={isPending}>
      {isPending ? "Enrolling..." : label}
    </button>
  );
}
