"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestPathwayFallback } from "@/lib/pathway-fallback-actions";

type Props = {
  pathwayId: string;
  pathwayStepId: string;
  targetOfferingId: string;
  requestStatus: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | null;
};

export function FallbackRequestButton({
  pathwayId,
  pathwayStepId,
  targetOfferingId,
  requestStatus,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const isLocked = requestStatus === "PENDING" || requestStatus === "APPROVED";
  const label =
    requestStatus === "PENDING"
      ? "Request pending"
      : requestStatus === "APPROVED"
        ? "Request approved"
        : "Request access";

  function handleRequest() {
    if (isLocked || isPending) return;

    setMessage("");
    startTransition(async () => {
      try {
        await requestPathwayFallback({
          pathwayId,
          pathwayStepId,
          targetOfferingId,
        });
        setMessage("Request sent to the partner chapter.");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "We could not send the request.");
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <button
        type="button"
        className="button outline small"
        onClick={handleRequest}
        disabled={isLocked || isPending}
      >
        {isPending ? "Sending..." : label}
      </button>
      {message ? (
        <p style={{ margin: 0, fontSize: 12, color: "var(--gray-500)" }}>{message}</p>
      ) : null}
    </div>
  );
}
