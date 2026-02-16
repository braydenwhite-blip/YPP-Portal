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
  isAdmin?: boolean;
}

export default function ReviewerDecisionForm({
  applicationId,
  positionTitle,
  action,
  label,
  interviewRequired,
  canSubmit,
  isAdmin,
}: ReviewerDecisionFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [accepted, setAccepted] = useState("true");
  const [notes, setNotes] = useState("");
  const [skipInterview, setSkipInterview] = useState(false);
  const [overrideJustification, setOverrideJustification] = useState("");

  function applyTemplate(tpl: { accepted: string; notes: string }) {
    setAccepted(tpl.accepted);
    setNotes(tpl.notes);
  }

  const showOverride = isAdmin && interviewRequired && !canSubmit;
  const canActuallySubmit = canSubmit || (skipInterview && overrideJustification.trim().length > 0);

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
        {skipInterview && (
          <>
            <input type="hidden" name="skipInterviewOverride" value="true" />
            <input type="hidden" name="overrideJustification" value={overrideJustification} />
          </>
        )}
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

        {showOverride && (
          <div style={{
            border: "1px solid #fbbf24",
            background: "#fffbeb",
            borderRadius: 8,
            padding: 12,
          }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={skipInterview}
                onChange={(e) => setSkipInterview(e.target.checked)}
              />
              Admin Override: Skip interview requirement
            </label>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#92400e" }}>
              This will bypass the interview completion and recommendation checks. A justification is required and will be logged in the audit trail.
            </p>
            {skipInterview && (
              <div style={{ marginTop: 10 }}>
                <label style={{ fontSize: 12, fontWeight: 500 }}>
                  Justification <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="e.g., Candidate was previously interviewed for another role, exceptional qualifications..."
                  value={overrideJustification}
                  onChange={(e) => setOverrideJustification(e.target.value)}
                  style={{ marginTop: 4 }}
                />
              </div>
            )}
          </div>
        )}

        <button type="submit" className="button" disabled={!canActuallySubmit}>
          Submit {label} Decision
        </button>
      </form>
    </div>
  );
}
