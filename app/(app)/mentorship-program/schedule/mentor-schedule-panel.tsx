"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addMentorAvailabilityOverride,
  addMentorAvailabilityRule,
  confirmScheduleRequest,
  deactivateMentorAvailabilityOverride,
  declineScheduleRequest,
  removeMentorAvailabilityRule,
  type MentorScheduleManagerData,
} from "@/lib/mentorship-scheduling-actions";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const SESSION_TYPE_LABELS: Record<string, string> = {
  KICKOFF: "Kickoff",
  CHECK_IN: "Check-In",
  REVIEW_PREP: "Review Prep",
  QUARTERLY_REVIEW: "Quarterly Review",
  OFFICE_HOURS: "Office Hours",
};

interface Props {
  data: MentorScheduleManagerData;
}

function formatSlotTime(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function MentorSchedulePanel({ data }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [startTime, setStartTime] = useState("14:00");
  const [endTime, setEndTime] = useState("17:00");
  const [slotDuration, setSlotDuration] = useState("30");
  const [bufferMinutes, setBufferMinutes] = useState("10");
  const [defaultMeetingLink, setDefaultMeetingLink] = useState("");
  const [locationLabel, setLocationLabel] = useState("");

  const [overrideType, setOverrideType] = useState("OPEN");
  const [overrideStartsAt, setOverrideStartsAt] = useState("");
  const [overrideEndsAt, setOverrideEndsAt] = useState("");
  const [overrideNote, setOverrideNote] = useState("");

  async function refreshPage(message?: string) {
    if (message) setSuccess(message);
    router.refresh();
  }

  async function handleConfirm(requestId: string) {
    setError(null);
    setSuccess(null);
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
        setActiveId(null);
        setScheduledAt("");
        setMeetingLink("");
        await refreshPage("Meeting confirmed.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to confirm.");
      }
    });
  }

  async function handleDecline(requestId: string) {
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.set("requestId", requestId);
    startTransition(async () => {
      try {
        await declineScheduleRequest(formData);
        await refreshPage("Request declined.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to decline.");
      }
    });
  }

  function handleAddRule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("dayOfWeek", dayOfWeek);
        formData.set("startTime", startTime);
        formData.set("endTime", endTime);
        formData.set("slotDuration", slotDuration);
        formData.set("bufferMinutes", bufferMinutes);
        formData.set("meetingLink", defaultMeetingLink);
        formData.set("locationLabel", locationLabel);
        await addMentorAvailabilityRule(formData);
        setDefaultMeetingLink("");
        setLocationLabel("");
        await refreshPage("Recurring mentor availability saved.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save recurring availability.");
      }
    });
  }

  function handleRemoveRule(ruleId: string) {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        await removeMentorAvailabilityRule(ruleId);
        await refreshPage("Recurring availability removed.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove availability.");
      }
    });
  }

  function handleAddOverride(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("type", overrideType);
        formData.set("startsAt", new Date(overrideStartsAt).toISOString());
        formData.set("endsAt", new Date(overrideEndsAt).toISOString());
        formData.set("slotDuration", slotDuration);
        formData.set("bufferMinutes", bufferMinutes);
        formData.set("note", overrideNote);
        await addMentorAvailabilityOverride(formData);
        setOverrideStartsAt("");
        setOverrideEndsAt("");
        setOverrideNote("");
        await refreshPage(overrideType === "OPEN" ? "Special opening saved." : "Blocked time saved.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save override.");
      }
    });
  }

  function handleRemoveOverride(overrideId: string) {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        await deactivateMentorAvailabilityOverride(overrideId);
        await refreshPage("Override removed.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove override.");
      }
    });
  }

  const rulesByDay = DAY_NAMES.map((name, index) => ({
    day: name,
    dayIdx: index,
    rules: data.availabilityRules.filter((rule) => rule.dayOfWeek === index),
  })).filter((entry) => entry.rules.length > 0);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Mentorship Program</p>
          <h1 className="page-title">Mentor Scheduling</h1>
          <p className="page-subtitle">Publish open times, manage overrides, and handle mentee requests</p>
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
          {success}
        </div>
      )}

      {data.availabilityStatusMessage && (
        <div
          style={{
            background: "#fff7ed",
            border: "1px solid #fdba74",
            borderRadius: "var(--radius)",
            padding: "0.85rem 1rem",
            color: "#9a3412",
            marginBottom: "1.25rem",
          }}
        >
          {data.availabilityStatusMessage}
        </div>
      )}

      {data.availabilitySchemaReady ? (
        <>
          <div className="grid two" style={{ alignItems: "start", marginBottom: "1.5rem" }}>
            <div className="card">
              <p style={{ fontWeight: 700, marginBottom: "1rem" }}>Recurring Availability</p>
              <form onSubmit={handleAddRule} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: "0.82rem", marginBottom: "0.3rem" }}>
                    Day
                  </label>
                  <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} style={{ width: "100%" }}>
                    {DAY_NAMES.map((day, index) => (
                      <option key={day} value={index}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label style={{ display: "block", fontWeight: 600, fontSize: "0.82rem", marginBottom: "0.3rem" }}>
                      Start
                    </label>
                    <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={{ width: "100%" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontWeight: 600, fontSize: "0.82rem", marginBottom: "0.3rem" }}>
                      End
                    </label>
                    <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={{ width: "100%" }} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label style={{ display: "block", fontWeight: 600, fontSize: "0.82rem", marginBottom: "0.3rem" }}>
                      Slot Length
                    </label>
                    <select value={slotDuration} onChange={(e) => setSlotDuration(e.target.value)} style={{ width: "100%" }}>
                      <option value="15">15 min</option>
                      <option value="30">30 min</option>
                      <option value="45">45 min</option>
                      <option value="60">60 min</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontWeight: 600, fontSize: "0.82rem", marginBottom: "0.3rem" }}>
                      Buffer
                    </label>
                    <select value={bufferMinutes} onChange={(e) => setBufferMinutes(e.target.value)} style={{ width: "100%" }}>
                      <option value="0">0 min</option>
                      <option value="5">5 min</option>
                      <option value="10">10 min</option>
                      <option value="15">15 min</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: "0.82rem", marginBottom: "0.3rem" }}>
                    Default Meeting Link
                  </label>
                  <input
                    type="url"
                    value={defaultMeetingLink}
                    onChange={(e) => setDefaultMeetingLink(e.target.value)}
                    placeholder="https://meet.google.com/..."
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: "0.82rem", marginBottom: "0.3rem" }}>
                    Location Label
                  </label>
                  <input
                    type="text"
                    value={locationLabel}
                    onChange={(e) => setLocationLabel(e.target.value)}
                    placeholder="Zoom, Phone Call, Office..."
                    style={{ width: "100%" }}
                  />
                </div>
                <button className="button primary" type="submit" disabled={isPending}>
                  {isPending ? "Saving..." : "Save Weekly Availability"}
                </button>
              </form>
            </div>

            <div className="card">
              <p style={{ fontWeight: 700, marginBottom: "1rem" }}>One-Off Override</p>
              <form onSubmit={handleAddOverride} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: "0.82rem", marginBottom: "0.3rem" }}>
                    Override Type
                  </label>
                  <select value={overrideType} onChange={(e) => setOverrideType(e.target.value)} style={{ width: "100%" }}>
                    <option value="OPEN">Open extra time</option>
                    <option value="BLOCKED">Block time</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: "0.82rem", marginBottom: "0.3rem" }}>
                    Starts
                  </label>
                  <input
                    type="datetime-local"
                    value={overrideStartsAt}
                    onChange={(e) => setOverrideStartsAt(e.target.value)}
                    style={{ width: "100%" }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: "0.82rem", marginBottom: "0.3rem" }}>
                    Ends
                  </label>
                  <input
                    type="datetime-local"
                    value={overrideEndsAt}
                    onChange={(e) => setOverrideEndsAt(e.target.value)}
                    style={{ width: "100%" }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: "0.82rem", marginBottom: "0.3rem" }}>
                    Note
                  </label>
                  <textarea
                    value={overrideNote}
                    onChange={(e) => setOverrideNote(e.target.value)}
                    rows={3}
                    placeholder={overrideType === "OPEN" ? "Optional note about this extra window" : "Why this time is blocked"}
                    style={{ width: "100%", resize: "vertical" }}
                  />
                </div>
                <button className="button primary" type="submit" disabled={isPending}>
                  {isPending ? "Saving..." : overrideType === "OPEN" ? "Add Opening" : "Block Time"}
                </button>
              </form>
            </div>
          </div>

          <div className="grid two" style={{ alignItems: "start", marginBottom: "1.5rem" }}>
            <div className="card">
              <p style={{ fontWeight: 700, marginBottom: "1rem" }}>Current Weekly Schedule</p>
              {rulesByDay.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>No recurring availability posted yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {rulesByDay.map((entry) => (
                    <div key={entry.dayIdx}>
                      <p style={{ fontWeight: 600, fontSize: "0.82rem", color: "var(--muted)", marginBottom: "0.35rem" }}>
                        {entry.day}
                      </p>
                      {entry.rules.map((rule) => (
                        <div
                          key={rule.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "0.75rem",
                            alignItems: "center",
                            padding: "0.6rem 0.75rem",
                            background: "var(--surface-alt)",
                            borderRadius: "var(--radius-sm)",
                            marginBottom: "0.35rem",
                          }}
                        >
                          <div>
                            <p style={{ margin: 0, fontWeight: 600, fontSize: "0.88rem" }}>
                              {rule.startTime} - {rule.endTime}
                            </p>
                            <p style={{ margin: "0.15rem 0 0", fontSize: "0.75rem", color: "var(--muted)" }}>
                              {rule.slotDuration} min slots, {rule.bufferMinutes} min buffer
                              {rule.locationLabel ? `, ${rule.locationLabel}` : ""}
                            </p>
                          </div>
                          <button className="button ghost small" onClick={() => handleRemoveRule(rule.id)} disabled={isPending}>
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <p style={{ fontWeight: 700, marginBottom: "1rem" }}>Upcoming Overrides</p>
              {data.availabilityOverrides.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>No one-off overrides yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                  {data.availabilityOverrides.map((override) => (
                    <div
                      key={override.id}
                      style={{
                        padding: "0.75rem 0.85rem",
                        background: override.type === "OPEN" ? "#f0fdf4" : "#fef2f2",
                        border: `1px solid ${override.type === "OPEN" ? "#bbf7d0" : "#fecaca"}`,
                        borderRadius: "var(--radius-sm)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
                        <div>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: "0.84rem" }}>
                            {override.type === "OPEN" ? "Special opening" : "Blocked time"}
                          </p>
                          <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: "var(--muted)" }}>
                            {formatSlotTime(override.startsAt)} - {formatSlotTime(override.endsAt)}
                          </p>
                          {override.note && (
                            <p style={{ margin: "0.25rem 0 0", fontSize: "0.78rem" }}>{override.note}</p>
                          )}
                        </div>
                        <button className="button ghost small" onClick={() => handleRemoveOverride(override.id)} disabled={isPending}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <p style={{ fontWeight: 700, marginBottom: "0.5rem" }}>Availability Setup Is Paused</p>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.85rem" }}>
            Weekly hours, overrides, and self-booking slots will appear here after the missing database migration is applied.
          </p>
        </div>
      )}

      <div className="grid two" style={{ alignItems: "start", marginBottom: "1.5rem" }}>
        <div className="card">
          <p style={{ fontWeight: 700, marginBottom: "1rem" }}>Next Open Slots</p>
          {!data.availabilitySchemaReady ? (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
              Slot previews will appear here after the mentor-availability migration is applied.
            </p>
          ) : data.slotPreview.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
              Once you post recurring hours or one-off openings, your mentees will be able to self-book them.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
              {data.slotPreview.map((slot) => (
                <div
                  key={slot.slotKey}
                  style={{
                    padding: "0.7rem 0.8rem",
                    background: "var(--surface-alt)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 600 }}>{formatSlotTime(slot.startsAt)}</p>
                  <p style={{ margin: "0.15rem 0 0", fontSize: "0.76rem", color: "var(--muted)" }}>
                    {slot.duration} min
                    {slot.locationLabel ? `, ${slot.locationLabel}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <p style={{ fontWeight: 700, marginBottom: "1rem" }}>Upcoming Sessions</p>
          {data.upcomingSessions.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>No upcoming sessions booked yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {data.upcomingSessions.map((session) => (
                <div
                  key={session.id}
                  style={{
                    padding: "0.75rem 0.85rem",
                    background: "var(--surface-alt)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 600 }}>{session.title}</p>
                  <p style={{ margin: "0.15rem 0 0", fontSize: "0.78rem", color: "var(--muted)" }}>
                    {session.menteeName} · {SESSION_TYPE_LABELS[session.sessionType] ?? session.sessionType}
                  </p>
                  <p style={{ margin: "0.15rem 0 0", fontSize: "0.78rem", color: "var(--muted)" }}>
                    {formatSlotTime(session.scheduledAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="topbar" style={{ marginBottom: "0.75rem" }}>
          <div>
            <p className="section-title" style={{ margin: 0 }}>Pending Requests</p>
            <p style={{ color: "var(--muted)", fontSize: "0.82rem", margin: "0.25rem 0 0" }}>
              Use these when a mentee needs a custom time instead of the posted slots.
            </p>
          </div>
        </div>

        {data.pendingRequests.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
            <p style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>No Pending Requests</p>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
              Your mentees can book directly from your posted schedule, or they can send a custom request that will appear here.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {data.pendingRequests.map((req) => {
              const isActive = activeId === req.id;

              return (
                <div key={req.id} className="card" style={{ borderLeft: "4px solid var(--ypp-purple-400)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.65rem" }}>
                    <div>
                      <p style={{ fontWeight: 700, marginBottom: "0.15rem" }}>{req.title}</p>
                      <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                        {req.menteeName} · {req.menteeEmail}
                      </p>
                      <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.1rem" }}>
                        {SESSION_TYPE_LABELS[req.sessionType] ?? req.sessionType} · Requested {new Date(req.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="pill" style={{ fontSize: "0.72rem", background: "#fffbeb", color: "#d97706" }}>
                      Pending
                    </span>
                  </div>

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
                      {req.notes}
                    </div>
                  )}

                  {req.preferredSlots.length > 0 && (
                    <div style={{ marginBottom: "0.65rem" }}>
                      <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", marginBottom: "0.3rem" }}>
                        Preferred times
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                        {req.preferredSlots.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            className="button secondary small"
                            style={{ fontSize: "0.72rem", padding: "0.2rem 0.5rem" }}
                            onClick={() => {
                              setActiveId(req.id);
                              setScheduledAt(new Date(slot).toISOString().slice(0, 16));
                            }}
                          >
                            {formatSlotTime(slot)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

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
                          Confirm Date & Time
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
                        <button className="button primary small" disabled={isPending} onClick={() => handleConfirm(req.id)}>
                          {isPending ? "Saving..." : "Confirm Meeting"}
                        </button>
                        <button className="button secondary small" onClick={() => setActiveId(null)}>
                          Close
                        </button>
                      </div>
                    </div>
                  )}

                  {!isActive && (
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button className="button primary small" onClick={() => setActiveId(req.id)}>
                        Confirm Time
                      </button>
                      <button className="button secondary small" disabled={isPending} onClick={() => handleDecline(req.id)}>
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
