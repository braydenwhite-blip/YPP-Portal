"use client";

import { useState, useTransition } from "react";
import { submitMentorQuestion, answerMentorQuestion, upvoteMentorAnswer } from "@/lib/mentor-ask-actions";

const PASSION_OPTIONS = [
  { value: "visual-arts", label: "Visual Arts" },
  { value: "music", label: "Music" },
  { value: "sports", label: "Sports" },
  { value: "writing", label: "Writing" },
  { value: "dance", label: "Dance" },
  { value: "theater", label: "Theater" },
  { value: "coding", label: "Coding" },
  { value: "other", label: "Other" },
];

const FIELD_STYLE = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid var(--border-color)",
  borderRadius: 6,
  fontFamily: "inherit",
  fontSize: 14,
} as const;

// ---------------------------------------------------------------------------
// Ask a Question Form
// ---------------------------------------------------------------------------

export function AskQuestionForm() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await submitMentorQuestion(formData);
        setOpen(false);
      } catch {
        // keep form open
      }
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="button primary">
        Ask a Question
      </button>
    );
  }

  return (
    <div className="card" style={{ borderLeft: "4px solid var(--ypp-purple)", marginBottom: 24 }}>
      <h3 style={{ margin: "0 0 16px" }}>Ask the Mentor Community</h3>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13 }}>
            Passion Area (optional)
          </label>
          <select name="passionId" style={FIELD_STYLE}>
            <option value="">Any area</option>
            {PASSION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13 }}>
            Your Question *
          </label>
          <textarea
            name="question"
            required
            rows={3}
            placeholder="What would you like advice on? Be specific so mentors can give you the best answer."
            style={FIELD_STYLE}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" name="isAnonymous" />
            Ask anonymously (your name won&apos;t be shown)
          </label>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" className="button primary" disabled={isPending}>
            {isPending ? "Submitting..." : "Submit Question"}
          </button>
          <button type="button" className="button secondary" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Answer a Question Form (Mentor / Instructor / Admin)
// ---------------------------------------------------------------------------

export function AnswerForm({ questionId }: { questionId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await answerMentorQuestion(formData);
        setOpen(false);
      } catch {
        // keep form open
      }
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="button primary small" style={{ marginTop: 8 }}>
        Answer This Question
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 12 }}>
      <input type="hidden" name="questionId" value={questionId} />
      <textarea
        name="answer"
        required
        rows={3}
        placeholder="Share your knowledge, experience, and encouragement..."
        style={{ ...FIELD_STYLE, marginBottom: 8 }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="button primary small" disabled={isPending}>
          {isPending ? "Posting..." : "Post Answer"}
        </button>
        <button type="button" className="button secondary small" onClick={() => setOpen(false)} disabled={isPending}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Upvote a helpful answer
// ---------------------------------------------------------------------------

export function UpvoteButton({ answerId, currentCount }: { answerId: string; currentCount: number }) {
  const [count, setCount] = useState(currentCount);
  const [voted, setVoted] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (voted) return;
    startTransition(async () => {
      await upvoteMentorAnswer(answerId);
      setCount((c) => c + 1);
      setVoted(true);
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending || voted}
      style={{
        background: voted ? "#f0fdf4" : "none",
        border: "1px solid",
        borderColor: voted ? "#16a34a" : "var(--border)",
        borderRadius: 6,
        cursor: voted ? "default" : "pointer",
        fontSize: 12,
        color: voted ? "#16a34a" : "var(--text-secondary)",
        padding: "3px 8px",
        display: "flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      👍 {count} helpful
    </button>
  );
}
