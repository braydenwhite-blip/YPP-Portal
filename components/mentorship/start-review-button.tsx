"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui-v2";
import { startReviewForPerson } from "@/lib/mentorship/cycle-actions";

/**
 * "Start review" — launches a single-participant review cycle for one person
 * and lands on its tracking page. The same lifecycle as a cohort launch, so
 * individual and cohort reviews share one progress model.
 */
export function StartReviewButton({
  userId,
  kind = "monthly",
}: {
  userId: string;
  kind?: "monthly" | "quarterly";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await startReviewForPerson({ userId, kind });
            if (result.ok) {
              router.push(`/mentorship/cycles/${result.cycleId}`);
            } else {
              setError(result.error);
            }
          });
        }}
      >
        {pending ? "Starting…" : "Start review"}
      </Button>
      {error ? <p className="m-0 text-[11.5px] text-danger-700">{error}</p> : null}
    </div>
  );
}
