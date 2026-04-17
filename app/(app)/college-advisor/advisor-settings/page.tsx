"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addAdvisorAvailabilityOverride,
  addAvailabilitySlot,
  deactivateAdvisorAvailabilityOverride,
  getMyAvailabilitySlots,
  removeAvailabilitySlot,
} from "@/lib/college-advisor-scheduling";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type AvailabilityState = Awaited<ReturnType<typeof getMyAvailabilitySlots>>;

const EMPTY_AVAILABILITY: AvailabilityState = {
  slots: [],
  overrides: [],
};

function formatOverrideWindow(startsAt: string, endsAt: string) {
  return `${new Date(startsAt).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })} - ${new Date(endsAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export default function AdvisorSettingsPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);
  const [availability, setAvailability] = useState<AvailabilityState>(EMPTY_AVAILABILITY);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [startTime, setStartTime] = useState("14:00");
  const [endTime, setEndTime] = useState("17:00");
  const [slotDuration, setSlotDuration] = useState("30");
  const [bufferMinutes, setBufferMinutes] = useState("10");
  const [meetingLink, setMeetingLink] = useState("");
  const [locationLabel, setLocationLabel] = useState("");

  const [overrideType, setOverrideType] = useState("OPEN");
  const [overrideStartsAt, setOverrideStartsAt] = useState("");
  const [overrideEndsAt, setOverrideEndsAt] = useState("");
  const [overrideMeetingLink, setOverrideMeetingLink] = useState("");
  const [overrideLocationLabel, setOverrideLocationLabel] = useState("");
  const [overrideNote, setOverrideNote] = useState("");

  async function loadAvailability() {
    setIsLoading(true);
    try {
      const nextAvailability = await getMyAvailabilitySlots();
      setAvailability(nextAvailability);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load availability");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadAvailability();
  }, []);

  function handleAddSlot(e: React.FormEvent<HTMLFormElement>) {
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
        formData.set("meetingLink", meetingLink);
        formData.set("locationLabel", locationLabel);
        await addAvailabilitySlot(formData);
        await loadAvailability();
        setSuccess("Recurring availability saved.");
        setMeetingLink("");
        setLocationLabel("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save recurring availability");
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
        formData.set("meetingLink", overrideMeetingLink);
        formData.set("locationLabel", overrideLocationLabel);
        formData.set("note", overrideNote);
        await addAdvisorAvailabilityOverride(formData);
        await loadAvailability();
        setSuccess(overrideType === "OPEN" ? "One-off opening added." : "Blocked time saved.");
        setOverrideStartsAt("");
        setOverrideEndsAt("");
        setOverrideMeetingLink("");
        setOverrideLocationLabel("");
        setOverrideNote("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save override");
      }
    });
  }

  function handleRemoveSlot(slotId: string) {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        await removeAvailabilitySlot(slotId);
        await loadAvailability();
        setSuccess("Recurring availability removed.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove slot");
      }
    });
  }

  function handleRemoveOverride(overrideId: string) {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        await deactivateAdvisorAvailabilityOverride(overrideId);
        await loadAvailability();
        setSuccess("Override removed.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove override");
      }
    });
  }

  const slotsByDay = DAY_NAMES.map((name, idx) => ({
    day: name,
    dayIdx: idx,
    slots: availability.slots.filter((slot) => slot.dayOfWeek === idx),
  })).filter((day) => day.slots.length > 0);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">College Advisor</p>
          <h1 className="page-title">Advisor Settings</h1>
          <p className="page-subtitle">Set recurring hours, special openings, and blocked times</p>
        </div>
        <button className="button ghost small" onClick={() => router.push("/advisor-dashboard")}>
          Back to Dashboard
        </button>
      </div>

      <div className="grid two" style={{ alignItems: "start" }}>
        <div className="card">
          <p style={{ fontWeight: 700, marginBottom: "1rem" }}>Recurring Weekly Availability</p>
          <form onSubmit={handleAddSlot} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <div>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.82rem", marginBottom: "0.3rem" }}>
                Day
              </label>
              <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} style={{ width: "100%" }}>
                {DAY_NAMES.map((name, idx) => (
                  <option key={idx} value={idx}>
                    {name}
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
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
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
                placeholder="Zoom, Google Meet, Phone Call, Office..."
                style={{ width: "100%" }}
              />
            </div>
            <button className="button primary" type="submit" disabled={isPending} style={{ width: "100%" }}>
              {isPending ? "Saving..." : "Save Recurring Availability"}
            </button>
          </form>
        </div>

        <div className="card">
          <p style={{ fontWeight: 700, marginBottom: "1rem" }}>One-Off Override</p>
          <p style={{ color: "var(--muted)", fontSize: "0.82rem", marginBottom: "0.85rem" }}>
            Use this to add a special opening or block time when your normal schedule is not enough.
          </p>
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
            {overrideType === "OPEN" && (
              <>
                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: "0.82rem", marginBottom: "0.3rem" }}>
                    Meeting Link
                  </label>
                  <input
                    type="url"
                    value={overrideMeetingLink}
                    onChange={(e) => setOverrideMeetingLink(e.target.value)}
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
                    value={overrideLocationLabel}
                    onChange={(e) => setOverrideLocationLabel(e.target.value)}
                    placeholder="Special office hours, travel window..."
                    style={{ width: "100%" }}
                  />
                </div>
              </>
            )}
            <div>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.82rem", marginBottom: "0.3rem" }}>
                Note
              </label>
              <textarea
                value={overrideNote}
                onChange={(e) => setOverrideNote(e.target.value)}
                rows={3}
                placeholder={overrideType === "OPEN" ? "Optional note about this extra opening" : "Why this time is blocked"}
                style={{ width: "100%", resize: "vertical" }}
              />
            </div>
            <button className="button primary" type="submit" disabled={isPending} style={{ width: "100%" }}>
              {isPending ? "Saving..." : overrideType === "OPEN" ? "Add Special Opening" : "Block Time"}
            </button>
          </form>
        </div>
      </div>

      {error && <p style={{ color: "var(--color-error)", fontWeight: 600, marginTop: "1rem" }}>{error}</p>}
      {success && <p style={{ color: "var(--color-success)", fontWeight: 600, marginTop: "1rem" }}>{success}</p>}

      <div className="grid two" style={{ marginTop: "1.5rem", alignItems: "start" }}>
        <div className="card">
          <p style={{ fontWeight: 700, marginBottom: "1rem" }}>Current Weekly Schedule</p>
          {isLoading ? (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Loading availability...</p>
          ) : slotsByDay.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
              No recurring availability yet. Add your first weekly block above.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {slotsByDay.map((day) => (
                <div key={day.dayIdx}>
                  <p style={{ fontWeight: 600, fontSize: "0.82rem", color: "var(--muted)", marginBottom: "0.35rem" }}>
                    {day.day}
                  </p>
                  {day.slots.map((slot) => (
                    <div
                      key={slot.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "0.75rem",
                        padding: "0.6rem 0.75rem",
                        background: "var(--surface-alt)",
                        borderRadius: "var(--radius-sm)",
                        marginBottom: "0.35rem",
                      }}
                    >
                      <div>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: "0.88rem" }}>
                          {slot.startTime} - {slot.endTime}
                        </p>
                        <p style={{ margin: "0.15rem 0 0", fontSize: "0.75rem", color: "var(--muted)" }}>
                          {slot.slotDuration} min slots, {slot.bufferMinutes} min buffer
                          {slot.locationLabel ? `, ${slot.locationLabel}` : ""}
                        </p>
                      </div>
                      <button
                        className="button ghost small"
                        style={{ color: "#dc2626", padding: "0.2rem 0.55rem" }}
                        onClick={() => handleRemoveSlot(slot.id)}
                        disabled={isPending}
                      >
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
          {isLoading ? (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Loading overrides...</p>
          ) : availability.overrides.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
              No one-off overrides yet.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
              {availability.overrides.map((override) => (
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
                      <p style={{ margin: 0, fontWeight: 700, fontSize: "0.85rem" }}>
                        {override.type === "OPEN" ? "Special opening" : "Blocked time"}
                      </p>
                      <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: "var(--muted)" }}>
                        {formatOverrideWindow(override.startsAt, override.endsAt)}
                      </p>
                      {override.note && (
                        <p style={{ margin: "0.35rem 0 0", fontSize: "0.78rem" }}>{override.note}</p>
                      )}
                    </div>
                    <button
                      className="button ghost small"
                      onClick={() => handleRemoveOverride(override.id)}
                      disabled={isPending}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
