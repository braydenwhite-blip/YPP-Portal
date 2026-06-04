"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { GoalRatingColor, QuarterlyReviewDecision } from "@prisma/client";

import { getMatrixLabel, isSuccessionCandidate } from "@/lib/matrix";
import { RATING_LABELS } from "@/lib/people-strategy/check-in-rating";
import {
  GOAL_RATING_ORDER,
  QUARTERLY_REVIEW_DECISION_LABELS,
  QUARTERLY_REVIEW_DECISION_VALUES,
} from "@/lib/people-strategy/constants";
import { submitQuarterlyReview } from "@/lib/people-strategy/quarterly-review-actions";

export interface LatestQuarterlyReview {
  quarter: string;
  performanceRating: GoalRatingColor;
  potentialRating: GoalRatingColor;
  decision: QuarterlyReviewDecision;
  notes: string | null;
  successionFlag: boolean;
  matrixLabel: string;
  createdAt: string;
}

/** Default the quarter input to the current calendar quarter, e.g. "2026-Q2". */
function currentQuarter(): string {
  const now = new Date();
  const q = Math.floor(now.getUTCMonth() / 3) + 1;
  return `${now.getUTCFullYear()}-Q${q}`;
}

function RatingSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: GoalRatingColor;
  onChange: (v: GoalRatingColor) => void;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as GoalRatingColor)}
        style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #e5e7eb", fontSize: 13 }}
      >
        {GOAL_RATING_ORDER.map((r) => (
          <option key={r} value={r}>
            {RATING_LABELS[r]}
          </option>
        ))}
      </select>
    </label>
  );
}

export function QuarterlyReviewForm({
  userId,
  latestReview,
  canSubmit,
}: {
  userId: string;
  latestReview: LatestQuarterlyReview | null;
  canSubmit: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [quarter, setQuarter] = useState(latestReview?.quarter ?? currentQuarter());
  const [performanceRating, setPerformanceRating] = useState<GoalRatingColor>(
    latestReview?.performanceRating ?? "ACHIEVED"
  );
  const [potentialRating, setPotentialRating] = useState<GoalRatingColor>(
    latestReview?.potentialRating ?? "ACHIEVED"
  );
  const [decision, setDecision] = useState<QuarterlyReviewDecision>(
    latestReview?.decision ?? "CONTINUATION"
  );
  const [notes, setNotes] = useState(latestReview?.notes ?? "");

  // Live matrix preview — computed, never persisted.
  const previewLabel = useMemo(
    () => getMatrixLabel(performanceRating, potentialRating),
    [performanceRating, potentialRating]
  );
  const previewSuccession = useMemo(
    () => isSuccessionCandidate(performanceRating, potentialRating),
    [performanceRating, potentialRating]
  );

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        await submitQuarterlyReview({
          userId,
          quarter,
          performanceRating,
          potentialRating,
          decision,
          notes: notes.trim() || undefined,
        });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save review.");
      }
    });
  }

  return (
    <div className="instructor-profile-two-column">
      <div>
        {latestReview ? (
          <div className="instructor-profile-stage-card" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className={`pill ${latestReview.successionFlag ? "pill-purple" : "pill-attention"}`}>
              {latestReview.matrixLabel}
            </span>
            <strong>{latestReview.quarter}</strong>
            <span>
              Performance: {RATING_LABELS[latestReview.performanceRating]} | Potential:{" "}
              {RATING_LABELS[latestReview.potentialRating]}
            </span>
            <span>
              Decision: {QUARTERLY_REVIEW_DECISION_LABELS[latestReview.decision]}
            </span>
            <span>
              Succession candidate: {latestReview.successionFlag ? "Yes" : "No"}
            </span>
            {latestReview.notes && (
              <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", color: "var(--muted)" }}>
                {latestReview.notes}
              </span>
            )}
            <small style={{ color: "var(--muted)" }}>
              Recorded {new Date(latestReview.createdAt).toLocaleDateString()}
            </small>
          </div>
        ) : (
          <p className="instructor-profile-muted">No quarterly review on file yet.</p>
        )}
      </div>

      {canSubmit ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>Quarter</span>
            <input
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              placeholder="2026-Q2"
              style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #e5e7eb", fontSize: 13 }}
            />
          </label>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <RatingSelect label="Performance" value={performanceRating} onChange={setPerformanceRating} />
            <RatingSelect label="Potential" value={potentialRating} onChange={setPotentialRating} />
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>Decision</span>
            <select
              value={decision}
              onChange={(e) => setDecision(e.target.value as QuarterlyReviewDecision)}
              style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #e5e7eb", fontSize: 13 }}
            >
              {QUARTERLY_REVIEW_DECISION_VALUES.map((d) => (
                <option key={d} value={d}>
                  {QUARTERLY_REVIEW_DECISION_LABELS[d]}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional rationale..."
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid #e5e7eb",
                fontSize: 13,
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </label>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              borderRadius: 6,
              background: previewSuccession ? "#f5f3ff" : "#fff7ed",
              border: `1px solid ${previewSuccession ? "#ddd6fe" : "#fed7aa"}`,
            }}
          >
            <span className={`pill ${previewSuccession ? "pill-purple" : "pill-attention"}`}>
              {previewLabel}
            </span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              {previewSuccession ? "Succession candidate" : "Not a succession candidate"}
            </span>
          </div>

          {error && <p style={{ color: "#b91c1c", fontSize: 12 }}>{error}</p>}

          <div>
            <button
              className="button"
              onClick={handleSubmit}
              disabled={isPending || !quarter.trim()}
              style={{ fontSize: 13, padding: "6px 16px" }}
            >
              {isPending ? "Saving..." : "Save quarterly review"}
            </button>
          </div>
        </div>
      ) : (
        <p className="instructor-profile-muted">
          Only Leadership or the Board can record a quarterly review.
        </p>
      )}
    </div>
  );
}
