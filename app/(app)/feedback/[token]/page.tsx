"use client";

import { useState, useTransition } from "react";
import { submitFeedbackResponse } from "@/lib/goal-review-actions";
import { useParams } from "next/navigation";

const RESPONDENT_ROLES = [
  "Parent",
  "Student",
  "School Official",
  "Leadership",
  "Colleague",
  "Community Member",
  "Other",
];

export default function PublicFeedbackPage() {
  const params = useParams();
  const token = params.token as string;
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("token", token);
    formData.set("overallRating", String(rating));

    if (rating === 0) {
      setError("Please select an overall rating.");
      return;
    }

    startTransition(async () => {
      try {
        await submitFeedbackResponse(formData);
        setSubmitted(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      }
    });
  }

  if (submitted) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--surface-alt)",
          padding: "2rem",
        }}
      >
        <div
          style={{
            background: "var(--surface)",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "3rem",
            maxWidth: "480px",
            width: "100%",
            textAlign: "center",
            boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🙏</div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "0.75rem" }}>
            Thank You for Your Feedback!
          </h1>
          <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>
            Your response has been submitted and will be included in this mentee's quarterly review. Your input helps us build stronger mentorship experiences.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--surface-alt)",
        padding: "2rem 1rem",
      }}
    >
      <div
        style={{
          maxWidth: "600px",
          margin: "0 auto",
          background: "var(--surface)",
          borderRadius: "var(--radius-lg, 12px)",
          overflow: "hidden",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, var(--ypp-purple-600) 0%, var(--ypp-purple-800, #4c1d95) 100%)",
            padding: "2rem",
            color: "white",
          }}
        >
          <p style={{ fontSize: "0.8rem", opacity: 0.8, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
            YPP Mentorship Program
          </p>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            Quarterly Feedback Form
          </h1>
          <p style={{ fontSize: "0.88rem", opacity: 0.85, lineHeight: 1.5 }}>
            You've been invited to provide feedback as part of a quarterly 360-degree review for a YPP mentorship program participant. Your honest input helps us support their growth.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Respondent info */}
          <div>
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.88rem", marginBottom: "0.4rem" }}>
              Your Name <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              type="text"
              name="respondentName"
              required
              placeholder="Full name"
              className="input"
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.88rem", marginBottom: "0.4rem" }}>
              Your Email (optional)
            </label>
            <input
              type="email"
              name="respondentEmail"
              placeholder="name@example.com"
              className="input"
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.88rem", marginBottom: "0.4rem" }}>
              Your Role / Relationship <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <select
              name="respondentRole"
              required
              className="input"
              style={{ width: "100%", boxSizing: "border-box" }}
            >
              <option value="">Select your role...</option>
              {RESPONDENT_ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Star rating */}
          <div>
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.88rem", marginBottom: "0.4rem" }}>
              Overall Rating <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
              Rate the mentee's overall performance and growth this quarter (1 = Needs significant improvement, 5 = Exceptional)
            </p>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "2rem",
                    padding: "0.1rem",
                    color: star <= (hoverRating || rating) ? "#d4af37" : "var(--border)",
                    transition: "color 0.1s",
                  }}
                >
                  ★
                </button>
              ))}
              {rating > 0 && (
                <span style={{ alignSelf: "center", fontSize: "0.82rem", color: "var(--muted)", marginLeft: "0.5rem" }}>
                  {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][rating]}
                </span>
              )}
            </div>
          </div>

          {/* Strengths */}
          <div>
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.88rem", marginBottom: "0.4rem" }}>
              Strengths <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: "0.4rem" }}>
              What are this person's standout qualities, contributions, or achievements?
            </p>
            <textarea
              name="strengths"
              required
              rows={4}
              placeholder="Describe their key strengths..."
              className="input"
              style={{ width: "100%", boxSizing: "border-box", resize: "vertical" }}
            />
          </div>

          {/* Areas for growth */}
          <div>
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.88rem", marginBottom: "0.4rem" }}>
              Areas for Growth <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: "0.4rem" }}>
              What areas could they improve, develop further, or focus on going forward?
            </p>
            <textarea
              name="areasForGrowth"
              required
              rows={4}
              placeholder="Describe areas where they could grow..."
              className="input"
              style={{ width: "100%", boxSizing: "border-box", resize: "vertical" }}
            />
          </div>

          {/* Additional notes */}
          <div>
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.88rem", marginBottom: "0.4rem" }}>
              Additional Notes (optional)
            </label>
            <textarea
              name="additionalNotes"
              rows={3}
              placeholder="Any other thoughts or context..."
              className="input"
              style={{ width: "100%", boxSizing: "border-box", resize: "vertical" }}
            />
          </div>

          {error && (
            <div
              style={{
                padding: "0.75rem 1rem",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "var(--radius-sm)",
                color: "#dc2626",
                fontSize: "0.85rem",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="button primary"
            style={{ width: "100%" }}
          >
            {isPending ? "Submitting..." : "Submit Feedback"}
          </button>

          <p style={{ fontSize: "0.75rem", color: "var(--muted)", textAlign: "center", lineHeight: 1.5 }}>
            Your feedback is confidential and will only be seen by authorized program staff. It is used solely to support the mentee's development.
          </p>
        </form>
      </div>
    </div>
  );
}
