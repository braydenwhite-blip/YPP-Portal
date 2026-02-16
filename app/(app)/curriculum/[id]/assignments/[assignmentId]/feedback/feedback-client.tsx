"use client";

import { useState } from "react";
import { giveAssignmentFeedback } from "@/lib/assignment-actions";
import { useRouter } from "next/navigation";

export function FeedbackClient({
  submissionId,
  offeringId,
  assignmentId,
}: {
  submissionId: string;
  offeringId: string;
  assignmentId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const formData = new FormData(e.currentTarget);
      formData.set("submissionId", submissionId);

      await giveAssignmentFeedback(formData);
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save feedback");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div style={{ marginTop: 12, padding: "8px 12px", background: "#f0fdf4", color: "#16a34a", borderRadius: 8, fontSize: 13 }}>
        Feedback sent! The student will be notified.
      </div>
    );
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="button secondary"
        style={{ marginTop: 12, fontSize: 13 }}
      >
        Write Feedback
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 12, padding: 16, background: "var(--surface-alt)", borderRadius: "var(--radius-md)" }}>
      {error && (
        <div style={{ padding: "8px 12px", background: "#fef2f2", color: "#dc2626", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Celebratory Note */}
      <div className="form-group">
        <label className="form-label" style={{ color: "#d97706" }}>
          Celebration (what did they do well?)
        </label>
        <textarea
          name="celebratoryNote"
          className="form-input"
          rows={2}
          placeholder="I love how you experimented with mixing techniques! The way you blended those colors was really creative."
        />
      </div>

      {/* Narrative Feedback */}
      <div className="form-group">
        <label className="form-label">Detailed Feedback</label>
        <textarea
          name="instructorFeedback"
          className="form-input"
          rows={3}
          placeholder="Share specific observations about their work..."
        />
      </div>

      {/* Suggestions for Next */}
      <div className="form-group">
        <label className="form-label">For Next Time</label>
        <textarea
          name="suggestionsForNext"
          className="form-input"
          rows={2}
          placeholder="Next time, try adding more contrast to make your focal point stand out..."
        />
      </div>

      {/* Completion Badge */}
      <div className="form-group">
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input type="checkbox" name="awardBadge" value="true" defaultChecked />
          Award Completion Badge
        </label>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="button primary" disabled={loading} style={{ fontSize: 13 }}>
          {loading ? "Sending..." : "Send Feedback"}
        </button>
        <button type="button" className="button secondary" onClick={() => setExpanded(false)} style={{ fontSize: 13 }}>
          Cancel
        </button>
      </div>
    </form>
  );
}
