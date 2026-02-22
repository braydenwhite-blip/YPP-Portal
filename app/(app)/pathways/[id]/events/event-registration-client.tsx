"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { registerForPathwayEvent, unregisterFromPathwayEvent } from "@/lib/pathway-event-actions";

interface EventRegistrationButtonProps {
  eventId: string;
  isRegistered: boolean;
  canRegister: boolean;
  requiredStep: number;
}

export function EventRegistrationButton({ eventId, isRegistered, canRegister, requiredStep }: EventRegistrationButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!canRegister) {
    return (
      <span style={{ fontSize: 13, color: "var(--gray-400)", whiteSpace: "nowrap" }}>
        Complete Step {requiredStep} to unlock
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

  return (
    <button
      className="button small"
      onClick={() => startTransition(async () => { await registerForPathwayEvent(eventId); router.refresh(); })}
      disabled={isPending}
      style={{ whiteSpace: "nowrap" }}
    >
      {isPending ? "Registering..." : "Register"}
    </button>
  );
}
