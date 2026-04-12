"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import type { InstructorApp, Reviewer } from "./kanban-board";
import {
  reviewInstructorApplicationAction,
  saveDecisionRecommendation,
  assignReviewer,
  setActionDueDate,
  saveScoresAndNotes,
} from "@/lib/instructor-application-actions";

/* ── Score Bar ─────────────────────────────────────── */

function ScoreBar({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="score-bar-row">
      <span className="score-bar-label">{label}</span>
      <div className="score-bar-blocks">
        {[1, 2, 3, 4, 5].map((n) => {
          let cls = "score-bar-block empty";
          if (value != null && n <= value) {
            if (value <= 2) cls = "score-bar-block filled-low";
            else if (value <= 3) cls = "score-bar-block filled-mid";
            else cls = "score-bar-block filled-high";
          }
          return (
            <div
              key={n}
              className={cls}
              onClick={() => {
                // Click same value to clear
                if (value === n) onChange(null);
                else onChange(n);
              }}
              title={`${n}/5 — click to set, click again to clear`}
            />
          );
        })}
      </div>
      <span className="score-bar-value">
        {value != null ? (
          `${value}/5`
        ) : (
          <span className="score-bar-no-info">Not Enough Info</span>
        )}
      </span>
    </div>
  );
}

/* ── Status pill ───────────────────────────────────── */

function statusPillClass(status: string): string {
  switch (status) {
    case "SUBMITTED": return "status-pill submitted";
    case "UNDER_REVIEW": return "status-pill under-review";
    case "INFO_REQUESTED": return "status-pill info-requested";
    case "INTERVIEW_SCHEDULED": return "status-pill interview-scheduled";
    case "INTERVIEW_COMPLETED": return "status-pill interview-completed";
    case "APPROVED": return "status-pill approved";
    case "REJECTED": return "status-pill rejected";
    case "ON_HOLD": return "status-pill on-hold";
    default: return "status-pill";
  }
}

function statusLabel(status: string): string {
  if (status === "INTERVIEW_SCHEDULED") return "Curriculum overview scheduled";
  if (status === "INTERVIEW_COMPLETED") return "Curriculum overview completed";
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ── Deadline formatting ───────────────────────────── */

function formatDeadlineDetail(app: InstructorApp): string | null {
  if (app.actionDueDate) {
    const due = new Date(app.actionDueDate);
    const now = new Date();
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const dateStr = due.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    if (diffDays < 0) return `Action overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? "s" : ""} (was ${dateStr})`;
    if (diffDays === 0) return `Action due today (${dateStr})`;
    return `Action due ${dateStr} (${diffDays} day${diffDays !== 1 ? "s" : ""} from now)`;
  }
  return null;
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ── Recommendation options ─────────────────────────── */

const RECOMMENDATION_OPTIONS = [
  { value: "STRONG_YES", label: "Strong Yes" },
  { value: "YES", label: "Yes" },
  { value: "MAYBE", label: "Maybe / Need More Info" },
  { value: "NO", label: "No" },
];

/* ── Main Panel ────────────────────────────────────── */

export default function ApplicantDetailPanel({
  app,
  reviewers,
  onClose,
  onUpdate,
}: {
  app: InstructorApp;
  reviewers: Reviewer[];
  onClose: () => void;
  onUpdate: (updated: Partial<InstructorApp> & { id: string }) => void;
}) {
  // Local state for editable fields
  const [scores, setScores] = useState({
    scoreAcademic: app.scoreAcademic,
    scoreCommunication: app.scoreCommunication,
    scoreLeadership: app.scoreLeadership,
    scoreMotivation: app.scoreMotivation,
    scoreFit: app.scoreFit,
  });
  const [notes, setNotes] = useState(app.reviewerNotes || "");
  const [recommendation, setRecommendation] = useState(app.decisionRecommendation || "");
  const [dueDate, setDueDate] = useState(app.actionDueDate ? app.actionDueDate.slice(0, 10) : "");
  const [selectedReviewer, setSelectedReviewer] = useState(app.reviewerId || "");
  const [saving, setSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset local state when app changes
  useEffect(() => {
    setScores({
      scoreAcademic: app.scoreAcademic,
      scoreCommunication: app.scoreCommunication,
      scoreLeadership: app.scoreLeadership,
      scoreMotivation: app.scoreMotivation,
      scoreFit: app.scoreFit,
    });
    setNotes(app.reviewerNotes || "");
    setRecommendation(app.decisionRecommendation || "");
    setDueDate(app.actionDueDate ? app.actionDueDate.slice(0, 10) : "");
    setSelectedReviewer(app.reviewerId || "");
    setActionMessage(null);
  }, [app.id, app.scoreAcademic, app.scoreCommunication, app.scoreLeadership, app.scoreMotivation, app.scoreFit, app.reviewerNotes, app.decisionRecommendation, app.actionDueDate, app.reviewerId]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const showMessage = useCallback((msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3000);
  }, []);

  // Save scores & notes
  async function handleSaveScores() {
    setSaving(true);
    const result = await saveScoresAndNotes(app.id, { ...scores, reviewerNotes: notes });
    if (result.success) {
      onUpdate({ id: app.id, ...scores, reviewerNotes: notes });
      showMessage("Scores saved");
    } else {
      showMessage(result.error || "Failed to save");
    }
    setSaving(false);
  }

  // Save recommendation
  async function handleSaveRecommendation(rec: string) {
    setRecommendation(rec);
    onUpdate({ id: app.id, decisionRecommendation: rec });
    startTransition(async () => {
      const result = await saveDecisionRecommendation(app.id, rec);
      if (!result.success) {
        setRecommendation(app.decisionRecommendation || "");
        onUpdate({ id: app.id, decisionRecommendation: app.decisionRecommendation });
      }
    });
  }

  // Save reviewer
  async function handleAssignReviewer(reviewerId: string) {
    setSelectedReviewer(reviewerId);
    const reviewer = reviewers.find((r) => r.id === reviewerId);
    onUpdate({ id: app.id, reviewerId, reviewer: reviewer ? { name: reviewer.name } : null });
    startTransition(async () => {
      const result = await assignReviewer(app.id, reviewerId);
      if (!result.success) {
        setSelectedReviewer(app.reviewerId || "");
        onUpdate({ id: app.id, reviewerId: app.reviewerId, reviewer: app.reviewer });
      }
    });
  }

  // Save due date
  async function handleSetDueDate(date: string) {
    setDueDate(date);
    onUpdate({ id: app.id, actionDueDate: date || null });
    startTransition(async () => {
      const result = await setActionDueDate(app.id, date || null);
      if (!result.success) {
        setDueDate(app.actionDueDate ? app.actionDueDate.slice(0, 10) : "");
        onUpdate({ id: app.id, actionDueDate: app.actionDueDate });
      }
    });
  }

  // Quick actions (status changes via form)
  async function handleAction(action: string, extraData?: Record<string, string>) {
    const formData = new FormData();
    formData.set("applicationId", app.id);
    formData.set("action", action);
    if (extraData) {
      for (const [k, v] of Object.entries(extraData)) {
        formData.set(k, v);
      }
    }
    setSaving(true);
    await reviewInstructorApplicationAction(formData);
    setSaving(false);

    // Map action to new status for optimistic update
    const statusMap: Record<string, string> = {
      mark_under_review: "UNDER_REVIEW",
      put_on_hold: "ON_HOLD",
      resume_from_hold: "UNDER_REVIEW",
      approve: "APPROVED",
      reject: "REJECTED",
    };
    if (statusMap[action]) {
      onUpdate({ id: app.id, status: statusMap[action] });
      showMessage(`Status updated to ${statusLabel(statusMap[action])}`);
    } else {
      showMessage("Action completed");
    }
  }

  const displayName = app.legalName || app.applicant.name;
  const deadlineText = formatDeadlineDetail(app);
  const isFinal = app.status === "APPROVED" || app.status === "REJECTED";

  return (
    <>
      {/* Backdrop */}
      <div className="slideout-backdrop" onClick={onClose} />

      {/* Panel */}
      <div className="slideout-panel">
        {/* Header */}
        <div className="slideout-header">
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>{displayName}</h2>
            {app.preferredFirstName && app.legalName && (
              <span style={{ fontSize: 13, color: "var(--muted)" }}>
                Goes by {app.preferredFirstName}
              </span>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <span className={statusPillClass(app.status)}>{statusLabel(app.status)}</span>
              {deadlineText && (
                <span style={{ fontSize: 12, color: app.actionDueDate && new Date(app.actionDueDate) < new Date() ? "#dc2626" : "var(--muted)" }}>
                  {deadlineText}
                </span>
              )}
            </div>
          </div>
          <button className="slideout-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        {/* Toast message */}
        {actionMessage && (
          <div style={{ padding: "8px 24px", background: "#f0fdf4", color: "#16a34a", fontSize: 13, fontWeight: 500, borderBottom: "1px solid #bbf7d0" }}>
            {actionMessage}
          </div>
        )}

        <div className="slideout-body">
          {/* Contact & Background */}
          <div className="slideout-section">
            <div className="slideout-section-title">Contact & Background</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
              <div className="slideout-field">
                <div className="slideout-field-label">Email</div>
                <div className="slideout-field-value">{app.applicant.email}</div>
              </div>
              {app.phoneNumber && (
                <div className="slideout-field">
                  <div className="slideout-field-label">Phone</div>
                  <div className="slideout-field-value">{app.phoneNumber}</div>
                </div>
              )}
              {app.applicant.chapter && (
                <div className="slideout-field">
                  <div className="slideout-field-label">Chapter</div>
                  <div className="slideout-field-value">{app.applicant.chapter.name}</div>
                </div>
              )}
              {(app.city || app.stateProvince) && (
                <div className="slideout-field">
                  <div className="slideout-field-label">Location</div>
                  <div className="slideout-field-value">
                    {[app.city, app.stateProvince, app.country].filter(Boolean).join(", ")}
                  </div>
                </div>
              )}
              {app.schoolName && (
                <div className="slideout-field">
                  <div className="slideout-field-label">School</div>
                  <div className="slideout-field-value">{app.schoolName}</div>
                </div>
              )}
              {app.graduationYear && (
                <div className="slideout-field">
                  <div className="slideout-field-label">Graduation</div>
                  <div className="slideout-field-value">Class of {app.graduationYear}</div>
                </div>
              )}
              {app.gpa && (
                <div className="slideout-field">
                  <div className="slideout-field-label">GPA</div>
                  <div className="slideout-field-value">{app.gpa}</div>
                </div>
              )}
              {app.hoursPerWeek && (
                <div className="slideout-field">
                  <div className="slideout-field-label">Availability</div>
                  <div className="slideout-field-value">{app.hoursPerWeek}h/week</div>
                </div>
              )}
              <div className="slideout-field">
                <div className="slideout-field-label">Applied</div>
                <div className="slideout-field-value">{formatDate(app.createdAt)}</div>
              </div>
              {app.interviewScheduledAt && (
                <div className="slideout-field">
                  <div className="slideout-field-label">Curriculum overview</div>
                  <div className="slideout-field-value">{formatDate(app.interviewScheduledAt)}</div>
                </div>
              )}
            </div>
          </div>

          {/* Application Materials */}
          <div className="slideout-section">
            <div className="slideout-section-title">Application Materials</div>
            <div className="slideout-field">
              <div className="slideout-field-label">Teaching Experience</div>
              <div className="slideout-field-value">{app.teachingExperience}</div>
            </div>
            {app.motivationVideoUrl && (
              <div className="slideout-field">
                <div className="slideout-field-label">Teaching Approach Video</div>
                <div className="slideout-field-value">
                  <a href={app.motivationVideoUrl} target="_blank" rel="noopener noreferrer" className="link">
                    Watch Video
                  </a>
                </div>
              </div>
            )}
            {app.motivation && !app.motivationVideoUrl && (
              <div className="slideout-field">
                <div className="slideout-field-label">Teaching Approach</div>
                <div className="slideout-field-value">{app.motivation}</div>
              </div>
            )}
            {app.subjectsOfInterest && (
              <div className="slideout-field">
                <div className="slideout-field-label">Subjects of Interest</div>
                <div className="slideout-field-value">{app.subjectsOfInterest}</div>
              </div>
            )}
            <div className="slideout-field">
              <div className="slideout-field-label">Curriculum overview availability</div>
              <div className="slideout-field-value">{app.availability}</div>
            </div>
            {app.preferredStartDate && (
              <div className="slideout-field">
                <div className="slideout-field-label">Preferred Start Date</div>
                <div className="slideout-field-value">{app.preferredStartDate}</div>
              </div>
            )}
            {app.referralEmails && (
              <div className="slideout-field">
                <div className="slideout-field-label">Referred Students</div>
                <div className="slideout-field-value">{app.referralEmails}</div>
              </div>
            )}
          </div>

          {/* Info Request / Response history */}
          {(app.infoRequest || app.applicantResponse) && (
            <div className="slideout-section">
              <div className="slideout-section-title">Info Request History</div>
              {app.infoRequest && (
                <div className="info-block">
                  <div className="info-block-label">Info Requested</div>
                  <div className="info-block-value">{app.infoRequest}</div>
                </div>
              )}
              {app.applicantResponse && (
                <div className="info-block">
                  <div className="info-block-label">Applicant Response</div>
                  <div className="info-block-value">{app.applicantResponse}</div>
                </div>
              )}
            </div>
          )}

          {app.rejectionReason && (
            <div className="slideout-section">
              <div className="info-block" style={{ background: "#fef2f2" }}>
                <div className="info-block-label" style={{ color: "#dc2626" }}>Rejection Reason</div>
                <div className="info-block-value">{app.rejectionReason}</div>
              </div>
            </div>
          )}

          {/* Reviewer Assignment */}
          <div className="slideout-section">
            <div className="slideout-section-title">Reviewer Assignment</div>
            <select
              className="input"
              value={selectedReviewer}
              onChange={(e) => handleAssignReviewer(e.target.value)}
              style={{ maxWidth: 300, marginBottom: 0 }}
              disabled={isFinal}
            >
              <option value="">Unassigned</option>
              {reviewers.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* Action Due Date */}
          <div className="slideout-section">
            <div className="slideout-section-title">Action Due Date</div>
            <input
              type="date"
              className="input"
              value={dueDate}
              onChange={(e) => handleSetDueDate(e.target.value)}
              style={{ maxWidth: 200, marginBottom: 0 }}
              disabled={isFinal}
            />
            {dueDate && (
              <button
                className="button secondary"
                onClick={() => handleSetDueDate("")}
                style={{ fontSize: 11, marginLeft: 8, padding: "4px 10px" }}
                disabled={isFinal}
              >
                Clear
              </button>
            )}
          </div>

          {/* Scoring Rubric */}
          <div className="slideout-section">
            <div className="slideout-section-title">
              Evaluation Scores
              <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, marginLeft: 8, fontSize: 11 }}>
                Click blocks to score, click again to mark "Not Enough Info"
              </span>
            </div>
            <ScoreBar
              label="Academic Standing"
              value={scores.scoreAcademic}
              onChange={(v) => setScores((s) => ({ ...s, scoreAcademic: v }))}
            />
            <ScoreBar
              label="Communication"
              value={scores.scoreCommunication}
              onChange={(v) => setScores((s) => ({ ...s, scoreCommunication: v }))}
            />
            <ScoreBar
              label="Leadership"
              value={scores.scoreLeadership}
              onChange={(v) => setScores((s) => ({ ...s, scoreLeadership: v }))}
            />
            <ScoreBar
              label="Motivation"
              value={scores.scoreMotivation}
              onChange={(v) => setScores((s) => ({ ...s, scoreMotivation: v }))}
            />
            <ScoreBar
              label="Cultural Fit"
              value={scores.scoreFit}
              onChange={(v) => setScores((s) => ({ ...s, scoreFit: v }))}
            />
          </div>

          {/* Reviewer Notes */}
          <div className="slideout-section">
            <div className="slideout-section-title">Reviewer Notes</div>
            <textarea
              className="input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Internal notes about this applicant..."
              style={{ marginBottom: 8 }}
              disabled={isFinal}
            />
            <button
              className="button secondary"
              onClick={handleSaveScores}
              disabled={saving || isFinal}
              style={{ fontSize: 12 }}
            >
              {saving ? "Saving..." : "Save Scores & Notes"}
            </button>
          </div>

          {/* Decision Recommendation */}
          <div className="slideout-section">
            <div className="slideout-section-title">Decision Recommendation</div>
            <div className="recommendation-options">
              {RECOMMENDATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`recommendation-option${recommendation === opt.value ? " selected" : ""}`}
                  onClick={() => handleSaveRecommendation(opt.value)}
                  disabled={isFinal}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          {!isFinal && (
            <div className="slideout-section">
              <div className="slideout-section-title">Actions</div>
              <div className="action-bar">
                {app.status === "SUBMITTED" && (
                  <button
                    className="button secondary"
                    onClick={() => handleAction("mark_under_review")}
                    disabled={saving}
                    style={{ fontSize: 12 }}
                  >
                    Begin Review
                  </button>
                )}
                {app.status === "ON_HOLD" && (
                  <button
                    className="button secondary"
                    onClick={() => handleAction("resume_from_hold")}
                    disabled={saving}
                    style={{ fontSize: 12 }}
                  >
                    Resume from Hold
                  </button>
                )}
                {app.status !== "ON_HOLD" && (
                  <button
                    className="button secondary"
                    onClick={() => handleAction("put_on_hold")}
                    disabled={saving}
                    style={{ fontSize: 12, color: "#71717a" }}
                  >
                    Put on Hold
                  </button>
                )}
                <button
                  className="button"
                  onClick={() => {
                    if (app.status !== "INTERVIEW_COMPLETED") {
                      if (
                        !confirm(
                          "This applicant has not completed a curriculum overview session yet. Approve anyway?"
                        )
                      )
                        return;
                    }
                    handleAction("approve");
                  }}
                  disabled={saving}
                  style={{ fontSize: 12, background: "#16a34a" }}
                >
                  Approve
                </button>
                <button
                  className="button"
                  onClick={() => {
                    const reason = prompt("Rejection reason (required):");
                    if (!reason?.trim()) return;
                    handleAction("reject", { reason });
                  }}
                  disabled={saving}
                  style={{ fontSize: 12, background: "#dc2626" }}
                >
                  Reject
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
