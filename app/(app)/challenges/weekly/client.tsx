"use client";

import { useState } from "react";
import { submitWeeklyWork, voteForSubmission } from "@/lib/challenge-gamification-actions";

export function WeeklySubmitForm({ challengeId }: { challengeId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      formData.set("challengeId", challengeId);
      await submitWeeklyWork(formData);
      setSubmitted(true);
    } catch (e: any) {
      alert(e.message);
    }
    setLoading(false);
  }

  if (submitted) {
    return (
      <div style={{ padding: 12, background: "#dcfce7", borderRadius: "var(--radius-md)", fontSize: 14, color: "#16a34a", fontWeight: 600 }}>
        Submission received! Good luck!
      </div>
    );
  }

  if (!open) {
    return (
      <button className="button primary" onClick={() => setOpen(true)}>
        Submit My Work
      </button>
    );
  }

  return (
    <form action={handleSubmit} style={{ padding: 16, background: "var(--surface-alt)", borderRadius: "var(--radius-md)" }}>
      <h4 style={{ margin: "0 0 12px" }}>Submit Your Work</h4>
      <div className="form-group">
        <label htmlFor="title">Title *</label>
        <input type="text" id="title" name="title" required placeholder="Name your piece" />
      </div>
      <div className="form-group">
        <label htmlFor="description">Description</label>
        <textarea id="description" name="description" rows={2} placeholder="Tell us about your work..." />
      </div>
      <div className="form-group">
        <label htmlFor="workUrl">Link to work</label>
        <input type="url" id="workUrl" name="workUrl" placeholder="https://..." />
      </div>
      <div className="form-group">
        <label htmlFor="mediaUrl">Image/video URL</label>
        <input type="url" id="mediaUrl" name="mediaUrl" placeholder="https://..." />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="button primary" disabled={loading}>
          {loading ? "Submitting..." : "Submit"}
        </button>
        <button type="button" className="button secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function VoteButton({ submissionId }: { submissionId: string }) {
  const [voted, setVoted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleVote() {
    setLoading(true);
    try {
      await voteForSubmission(submissionId);
      setVoted(true);
    } catch (e: any) {
      alert(e.message);
    }
    setLoading(false);
  }

  if (voted) {
    return <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>Voted!</span>;
  }

  return (
    <button
      className="button secondary small"
      onClick={handleVote}
      disabled={loading}
      style={{ fontSize: 11, padding: "2px 8px" }}
    >
      {loading ? "..." : "Vote"}
    </button>
  );
}
