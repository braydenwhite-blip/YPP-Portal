"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startWorkshopReview } from "@/lib/workshop-proposal-actions";
import type { WorkshopProposalSubmissionStatus } from "@prisma/client";

type StartReviewBannerProps = {
  submissionId: string;
  status: WorkshopProposalSubmissionStatus;
};

export function StartReviewBanner({
  submissionId,
  status,
}: StartReviewBannerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (status !== "SUBMITTED") return null;

  function handleStart() {
    setError(null);
    const fd = new FormData();
    fd.set("submissionId", submissionId);
    startTransition(async () => {
      try {
        await startWorkshopReview(fd);
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not start review."
        );
      }
    });
  }

  return (
    <div
      className="card"
      role="status"
      style={{
        marginBottom: 16,
        background: "#f3ecff",
        borderColor: "#e8d8ff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <p style={{ margin: 0, fontSize: 13, color: "#5a1da8" }}>
          New submission. Click <strong>Start review</strong> to flag it as
          in-review and lock the applicant&rsquo;s edits while you read.
        </p>
        <button
          type="button"
          className="button small"
          onClick={handleStart}
          disabled={isPending}
        >
          {isPending ? "Starting…" : "Start review"}
        </button>
      </div>
      {error ? (
        <p
          role="alert"
          style={{ margin: "8px 0 0", fontSize: 12, color: "#dc2626" }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
