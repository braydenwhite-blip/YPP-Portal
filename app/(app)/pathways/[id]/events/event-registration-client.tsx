"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { registerForPathwayEvent, unregisterFromPathwayEvent } from "@/lib/pathway-event-actions";

interface EventRegistrationButtonProps {
  eventId: string;
  isRegistered: boolean;
  canRegister: boolean;
  isFull: boolean;
  requiredStep: number;
}

export function EventRegistrationButton({
  eventId,
  isRegistered,
  canRegister,
  isFull,
  requiredStep,
}: EventRegistrationButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!canRegister) {
    return (
      <span style={{ fontSize: 13, color: "var(--gray-400)", whiteSpace: "nowrap" }}>
        Finish course steps through Step {requiredStep}
      </span>
    );
  }

  if (isRegistered) {
    return (
      <button
        className="button outline small"
        onClick={() => startTransition(async () => { await unregisterFromPathwayEvent(eventId); router.refresh(); })}
        disabled={isPending}
        style={{ whiteSpace: "nowrap" }}
      >
        {isPending ? "..." : "Cancel Registration"}
      </button>
    );
  }

  if (isFull) {
    return (
      <span style={{ fontSize: 13, color: "var(--gray-400)", whiteSpace: "nowrap" }}>
        Event full
      </span>
    );
  }

  return (
    <button
      className="button small"
      onClick={() =>
        startTransition(async () => {
          const result = await registerForPathwayEvent(eventId);
          if (result?.error) {
            alert(result.error);
            return;
          }
          router.refresh();
        })
      }
      disabled={isPending}
      style={{ whiteSpace: "nowrap" }}
    >
      {isPending ? "Registering..." : "Register for Event"}
    </button>
  );
}
