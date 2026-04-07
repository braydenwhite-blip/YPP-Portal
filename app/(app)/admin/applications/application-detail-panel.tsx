"use client";

import { KanbanDetailPanel, PanelToast, useToast } from "@/components/kanban";
import { statusLabel, formatDate } from "@/components/kanban/kanban-utils";
import {
  isHiringDecisionApproved,
  isHiringDecisionPending,
  isHiringDecisionReturned,
} from "@/lib/hiring-decision-utils";
import type { JobApplication } from "./kanban-board";

/* -- Status pill ------------------------------------------- */

function statusPillClass(status: string): string {
  switch (status) {
    case "SUBMITTED":
      return "status-pill submitted";
    case "UNDER_REVIEW":
      return "status-pill under-review";
    case "INTERVIEW_SCHEDULED":
      return "status-pill interview-scheduled";
    case "INTERVIEW_COMPLETED":
      return "status-pill interview-completed";
    case "ACCEPTED":
      return "status-pill approved";
    case "REJECTED":
      return "status-pill rejected";
    case "WITHDRAWN":
      return "status-pill on-hold";
    default:
      return "status-pill";
  }
}

/* -- Decision display -------------------------------------- */

function DecisionDisplay({ decision }: { decision: JobApplication["decision"] }) {
  if (!decision) {
    return <span style={{ color: "var(--muted)", fontSize: 13 }}>No decision yet</span>;
  }

  if (isHiringDecisionApproved(decision)) {
    return (
      <span className={`pill ${decision.accepted ? "pill-success" : "pill-declined"}`}>
        {decision.accepted ? "Accepted" : "Rejected"}
      </span>
    );
  }
  if (isHiringDecisionPending(decision)) {
    return <span className="pill pill-pathway">Pending Chair Review</span>;
  }
  if (isHiringDecisionReturned(decision)) {
    return <span className="pill pill-pending">Returned by Chair</span>;
  }
  return <span style={{ color: "var(--muted)", fontSize: 13 }}>Pending</span>;
}

/* -- Main Panel -------------------------------------------- */

export default function ApplicationDetailPanel({
  app,
  onClose,
  onUpdate,
}: {
  app: JobApplication;
  onClose: () => void;
  onUpdate: (updated: Partial<JobApplication> & { id: string }) => void;
}) {
  const { message, show } = useToast();

  const nextSlot = app.interviewSlots.find(
    (s) => new Date(s.scheduledAt) >= new Date()
  );

  return (
    <KanbanDetailPanel
      title={app.applicant.name}
      subtitle={app.applicant.email}
      statusBadge={
        <span className={statusPillClass(app.status)}>{statusLabel(app.status)}</span>
      }
      onClose={onClose}
    >
      <PanelToast message={message} />

      {/* Applicant Info */}
      <div className="slideout-section">
        <div className="slideout-section-title">Applicant Info</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
          <div className="slideout-field">
            <div className="slideout-field-label">Name</div>
            <div className="slideout-field-value">{app.applicant.name}</div>
          </div>
          <div className="slideout-field">
            <div className="slideout-field-label">Email</div>
            <div className="slideout-field-value">{app.applicant.email}</div>
          </div>
        </div>
      </div>

      {/* Position Info */}
      <div className="slideout-section">
        <div className="slideout-section-title">Position</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
          <div className="slideout-field">
            <div className="slideout-field-label">Title</div>
            <div className="slideout-field-value">{app.position.title}</div>
          </div>
          <div className="slideout-field">
            <div className="slideout-field-label">Type</div>
            <div className="slideout-field-value">
              {app.position.type.replace(/_/g, " ")}
            </div>
          </div>
          <div className="slideout-field">
            <div className="slideout-field-label">Chapter</div>
            <div className="slideout-field-value">
              {app.position.chapter?.name || "Global"}
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="slideout-section">
        <div className="slideout-section-title">Timeline</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
          <div className="slideout-field">
            <div className="slideout-field-label">Submitted</div>
            <div className="slideout-field-value">{formatDate(app.submittedAt)}</div>
          </div>
          <div className="slideout-field">
            <div className="slideout-field-label">Last Updated</div>
            <div className="slideout-field-value">{formatDate(app.updatedAt)}</div>
          </div>
          <div className="slideout-field">
            <div className="slideout-field-label">Status</div>
            <div className="slideout-field-value">
              <span className={statusPillClass(app.status)}>{statusLabel(app.status)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interview Slots */}
      {app.interviewSlots.length > 0 && (
        <div className="slideout-section">
          <div className="slideout-section-title">Interview Slots</div>
          {app.interviewSlots.map((slot) => {
            const d = new Date(slot.scheduledAt);
            const isPast = d < new Date();
            return (
              <div
                key={slot.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "6px 0",
                  borderBottom: "1px solid var(--border, #e5e7eb)",
                  fontSize: 13,
                }}
              >
                <span>
                  {d.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}{" "}
                  at{" "}
                  {d.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: isPast ? "var(--muted)" : slot.isConfirmed ? "#16a34a" : "#f59e0b",
                  }}
                >
                  {isPast ? "Past" : slot.isConfirmed ? "Confirmed" : "Pending"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Next Interview */}
      {nextSlot && (
        <div className="slideout-section">
          <div className="slideout-section-title">Next Interview</div>
          <div className="slideout-field">
            <div className="slideout-field-value" style={{ fontWeight: 500 }}>
              {new Date(nextSlot.scheduledAt).toLocaleString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>
          </div>
        </div>
      )}

      {/* Hiring Decision */}
      <div className="slideout-section">
        <div className="slideout-section-title">Hiring Decision</div>
        <DecisionDisplay decision={app.decision} />
        {app.decision?.decidedAt && (
          <div className="slideout-field" style={{ marginTop: 8 }}>
            <div className="slideout-field-label">Decided At</div>
            <div className="slideout-field-value">{formatDate(app.decision.decidedAt)}</div>
          </div>
        )}
      </div>

      {/* Link to full detail page */}
      <div className="slideout-section">
        <a
          href={`/applications/${app.id}`}
          className="button small"
          style={{ textDecoration: "none" }}
        >
          View Full Application
        </a>
      </div>
    </KanbanDetailPanel>
  );
}
