"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { formatScheduleDateTime } from "@/lib/scheduling/shared";

type DrawerApp = {
  id: string;
  status: string;
  materialsReadyAt: Date | string | null;
  interviewScheduledAt?: Date | string | null;
  updatedAt?: Date | string;
  overdue?: boolean;
  subjectsOfInterest: string | null;
  applicant: {
    id: string;
    name: string | null;
    email: string;
    chapter: { name: string } | null;
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
      <div className="slideout-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className="slideout-panel applicant-quick-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Applicant detail: ${app.applicant.name ?? app.applicant.email}`}
      >
        {/* Header */}
        <div className="slideout-header applicant-quick-drawer-header">
          <div>
            <div className="applicant-quick-drawer-title">
              {app.applicant.name ?? app.applicant.email}
            </div>
            <div className="applicant-quick-drawer-chips">
              {app.applicant.chapter && (
                <span className="kanban-card-chapter">{app.applicant.chapter.name}</span>
              )}
              <span
                className={`status-pill ${app.status.toLowerCase().replace(/_/g, "-")}`}
                aria-label={`Status: ${STATUS_LABELS[app.status] ?? app.status.replace(/_/g, " ")}`}
              >
                {STATUS_LABELS[app.status] ?? app.status.replace(/_/g, " ")}
              </span>
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
          role="tablist"
          aria-label="Applicant sections"
          className="applicant-quick-drawer-tabs"
        >
          {(["summary", "reviewer", "interviewer"] as const).map((tab) => (
            <button
              key={tab}
              role="tab"
              type="button"
              aria-selected={activeSection === tab}
              onClick={() => setActiveSection(tab)}
              className="applicant-quick-drawer-tab"
              data-active={activeSection === tab}
            >
              {tab === "reviewer" ? "Reviewer" : tab === "interviewer" ? "Interviewers" : "Summary"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="slideout-body">
          {activeSection === "summary" && (
            <>
              {/* Key details */}
              <div className="slideout-section">
                <div className="slideout-section-title">Quick glance</div>
                <div className="slideout-field">
                  <div className="slideout-field-label">Email</div>
                  <div className="slideout-field-value">
                    <a href={`mailto:${app.applicant.email}`}>{app.applicant.email}</a>
                  </div>
                </div>
                <div className="slideout-field">
                  <div className="slideout-field-label">Interview</div>
                  <div className="slideout-field-value">
                    {app.interviewScheduledAt ? formatScheduleDateTime(app.interviewScheduledAt) : "Not scheduled"}
                  </div>
                </div>
                <div className="slideout-field">
                  <div className="slideout-field-label">Materials</div>
                  <div className="slideout-field-value">
                    {app.materialsReadyAt ? "Ready" : "Missing"}
                  </div>
                </div>
                <div className="slideout-field">
                  <div className="slideout-field-label">Updated</div>
                  <div className="slideout-field-value">
                    {app.updatedAt ? new Date(app.updatedAt).toLocaleString() : "—"}
                  </div>
                </div>
              </div>

              {/* Subjects */}
              {app.subjectsOfInterest && (
              <div className="slideout-section">
                <div className="slideout-section-title">Subjects of Interest</div>
                  <div className="applicant-quick-drawer-chips">
                    {app.subjectsOfInterest
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
                  <div className="applicant-card-unassigned">Not assigned</div>
                )}
              </div>

              {/* Interviewers */}
              <div className="slideout-section">
                <div className="slideout-section-title">Interviewers</div>
                <div className="slideout-field">
                  <div className="slideout-field-label">Lead</div>
                  <div className="slideout-field-value">
                    {leadInterviewer?.interviewer.name ?? "Not assigned"}
                  </div>
                </div>
                <div className="slideout-field">
                  <div className="slideout-field-label">Second</div>
                  <div className="slideout-field-value">
                    {secondInterviewer?.interviewer.name ?? "Not assigned"}
                  </div>
                </div>
              </div>

              {/* Lead review summary */}
              {leadReview?.summary && (
                <div className="slideout-section">
                  <div className="slideout-section-title">Reviewer note</div>
                  <div
                    className="applicant-quick-drawer-note"
                  >
                    {leadReview.summary}
                  </div>
                </div>
              )}

              {/* Open full workspace CTA */}
              <div style={{ marginTop: 24 }}>
                <Link
                  href={`/applications/instructor/${app.id}`}
                  className="button applicant-quick-drawer-cta"
                >
                  Open full workspace
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
