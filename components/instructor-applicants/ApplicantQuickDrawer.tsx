"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import MaterialsMissingChip from "./MaterialsMissingChip";

type DrawerApp = {
  id: string;
  status: string;
  materialsReadyAt: Date | string | null;
  overdue?: boolean;
  applicant: {
    id: string;
    name: string | null;
    email: string;
    chapter: { name: string } | null;
    subjectsOfInterest: string | null;
  };
  reviewer: { id: string; name: string | null } | null;
  interviewerAssignments: Array<{
    id: string;
    role: string;
    interviewer: { id: string; name: string | null };
  }>;
  applicationReviews?: Array<{
    summary: string | null;
    nextStep: string | null;
    overallRating: string | null;
  }>;
};

interface ApplicantQuickDrawerProps {
  app: DrawerApp;
  onClose: () => void;
  canAssignReviewer?: boolean;
  canAssignInterviewer?: boolean;
  reviewerPickerSlot?: ReactNode;
  interviewerPickerSlot?: ReactNode;
}

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "New",
  UNDER_REVIEW: "Under Review",
  INFO_REQUESTED: "Info Requested",
  PRE_APPROVED: "Pre-Approved",
  INTERVIEW_SCHEDULED: "Interview Scheduled",
  INTERVIEW_COMPLETED: "Interview Completed",
  CHAIR_REVIEW: "Chair Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  ON_HOLD: "On Hold",
  WITHDRAWN: "Withdrawn",
};

export default function ApplicantQuickDrawer({
  app,
  onClose,
  reviewerPickerSlot,
  interviewerPickerSlot,
}: ApplicantQuickDrawerProps) {
  const [activeSection, setActiveSection] = useState<"summary" | "reviewer" | "interviewer">("summary");

  const leadInterviewer = app.interviewerAssignments.find((a) => a.role === "LEAD");
  const secondInterviewer = app.interviewerAssignments.find((a) => a.role === "SECOND");
  const leadReview = app.applicationReviews?.[0];

  return (
    <>
      <div className="slideout-backdrop" onClick={onClose} />
      <div className="slideout-panel">
        {/* Header */}
        <div className="slideout-header">
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
              {app.applicant.name ?? app.applicant.email}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
              {app.applicant.chapter && (
                <span className="kanban-card-chapter">{app.applicant.chapter.name}</span>
              )}
              <span
                className={`status-pill ${app.status.toLowerCase().replace(/_/g, "-")}`}
              >
                {STATUS_LABELS[app.status] ?? app.status.replace(/_/g, " ")}
              </span>
              <MaterialsMissingChip materialsReadyAt={app.materialsReadyAt} />
              {app.overdue && (
                <span className="pill pill-attention pill-small">Overdue</span>
              )}
            </div>
          </div>
          <button
            className="slideout-close"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Tab nav */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--border)",
            padding: "0 24px",
          }}
        >
          {(["summary", "reviewer", "interviewer"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveSection(tab)}
              style={{
                background: "none",
                border: "none",
                borderBottom: activeSection === tab ? "2px solid #6b21c8" : "2px solid transparent",
                padding: "10px 12px",
                fontSize: 13,
                fontWeight: activeSection === tab ? 700 : 400,
                color: activeSection === tab ? "#6b21c8" : "var(--muted)",
                cursor: "pointer",
                marginBottom: -1,
                textTransform: "capitalize",
              }}
            >
              {tab === "reviewer" ? "Reviewer" : tab === "interviewer" ? "Interviewers" : "Summary"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="slideout-body">
          {activeSection === "summary" && (
            <>
              {/* Subjects */}
              {app.applicant.subjectsOfInterest && (
                <div className="slideout-section">
                  <div className="slideout-section-title">Subjects of Interest</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {app.applicant.subjectsOfInterest
                      .split(/[\s,;]+/)
                      .filter(Boolean)
                      .map((s) => (
                        <span key={s} className="pill pill-purple pill-small">{s}</span>
                      ))}
                  </div>
                </div>
              )}

              {/* Reviewer */}
              <div className="slideout-section">
                <div className="slideout-section-title">Reviewer</div>
                {app.reviewer ? (
                  <div className="slideout-field-value">{app.reviewer.name ?? "Unknown"}</div>
                ) : (
                  <div style={{ fontSize: 13, color: "#d97706", fontStyle: "italic" }}>Not assigned</div>
                )}
              </div>

              {/* Interviewers */}
              {(leadInterviewer || secondInterviewer) && (
                <div className="slideout-section">
                  <div className="slideout-section-title">Interviewers</div>
                  {leadInterviewer && (
                    <div className="slideout-field">
                      <div className="slideout-field-label">Lead</div>
                      <div className="slideout-field-value">{leadInterviewer.interviewer.name ?? "Unknown"}</div>
                    </div>
                  )}
                  {secondInterviewer && (
                    <div className="slideout-field">
                      <div className="slideout-field-label">Second</div>
                      <div className="slideout-field-value">{secondInterviewer.interviewer.name ?? "Unknown"}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Lead review summary */}
              {leadReview?.summary && (
                <div className="slideout-section">
                  <div className="slideout-section-title">Reviewer note</div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--text)",
                      lineHeight: 1.5,
                      background: "var(--surface-2)",
                      borderRadius: 8,
                      padding: "10px 12px",
                    }}
                  >
                    {leadReview.summary}
                  </div>
                </div>
              )}

              {/* Open full cockpit CTA */}
              <div style={{ marginTop: 24 }}>
                <Link
                  href={`/applications/instructor/${app.id}`}
                  className="button"
                  style={{ display: "block", textAlign: "center" }}
                >
                  Open full cockpit →
                </Link>
              </div>
            </>
          )}

          {activeSection === "reviewer" && (
            <div className="slideout-section">
              <div className="slideout-section-title">
                {app.reviewer ? "Reassign Reviewer" : "Assign Reviewer"}
              </div>
              {reviewerPickerSlot ?? (
                <p style={{ fontSize: 13, color: "var(--muted)" }}>
                  Reviewer assignment not available here.
                </p>
              )}
            </div>
          )}

          {activeSection === "interviewer" && (
            <div className="slideout-section">
              <div className="slideout-section-title">Assign Interviewers</div>
              {interviewerPickerSlot ?? (
                <p style={{ fontSize: 13, color: "var(--muted)" }}>
                  Interviewer assignment not available here.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
