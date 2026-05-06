"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { commitWorkshopReview } from "@/lib/workshop-proposal-actions";
import { recommendationLabel } from "@/lib/workshop-proposal-constants";
import type { WorkshopProposalReviewRecommendation } from "@prisma/client";

const RECOMMENDATIONS: WorkshopProposalReviewRecommendation[] = [
  "APPROVE",
  "REQUEST_CHANGES",
  "REJECT",
];

const RATING_FIELDS: { name: string; label: string }[] = [
  { name: "clarityRating",            label: "Clarity" },
  { name: "engagementRating",         label: "Engagement" },
  { name: "feasibilityRating",        label: "Feasibility" },
  { name: "ageAppropriatenessRating", label: "Age appropriateness" },
  { name: "preparednessRating",       label: "Preparedness" },
  { name: "alignmentRating",          label: "YPP values alignment" },
];

type ReviewDecisionFormProps = {
  submissionId: string;
  disabled: boolean;
};

export function ReviewDecisionForm({
  submissionId,
  disabled,
}: ReviewDecisionFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handle(formData: FormData) {
    setError(null);
    formData.set("submissionId", submissionId);
    startTransition(async () => {
      try {
        await commitWorkshopReview(formData);
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not save review."
        );
      }
    });
  }

  return (
    <form
      action={handle}
      className="card"
      style={{ display: "grid", gap: 12 }}
    >
      <h3 style={{ marginTop: 0 }}>Score &amp; decide</h3>
      <p style={{ marginTop: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
        Rate each category 1–5 (5 = strongest). Applicant feedback gets sent
        to the applicant; internal notes stay reviewer-only.
      </p>

      <div style={{ display: "grid", gap: 8 }}>
        {RATING_FIELDS.map((f) => (
          <label
            key={f.name}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 90px",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
            }}
          >
            <span>{f.label}</span>
            <select
              name={f.name}
              className="input"
              defaultValue=""
              disabled={disabled || isPending}
            >
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <label style={{ display: "grid", gap: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          Overall recommendation
        </span>
        <select
          name="overallRecommendation"
          className="input"
          required
          defaultValue=""
          disabled={disabled || isPending}
        >
          <option value="" disabled>
            Pick a decision…
          </option>
          {RECOMMENDATIONS.map((r) => (
            <option key={r} value={r}>
              {recommendationLabel(r)}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: "grid", gap: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          Feedback to applicant
        </span>
        <textarea
          name="applicantFeedback"
          className="input"
          rows={4}
          disabled={disabled || isPending}
          placeholder="What should they keep, fix, or do next?"
        />
      </label>

      <label style={{ display: "grid", gap: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Internal note</span>
        <textarea
          name="internalNote"
          className="input"
          rows={3}
          disabled={disabled || isPending}
          placeholder="Reviewer-only context. Not shown to the applicant."
        />
      </label>

      <button
        type="submit"
        className="button"
        disabled={disabled || isPending}
      >
        {disabled
          ? "Decided"
          : isPending
            ? "Committing…"
            : "Commit decision"}
      </button>
      {error ? (
        <p
          role="alert"
          style={{ margin: 0, fontSize: 12, color: "#dc2626" }}
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}
