"use client";

import { useState } from "react";
import { createClassAssignment } from "@/lib/assignment-actions";
import { useRouter } from "next/navigation";

export function CreateAssignmentClient({
  offeringId,
  sessions,
}: {
  offeringId: string;
  sessions: { id: string; sessionNumber: number; topic: string }[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [type, setType] = useState("PRACTICE");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const formData = new FormData(e.currentTarget);
      formData.set("offeringId", offeringId);
      formData.set("type", type);

      const result = await createClassAssignment(formData);
      router.push(`/curriculum/${offeringId}/assignments/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create assignment");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ maxWidth: 800 }}>
      {error && (
        <div style={{ padding: "12px 16px", background: "#fef2f2", color: "#dc2626", borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Title */}
        <div className="form-group" style={{ gridColumn: "1 / -1" }}>
          <label className="form-label">Assignment Title *</label>
          <input name="title" className="form-input" required placeholder="e.g., Color Mixing Exploration" />
        </div>

        {/* Description */}
        <div className="form-group" style={{ gridColumn: "1 / -1" }}>
          <label className="form-label">Description *</label>
          <textarea
            name="description"
            className="form-input"
            required
            rows={3}
            placeholder="What will students explore or create? Keep it inspiring!"
          />
        </div>

        {/* Assignment Type */}
        <div className="form-group" style={{ gridColumn: "1 / -1" }}>
          <label className="form-label">Assignment Type *</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { value: "PRACTICE", label: "Practice", desc: "Skill-building exercise" },
              { value: "PROJECT", label: "Project", desc: "Creative project" },
              { value: "EXPLORATION", label: "Exploration", desc: "Open-ended discovery" },
              { value: "GROUP", label: "Group", desc: "Collaborative work" },
              { value: "REFLECTION", label: "Reflection", desc: "Reflective writing" },
            ].map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                  textAlign: "left",
                  ...(type === t.value
                    ? { background: "var(--ypp-purple)", color: "white", borderColor: "var(--ypp-purple)" }
                    : { background: "var(--surface)" }),
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 14 }}>{t.label}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Feedback Style */}
        <div className="form-group">
          <label className="form-label">Feedback Style</label>
          <select name="feedbackStyle" className="form-input">
            <option value="NARRATIVE">Narrative (written feedback)</option>
            <option value="CHECKLIST">Checklist (skills demonstrated)</option>
            <option value="VIDEO">Video feedback</option>
            <option value="PEER_REVIEW">Peer review</option>
          </select>
        </div>

        {/* Grading Style */}
        <div className="form-group">
          <label className="form-label">Grading Approach</label>
          <select name="gradingStyle" className="form-input">
            <option value="FEEDBACK_ONLY">Feedback Only (no score)</option>
            <option value="COMPLETION">Completion Only (done/not done)</option>
            <option value="OPTIONAL_GRADE">Optional Grade (student opts in)</option>
          </select>
        </div>

        {/* Suggested Due Date */}
        <div className="form-group">
          <label className="form-label">Suggested Due Date</label>
          <input name="suggestedDueDate" type="date" className="form-input" />
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
            &quot;Aim to complete by...&quot; — not a hard deadline
          </div>
        </div>

        {/* Hard Deadline (optional) */}
        <div className="form-group">
          <label className="form-label">Hard Deadline (optional)</label>
          <input name="hardDeadline" type="date" className="form-input" />
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
            Only use for truly time-sensitive assignments
          </div>
        </div>

        {/* Tie to Session */}
        {sessions.length > 0 && (
          <div className="form-group">
            <label className="form-label">Linked Session (optional)</label>
            <select name="sessionId" className="form-input">
              <option value="">Not linked to a session</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  Session {s.sessionNumber}: {s.topic}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Instructions */}
        <div className="form-group" style={{ gridColumn: "1 / -1" }}>
          <label className="form-label">Detailed Instructions</label>
          <textarea
            name="instructions"
            className="form-input"
            rows={4}
            placeholder="Step-by-step guidance for students..."
          />
        </div>

        {/* Encouragement Note */}
        <div className="form-group" style={{ gridColumn: "1 / -1" }}>
          <label className="form-label">Encouragement Note</label>
          <textarea
            name="encouragementNote"
            className="form-input"
            rows={2}
            placeholder="e.g., Don't worry about making it perfect — focus on having fun and trying new things!"
          />
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
            This message will appear on the assignment to motivate students
          </div>
        </div>

        {/* Reference Links */}
        <div className="form-group" style={{ gridColumn: "1 / -1" }}>
          <label className="form-label">Reference Links (one per line)</label>
          <textarea
            name="referenceLinks"
            className="form-input"
            rows={2}
            placeholder={"https://example.com/tutorial\nhttps://youtube.com/helpful-video"}
          />
        </div>

        {/* Example Work */}
        <div className="form-group" style={{ gridColumn: "1 / -1" }}>
          <label className="form-label">Example Work URLs (one per line)</label>
          <textarea
            name="exampleWorkUrls"
            className="form-input"
            rows={2}
            placeholder="Links to examples of what good submissions look like"
          />
        </div>

        {/* Group Settings */}
        {type === "GROUP" && (
          <>
            <div className="form-group">
              <label className="form-label">Suggested Group Size</label>
              <input name="groupSize" type="number" className="form-input" min={2} max={10} defaultValue={3} />
            </div>
            <div className="form-group">
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginTop: 24 }}>
                <input type="checkbox" name="allowSelfSelect" value="true" defaultChecked />
                Allow students to form their own groups
              </label>
            </div>
          </>
        )}

        {/* Attachment */}
        <div className="form-group" style={{ gridColumn: "1 / -1" }}>
          <label className="form-label">Attachment URL (optional)</label>
          <input name="attachmentUrl" className="form-input" placeholder="https://drive.google.com/..." />
        </div>
      </div>

      <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
        <button type="submit" className="button primary" disabled={loading}>
          {loading ? "Creating..." : "Create Assignment"}
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => router.push(`/curriculum/${offeringId}/assignments`)}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
