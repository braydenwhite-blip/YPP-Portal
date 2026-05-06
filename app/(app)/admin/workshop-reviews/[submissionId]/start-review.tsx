"use client";

import { useTransition } from "react";
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

  if (status !== "SUBMITTED") return null;

  function handleStart() {
    const fd = new FormData();
    fd.set("submissionId", submissionId);
    startTransition(async () => {
      try {
        await startWorkshopReview(fd);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Could not start review.");
      }
    });
  }

  return (
    <div
      className="card"
      role="status"
      style={{
        marginBottom: 16,
        background: "#eff6ff",
        borderColor: "#bfdbfe",
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
        <p style={{ margin: 0, fontSize: 13, color: "#1d4ed8" }}>
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
    </div>
  );
}
