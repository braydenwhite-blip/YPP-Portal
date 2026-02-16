"use client";

import { useState, useRef } from "react";
import DecisionTemplates from "./decision-templates";

interface ReviewerDecisionFormProps {
  applicationId: string;
  positionTitle: string;
  action: (formData: FormData) => void;
  label: string;
  interviewRequired: boolean;
  canSubmit: boolean;
}

export default function ReviewerDecisionForm({
  applicationId,
  positionTitle,
  action,
  label,
  interviewRequired,
  canSubmit,
}: ReviewerDecisionFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [accepted, setAccepted] = useState("true");
  const [notes, setNotes] = useState("");

  function applyTemplate(tpl: { accepted: string; notes: string }) {
    setAccepted(tpl.accepted);
    setNotes(tpl.notes);
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="section-title">Final Decision ({label})</div>
      {!interviewRequired && (
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 12px" }}>
          No interview required. Make your decision based on the application materials and any notes.
        </p>
      )}
      <DecisionTemplates onApply={applyTemplate} positionTitle={positionTitle} />
      <form ref={formRef} action={action} className="form-grid">
        <input type="hidden" name="applicationId" value={applicationId} />
        <div className="form-row">
          <label>Decision</label>
          <select
            name="accepted"
            className="input"
            value={accepted}
            onChange={(e) => setAccepted(e.target.value)}
          >
            <option value="true">Accept Candidate</option>
            <option value="false">Reject Candidate</option>
          </select>
        </div>
        <div className="form-row">
          <label>Decision Notes</label>
          <textarea
            name="notes"
            className="input"
            rows={4}
            placeholder="Add rationale and follow-up instructions..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <button type="submit" className="button" disabled={!canSubmit}>
          Submit {label} Decision
        </button>
      </form>
    </div>
  );
}
