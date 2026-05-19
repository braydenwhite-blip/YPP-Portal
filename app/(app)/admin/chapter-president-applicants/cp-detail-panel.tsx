"use client";

import { useState, useTransition, useEffect } from "react";
import { KanbanDetailPanel, PanelToast, useToast } from "@/components/kanban";
import {
  statusPillClass,
  statusLabel,
  formatDate,
  recommendationInfo,
} from "@/components/kanban/kanban-utils";
import type { CPApp, ChapterOption, Reviewer } from "./kanban-board";
import {
  saveCPScoresAndNotes,
  assignCPReviewer,
  assignCPApplicationChapter,
} from "@/lib/cp-application-kanban-actions";
import {
  reviewCPApplicationAction,
  reviewChapterPresidentApplication,
} from "@/lib/chapter-president-application-actions";

/* ── Helpers ───────────────────────────────────────── */

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Convert an ISO timestamp to a `datetime-local` input value in local time. */
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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
  chapters = [],
  onClose,
  onUpdate,
}: {
  app: CPApp;
  reviewers: Reviewer[];
  chapters?: ChapterOption[];
  onClose: () => void;
  onUpdate: (updated: Partial<CPApp> & { id: string }) => void;
}) {
  const initialChapterId = app.chapter?.id || app.chapterId || "";
  const [assignedChapterId, setAssignedChapterId] = useState<string>(initialChapterId);
  const [assigningChapter, setAssigningChapter] = useState(false);
  const [chapterError, setChapterError] = useState<string | null>(null);

  const [scores, setScores] = useState({
    scoreLeadership: app.scoreLeadership,
    scoreVision: app.scoreVision,
    scoreOrganization: app.scoreOrganization,
    scoreCommunication: app.scoreCommunication,
    scoreFit: app.scoreFit,
  });
  const [interviewSummary, setInterviewSummary] = useState(app.interviewSummary || "");
  const [notes, setNotes] = useState(app.reviewerNotes || "");
  const [selectedReviewer, setSelectedReviewer] = useState(app.reviewerId || "");
  const [interviewDate, setInterviewDate] = useState(
    app.interviewScheduledAt ? toDatetimeLocal(app.interviewScheduledAt) : ""
  );
  const [meetingUrl, setMeetingUrl] = useState(app.interviewMeetingUrl || "");
  const [recommendation, setRecommendation] = useState(app.decisionRecommendation || "");
  const [recRationale, setRecRationale] = useState(app.recommendationRationale || "");
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();
  const toast = useToast();

  // Reset local state when app changes
  useEffect(() => {
    setScores({
      scoreLeadership: app.scoreLeadership,
      scoreVision: app.scoreVision,
      scoreOrganization: app.scoreOrganization,
      scoreCommunication: app.scoreCommunication,
      scoreFit: app.scoreFit,
    });
    setInterviewSummary(app.interviewSummary || "");
    setNotes(app.reviewerNotes || "");
    setSelectedReviewer(app.reviewerId || "");
    setInterviewDate(app.interviewScheduledAt ? toDatetimeLocal(app.interviewScheduledAt) : "");
    setMeetingUrl(app.interviewMeetingUrl || "");
    setRecommendation(app.decisionRecommendation || "");
    setRecRationale(app.recommendationRationale || "");
    setAssignedChapterId(app.chapter?.id || app.chapterId || "");
    setChapterError(null);
  }, [app.id, app.scoreLeadership, app.scoreVision, app.scoreOrganization, app.scoreCommunication, app.scoreFit, app.interviewSummary, app.reviewerNotes, app.reviewerId, app.interviewScheduledAt, app.interviewMeetingUrl, app.decisionRecommendation, app.recommendationRationale, app.chapter?.id, app.chapterId]);

  // Save scores & notes
  async function handleSaveScores() {
    setSaving(true);
    const result = await saveCPScoresAndNotes(app.id, { ...scores, interviewSummary, reviewerNotes: notes });
    if (result.success) {
      onUpdate({ id: app.id, ...scores, interviewSummary, reviewerNotes: notes });
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

  // Assign chapter to applicant (admin-only flow; required before approval)
  async function handleAssignChapter(nextChapterId: string) {
    setChapterError(null);
    setAssigningChapter(true);
    const previous = assignedChapterId;
    setAssignedChapterId(nextChapterId);

    const result = await assignCPApplicationChapter(
      app.id,
      nextChapterId === "" ? null : nextChapterId
    );

    if (result.success) {
      const matchedChapter = chapters.find((c) => c.id === nextChapterId);
      onUpdate({
        id: app.id,
        chapterId: nextChapterId === "" ? null : nextChapterId,
        chapter: matchedChapter
          ? { id: matchedChapter.id, name: matchedChapter.name }
          : null,
      });
      toast.show(
        nextChapterId === ""
          ? "Chapter cleared"
          : `Chapter assigned: ${chapters.find((c) => c.id === nextChapterId)?.name ?? ""}`
      );
    } else {
      setAssignedChapterId(previous);
      setChapterError(result.error || "Failed to assign chapter");
    }
    setAssigningChapter(false);
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
      request_info: "INFO_REQUESTED",
      mark_interview_complete: "INTERVIEW_COMPLETED",
      submit_recommendation: "RECOMMENDATION_SUBMITTED",
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

  // Schedule (or reschedule) the interview with an optional meeting link.
  // Calls the action directly so validation errors surface in the toast.
  async function handleScheduleInterview() {
    if (!interviewDate) {
      toast.show("Pick an interview date and time first");
      return;
    }
    const dt = new Date(interviewDate);
    if (isNaN(dt.getTime())) {
      toast.show("Invalid interview date/time");
      return;
    }
    const trimmedUrl = meetingUrl.trim();
    if (trimmedUrl && !/^https?:\/\//i.test(trimmedUrl)) {
      toast.show("Meeting link must start with http:// or https://");
      return;
    }
    const formData = new FormData();
    formData.set("applicationId", app.id);
    formData.set("action", "schedule_interview");
    formData.set("scheduledAt", dt.toISOString());
    if (trimmedUrl) formData.set("meetingUrl", trimmedUrl);

    setSaving(true);
    const result = await reviewChapterPresidentApplication(
      { status: "idle", message: "" },
      formData
    );
    setSaving(false);

    if (result.status === "success") {
      onUpdate({
        id: app.id,
        status: "INTERVIEW_SCHEDULED",
        interviewScheduledAt: dt.toISOString(),
        interviewMeetingUrl: trimmedUrl || null,
      });
      toast.show(app.interviewScheduledAt ? "Interview updated" : "Interview scheduled");
    } else {
      toast.show(result.message || "Failed to schedule interview");
    }
  }

  // Submit the final recommendation that the chair/decision-maker reviews
  // before approving or rejecting.
  async function handleSubmitRecommendation() {
    if (!recommendation) {
      toast.show("Pick a recommendation first");
      return;
    }
    if (!recRationale.trim()) {
      toast.show("Add a short rationale for your recommendation");
      return;
    }
    const formData = new FormData();
    formData.set("applicationId", app.id);
    formData.set("action", "submit_recommendation");
    formData.set("recommendation", recommendation);
    formData.set("recommendationRationale", recRationale.trim());

    setSaving(true);
    const result = await reviewChapterPresidentApplication(
      { status: "idle", message: "" },
      formData
    );
    setSaving(false);

    if (result.status === "success") {
      onUpdate({
        id: app.id,
        status: "RECOMMENDATION_SUBMITTED",
        decisionRecommendation: recommendation,
        recommendationRationale: recRationale.trim(),
      });
      toast.show("Recommendation submitted");
    } else {
      toast.show(result.message || "Failed to submit recommendation");
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
          <div className="slideout-field" style={{ gridColumn: "1 / -1" }}>
            <div className="slideout-field-label">
              Chapter Assignment
              {!assignedChapterId && (
                <span style={{ marginLeft: 8, color: "#d97706", fontWeight: 500 }}>
                  · Required before approval
                </span>
              )}
            </div>
            <select
              className="input"
              value={assignedChapterId}
              onChange={(e) => handleAssignChapter(e.target.value)}
              disabled={assigningChapter || isFinal}
              style={{ maxWidth: 360, marginTop: 4 }}
            >
              <option value="">— No chapter assigned (proposal) —</option>
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.city ? ` — ${c.city}${c.region ? ", " + c.region : ""}` : ""}
                </option>
              ))}
            </select>
            {chapterError && (
              <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>
                {chapterError}
              </div>
            )}
            {!assignedChapterId && chapterName && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                Applicant&apos;s current chapter: <strong>{chapterName}</strong>
              </div>
            )}
            {!assignedChapterId && !chapterName && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                Applicant submitted as a new-chapter proposal. Pick the chapter
                they&apos;ll lead, or create one in{" "}
                <a href="/admin/chapters" className="link">
                  Admin → Chapters
                </a>{" "}
                first.
              </div>
            )}
          </div>
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
        {app.hearAboutYPP && (
          <div className="slideout-field">
            <div className="slideout-field-label">How They Heard About YPP</div>
            <div className="slideout-field-value">{app.hearAboutYPP}</div>
          </div>
        )}
        {app.documentUrl && (
          <div className="slideout-field">
            <div className="slideout-field-label">Supporting Document</div>
            <div className="slideout-field-value">
              <a href={app.documentUrl} target="_blank" rel="noopener noreferrer" className="link">
                View uploaded document
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Instructor Information */}
      {(app.instructorApplicantPosition || app.classInMind || app.instructorTeachingDesc) && (
        <div className="slideout-section">
          <div className="slideout-section-title">Instructor Information</div>
          {app.instructorApplicantPosition && (
            <div className="slideout-field">
              <div className="slideout-field-label">Application Position</div>
              <div className="slideout-field-value">{app.instructorApplicantPosition}</div>
            </div>
          )}
          {app.classInMind && (
            <div className="slideout-field">
              <div className="slideout-field-label">Class in Mind</div>
              <div className="slideout-field-value">{app.classInMind}</div>
            </div>
          )}
          {app.instructorTeachingDesc && (
            <div className="slideout-field">
              <div className="slideout-field-label">Teaching / Empowerment Experience</div>
              <div className="slideout-field-value" style={{ whiteSpace: "pre-wrap" }}>{app.instructorTeachingDesc}</div>
            </div>
          )}
        </div>
      )}

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

      {/* Interview Scheduling */}
      {["SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED", "INTERVIEW_SCHEDULED"].includes(
        app.status
      ) && (
        <div className="slideout-section">
          <div className="slideout-section-title">
            {app.status === "INTERVIEW_SCHEDULED" ? "Interview" : "Schedule Interview"}
          </div>
          {app.availabilityWindows.length > 0 && (
            <div className="slideout-field" style={{ marginBottom: 10 }}>
              <div className="slideout-field-label">Applicant-submitted availability</div>
              <div className="slideout-field-value" style={{ fontSize: 13 }}>
                {app.availabilityWindows.map((w) => (
                  <div key={w.id}>
                    {DOW_LABELS[w.dayOfWeek] ?? "?"} {w.startTime}–{w.endTime} ({w.timezone})
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ marginBottom: 8 }}>
            <div className="slideout-field-label" style={{ marginBottom: 4 }}>
              Interview date &amp; time
            </div>
            <input
              type="datetime-local"
              className="input"
              value={interviewDate}
              onChange={(e) => setInterviewDate(e.target.value)}
              style={{ marginBottom: 0 }}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <div className="slideout-field-label" style={{ marginBottom: 4 }}>
              Meeting link (Zoom / Google Meet) — optional
            </div>
            <input
              type="url"
              className="input"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="https://zoom.us/j/..."
              style={{ marginBottom: 0 }}
            />
          </div>
          <button
            className="button secondary"
            onClick={handleScheduleInterview}
            disabled={saving}
            style={{ fontSize: 12 }}
          >
            {saving
              ? "Saving..."
              : app.status === "INTERVIEW_SCHEDULED"
                ? "Update Interview Time"
                : "Schedule Interview & Notify Applicant"}
          </button>
        </div>
      )}

      {/* Interview Evaluation — scored after the interview */}
      <div className="slideout-section">
        <div className="slideout-section-title">
          Interview Evaluation
          <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, marginLeft: 8, fontSize: 11 }}>
            Click blocks to score · click again to clear
          </span>
        </div>
        <ScoreBar
          label="Communication & Presentation"
          value={scores.scoreCommunication}
          onChange={(v) => setScores((s) => ({ ...s, scoreCommunication: v }))}
        />
        <ScoreBar
          label="Leadership Presence"
          value={scores.scoreLeadership}
          onChange={(v) => setScores((s) => ({ ...s, scoreLeadership: v }))}
        />
        <ScoreBar
          label="Professionalism & Preparation"
          value={scores.scoreOrganization}
          onChange={(v) => setScores((s) => ({ ...s, scoreOrganization: v }))}
        />
        <ScoreBar
          label="Passion for YPP&apos;s Mission"
          value={scores.scoreVision}
          onChange={(v) => setScores((s) => ({ ...s, scoreVision: v }))}
        />
        <ScoreBar
          label="Cultural Fit"
          value={scores.scoreFit}
          onChange={(v) => setScores((s) => ({ ...s, scoreFit: v }))}
        />
        <div style={{ marginTop: 12 }}>
          <div className="slideout-field-label" style={{ marginBottom: 4 }}>Interview Summary</div>
          <textarea
            className="input"
            value={interviewSummary}
            onChange={(e) => setInterviewSummary(e.target.value)}
            rows={3}
            placeholder="Overall takeaway from the interview — key signals, standout moments..."
            style={{ marginBottom: 0 }}
            disabled={isFinal}
          />
        </div>
      </div>

      {/* Reviewer Notes */}
      <div className="slideout-section">
        <div className="slideout-section-title">Internal Notes</div>
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

      {/* Final Recommendation */}
      {["INTERVIEW_COMPLETED", "RECOMMENDATION_SUBMITTED", "APPROVED", "REJECTED"].includes(
        app.status
      ) && (
        <div className="slideout-section">
          <div className="slideout-section-title">Final Recommendation</div>
          {app.status === "INTERVIEW_COMPLETED" ? (
            <>
              <div style={{ marginBottom: 8 }}>
                <div className="slideout-field-label" style={{ marginBottom: 4 }}>
                  Recommendation
                </div>
                <select
                  className="input"
                  value={recommendation}
                  onChange={(e) => setRecommendation(e.target.value)}
                  style={{ marginBottom: 0 }}
                >
                  <option value="">Select a recommendation…</option>
                  <option value="STRONG_YES">Strong Yes</option>
                  <option value="YES">Yes</option>
                  <option value="MAYBE">Maybe</option>
                  <option value="NO">No</option>
                </select>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div className="slideout-field-label" style={{ marginBottom: 4 }}>
                  Rationale
                </div>
                <textarea
                  className="input"
                  value={recRationale}
                  onChange={(e) => setRecRationale(e.target.value)}
                  rows={3}
                  placeholder="Tie this to the rubric scores and interview signals so the final decision-maker has context."
                  style={{ marginBottom: 0 }}
                />
              </div>
              <button
                className="button"
                onClick={handleSubmitRecommendation}
                disabled={saving}
                style={{ fontSize: 12, background: "#7c3aed" }}
              >
                {saving ? "Submitting..." : "Submit Recommendation"}
              </button>
            </>
          ) : (
            <>
              {(() => {
                const rec = recommendationInfo(app.decisionRecommendation);
                return rec ? (
                  <span className={rec.className}>{rec.label}</span>
                ) : (
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    No recommendation was recorded for this application.
                  </div>
                );
              })()}
              {app.recommendationRationale && (
                <div className="slideout-field" style={{ marginTop: 8 }}>
                  <div className="slideout-field-label">Rationale</div>
                  <div className="slideout-field-value">{app.recommendationRationale}</div>
                </div>
              )}
            </>
          )}
        </div>
      )}

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
            {["SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED"].includes(app.status) && (
              <button
                className="button secondary"
                onClick={() => {
                  const message = prompt(
                    "What additional information do you need from the applicant?"
                  );
                  if (!message?.trim()) return;
                  handleAction("request_info", { message });
                }}
                disabled={saving}
                style={{ fontSize: 12 }}
              >
                Request More Info
              </button>
            )}
            {app.status === "INTERVIEW_SCHEDULED" && (
              <button
                className="button secondary"
                onClick={() => handleAction("mark_interview_complete")}
                disabled={saving}
                style={{ fontSize: 12 }}
              >
                Mark Interview Complete
              </button>
            )}
            {app.status === "INTERVIEW_COMPLETED" && (
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                Submit a recommendation above to move this application forward.
              </span>
            )}
            {app.status === "RECOMMENDATION_SUBMITTED" && (
              <>
                <button
                  className="button"
                  onClick={() => handleAction("approve")}
                  disabled={saving || !assignedChapterId}
                  title={!assignedChapterId ? "Assign a chapter before approving" : undefined}
                  style={{ fontSize: 12, background: !assignedChapterId ? "#9ca3af" : "#16a34a" }}
                >
                  Approve (Final)
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
                  Reject (Final)
                </button>
              </>
            )}
            {!["SUBMITTED", "INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED", "RECOMMENDATION_SUBMITTED"].includes(app.status) && (
              <>
                <button
                  className="button"
                  onClick={() => {
                    if (!confirm("Approve this application without completing the full interview flow?")) return;
                    handleAction("approve");
                  }}
                  disabled={saving || !assignedChapterId}
                  title={!assignedChapterId ? "Assign a chapter before approving" : undefined}
                  style={{ fontSize: 12, background: !assignedChapterId ? "#9ca3af" : "#16a34a" }}
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
              </>
            )}
          </div>
        </div>
      )}
    </KanbanDetailPanel>
  );
}
