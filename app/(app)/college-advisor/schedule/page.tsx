"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  bookCollegeAdvisorMeeting,
  cancelAdvisorMeetingBooking,
  getCollegeAdvisorScheduleData,
} from "@/lib/college-advisor-scheduling";

type ScheduleData = Awaited<ReturnType<typeof getCollegeAdvisorScheduleData>>;

function formatSlotTime(startsAt: string) {
  return new Date(startsAt).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ScheduleMeetingPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<ScheduleData>(null);
  const [selectedSlotKey, setSelectedSlotKey] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadScheduleData() {
    setIsLoading(true);
    try {
      const nextData = await getCollegeAdvisorScheduleData();
      setData(nextData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load scheduling data");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadScheduleData();
  }, []);

  function handleBook(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!data?.advisorshipId) {
      setError("No active advisorship found.");
      return;
    }

    if (!selectedSlotKey) {
      setError("Please choose an available time.");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("advisorshipId", data.advisorshipId);
        formData.set("slotKey", selectedSlotKey);
        formData.set("topic", topic);
        await bookCollegeAdvisorMeeting(formData);
        setSuccess("Meeting booked. A confirmation email and calendar invite are on the way.");
        setSelectedSlotKey(null);
        setTopic("");
        await loadScheduleData();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to book meeting");
      }
    });
  }

  function handleCancel(meetingId: string) {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("meetingId", meetingId);
        await cancelAdvisorMeetingBooking(formData);
        setSuccess("Meeting cancelled.");
        await loadScheduleData();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to cancel meeting");
      }
    });
  }

  if (isLoading) {
    return (
      <div>
        <div className="topbar">
          <div>
            <p className="badge">College Advisor</p>
            <h1 className="page-title">Schedule a Meeting</h1>
            <p className="page-subtitle">Loading advisor availability...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <div className="topbar">
          <div>
            <p className="badge">College Advisor</p>
            <h1 className="page-title">Schedule a Meeting</h1>
            <p className="page-subtitle">You need an active advisor match before you can book a time.</p>
          </div>
          <button className="button ghost small" onClick={() => router.push("/college-advisor")}>
            Back
          </button>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "3rem", maxWidth: "620px" }}>
          <p style={{ fontWeight: 700, marginBottom: "0.5rem" }}>No active advisor match</p>
          <p style={{ color: "var(--muted)", fontSize: "0.88rem" }}>
            Once you are matched with a college advisor, this page will show their real bookable slots here.
          </p>
        </div>
      </div>
    );
  }

  const selectedSlot =
    data.availableSlots.find((slot) => slot.slotKey === selectedSlotKey) ?? null;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">College Advisor</p>
          <h1 className="page-title">Schedule a Meeting</h1>
          <p className="page-subtitle">Pick from your advisor&apos;s real availability instead of requesting a blind time.</p>
        </div>
        <button className="button ghost small" onClick={() => router.push("/college-advisor")}>
          Back
        </button>
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

      <div className="grid two" style={{ alignItems: "start" }}>
        <div className="card">
          <p style={{ fontWeight: 700, marginBottom: "0.3rem" }}>Your Advisor</p>
          <p style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.2rem" }}>{data.advisor.name}</p>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
            {data.advisor.college}
            {data.advisor.major ? ` - ${data.advisor.major}` : ""}
          </p>
          {data.advisor.bio && (
            <p style={{ color: "var(--muted)", fontSize: "0.82rem", lineHeight: 1.6 }}>{data.advisor.bio}</p>
          )}
          <div
            style={{
              marginTop: "1rem",
              padding: "0.75rem 0.85rem",
              background: "var(--surface-alt)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <p style={{ margin: 0, fontWeight: 600, fontSize: "0.82rem" }}>Meeting allowance</p>
            <p style={{ margin: "0.2rem 0 0", color: "var(--muted)", fontSize: "0.8rem" }}>
              Tier: {data.tier ?? "Unknown"}
            </p>
          </div>
        </div>

        <div className="card">
          <p style={{ fontWeight: 700, marginBottom: "1rem" }}>Book a Slot</p>
          {data.availableSlots.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
              Your advisor does not have any open slots posted right now. Check back soon or email them directly.
            </p>
          ) : (
            <form onSubmit={handleBook} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: "0.82rem", marginBottom: "0.45rem" }}>
                  Available times
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", maxHeight: "360px", overflowY: "auto" }}>
                  {data.availableSlots.slice(0, 24).map((slot) => {
                    const isSelected = selectedSlotKey === slot.slotKey;
                    return (
                      <button
                        key={slot.slotKey}
                        type="button"
                        onClick={() => setSelectedSlotKey(slot.slotKey)}
                        style={{
                          textAlign: "left",
                          padding: "0.75rem 0.85rem",
                          borderRadius: "var(--radius-sm)",
                          border: isSelected ? "2px solid var(--ypp-purple-500)" : "1px solid var(--border)",
                          background: isSelected ? "rgba(124, 58, 237, 0.08)" : "var(--surface-alt)",
                          cursor: "pointer",
                        }}
                      >
                        <p style={{ margin: 0, fontWeight: 600 }}>{formatSlotTime(slot.startsAt)}</p>
                        <p style={{ margin: "0.15rem 0 0", fontSize: "0.78rem", color: "var(--muted)" }}>
                          {slot.duration} min
                          {slot.locationLabel ? ` - ${slot.locationLabel}` : ""}
                        </p>
                        {slot.warningLabels.length > 0 && (
                          <p style={{ margin: "0.25rem 0 0", fontSize: "0.72rem", color: "#b45309" }}>
                            {slot.warningLabels.join(", ")}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: "0.82rem", marginBottom: "0.3rem" }}>
                  Topic (optional)
                </label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  rows={3}
                  placeholder="What would you like to talk about?"
                  style={{ width: "100%", resize: "vertical" }}
                />
              </div>

              {selectedSlot && (
                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    background: "#f5f3ff",
                    border: "1px solid #ddd6fe",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 700, fontSize: "0.82rem" }}>Booking summary</p>
                  <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem" }}>{formatSlotTime(selectedSlot.startsAt)}</p>
                  <p style={{ margin: "0.15rem 0 0", fontSize: "0.78rem", color: "var(--muted)" }}>
                    {selectedSlot.duration} min
                    {selectedSlot.locationLabel ? ` - ${selectedSlot.locationLabel}` : ""}
                  </p>
                </div>
              )}

              <button className="button primary" type="submit" disabled={isPending || !selectedSlotKey}>
                {isPending ? "Booking..." : "Book Meeting"}
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: "1.5rem" }}>
        <p style={{ fontWeight: 700, marginBottom: "1rem" }}>Upcoming Meetings</p>
        {data.upcomingMeetings.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
            No upcoming meetings yet.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {data.upcomingMeetings.map((meeting) => (
              <div
                key={meeting.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.8rem 0.9rem",
                  background: "var(--surface-alt)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>{formatSlotTime(meeting.scheduledAt)}</p>
                  <p style={{ margin: "0.15rem 0 0", fontSize: "0.78rem", color: "var(--muted)" }}>
                    {meeting.durationMinutes} min
                    {meeting.topic ? ` - ${meeting.topic}` : ""}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  {meeting.meetingLink && (
                    <a
                      href={meeting.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="button secondary small"
                    >
                      Join
                    </a>
                  )}
                  <button
                    className="button ghost small"
                    onClick={() => handleCancel(meeting.id)}
                    disabled={isPending}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
