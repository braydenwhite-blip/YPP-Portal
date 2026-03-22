"use client";

import { useState, useTransition } from "react";
import {
  confirmScheduleRequest,
  declineScheduleRequest,
  type MentorScheduleQueueItem,
} from "@/lib/mentorship-scheduling-actions";

const SESSION_TYPE_LABELS: Record<string, string> = {
  KICKOFF: "Kickoff",
  CHECK_IN: "Check-In",
  REVIEW_PREP: "Review Prep",
  QUARTERLY_REVIEW: "Quarterly Review",
  OFFICE_HOURS: "Office Hours",
};

interface Props {
  requests: MentorScheduleQueueItem[];
}

export default function MentorSchedulePanel({ requests }: Props) {
  const [isPending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  async function handleConfirm(requestId: string) {
    setError(null);
    if (!scheduledAt) {
      setError("Please select a meeting time.");
      return;
    }

    const formData = new FormData();
    formData.set("requestId", requestId);
    formData.set("scheduledAt", new Date(scheduledAt).toISOString());
    if (meetingLink) formData.set("meetingLink", meetingLink);

    startTransition(async () => {
      try {
        await confirmScheduleRequest(formData);
        setSuccessId(requestId);
        setActiveId(null);
        setScheduledAt("");
        setMeetingLink("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to confirm.");
      }
    });
  }

  async function handleDecline(requestId: string) {
    const formData = new FormData();
    formData.set("requestId", requestId);
    startTransition(async () => {
      try {
        await declineScheduleRequest(formData);
        setSuccessId(requestId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to decline.");
      }
    });
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Mentorship Program</p>
          <h1 className="page-title">Meeting Requests</h1>
          <p className="page-subtitle">
            Incoming session requests from your mentees
          </p>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "var(--radius)",
            padding: "0.85rem 1rem",
            color: "#dc2626",
            marginBottom: "1.25rem",
          }}
        >
          {error}
        </div>
      )}

      {requests.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>📅</p>
          <p style={{ fontWeight: 600, marginBottom: "0.4rem" }}>No Pending Requests</p>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
            Your mentees haven't sent any meeting requests yet.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {requests.map((req) => {
            const isActive = activeId === req.id;
            const isSuccess = successId === req.id;

            return (
              <div
                key={req.id}
                className="card"
                style={{
                  borderLeft: "4px solid var(--ypp-purple-400)",
                  opacity: isSuccess ? 0.6 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.65rem" }}>
                  <div>
                    <p style={{ fontWeight: 700, marginBottom: "0.15rem" }}>{req.title}</p>
                    <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                      {req.menteeName} · {req.menteeEmail}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.1rem" }}>
                      {SESSION_TYPE_LABELS[req.sessionType] ?? req.sessionType} ·{" "}
                      Requested {new Date(req.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className="pill"
                    style={{ fontSize: "0.72rem", background: "#fffbeb", color: "#d97706", flexShrink: 0 }}
                  >
                    Pending
                  </span>
                </div>

                {/* Notes */}
                {req.notes && (
                  <div
                    style={{
                      padding: "0.5rem 0.65rem",
                      background: "var(--surface-alt)",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "0.82rem",
                      marginBottom: "0.65rem",
                    }}
                  >
                    <p style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--muted)", marginBottom: "0.2rem", textTransform: "uppercase" }}>
                      Notes
                    </p>
                    {req.notes}
                  </div>
                )}

                {/* Preferred slots */}
                {req.preferredSlots.length > 0 && (
                  <div style={{ marginBottom: "0.65rem" }}>
                    <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", marginBottom: "0.3rem" }}>
                      Preferred times
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                      {req.preferredSlots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          className="button secondary small"
                          style={{ fontSize: "0.72rem", padding: "0.2rem 0.5rem" }}
                          onClick={() => setScheduledAt(new Date(slot).toISOString().slice(0, 16))}
                        >
                          {new Date(slot).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </button>
                      ))}
                    </div>
                    <p style={{ fontSize: "0.68rem", color: "var(--muted)", marginTop: "0.2rem" }}>
                      Click a time to pre-fill the confirmation form
                    </p>
                  </div>
                )}

                {/* Confirm form */}
                {isActive && (
                  <div
                    style={{
                      marginBottom: "0.65rem",
                      padding: "0.75rem",
                      background: "#f0fdf4",
                      borderRadius: "var(--radius-sm)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.6rem",
                    }}
                  >
                    <div>
                      <label style={{ display: "block", fontWeight: 600, fontSize: "0.82rem", marginBottom: "0.3rem" }}>
                        Confirm Date & Time <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <input
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        className="input"
                        style={{ width: "100%", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontWeight: 600, fontSize: "0.82rem", marginBottom: "0.3rem" }}>
                        Meeting Link (optional)
                      </label>
                      <input
                        type="url"
                        value={meetingLink}
                        onChange={(e) => setMeetingLink(e.target.value)}
                        placeholder="https://meet.google.com/..."
                        className="input"
                        style={{ width: "100%", boxSizing: "border-box" }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        className="button primary small"
                        disabled={isPending}
                        onClick={() => handleConfirm(req.id)}
                      >
                        {isPending ? "..." : "Confirm Meeting"}
                      </button>
                      <button
                        className="button secondary small"
                        onClick={() => { setActiveId(null); setError(null); }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                {!isActive && !isSuccess && (
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      className="button primary small"
                      onClick={() => { setActiveId(req.id); setError(null); }}
                    >
                      Confirm Time
                    </button>
                    <button
                      className="button secondary small"
                      disabled={isPending}
                      onClick={() => handleDecline(req.id)}
                    >
                      Decline
                    </button>
                  </div>
                )}

                {isSuccess && (
                  <span style={{ fontSize: "0.82rem", color: "#16a34a", fontWeight: 600 }}>
                    ✓ Done
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
