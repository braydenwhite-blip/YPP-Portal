"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  requestMentorMeeting,
  cancelScheduleRequest,
  type SchedulePageData,
} from "@/lib/mentorship-scheduling-actions";

const SESSION_TYPES = [
  { value: "CHECK_IN", label: "Check-In", description: "Regular progress check-in with your mentor" },
  { value: "REVIEW_PREP", label: "Review Prep", description: "Prepare for an upcoming goal review cycle" },
  { value: "QUARTERLY_REVIEW", label: "Quarterly Review", description: "Full quarterly committee-style review session" },
  { value: "OFFICE_HOURS", label: "Office Hours", description: "Open-ended questions and support session" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: "Awaiting Confirmation", color: "#d97706", bg: "#fffbeb" },
  CONFIRMED: { label: "Confirmed", color: "#16a34a", bg: "#f0fdf4" },
  DECLINED: { label: "Declined", color: "#ef4444", bg: "#fef2f2" },
  CANCELLED: { label: "Cancelled", color: "var(--muted)", bg: "var(--surface-alt)" },
};

const SESSION_TYPE_LABELS: Record<string, string> = {
  KICKOFF: "Kickoff",
  CHECK_IN: "Check-In",
  REVIEW_PREP: "Review Prep",
  QUARTERLY_REVIEW: "Quarterly Review",
  OFFICE_HOURS: "Office Hours",
};

const INTERVIEW_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  REQUIRED: { label: "Required", color: "#ef4444" },
  SCHEDULED: { label: "Scheduled", color: "#0ea5e9" },
  COMPLETED: { label: "Completed", color: "#16a34a" },
  PASSED: { label: "Passed", color: "#16a34a" },
  HOLD: { label: "On Hold", color: "#d97706" },
  FAILED: { label: "Failed", color: "#ef4444" },
  WAIVED: { label: "Waived", color: "var(--muted)" },
};

interface Props {
  data: SchedulePageData | null;
}

export default function ScheduleClient({ data }: Props) {
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [slotInput, setSlotInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  function addSlot() {
    if (!slotInput) return;
    const dt = new Date(slotInput);
    if (isNaN(dt.getTime())) {
      setError("Invalid date/time. Please use the date picker.");
      return;
    }
    const iso = dt.toISOString();
    if (!selectedSlots.includes(iso)) {
      setSelectedSlots((prev) => [...prev, iso]);
    }
    setSlotInput("");
  }

  function removeSlot(slot: string) {
    setSelectedSlots((prev) => prev.filter((s) => s !== slot));
  }

  async function handleRequestSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const formData = new FormData(e.currentTarget);
    for (const slot of selectedSlots) {
      formData.append("preferredSlots", slot);
    }

    startTransition(async () => {
      try {
        await requestMentorMeeting(formData);
        setSuccess("Meeting request sent! Your mentor will confirm a time.");
        setShowRequestForm(false);
        setSelectedSlots([]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send request.");
      }
    });
  }

  async function handleCancel(requestId: string) {
    setCancellingId(requestId);
    const formData = new FormData();
    formData.set("requestId", requestId);
    startTransition(async () => {
      try {
        await cancelScheduleRequest(formData);
        setCancellingId(null);
      } catch {
        setCancellingId(null);
      }
    });
  }

  const hasMentorship = !!data?.mentorship;
  const activeRequests = (data?.scheduleRequests ?? []).filter(
    (r) => r.status === "PENDING" || r.status === "CONFIRMED"
  );
  const pastRequests = (data?.scheduleRequests ?? []).filter(
    (r) => r.status === "DECLINED" || r.status === "CANCELLED"
  );

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">My Program</p>
          <h1 className="page-title">Schedule a Meeting</h1>
          <p className="page-subtitle">
            Request sessions with your mentor or manage your upcoming meetings
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link href="/mentorship/calendar" className="button secondary small">
            View Calendar
          </Link>
          {hasMentorship && !showRequestForm && (
            <button
              className="button primary small"
              onClick={() => setShowRequestForm(true)}
            >
              + Request Meeting
            </button>
          )}
        </div>
      </div>

      {/* Success banner */}
      {success && (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "var(--radius)",
            padding: "0.85rem 1rem",
            color: "#16a34a",
            fontWeight: 600,
            marginBottom: "1.25rem",
          }}
        >
          ✓ {success}
        </div>
      )}

      {/* Error banner */}
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

      {/* No mentorship state */}
      {!hasMentorship && (
        <div className="card" style={{ textAlign: "center", padding: "3rem", marginBottom: "1.5rem" }}>
          <p style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>🤝</p>
          <p style={{ fontWeight: 600, marginBottom: "0.4rem" }}>No Active Mentorship</p>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
            You need an active mentor to request meetings. Contact your program administrator to get assigned.
          </p>
        </div>
      )}

      {/* Mentor info */}
      {data?.mentorship && (
        <div className="card" style={{ marginBottom: "1.5rem", display: "flex", gap: "1rem", alignItems: "center" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              background: "var(--ypp-purple-100)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.2rem",
              flexShrink: 0,
            }}
          >
            🧑‍🏫
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700 }}>{data.mentorship.mentorName}</p>
            <p style={{ fontSize: "0.82rem", color: "var(--muted)" }}>{data.mentorship.mentorEmail}</p>
          </div>
          <span
            className="pill"
            style={{
              background: "#f0fdf4",
              color: "#16a34a",
              fontSize: "0.75rem",
            }}
          >
            Active Mentor
          </span>
        </div>
      )}

      {/* Meeting Request Form */}
      {showRequestForm && data?.mentorship && (
        <div
          className="card"
          style={{
            marginBottom: "1.5rem",
            borderTop: "3px solid var(--ypp-purple-500)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <p style={{ fontWeight: 700, fontSize: "1rem" }}>Request a Meeting</p>
            <button
              className="button secondary small"
              onClick={() => {
                setShowRequestForm(false);
                setSelectedSlots([]);
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
          <form onSubmit={handleRequestSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <input type="hidden" name="mentorshipId" value={data.mentorship.id} />

            {/* Session type */}
            <div>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.88rem", marginBottom: "0.4rem" }}>
                Meeting Type <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                {SESSION_TYPES.map((type) => (
                  <label
                    key={type.value}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.15rem",
                      padding: "0.65rem 0.85rem",
                      border: "2px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <input type="radio" name="sessionType" value={type.value} defaultChecked={type.value === "CHECK_IN"} required />
                      <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{type.label}</span>
                    </div>
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)", paddingLeft: "1.25rem" }}>
                      {type.description}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.88rem", marginBottom: "0.4rem" }}>
                Meeting Title / Topic <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                name="title"
                required
                placeholder="e.g., Cycle 4 goal check-in"
                className="input"
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </div>

            {/* Notes */}
            <div>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.88rem", marginBottom: "0.4rem" }}>
                Agenda / Notes (optional)
              </label>
              <textarea
                name="notes"
                rows={3}
                placeholder="What would you like to discuss?"
                className="input"
                style={{ width: "100%", boxSizing: "border-box", resize: "vertical" }}
              />
            </div>

            {/* Preferred time slots */}
            <div>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.88rem", marginBottom: "0.4rem" }}>
                Preferred Time Slots (optional)
              </label>
              <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
                Add 2-3 times that work for you. Your mentor will confirm one.
              </p>
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <input
                  type="datetime-local"
                  value={slotInput}
                  onChange={(e) => setSlotInput(e.target.value)}
                  className="input"
                  style={{ flex: 1 }}
                />
                <button type="button" className="button secondary small" onClick={addSlot}>
                  Add
                </button>
              </div>
              {selectedSlots.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  {selectedSlots.map((slot) => (
                    <div
                      key={slot}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.35rem 0.65rem",
                        background: "var(--surface-alt)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "0.82rem",
                      }}
                    >
                      <span>
                        {new Date(slot).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeSlot(slot)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#ef4444",
                          fontSize: "0.8rem",
                          padding: "0 0.25rem",
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button type="submit" disabled={isPending} className="button primary">
              {isPending ? "Sending..." : "Send Meeting Request"}
            </button>
          </form>
        </div>
      )}

      {/* Upcoming confirmed sessions */}
      {(data?.upcomingSessions ?? []).length > 0 && (
        <div style={{ marginBottom: "1.75rem" }}>
          <p className="section-title" style={{ marginBottom: "0.75rem" }}>Upcoming Sessions</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {data!.upcomingSessions.map((session) => (
              <div
                key={session.id}
                className="card"
                style={{
                  padding: "0.85rem 1rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderLeft: "4px solid #16a34a",
                }}
              >
                <div>
                  <p style={{ fontWeight: 600, marginBottom: "0.15rem" }}>{session.title}</p>
                  <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                    {SESSION_TYPE_LABELS[session.type] ?? session.type} ·{" "}
                    {new Date(session.scheduledAt).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                  {session.agenda && (
                    <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.15rem" }}>
                      {session.agenda.slice(0, 80)}{session.agenda.length > 80 ? "..." : ""}
                    </p>
                  )}
                </div>
                <span className="pill" style={{ background: "#f0fdf4", color: "#16a34a", fontSize: "0.72rem" }}>
                  Confirmed
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active requests */}
      {activeRequests.length > 0 && (
        <div style={{ marginBottom: "1.75rem" }}>
          <p className="section-title" style={{ marginBottom: "0.75rem" }}>Meeting Requests</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {activeRequests.map((req) => {
              const statusCfg = STATUS_CONFIG[req.status];
              return (
                <div
                  key={req.id}
                  className="card"
                  style={{
                    padding: "0.85rem 1rem",
                    borderLeft: `4px solid ${statusCfg?.color ?? "var(--border)"}`,
                    background: statusCfg?.bg ?? "var(--surface)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.2rem" }}>
                        <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{req.title}</span>
                        <span
                          className="pill"
                          style={{ fontSize: "0.7rem", background: statusCfg?.color + "22", color: statusCfg?.color }}
                        >
                          {statusCfg?.label ?? req.status}
                        </span>
                      </div>
                      <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                        {SESSION_TYPE_LABELS[req.sessionType] ?? req.sessionType} ·{" "}
                        Requested {new Date(req.createdAt).toLocaleDateString()}
                      </p>
                      {req.scheduledAt && (
                        <p style={{ fontSize: "0.8rem", color: "#16a34a", fontWeight: 600, marginTop: "0.25rem" }}>
                          ✓ Confirmed:{" "}
                          {new Date(req.scheduledAt).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      )}
                      {req.preferredSlots.length > 0 && req.status === "PENDING" && (
                        <div style={{ marginTop: "0.4rem" }}>
                          <p style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: "0.2rem" }}>
                            Preferred times:
                          </p>
                          {req.preferredSlots.map((slot) => (
                            <span
                              key={slot}
                              style={{
                                display: "inline-block",
                                fontSize: "0.72rem",
                                background: "var(--surface-alt)",
                                padding: "0.15rem 0.45rem",
                                borderRadius: "99px",
                                marginRight: "0.3rem",
                                marginBottom: "0.2rem",
                              }}
                            >
                              {new Date(slot).toLocaleDateString("en-US", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {req.status === "PENDING" && (
                      <button
                        className="button secondary small"
                        disabled={cancellingId === req.id}
                        onClick={() => handleCancel(req.id)}
                        style={{ flexShrink: 0, marginLeft: "0.75rem" }}
                      >
                        {cancellingId === req.id ? "..." : "Cancel"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Interview gate section */}
      {data?.interviewGate && (
        <div style={{ marginBottom: "1.75rem" }}>
          <p className="section-title" style={{ marginBottom: "0.75rem" }}>Interview Scheduling</p>
          <div className="card" style={{ borderTop: "3px solid #0ea5e9" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <div>
                <p style={{ fontWeight: 700 }}>Instructor Interview</p>
                <p style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                  Status:{" "}
                  <span
                    style={{
                      color: INTERVIEW_STATUS_CONFIG[data.interviewGate.status]?.color ?? "inherit",
                      fontWeight: 600,
                    }}
                  >
                    {INTERVIEW_STATUS_CONFIG[data.interviewGate.status]?.label ?? data.interviewGate.status}
                  </span>
                </p>
              </div>
              <Link href="/interviews" className="button secondary small">
                Manage Interview →
              </Link>
            </div>

            {data.interviewGate.slots.length > 0 && (
              <div>
                <p style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.4rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Available Slots
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  {data.interviewGate.slots.map((slot) => (
                    <div
                      key={slot.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.5rem 0.75rem",
                        background: slot.status === "CONFIRMED" ? "#f0fdf4" : "var(--surface-alt)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "0.82rem",
                      }}
                    >
                      <span>
                        {new Date(slot.scheduledAt).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span
                          className="pill"
                          style={{
                            fontSize: "0.68rem",
                            background: slot.status === "CONFIRMED" ? "#bbf7d0" : "var(--surface-alt)",
                            color: slot.status === "CONFIRMED" ? "#16a34a" : "var(--muted)",
                          }}
                        >
                          {slot.status}
                        </span>
                        {slot.meetingLink && (
                          <a
                            href={slot.meetingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="button primary small"
                            style={{ fontSize: "0.72rem", padding: "0.2rem 0.5rem" }}
                          >
                            Join
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.interviewGate.slots.length === 0 && (
              <p style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                No interview slots posted yet. Visit the{" "}
                <Link href="/interviews" style={{ color: "var(--ypp-purple-600)" }}>
                  Interviews page
                </Link>{" "}
                to request a slot or check for availability.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Past requests */}
      {pastRequests.length > 0 && (
        <div>
          <p className="section-title" style={{ marginBottom: "0.75rem" }}>
            Past Requests
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {pastRequests.map((req) => {
              const statusCfg = STATUS_CONFIG[req.status];
              return (
                <div
                  key={req.id}
                  className="card"
                  style={{
                    padding: "0.65rem 1rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    opacity: 0.7,
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{req.title}</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginLeft: "0.5rem" }}>
                      {new Date(req.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <span
                    className="pill"
                    style={{ fontSize: "0.7rem", color: statusCfg?.color, background: statusCfg?.bg }}
                  >
                    {statusCfg?.label ?? req.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
