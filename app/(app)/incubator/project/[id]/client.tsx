"use client";

import { useState } from "react";
import {
  advancePhase,
  postUpdate,
  submitPitchFeedback,
  updateProjectShowcase,
} from "@/lib/incubator-actions";

const PHASE_LABELS: Record<string, string> = {
  IDEATION: "Ideation", PLANNING: "Planning", BUILDING: "Building",
  FEEDBACK: "Feedback", POLISHING: "Polishing", SHOWCASE: "Showcase",
};

export function AdvancePhaseButton({ projectId, nextPhase }: { projectId: string; nextPhase: string }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleAdvance() {
    if (!confirm(`Move to ${PHASE_LABELS[nextPhase]} phase? Make sure you've completed your current phase work.`)) return;
    setLoading(true);
    try {
      await advancePhase(projectId);
      setDone(true);
      window.location.reload();
    } catch {}
    setLoading(false);
  }

  if (done) return <span style={{ color: "#16a34a", fontWeight: 600, fontSize: 13 }}>Advanced!</span>;

  return (
    <button onClick={handleAdvance} disabled={loading} className="button primary small">
      {loading ? "..." : `Advance to ${PHASE_LABELS[nextPhase]}`}
    </button>
  );
}

export function PostUpdateForm({ projectId, currentPhase }: { projectId: string; currentPhase: string }) {
  const [posted, setPosted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    try {
      await postUpdate(projectId, formData);
      setPosted(true);
      setTimeout(() => window.location.reload(), 500);
    } catch (e: any) {
      setError(e.message || "Failed to post");
    }
  }

  if (posted) {
    return (
      <div style={{ padding: 12, background: "#dcfce7", color: "#16a34a", borderRadius: 8, fontSize: 13 }}>
        Update posted! +10 XP
      </div>
    );
  }

  return (
    <form action={handleSubmit}>
      {error && (
        <div style={{ background: "#fee2e2", color: "#dc2626", padding: 8, borderRadius: 6, marginBottom: 8, fontSize: 12 }}>
          {error}
        </div>
      )}
      <div style={{ marginBottom: 10 }}>
        <input
          name="title"
          required
          placeholder="Update title (e.g., 'Finished first prototype')"
          className="input"
          style={{ width: "100%" }}
        />
      </div>
      <div style={{ marginBottom: 10 }}>
        <textarea
          name="content"
          required
          rows={3}
          placeholder="What did you work on? What progress did you make? Any challenges?"
          className="input"
          style={{ width: "100%", resize: "vertical" }}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <input
          name="hoursSpent"
          type="number"
          step="0.5"
          min="0"
          placeholder="Hours spent (optional)"
          className="input"
          style={{ width: "100%" }}
        />
        <input
          name="mediaUrls"
          placeholder="Links to photos/videos (comma-separated)"
          className="input"
          style={{ width: "100%" }}
        />
      </div>
      <button type="submit" className="button primary small">Post Update</button>
    </form>
  );
}

export function PitchFeedbackForm({ projectId }: { projectId: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    try {
      await submitPitchFeedback(projectId, formData);
      setSubmitted(true);
    } catch (e: any) {
      setError(e.message || "Failed to submit");
    }
  }

  if (submitted) {
    return (
      <div style={{ padding: 12, background: "#dcfce7", color: "#16a34a", borderRadius: 8, fontSize: 13 }}>
        Feedback submitted!
      </div>
    );
  }

  return (
    <form action={handleSubmit}>
      {error && (
        <div style={{ background: "#fee2e2", color: "#dc2626", padding: 8, borderRadius: 6, marginBottom: 8, fontSize: 12 }}>
          {error}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 10 }}>
        {[
          { name: "clarityScore", label: "Clarity" },
          { name: "passionScore", label: "Passion" },
          { name: "executionScore", label: "Execution" },
          { name: "impactScore", label: "Impact" },
        ].map((field) => (
          <div key={field.name}>
            <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
              {field.label} (1-5)
            </label>
            <select name={field.name} className="input" style={{ width: "100%" }}>
              <option value="">--</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 8 }}>
        <textarea name="strengths" rows={2} placeholder="Strengths - what's great about this project?" className="input" style={{ width: "100%", resize: "vertical" }} />
      </div>
      <div style={{ marginBottom: 8 }}>
        <textarea name="improvements" rows={2} placeholder="Areas to improve" className="input" style={{ width: "100%", resize: "vertical" }} />
      </div>
      <div style={{ marginBottom: 10 }}>
        <textarea name="encouragement" rows={1} placeholder="Words of encouragement" className="input" style={{ width: "100%", resize: "vertical" }} />
      </div>
      <button type="submit" className="button primary small">Submit Feedback</button>
    </form>
  );
}

export function ShowcaseLinksForm({
  projectId,
  initialPitchVideo,
  initialPitchDeck,
  initialShowcase,
}: {
  projectId: string;
  initialPitchVideo: string;
  initialPitchDeck: string;
  initialShowcase: string;
}) {
  const [saved, setSaved] = useState(false);

  async function handleSubmit(formData: FormData) {
    try {
      await updateProjectShowcase(projectId, formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
  }

  return (
    <form action={handleSubmit} style={{ marginTop: 12 }}>
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 11, color: "var(--text-secondary)" }}>Pitch Video URL</label>
        <input name="pitchVideoUrl" defaultValue={initialPitchVideo} placeholder="YouTube or Google Drive link" className="input" style={{ width: "100%" }} />
      </div>
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 11, color: "var(--text-secondary)" }}>Pitch Deck URL</label>
        <input name="pitchDeckUrl" defaultValue={initialPitchDeck} placeholder="Google Slides, Canva, etc." className="input" style={{ width: "100%" }} />
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11, color: "var(--text-secondary)" }}>Final Showcase URL</label>
        <input name="finalShowcaseUrl" defaultValue={initialShowcase} placeholder="Link to your finished project" className="input" style={{ width: "100%" }} />
      </div>
      <button type="submit" className="button primary small">
        {saved ? "Saved!" : "Save Links"}
      </button>
    </form>
  );
}
