"use client";

import { useState, useTransition } from "react";

import { submitFeedbackResponse } from "@/lib/people-strategy/feedback-request-actions";

function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function FeedbackResponseForm({
  requestId,
  subjectName,
  initialResponse,
  initialSubmittedAt,
}: {
  requestId: string;
  subjectName: string;
  initialResponse: string | null;
  initialSubmittedAt: string | null;
}) {
  const [responseBody, setResponseBody] = useState(initialResponse ?? "");
  const [submittedAt, setSubmittedAt] = useState<string | null>(initialSubmittedAt);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (responseBody.trim().length === 0) {
      setError("Please write your feedback before submitting.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await submitFeedbackResponse({ requestId, responseBody });
        setSubmittedAt(result.submittedAt.toISOString());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      {submittedAt ? (
        <div
          className="card"
          style={{ padding: "12px 14px", fontSize: 13, color: "var(--success-text)", background: "var(--success-bg)", borderLeft: "3px solid var(--success-color)" }}
        >
          Submitted {formatTimestamp(submittedAt)}. You can edit and resubmit while the request is open.
        </div>
      ) : null}

      <label htmlFor="responseBody" style={{ fontSize: 14, fontWeight: 600 }}>
        Your feedback on {subjectName}
      </label>
      <textarea
        id="responseBody"
        name="responseBody"
        value={responseBody}
        onChange={(e) => setResponseBody(e.target.value)}
        rows={10}
        maxLength={10000}
        placeholder="What is this person doing well? Where could they grow? Be specific and constructive."
        style={{
          width: "100%",
          padding: "12px 14px",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border)",
          fontSize: 14,
          fontFamily: "inherit",
          resize: "vertical",
        }}
        disabled={isPending}
      />

      {error ? (
        <p role="alert" style={{ margin: 0, color: "var(--error-text)", fontSize: 13 }}>
          {error}
        </p>
      ) : null}

      <div>
        <button type="submit" className="button small" disabled={isPending}>
          {isPending ? "Submitting…" : submittedAt ? "Update Feedback" : "Submit Feedback"}
        </button>
      </div>
    </form>
  );
}
