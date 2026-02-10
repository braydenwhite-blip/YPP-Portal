"use client";

import { useState } from "react";
import { submitCompetitionEntry, voteOnCompetitionEntry } from "@/lib/challenge-gamification-actions";

export function CompetitionEntryForm({ competitionId }: { competitionId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      formData.set("competitionId", competitionId);
      await submitCompetitionEntry(formData);
      setSubmitted(true);
    } catch (e: any) {
      alert(e.message);
    }
    setLoading(false);
  }

  if (submitted) {
    return (
      <div style={{ padding: 12, background: "#dcfce7", borderRadius: "var(--radius-md)", fontSize: 14, color: "#16a34a", fontWeight: 600 }}>
        Entry submitted! Good luck!
      </div>
    );
  }

  if (!open) {
    return (
      <button className="button primary" onClick={() => setOpen(true)}>
        Submit Entry
      </button>
    );
  }

  return (
    <form action={handleSubmit} style={{ padding: 16, background: "var(--surface-alt)", borderRadius: "var(--radius-md)" }}>
      <h4 style={{ margin: "0 0 12px" }}>Submit Your Entry</h4>
      <div className="form-group">
        <label htmlFor="title">Title *</label>
        <input type="text" id="title" name="title" required placeholder="Name your entry" />
      </div>
      <div className="form-group">
        <label htmlFor="description">Description</label>
        <textarea id="description" name="description" rows={3} placeholder="Tell the judges about your work, your process, and what inspires you..." />
      </div>
      <div className="form-group">
        <label htmlFor="workUrl">Link to your work</label>
        <input type="url" id="workUrl" name="workUrl" placeholder="https://..." />
      </div>
      <div className="form-group">
        <label htmlFor="mediaUrl">Image/video URL</label>
        <input type="url" id="mediaUrl" name="mediaUrl" placeholder="https://..." />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="button primary" disabled={loading}>
          {loading ? "Submitting..." : "Submit Entry"}
        </button>
        <button type="button" className="button secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function CompetitionVoteForm({ entryId }: { entryId: string }) {
  const [loading, setLoading] = useState(false);
  const [voted, setVoted] = useState(false);
  const [selectedScore, setSelectedScore] = useState(0);

  async function handleVote() {
    if (selectedScore === 0) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("entryId", entryId);
      formData.set("score", String(selectedScore));
      await voteOnCompetitionEntry(formData);
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
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((score) => (
        <button
          key={score}
          onClick={() => setSelectedScore(score)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 16,
            color: score <= selectedScore ? "#fbbf24" : "var(--gray-300)",
            padding: 0,
          }}
        >
          &#9733;
        </button>
      ))}
      {selectedScore > 0 && (
        <button
          className="button primary small"
          onClick={handleVote}
          disabled={loading}
          style={{ fontSize: 11, padding: "2px 6px", marginLeft: 4 }}
        >
          {loading ? "..." : "Vote"}
        </button>
      )}
    </div>
  );
}
