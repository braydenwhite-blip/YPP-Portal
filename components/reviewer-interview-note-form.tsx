"use client";

import { useState, useRef } from "react";
import InterviewNoteTemplates from "./interview-note-templates";

interface ReviewerInterviewNoteFormProps {
  applicationId: string;
  disabled: boolean;
  action: (formData: FormData) => void;
}

export default function ReviewerInterviewNoteForm({
  applicationId,
  disabled,
  action,
}: ReviewerInterviewNoteFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [content, setContent] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [rating, setRating] = useState("");

  function applyTemplate(tpl: { content: string; recommendation: string; rating: string }) {
    setContent(tpl.content);
    setRecommendation(tpl.recommendation);
    setRating(tpl.rating);
  }

  return (
    <form ref={formRef} action={action} className="form-grid">
      <input type="hidden" name="applicationId" value={applicationId} />

      <div className="form-row">
        <label>Interview Note Summary</label>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>
          Summarize the candidate&#39;s responses, communication signals, and overall takeaways.
        </p>
        <InterviewNoteTemplates onApply={applyTemplate} disabled={disabled} />
        <textarea
          name="content"
          className="input"
          rows={4}
          placeholder="Candidate summary, communication signals, and overall interview takeaways..."
          required
          disabled={disabled}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>

      <div className="grid two">
        <label className="form-row">
          Recommendation
          <select
            name="recommendation"
            className="input"
            disabled={disabled}
            value={recommendation}
            onChange={(e) => setRecommendation(e.target.value)}
          >
            <option value="">No recommendation yet</option>
            <option value="STRONG_YES">Strong Yes</option>
            <option value="YES">Yes</option>
            <option value="MAYBE">Maybe</option>
            <option value="NO">No</option>
          </select>
        </label>
        <label className="form-row">
          Rating (optional)
          <select
            name="rating"
            className="input"
            disabled={disabled}
            value={rating}
            onChange={(e) => setRating(e.target.value)}
          >
            <option value="">No rating</option>
            {[1, 2, 3, 4, 5].map((r) => (
              <option key={r} value={r}>
                {r}/5
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="form-row">
        Strengths
        <textarea
          name="strengths"
          className="input"
          rows={3}
          placeholder="Observable strengths from interview responses..."
          disabled={disabled}
        />
      </label>

      <label className="form-row">
        Concerns
        <textarea
          name="concerns"
          className="input"
          rows={3}
          placeholder="Risks, skill gaps, or follow-up concerns..."
          disabled={disabled}
        />
      </label>

      <label className="form-row">
        Next Step Suggestion
        <textarea
          name="nextStepSuggestion"
          className="input"
          rows={2}
          placeholder="Recommend next action for candidate and hiring team..."
          disabled={disabled}
        />
      </label>

      <button type="submit" className="button small" disabled={disabled}>
        Save Structured Interview Note
      </button>
    </form>
  );
}
