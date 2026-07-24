"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, CardV2 } from "@/components/ui-v2";
import { approveGoalReview, requestReviewChanges } from "@/lib/goal-review-actions";

interface Props {
  reviewId: string;
  currentStatus: string;
  pointsToAward: number;
  menteeName: string;
  bonusPoints?: number;
  bonusReason?: string | null;
}

/**
 * Approve / request-changes — inline on ?panel=approve.
 * Approval releases the review and awards points in one step.
 */
export function ChairDecisionForm({
  reviewId,
  currentStatus,
  pointsToAward,
  menteeName,
  bonusPoints = 0,
  bonusReason,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [chairComments, setChairComments] = useState("");
  const [chairAdjustedBonus, setChairAdjustedBonus] = useState("");
  const [mode, setMode] = useState<"idle" | "approve" | "changes">("idle");

  const effectiveBonus =
    chairAdjustedBonus !== ""
      ? Math.max(0, Math.min(25, parseInt(chairAdjustedBonus, 10) || 0))
      : bonusPoints;
  const totalPoints = pointsToAward - bonusPoints + effectiveBonus;

  if (currentStatus === "APPROVED") {
    return (
      <CardV2 padding="md" className="border-l-4 border-l-complete-700">
        <p className="m-0 text-[14px] font-semibold text-ink">Approved &amp; released</p>
        <p className="m-0 mt-1 text-[13px] text-ink-muted">
          {menteeName} can see this feedback now.
        </p>
      </CardV2>
    );
  }

  function handleApprove() {
    if (
      !confirm(
        `Approve and release to ${menteeName}? Awards ${totalPoints} achievement points.`
      )
    ) {
      return;
    }
    setError(null);
    setSuccess(null);
    const formData = new FormData();
    formData.set("reviewId", reviewId);
    formData.set("chairComments", chairComments);
    if (chairAdjustedBonus !== "") {
      formData.set("chairAdjustedBonusPoints", String(effectiveBonus));
    }
    startTransition(async () => {
      try {
        await approveGoalReview(formData);
        setSuccess(`Released. ${totalPoints} points awarded.`);
        setTimeout(() => router.refresh(), 1000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to approve");
      }
    });
  }

  function handleRequestChanges() {
    if (!chairComments.trim()) {
      setError("Add a short note on what needs to change.");
      return;
    }
    setError(null);
    setSuccess(null);
    const formData = new FormData();
    formData.set("reviewId", reviewId);
    formData.set("chairComments", chairComments);
    startTransition(async () => {
      try {
        await requestReviewChanges(formData);
        setSuccess("Sent back to the mentor.");
        setTimeout(() => router.refresh(), 1000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to request changes");
      }
    });
  }

  return (
    <CardV2 padding="md" className="grid gap-4 border-l-4 border-l-brand-600">
      <div>
        <h3 className="m-0 text-[15px] font-semibold text-ink">Your decision</h3>
        <p className="m-0 mt-1 text-[13px] text-ink-muted">
          Approve releases feedback to {menteeName}. Request changes sends it back to the mentor.
        </p>
      </div>

      {(bonusPoints > 0 || bonusReason) && (
        <div className="rounded-[10px] bg-surface-soft px-3 py-2.5 text-[13px]">
          <p className="m-0 font-semibold text-ink">
            Bonus suggested: {bonusPoints} pts
          </p>
          {bonusReason ? (
            <p className="m-0 mt-1 text-ink-muted">{bonusReason}</p>
          ) : null}
          <label className="mt-2 flex items-center gap-2 text-[12.5px] text-ink-muted">
            Adjust
            <input
              type="number"
              min={0}
              max={25}
              value={chairAdjustedBonus}
              onChange={(e) => setChairAdjustedBonus(e.target.value)}
              placeholder={String(bonusPoints)}
              disabled={isPending}
              className="w-16 rounded-md border border-line-soft bg-surface px-2 py-1 text-ink"
            />
          </label>
        </div>
      )}

      <div className="grid gap-1.5">
        <label className="text-[13px] font-medium text-ink">
          Notes {mode === "changes" ? <span className="text-danger-700">*</span> : null}
        </label>
        <textarea
          value={chairComments}
          onChange={(e) => setChairComments(e.target.value)}
          rows={3}
          placeholder={
            mode === "changes"
              ? "What should the mentor change?"
              : "Optional note…"
          }
          disabled={isPending}
          className="w-full resize-y rounded-[10px] border border-line-soft bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-brand-400"
        />
      </div>

      {error ? (
        <p className="m-0 text-[13px] font-medium text-danger-700">{error}</p>
      ) : null}
      {success ? (
        <p className="m-0 text-[13px] font-medium text-complete-700">{success}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={isPending}
          onClick={() => {
            setMode("approve");
            handleApprove();
          }}
        >
          {isPending && mode === "approve" ? "Approving…" : "Approve & release"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={isPending}
          onClick={() => {
            setMode("changes");
            handleRequestChanges();
          }}
        >
          {isPending && mode === "changes" ? "Sending…" : "Request changes"}
        </Button>
      </div>
    </CardV2>
  );
}
