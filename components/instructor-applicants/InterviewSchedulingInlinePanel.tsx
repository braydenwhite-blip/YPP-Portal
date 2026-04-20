"use client";

import { useState, useTransition } from "react";
import { postInterviewSlot } from "@/lib/instructor-interview-actions";

interface OfferedSlot {
  id: string;
  scheduledAt: Date;
  durationMinutes: number;
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
}

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
}: Props) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function handlePostSlot(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("instructorApplicationId", applicationId);
    startTransition(async () => {
      try {
        await postInterviewSlot(fd);
        setResult("Slot posted.");
        (e.target as HTMLFormElement).reset();
      } catch (err) {
        setResult(err instanceof Error ? err.message : "Failed to post slot.");
      }
    });
  }

  const confirmed = offeredSlots.filter((s) => s.confirmedAt);
  const pending_slots = offeredSlots.filter((s) => !s.confirmedAt);

  return (
    <section id="section-scheduling" className="cockpit-panel cockpit-scheduling-panel">
      <div className="cockpit-panel-header-row">
        <div className="cockpit-section-heading">
          <span className="cockpit-section-kicker">Interview logistics</span>
          <h2>Scheduling</h2>
        </div>
        <a
          href={`/interviews/schedule?applicationId=${applicationId}`}
          className="button outline cockpit-inline-button"
        >
          Open scheduling workspace
        </a>
      </div>

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
            </div>
          ))}
        </div>
      )}

      {/* Posted (pending confirmation) */}
      {pending_slots.length > 0 && (
        <div className="cockpit-slot-group">
          <p className="cockpit-slot-title">
            Awaiting Confirmation ({pending_slots.length})
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
            Applicant Availability Requests ({availabilityWindows.length})
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
          No slots posted yet.
        </p>
      )}

      {/* Quick post-slot form */}
      {canPostSlots && (
        <form onSubmit={handlePostSlot} className="cockpit-slot-form">
          <p>Post a Slot</p>
          <div>
            <input
              type="datetime-local"
              name="scheduledAt"
              required
              className="input"
            />
            <select name="durationMinutes" className="input">
              <option value="30">30 min</option>
              <option value="45">45 min</option>
              <option value="60" defaultValue="60">60 min</option>
              <option value="90">90 min</option>
            </select>
            <button type="submit" className="button cockpit-inline-button" disabled={pending}>
              {pending ? "Posting…" : "Post"}
            </button>
          </div>
          {result && (
            <p className={result.startsWith("Failed") ? "cockpit-form-error" : "cockpit-form-success"}>
              {result}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
