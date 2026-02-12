"use client";

import { useState, useTransition } from "react";
import {
  createFeedbackRequest,
  respondToFeedback,
  markResponseHelpful,
} from "@/lib/feedback-actions";

// ---------------------------------------------------------------------------
// Student: Request Feedback Form
// ---------------------------------------------------------------------------

export function RequestFeedbackForm() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await createFeedbackRequest(formData);
        setOpen(false);
      } catch {
        // keep form open on error
      }
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="button primary">
        Request Feedback
      </button>
    );
  }

  return (
    <div
      className="card"
      style={{
        borderLeft: "4px solid var(--ypp-purple)",
        marginBottom: 24,
      }}
    >
      <h3 style={{ margin: "0 0 16px" }}>Request Mentor Feedback</h3>
      <form action={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13 }}>
            Passion Area *
          </label>
          <select
            name="passionId"
            required
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid var(--border-color)",
              borderRadius: 6,
            }}
          >
            <option value="">Select area</option>
            <option value="visual-arts">Visual Arts</option>
            <option value="music">Music</option>
            <option value="sports">Sports</option>
            <option value="writing">Writing</option>
            <option value="dance">Dance</option>
            <option value="theater">Theater</option>
            <option value="coding">Coding</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13 }}>
            What would you like feedback on? *
          </label>
          <textarea
            name="question"
            required
            rows={3}
            placeholder="Describe your work and what specific feedback you're looking for..."
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid var(--border-color)",
              borderRadius: 6,
              fontFamily: "inherit",
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13 }}>
            Link to your work (optional)
          </label>
          <input
            type="url"
            name="mediaUrl"
            placeholder="https://..."
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid var(--border-color)",
              borderRadius: 6,
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" className="button primary" disabled={isPending}>
            {isPending ? "Submitting..." : "Submit Request"}
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mentor: Respond to Request
// ---------------------------------------------------------------------------

export function RespondForm({ requestId }: { requestId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await respondToFeedback(formData);
        setOpen(false);
      } catch {
        // keep form open
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="button primary small"
        style={{ marginTop: 8 }}
      >
        Write Response
      </button>
    );
  }

  return (
    <form action={handleSubmit} style={{ marginTop: 12 }}>
      <input type="hidden" name="requestId" value={requestId} />
      <textarea
        name="feedback"
        required
        rows={3}
        placeholder="Share your feedback, suggestions, and encouragement..."
        style={{
          width: "100%",
          padding: "8px 12px",
          border: "1px solid var(--border-color)",
          borderRadius: 6,
          fontFamily: "inherit",
          marginBottom: 8,
        }}
      />
      <input
        type="url"
        name="resourceUrl"
        placeholder="Helpful resource link (optional)"
        style={{
          width: "100%",
          padding: "8px 12px",
          border: "1px solid var(--border-color)",
          borderRadius: 6,
          marginBottom: 8,
        }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="button primary small" disabled={isPending}>
          {isPending ? "Sending..." : "Send Feedback"}
        </button>
        <button
          type="button"
          className="button secondary small"
          onClick={() => setOpen(false)}
          disabled={isPending}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Helpful Button
// ---------------------------------------------------------------------------

export function HelpfulButton({ responseId }: { responseId: string }) {
  const [marked, setMarked] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await markResponseHelpful(responseId);
      setMarked(true);
    });
  }

  if (marked) {
    return (
      <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>
        Marked helpful
      </span>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        fontSize: 12,
        color: "var(--text-secondary)",
        padding: "2px 4px",
      }}
    >
      {isPending ? "..." : "Mark as helpful"}
    </button>
  );
}
