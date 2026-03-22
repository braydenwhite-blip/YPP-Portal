"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveGoalReview, requestReviewChanges } from "@/lib/goal-review-actions";

interface Props {
  reviewId: string;
  currentStatus: string;
  pointsToAward: number;
  menteeName: string;
  bonusPoints?: number;
  bonusReason?: string | null;
}

export default function ChairActionsPanel({ reviewId, currentStatus, pointsToAward, menteeName, bonusPoints = 0, bonusReason }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [chairComments, setChairComments] = useState("");
  const [chairAdjustedBonus, setChairAdjustedBonus] = useState<string>("");
  const [mode, setMode] = useState<"idle" | "approve" | "changes">("idle");

  const effectiveBonus = chairAdjustedBonus !== "" ? Math.max(0, Math.min(25, parseInt(chairAdjustedBonus, 10) || 0)) : bonusPoints;
  const totalPoints = pointsToAward - bonusPoints + effectiveBonus;

  if (currentStatus === "APPROVED") {
    return (
      <div className="card" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
        <p style={{ fontWeight: 700, color: "#16a34a" }}>✓ Review Approved & Released</p>
        <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "0.25rem" }}>
          This review has been approved and released to the mentee.
        </p>
      </div>
    );
  }

  function handleApprove() {
    if (!confirm(`Approve this review and release it to ${menteeName}? This will award ${totalPoints} achievement points.`)) return;
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
        setSuccess(`Approved! ${totalPoints} points awarded to ${menteeName}. Review released.`);
        setTimeout(() => router.push("/mentorship-program/chair"), 1500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to approve");
      }
    });
  }

  function handleRequestChanges() {
    if (!chairComments.trim()) { setError("Please add comments explaining what changes are needed."); return; }
    setError(null);
    setSuccess(null);
    const formData = new FormData();
    formData.set("reviewId", reviewId);
    formData.set("chairComments", chairComments);
    startTransition(async () => {
      try {
        await requestReviewChanges(formData);
        setSuccess("Changes requested. The mentor has been notified.");
        setTimeout(() => router.push("/mentorship-program/chair"), 1500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to request changes");
      }
    });
  }

  return (
    <div className="card">
      <p style={{ fontWeight: 700, marginBottom: "1rem" }}>Chair Decision</p>

      {/* Points preview */}
      <div
        style={{
          padding: "0.75rem 1rem",
          background: "var(--surface-alt)",
          borderRadius: "var(--radius-sm)",
          marginBottom: "1.25rem",
          fontSize: "0.85rem",
        }}
      >
        <span style={{ color: "var(--muted)" }}>Points that will be awarded on approval: </span>
        <strong style={{ fontSize: "1.05rem" }}>{totalPoints} pts</strong>
        <span style={{ color: "var(--muted)", fontSize: "0.78rem", marginLeft: "0.5rem" }}>
          (base: {pointsToAward - bonusPoints}{bonusPoints > 0 || effectiveBonus > 0 ? ` + bonus: ${effectiveBonus}` : ""})
        </span>
      </div>

      {/* Mentor's bonus points */}
      {(bonusPoints > 0 || bonusReason) && (
        <div
          style={{
            padding: "0.75rem 1rem",
            background: "#fefce8",
            border: "1px solid #fde68a",
            borderRadius: "var(--radius-sm)",
            marginBottom: "1rem",
            fontSize: "0.85rem",
          }}
        >
          <p style={{ fontWeight: 700, color: "#92400e", marginBottom: "0.3rem", fontSize: "0.82rem" }}>
            Mentor&apos;s Character & Culture Bonus: {bonusPoints} pts
          </p>
          {bonusReason && (
            <p style={{ color: "var(--text)", fontSize: "0.82rem", margin: 0 }}>{bonusReason}</p>
          )}
          <div style={{ marginTop: "0.5rem" }}>
            <label style={{ fontWeight: 600, fontSize: "0.78rem", color: "var(--muted)" }}>
              Adjust bonus (leave blank to keep mentor&apos;s value):
            </label>
            <input
              type="number"
              min={0}
              max={25}
              value={chairAdjustedBonus}
              onChange={(e) => setChairAdjustedBonus(e.target.value)}
              placeholder={String(bonusPoints)}
              disabled={isPending}
              style={{ width: "80px", marginLeft: "0.5rem" }}
            />
          </div>
        </div>
      )}

      {/* Comments field */}
      <div style={{ marginBottom: "1rem" }}>
        <label style={{ fontWeight: 600, fontSize: "0.88rem" }}>
          Chair Comments {mode === "changes" && <span style={{ color: "#ef4444" }}>*</span>}
        </label>
        <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: "0.4rem" }}>
          {mode === "changes"
            ? "Required — explain what changes the mentor needs to make."
            : "Optional — add any notes for the mentor or mentee."}
        </p>
        <textarea
          value={chairComments}
          onChange={(e) => setChairComments(e.target.value)}
          rows={3}
          placeholder={
            mode === "changes"
              ? "Describe the specific changes needed…"
              : "Optional feedback for the mentor…"
          }
          style={{ width: "100%", resize: "vertical" }}
          disabled={isPending}
        />
      </div>

      {error && <p style={{ color: "var(--color-error)", marginBottom: "0.75rem", fontWeight: 600 }}>{error}</p>}
      {success && <p style={{ color: "var(--color-success)", marginBottom: "0.75rem", fontWeight: 600 }}>{success}</p>}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button
          className="button primary"
          disabled={isPending}
          onClick={() => { setMode("approve"); handleApprove(); }}
        >
          {isPending && mode === "approve" ? "Approving…" : `Approve & Award ${totalPoints} pts`}
        </button>
        <button
          className="button outline"
          disabled={isPending}
          style={{ color: "#c2410c", borderColor: "#fed7aa" }}
          onClick={() => { setMode("changes"); handleRequestChanges(); }}
        >
          {isPending && mode === "changes" ? "Requesting…" : "Request Changes"}
        </button>
      </div>
    </div>
  );
}
