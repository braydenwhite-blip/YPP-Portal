"use client";

import { useState, useTransition } from "react";
import type { ReactNode } from "react";
import { offerInterviewSlots } from "@/lib/instructor-application-actions";
import { cleanMeetingDetails, isHttpUrl } from "@/lib/meeting-details";

interface OfferedSlot {
  id: string;
  scheduledAt: Date;
  durationMinutes: number;
  meetingUrl: string | null;
  confirmedAt: Date | null;
  offeredBy: { name: string | null };
}

interface AvailabilityWindow {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timezone: string;
}

interface Props {
  applicationId: string;
  offeredSlots: OfferedSlot[];
  availabilityWindows: AvailabilityWindow[];
  canPostSlots: boolean;
  children?: ReactNode;
}

type SlotDraft = {
  id: number;
  scheduledAt: string;
  durationMinutes: string;
};

function slotStatus(slot: OfferedSlot): string {
  if (slot.confirmedAt) return "CONFIRMED";
  return "POSTED";
}

function formatDt(dt: Date | string) {
  return new Date(dt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function InterviewSchedulingInlinePanel({
  applicationId,
  offeredSlots,
  availabilityWindows,
  canPostSlots,
  children,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(null);
  const [meetingUrl, setMeetingUrl] = useState("");
  const [slotDrafts, setSlotDrafts] = useState<SlotDraft[]>([
    { id: 1, scheduledAt: "", durationMinutes: "60" },
    { id: 2, scheduledAt: "", durationMinutes: "60" },
    { id: 3, scheduledAt: "", durationMinutes: "60" },
  ]);

  function updateSlotDraft(id: number, patch: Partial<SlotDraft>) {
    setSlotDrafts((current) =>
      current.map((slot) => (slot.id === id ? { ...slot, ...patch } : slot))
    );
  }

  function handleSendTimes(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsedSlots = slotDrafts.map((slot) => ({
      scheduledAt: new Date(slot.scheduledAt),
      durationMinutes: Number(slot.durationMinutes || 60),
      meetingUrl: cleanMeetingDetails(meetingUrl),
    }));
    const meetingDetails = cleanMeetingDetails(meetingUrl);

    if (!meetingDetails) {
      setResult({ text: "Add meeting details before emailing interview times.", ok: false });
      return;
    }

    if (parsedSlots.some((slot) => Number.isNaN(slot.scheduledAt.getTime()))) {
      setResult({ text: "Fill in a valid date and time for all 3 required rows.", ok: false });
      return;
    }

    const now = new Date();
    if (parsedSlots.some((slot) => slot.scheduledAt <= now)) {
      setResult({ text: "All proposed times must be in the future.", ok: false });
      return;
    }

    const uniqueTimes = new Set(parsedSlots.map((slot) => slot.scheduledAt.getTime()));
    if (uniqueTimes.size !== parsedSlots.length) {
      setResult({ text: "Each proposed time must be different.", ok: false });
      return;
    }

    startTransition(async () => {
      try {
        const response = await offerInterviewSlots(applicationId, parsedSlots);
        if (!response.success) {
          throw new Error(response.error ?? "Failed to send times.");
        }
        setResult({ text: "Times sent. The applicant can now pick one on their status page.", ok: true });
        setSlotDrafts([
          { id: 1, scheduledAt: "", durationMinutes: "60" },
          { id: 2, scheduledAt: "", durationMinutes: "60" },
          { id: 3, scheduledAt: "", durationMinutes: "60" },
        ]);
        setMeetingUrl("");
      } catch (err) {
        setResult({ text: err instanceof Error ? err.message : "Failed to send times.", ok: false });
      }
    });
  }

  const confirmed = offeredSlots.filter((s) => s.confirmedAt);
  const pending_slots = offeredSlots.filter((s) => !s.confirmedAt);
  const schedulerHref = `/interviews/schedule?panel=calendars&domain=HIRING&applicationId=${encodeURIComponent(applicationId)}&source=instructorApplicant`;

  return (
    <section id="section-scheduling" className="cockpit-panel cockpit-scheduling-panel">
      <div className="cockpit-panel-header-row">
        <div className="cockpit-section-heading">
          <span className="cockpit-section-kicker">Automatic applicant email</span>
          <h2>Interview Scheduling</h2>
        </div>
        <a
          href={schedulerHref}
          className="button outline cockpit-inline-button"
        >
          Open interviewer calendars
        </a>
      </div>
      <p className="cockpit-scheduler-bridge">
        <strong>Automatic email offer.</strong> The assigned lead interviewer chooses
        exactly 3 future options, the portal emails them to the applicant, and the
        applicant picks the one that works.
      </p>

      {children}

      {/* Confirmed slots */}
      {confirmed.length > 0 && (
        <div className="cockpit-slot-group">
          <p className="cockpit-slot-title is-confirmed">
            Confirmed ({confirmed.length})
          </p>
          {confirmed.map((slot) => (
            <div
              key={slot.id}
              className="cockpit-slot-card is-confirmed"
            >
              {formatDt(slot.scheduledAt)} | {slot.durationMinutes} min
              {slot.meetingUrl ? (
                <>
                  {" | "}
                  {isHttpUrl(slot.meetingUrl) ? (
                    <a href={slot.meetingUrl} target="_blank" rel="noreferrer" className="cockpit-text-link">
                      Join link
                    </a>
                  ) : (
                    <span>Meeting details: {slot.meetingUrl}</span>
                  )}
                </>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {/* Posted (pending confirmation) */}
      {pending_slots.length > 0 && (
        <div className="cockpit-slot-group">
          <p className="cockpit-slot-title">
            Sent to applicant, awaiting confirmation ({pending_slots.length})
          </p>
          {pending_slots.map((slot) => (
            <div
              key={slot.id}
              className="cockpit-slot-card"
            >
              {formatDt(slot.scheduledAt)} | {slot.durationMinutes} min | by {slot.offeredBy.name ?? "Unknown"}
            </div>
          ))}
        </div>
      )}

      {/* Applicant availability windows */}
      {availabilityWindows.length > 0 && (
        <div className="cockpit-slot-group">
          <p className="cockpit-slot-title is-requested">
            Legacy Applicant Availability Notes ({availabilityWindows.length})
          </p>
          {availabilityWindows.map((w) => {
            const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
            return (
              <div
                key={w.id}
                className="cockpit-slot-card is-requested"
              >
                {days[w.dayOfWeek]} {w.startTime}-{w.endTime}
                <span>({w.timezone})</span>
              </div>
            );
          })}
        </div>
      )}

      {offeredSlots.length === 0 && availabilityWindows.length === 0 && (
        <p className="cockpit-muted">
          No official applicant time offers have been posted yet.
        </p>
      )}

      {/* Lead sends exactly three proposed times. */}
      {canPostSlots && (
        <form onSubmit={handleSendTimes} className="cockpit-slot-form">
          <p>Email 3 proposed interview times</p>
          <label className="cockpit-slot-meeting-link">
            <span>Meeting details</span>
            <input
              type="text"
              className="input"
              required
              value={meetingUrl}
              onChange={(event) => setMeetingUrl(event.target.value)}
              placeholder="Zoom link, Google Meet link, room number, phone call, or TBD"
            />
          </label>
          <div className="cockpit-slot-draft-list">
            {slotDrafts.map((slot, index) => (
              <div key={slot.id} className="cockpit-slot-draft-row">
                <label>
                  <span>Option {index + 1}</span>
                  <input
                    type="datetime-local"
                    required
                    className="input"
                    value={slot.scheduledAt}
                    onChange={(event) =>
                      updateSlotDraft(slot.id, { scheduledAt: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span>Duration</span>
                  <select
                    className="input"
                    value={slot.durationMinutes}
                    onChange={(event) =>
                      updateSlotDraft(slot.id, { durationMinutes: event.target.value })
                    }
                  >
                    <option value="30">30 min</option>
                    <option value="45">45 min</option>
                    <option value="60">60 min</option>
                    <option value="90">90 min</option>
                  </select>
                </label>
              </div>
            ))}
          </div>
          <div className="cockpit-slot-form-actions">
            <button type="submit" className="button cockpit-inline-button" disabled={pending}>
              {pending ? "Emailing..." : "Email times"}
            </button>
          </div>
          {result && (
            <p className={result.ok ? "cockpit-form-success" : "cockpit-form-error"}>
              {result.text}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
