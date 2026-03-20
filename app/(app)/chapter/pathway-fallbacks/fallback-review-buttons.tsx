"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewPathwayFallbackRequest } from "@/lib/pathway-fallback-actions";

export function FallbackReviewButtons({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function review(status: "APPROVED" | "REJECTED") {
    setMessage("");
    startTransition(async () => {
      try {
        const result = await reviewPathwayFallbackRequest({
          requestId,
          status,
        });
        setMessage(result.message);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "We could not update the request.");
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="button small" onClick={() => review("APPROVED")} disabled={isPending}>
          {isPending ? "Working..." : "Approve"}
        </button>
        <button type="button" className="button outline small" onClick={() => review("REJECTED")} disabled={isPending}>
          Reject
        </button>
      </div>
      {message ? <p style={{ margin: 0, fontSize: 12, color: "var(--gray-600)" }}>{message}</p> : null}
    </div>
  );
}
