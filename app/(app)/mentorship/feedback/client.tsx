"use client";

import { useState, useTransition } from "react";

import { FieldLabel } from "@/components/field-help";
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
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--muted)" }}>
        Use this for private, personalized feedback on a real piece of work. The clearer your request is, the better the response will be.
      </p>
      <form action={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 6 }}>
            <FieldLabel
              label="Passion Area"
              required
              help={{
                title: "Passion Area",
                guidance:
                  "This tells mentors what subject area your request belongs to so the right people can respond.",
                example: "Choose Coding for app, website, or software work.",
              }}
            />
          </div>
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
          <div style={{ marginBottom: 6 }}>
            <FieldLabel
              label="What would you like feedback on?"
              required
              help={{
                title: "What Would You Like Feedback On?",
                guidance:
                  "Describe the work and the kind of help you want so mentors know what to focus on.",
                example:
                  "Please review my pitch deck opening and tell me if the story is clear and persuasive.",
              }}
            />
          </div>
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
          <div style={{ marginBottom: 6 }}>
            <FieldLabel
              label="Link to your work (optional)"
              help={{
                title: "Link To Your Work",
                guidance:
                  "Add a URL to the thing you want reviewed so the mentor can see the actual work, not only your description of it.",
                example: "A Google Doc, slide deck, video, portfolio page, or shared file link.",
              }}
            />
          </div>
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
      <div style={{ marginBottom: 6 }}>
        <FieldLabel
          label="Response"
          required
          help={{
            title: "Response",
            guidance:
              "Write the actual feedback here. Aim for something supportive, specific, and usable.",
            example:
              "Your concept is strong. Tighten the opening, show one concrete example, and simplify slide three.",
          }}
        />
      </div>
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
      <div style={{ marginBottom: 6 }}>
        <FieldLabel
          label="Helpful resource link (optional)"
          help={{
            title: "Helpful Resource Link",
            guidance:
              "Add a link when a template, example, or tutorial would help the student act on your feedback.",
            example: "A checklist, reference example, or how-to article that matches your advice.",
          }}
        />
      </div>
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
