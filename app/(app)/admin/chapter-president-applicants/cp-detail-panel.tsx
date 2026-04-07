"use client";

import { useState, useTransition, useEffect } from "react";
import { KanbanDetailPanel, PanelToast, useToast } from "@/components/kanban";
import {
  statusPillClass,
  statusLabel,
  formatDate,
} from "@/components/kanban/kanban-utils";
import type { CPApp, Reviewer } from "./kanban-board";
import {
  saveCPScoresAndNotes,
  assignCPReviewer,
} from "@/lib/cp-application-kanban-actions";
import { reviewCPApplicationAction } from "@/lib/chapter-president-application-actions";

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

/* ── Main Panel ────────────────────────────────────── */

export default function CPDetailPanel({
  app,
  reviewers,
  onClose,
  onUpdate,
}: {
  app: CPApp;
  reviewers: Reviewer[];
  onClose: () => void;
  onUpdate: (updated: Partial<CPApp> & { id: string }) => void;
}) {
  const [scores, setScores] = useState({
    scoreLeadership: app.scoreLeadership,
    scoreVision: app.scoreVision,
    scoreOrganization: app.scoreOrganization,
    scoreCommitment: app.scoreCommitment,
    scoreFit: app.scoreFit,
  });
  const [notes, setNotes] = useState(app.reviewerNotes || "");
  const [selectedReviewer, setSelectedReviewer] = useState(app.reviewerId || "");
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();
  const toast = useToast();

  // Reset local state when app changes
  useEffect(() => {
    setScores({
      scoreLeadership: app.scoreLeadership,
      scoreVision: app.scoreVision,
      scoreOrganization: app.scoreOrganization,
      scoreCommitment: app.scoreCommitment,
      scoreFit: app.scoreFit,
    });
    setNotes(app.reviewerNotes || "");
    setSelectedReviewer(app.reviewerId || "");
  }, [app.id, app.scoreLeadership, app.scoreVision, app.scoreOrganization, app.scoreCommitment, app.scoreFit, app.reviewerNotes, app.reviewerId]);

  // Save scores & notes
  async function handleSaveScores() {
    setSaving(true);
    const result = await saveCPScoresAndNotes(app.id, { ...scores, reviewerNotes: notes });
    if (result.success) {
      onUpdate({ id: app.id, ...scores, reviewerNotes: notes });
      toast.show("Scores saved");
    } else {
      toast.show(result.error || "Failed to save");
    }
    setSaving(false);
  }

  // Save reviewer
  async function handleAssignReviewer(reviewerId: string) {
    setSelectedReviewer(reviewerId);
    const reviewer = reviewers.find((r) => r.id === reviewerId);
    onUpdate({ id: app.id, reviewerId, reviewer: reviewer ? { name: reviewer.name } : null });
    startTransition(async () => {
      const result = await assignCPReviewer(app.id, reviewerId);
      if (!result.success) {
        setSelectedReviewer(app.reviewerId || "");
        onUpdate({ id: app.id, reviewerId: app.reviewerId, reviewer: app.reviewer });
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
    await reviewCPApplicationAction(formData);
    setSaving(false);

    const statusMap: Record<string, string> = {
      mark_under_review: "UNDER_REVIEW",
      approve: "APPROVED",
      reject: "REJECTED",
    };
    if (statusMap[action]) {
      onUpdate({ id: app.id, status: statusMap[action] });
      toast.show(`Status updated to ${statusLabel(statusMap[action])}`);
    } else {
      toast.show("Action completed");
    }
  }

  const displayName = app.legalName || app.applicant.name;
  const isFinal = app.status === "APPROVED" || app.status === "REJECTED";
  const chapterName = app.chapter?.name || app.applicant.chapter?.name;

  return (
    <KanbanDetailPanel
      title={displayName}
      subtitle={
        app.preferredFirstName && app.legalName
          ? `Goes by ${app.preferredFirstName}`
          : undefined
      }
      statusBadge={
        <span className={statusPillClass(app.status)}>{statusLabel(app.status)}</span>
      }
      onClose={onClose}
    >
      <PanelToast message={toast.message} />

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
          {chapterName && (
            <div className="slideout-field">
              <div className="slideout-field-label">Chapter</div>
              <div className="slideout-field-value">{chapterName}</div>
            </div>
          )}
          {!chapterName && (
            <div className="slideout-field">
              <div className="slideout-field-label">Chapter</div>
              <div className="slideout-field-value" style={{ color: "#d97706" }}>
                New Chapter Proposal
              </div>
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
          {app.gpa && (
            <div className="slideout-field">
              <div className="slideout-field-label">GPA</div>
              <div className="slideout-field-value">{app.gpa}</div>
            </div>
          )}
          {app.graduationYear && (
            <div className="slideout-field">
              <div className="slideout-field-label">Graduation</div>
              <div className="slideout-field-value">Class of {app.graduationYear}</div>
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
              <div className="slideout-field-label">Interview</div>
              <div className="slideout-field-value">{formatDate(app.interviewScheduledAt)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Application Materials */}
      <div className="slideout-section">
        <div className="slideout-section-title">Application Materials</div>
        {app.whyChapterPresident && (
          <div className="slideout-field">
            <div className="slideout-field-label">Why Chapter President</div>
            <div className="slideout-field-value">{app.whyChapterPresident}</div>
          </div>
        )}
        <div className="slideout-field">
          <div className="slideout-field-label">Leadership Experience</div>
          <div className="slideout-field-value">{app.leadershipExperience}</div>
        </div>
        <div className="slideout-field">
          <div className="slideout-field-label">Chapter Vision</div>
          <div className="slideout-field-value">{app.chapterVision}</div>
        </div>
        {app.recruitmentPlan && (
          <div className="slideout-field">
            <div className="slideout-field-label">Recruitment Plan</div>
            <div className="slideout-field-value">{app.recruitmentPlan}</div>
          </div>
        )}
        {app.launchPlan && (
          <div className="slideout-field">
            <div className="slideout-field-label">Launch Plan</div>
            <div className="slideout-field-value">{app.launchPlan}</div>
          </div>
        )}
        {app.priorOrganizing && (
          <div className="slideout-field">
            <div className="slideout-field-label">Prior Organizing</div>
            <div className="slideout-field-value">{app.priorOrganizing}</div>
          </div>
        )}
        {app.extracurriculars && (
          <div className="slideout-field">
            <div className="slideout-field-label">Extracurriculars</div>
            <div className="slideout-field-value">{app.extracurriculars}</div>
          </div>
        )}
        {app.specialSkills && (
          <div className="slideout-field">
            <div className="slideout-field-label">Special Skills</div>
            <div className="slideout-field-value">{app.specialSkills}</div>
          </div>
        )}
        <div className="slideout-field">
          <div className="slideout-field-label">Interview Availability</div>
          <div className="slideout-field-value">{app.availability}</div>
        </div>
        {app.preferredStartDate && (
          <div className="slideout-field">
            <div className="slideout-field-label">Preferred Launch Date</div>
            <div className="slideout-field-value">{app.preferredStartDate}</div>
          </div>
        )}
        {app.partnerSchool && (
          <div className="slideout-field">
            <div className="slideout-field-label">Partner School</div>
            <div className="slideout-field-value">{app.partnerSchool}</div>
          </div>
        )}
        {app.referralEmails && (
          <div className="slideout-field">
            <div className="slideout-field-label">Referred Students</div>
            <div className="slideout-field-value">{app.referralEmails}</div>
          </div>
        )}
      </div>

      {/* Custom form responses */}
      {app.customResponses && app.customResponses.length > 0 && (
        <div className="slideout-section">
          <div className="slideout-section-title">Additional Responses</div>
          {app.customResponses.map((resp) => (
            <div key={resp.id} className="slideout-field">
              <div className="slideout-field-label">{resp.field.label}</div>
              <div className="slideout-field-value">{resp.value}</div>
              {resp.fileUrl && (
                <a href={resp.fileUrl} target="_blank" rel="noopener noreferrer" className="link" style={{ fontSize: 12 }}>
                  View uploaded file
                </a>
              )}
            </div>
          ))}
        </div>
      )}

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

      {/* Scoring Rubric */}
      <div className="slideout-section">
        <div className="slideout-section-title">
          Evaluation Scores
          <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, marginLeft: 8, fontSize: 11 }}>
            Click blocks to score, click again to mark &quot;Not Enough Info&quot;
          </span>
        </div>
        <ScoreBar
          label="Leadership"
          value={scores.scoreLeadership}
          onChange={(v) => setScores((s) => ({ ...s, scoreLeadership: v }))}
        />
        <ScoreBar
          label="Vision & Strategy"
          value={scores.scoreVision}
          onChange={(v) => setScores((s) => ({ ...s, scoreVision: v }))}
        />
        <ScoreBar
          label="Organization"
          value={scores.scoreOrganization}
          onChange={(v) => setScores((s) => ({ ...s, scoreOrganization: v }))}
        />
        <ScoreBar
          label="Commitment"
          value={scores.scoreCommitment}
          onChange={(v) => setScores((s) => ({ ...s, scoreCommitment: v }))}
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
            <button
              className="button"
              onClick={() => {
                if (app.status !== "INTERVIEW_COMPLETED") {
                  if (!confirm("This applicant hasn't completed an interview yet. Approve anyway?")) return;
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
    </KanbanDetailPanel>
  );
}
