"use client";

import { useState } from "react";
import { submitAssignmentWork, saveAssignmentDraft } from "@/lib/assignment-actions";
import { useRouter } from "next/navigation";

interface ExistingSubmission {
  workUrl: string;
  workText: string;
  studentReflection: string;
  enjoymentRating: number;
  difficultyRating: number;
  whatWentWell: string;
  whatToImprove: string;
  wouldRecommend: boolean | null;
  status: string;
}

export function SubmissionClient({
  assignmentId,
  offeringId,
  existingSubmission,
  groupId,
}: {
  assignmentId: string;
  offeringId: string;
  existingSubmission: ExistingSubmission | null;
  groupId: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [enjoyment, setEnjoyment] = useState(existingSubmission?.enjoymentRating || 0);
  const [difficulty, setDifficulty] = useState(existingSubmission?.difficultyRating || 0);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const formData = new FormData(e.currentTarget);
      formData.set("assignmentId", assignmentId);
      formData.set("enjoymentRating", String(enjoyment));
      formData.set("difficultyRating", String(difficulty));
      if (groupId) formData.set("groupId", groupId);

      await submitAssignmentWork(formData);
      setSuccess("Submitted! Great job on completing this assignment!");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveDraft(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const formData = new FormData(e.currentTarget);
      formData.set("assignmentId", assignmentId);
      if (groupId) formData.set("groupId", groupId);

      await saveAssignmentDraft(formData);
      setSuccess("Draft saved!");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save draft");
    } finally {
      setSaving(false);
    }
  }

  const isAlreadySubmitted = existingSubmission?.status === "SUBMITTED" || existingSubmission?.status === "FEEDBACK_GIVEN";

  return (
    <form
      onSubmit={handleSubmit}
      style={{ marginTop: 16 }}
    >
      {error && (
        <div style={{ padding: "12px 16px", background: "#fef2f2", color: "#dc2626", borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: "12px 16px", background: "#f0fdf4", color: "#16a34a", borderRadius: 8, marginBottom: 16 }}>
          {success}
        </div>
      )}

      {/* Work Submission */}
      <div className="form-group">
        <label className="form-label">Link to Your Work</label>
        <input
          name="workUrl"
          className="form-input"
          defaultValue={existingSubmission?.workUrl || ""}
          placeholder="https://drive.google.com/... or YouTube link, portfolio, etc."
        />
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
          Google Drive, YouTube, website link — any way you want to share!
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Description / Written Work</label>
        <textarea
          name="workText"
          className="form-input"
          rows={4}
          defaultValue={existingSubmission?.workText || ""}
          placeholder="Describe what you created, your process, or write your response here..."
        />
      </div>

      {/* Self-Reflection Section */}
      <div style={{
        marginTop: 24,
        padding: 20,
        background: "var(--ypp-purple-50)",
        borderRadius: "var(--radius-md)",
      }}>
        <h4 style={{ color: "var(--ypp-purple)", marginBottom: 12 }}>Self-Reflection</h4>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
          Take a moment to reflect on your experience. There are no wrong answers!
        </p>

        <div className="form-group">
          <label className="form-label">What did you learn or discover?</label>
          <textarea
            name="studentReflection"
            className="form-input"
            rows={3}
            defaultValue={existingSubmission?.studentReflection || ""}
            placeholder="What new skills, ideas, or insights did you gain?"
          />
        </div>

        <div className="form-group">
          <label className="form-label">What went well?</label>
          <textarea
            name="whatWentWell"
            className="form-input"
            rows={2}
            defaultValue={existingSubmission?.whatWentWell || ""}
            placeholder="What are you proud of?"
          />
        </div>

        <div className="form-group">
          <label className="form-label">What would you do differently next time?</label>
          <textarea
            name="whatToImprove"
            className="form-input"
            rows={2}
            defaultValue={existingSubmission?.whatToImprove || ""}
            placeholder="Any ideas for improving your approach?"
          />
        </div>

        {/* Enjoyment Rating */}
        <div className="form-group">
          <label className="form-label">How much fun did you have? (1-5)</label>
          <div style={{ display: "flex", gap: 8 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setEnjoyment(n)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  border: "2px solid",
                  cursor: "pointer",
                  fontSize: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  ...(enjoyment >= n
                    ? { background: "var(--ypp-purple)", color: "white", borderColor: "var(--ypp-purple)" }
                    : { background: "white", borderColor: "var(--border)" }),
                }}
              >
                {n <= 2 ? ["😐", "🙂"][n - 1] : n === 3 ? "😊" : n === 4 ? "😄" : "🤩"}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty Rating */}
        <div className="form-group">
          <label className="form-label">How challenging was this? (1-5)</label>
          <div style={{ display: "flex", gap: 8 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setDifficulty(n)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "var(--radius-full)",
                  border: "2px solid",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                  ...(difficulty === n
                    ? { background: "var(--ypp-purple)", color: "white", borderColor: "var(--ypp-purple)" }
                    : { background: "white", borderColor: "var(--border)" }),
                }}
              >
                {["Easy", "Moderate", "Just Right", "Challenging", "Very Hard"][n - 1]}
              </button>
            ))}
          </div>
        </div>

        {/* Would Recommend */}
        <div className="form-group">
          <label className="form-label">Would you recommend this assignment to a classmate?</label>
          <div style={{ display: "flex", gap: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input type="radio" name="wouldRecommend" value="true" defaultChecked={existingSubmission?.wouldRecommend === true} />
              Yes!
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input type="radio" name="wouldRecommend" value="false" defaultChecked={existingSubmission?.wouldRecommend === false} />
              Not really
            </label>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ marginTop: 24, display: "flex", gap: 12, alignItems: "center" }}>
        <button type="submit" className="button primary" disabled={loading}>
          {loading ? "Submitting..." : isAlreadySubmitted ? "Update Submission" : "Submit Work"}
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={saving}
          onClick={(e) => {
            const form = (e.target as HTMLElement).closest("form");
            if (form) handleSaveDraft({ currentTarget: form, preventDefault: () => {} } as React.FormEvent<HTMLFormElement>);
          }}
        >
          {saving ? "Saving..." : "Save Draft"}
        </button>
        {isAlreadySubmitted && (
          <span style={{ fontSize: 13, color: "#16a34a", fontWeight: 600 }}>
            Previously submitted
          </span>
        )}
      </div>
    </form>
  );
}
