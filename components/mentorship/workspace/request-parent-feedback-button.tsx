"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui-v2";
import { requestParentFeedbackForInstructor } from "@/lib/instructor-feedback-actions";

/** Mentor/officer CTA to email parents of this instructor's students. */
export function RequestParentFeedbackButton({
  instructorId,
  label = "Request feedback from parents",
  variant = "primary",
}: {
  instructorId: string;
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await requestParentFeedbackForInstructor({ instructorId });
        setMessage(
          `Requested feedback from ${res.parentsNotified} parent${
            res.parentsNotified === 1 ? "" : "s"
          }.`
        );
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not send requests.");
      }
    });
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <Button variant={variant} size="sm" loading={pending} onClick={run}>
        {label}
      </Button>
      {message ? (
        <p className="m-0 text-[12.5px] font-medium text-complete-800">{message}</p>
      ) : null}
      {error ? (
        <p className="m-0 text-[12.5px] font-medium text-danger-700">{error}</p>
      ) : null}
    </div>
  );
}
