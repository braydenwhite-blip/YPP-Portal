"use client";

import { useState, useTransition } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  offerInterviewSlots,
  reviewInstructorApplication,
} from "@/lib/instructor-application-actions";
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

/**
 * An interview time the current interviewer has already sent out (or had
 * confirmed) for a *different* applicant. Surfaced so the interviewer can
 * avoid double-booking themselves when proposing new times.
 */
interface InterviewCommitment {
  id: string;
  scheduledAt: Date;
  durationMinutes: number;
  confirmed: boolean;
  applicantName: string;
}

interface Props {
  applicationId: string;
  offeredSlots: OfferedSlot[];
  availabilityWindows: AvailabilityWindow[];
  canPostSlots: boolean;
  /** The interviewer's existing interview times for other applicants. */
  myCommitments?: InterviewCommitment[];
  children?: ReactNode;
}

const CONFLICT_WARNING_STYLE: CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  fontWeight: 600,
  color: "#b45309",
  background: "rgba(251, 191, 36, 0.12)",
  border: "1px solid rgba(245, 158, 11, 0.35)",
  borderRadius: 8,
  padding: "6px 8px",
};

function intervalsOverlap(
  startA: Date,
  durationA: number,
  startB: Date,
  durationB: number
): boolean {
  const aStart = startA.getTime();
  const aEnd = aStart + durationA * 60_000;
  const bStart = startB.getTime();
  const bEnd = bStart + durationB * 60_000;
  return aStart < bEnd && bStart < aEnd;
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
  myCommitments = [],
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
  const [directAt, setDirectAt] = useState("");
  const [directNotes, setDirectNotes] = useState("");
  const [directPending, startDirectTransition] = useTransition();
  const [directResult, setDirectResult] = useState<{ text: string; ok: boolean } | null>(null);

  function handleSetDirect(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!directAt) {
      setDirectResult({ text: "Pick a date and time first.", ok: false });
      return;
    }
    const scheduledAt = new Date(directAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      setDirectResult({ text: "That date/time is not valid.", ok: false });
      return;
    }
    if (scheduledAt <= new Date()) {
      setDirectResult({ text: "Interview time must be in the future.", ok: false });
      return;
    }
    startDirectTransition(async () => {
      const formData = new FormData();
      formData.set("applicationId", applicationId);
      formData.set("action", "schedule_interview");
      formData.set("scheduledAt", scheduledAt.toISOString());
      const notes = directNotes.trim();
      if (notes) {
        formData.set("notes", notes);
      }
      const response = await reviewInstructorApplication(
        { status: "idle", message: "" },
        formData
      );
      if (response.status === "error") {
        setDirectResult({ text: response.message || "Failed to set interview time.", ok: false });
        return;
      }
      setDirectNotes("");
      setDirectResult({
        text: "Interview scheduled. Open the interview workspace when you're ready to run it.",
        ok: true,
      });
    });
  }

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
  const schedulerHref = `/interviews/schedule?domain=HIRING&applicationId=${encodeURIComponent(applicationId)}&source=instructorApplicant`;

  const sortedCommitments = [...myCommitments].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );

  // Returns the interviewer's other interview times that overlap a proposed time.
  function conflictsFor(value: string, durationMinutes: number): InterviewCommitment[] {
    if (!value) return [];
    const start = new Date(value);
    if (Number.isNaN(start.getTime())) return [];
    const duration = Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 60;
    return myCommitments.filter((commitment) =>
      intervalsOverlap(
        start,
        duration,
        new Date(commitment.scheduledAt),
        commitment.durationMinutes
      )
    );
  }

  function renderConflictNote(conflicts: InterviewCommitment[]): ReactNode {
    if (conflicts.length === 0) return null;
    const hasConfirmed = conflicts.some((conflict) => conflict.confirmed);
    const detail = conflicts
      .map((conflict) => `${conflict.applicantName} (${formatDt(conflict.scheduledAt)})`)
      .join(", ");
    return (
      <p style={CONFLICT_WARNING_STYLE} role="alert">
        ⚠ {hasConfirmed
          ? "Double-booking: this overlaps a confirmed interview"
          : "This overlaps interview times you already sent out"}
        : {detail}
      </p>
    );
  }

  return (
    <section id="section-scheduling" className="rounded-[12px] border border-line-soft bg-surface p-[22px] shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="mb-4 grid gap-0.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.11em] text-brand-700">Automatic applicant email</span>
          <h2>Interview Scheduling</h2>
        </div>
        <a
          href={schedulerHref}
          className="inline-flex cursor-pointer items-center justify-center rounded-[8px] border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold text-brand-800 hover:border-brand-400 hover:bg-brand-50 disabled:pointer-events-none disabled:opacity-50"
        >
          Open scheduler
        </a>
      </div>
      <p className="m-0 mb-3 rounded-[8px] border border-line-soft bg-surface-soft px-3 py-2 text-[12.5px] leading-relaxed text-ink-muted">
        <strong>Automatic email offer.</strong> The assigned lead interviewer chooses
        exactly 3 future options, the portal emails them to the applicant, and the
        applicant picks the one that works.
      </p>

      {canPostSlots && sortedCommitments.length > 0 && (
        <div className="mb-3.5 flex flex-col gap-1.5">
          <p className="m-0 text-[12.5px] font-bold text-ink">
            Your other interview times ({sortedCommitments.length})
          </p>
          <p className="m-0 text-[13px] text-ink-muted" style={{ marginTop: -2, marginBottom: 8 }}>
            Times you&apos;ve already sent out or confirmed for other interviews.
            Check these before proposing new times so you don&apos;t double-book
            yourself.
          </p>
          {sortedCommitments.map((commitment) => (
            <div key={commitment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-line-soft bg-surface-soft px-3 py-2 text-[13px] text-ink">
              {formatDt(commitment.scheduledAt)} | {commitment.durationMinutes} min |{" "}
              {commitment.applicantName}
              {commitment.confirmed ? (
                <strong style={{ color: "#047857" }}> · Confirmed</strong>
              ) : (
                <span className="text-[12px] text-ink-muted"> · Awaiting confirmation</span>
              )}
            </div>
          ))}
        </div>
      )}

      {canPostSlots && (
        <form onSubmit={handleSetDirect} className="mt-2 flex flex-col gap-2.5">
          <p>
            <strong>Skip the offer step.</strong> If you and the applicant have
            already agreed on a time, set it directly here. Status moves to{" "}
            <em>Interview scheduled</em> and the interview workspace opens up.
          </p>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 500 }}>Interview time</span>
              <input
                type="datetime-local"
                className="input"
                value={directAt}
                onChange={(event) => setDirectAt(event.target.value)}
                style={{ minWidth: 220 }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 500 }}>Notes (optional)</span>
              <input
                type="text"
                className="input"
                value={directNotes}
                onChange={(event) => setDirectNotes(event.target.value)}
                placeholder="Meeting link, room, or any notes"
                style={{ minWidth: 220 }}
              />
            </label>
            <button
              type="submit"
              className="inline-flex cursor-pointer items-center justify-center rounded-[8px] bg-brand-600 px-3.5 py-2 text-[13px] font-semibold text-white shadow-card hover:bg-brand-700 disabled:pointer-events-none disabled:opacity-50"
              disabled={directPending || !directAt}
              style={{ alignSelf: "end" }}
            >
              {directPending ? "Saving..." : "Set interview time"}
            </button>
          </div>
          {renderConflictNote(conflictsFor(directAt, 60))}
          {directResult && (
            <p className={directResult.ok ? "m-0 text-[12.5px] font-semibold text-success-600" : "m-0 text-[12.5px] font-semibold text-danger-700"}>
              {directResult.text}
            </p>
          )}
        </form>
      )}

      {children}

      {/* Confirmed slots */}
      {confirmed.length > 0 && (
        <div className="mb-3.5 flex flex-col gap-1.5">
          <p className="m-0 text-[12.5px] font-bold text-emerald-700">
            Confirmed ({confirmed.length})
          </p>
          {confirmed.map((slot) => (
            <div
              key={slot.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-[13px] text-ink"
            >
              {formatDt(slot.scheduledAt)} | {slot.durationMinutes} min
              {slot.meetingUrl ? (
                <>
                  {" | "}
                  {isHttpUrl(slot.meetingUrl) ? (
                    <a href={slot.meetingUrl} target="_blank" rel="noreferrer" className="text-[12.5px] font-semibold text-brand-700 hover:underline">
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
        <div className="mb-3.5 flex flex-col gap-1.5">
          <p className="m-0 text-[12.5px] font-bold text-ink">
            Sent to applicant, awaiting confirmation ({pending_slots.length})
          </p>
          {pending_slots.map((slot) => (
            <div
              key={slot.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-line-soft bg-surface-soft px-3 py-2 text-[13px] text-ink"
            >
              {formatDt(slot.scheduledAt)} | {slot.durationMinutes} min | by {slot.offeredBy.name ?? "Unknown"}
            </div>
          ))}
        </div>
      )}

      {/* Applicant availability windows */}
      {availabilityWindows.length > 0 && (
        <div className="mb-3.5 flex flex-col gap-1.5">
          <p className="m-0 text-[12.5px] font-bold text-amber-800">
            Legacy Applicant Availability Notes ({availabilityWindows.length})
          </p>
          {availabilityWindows.map((w) => {
            const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
            return (
              <div
                key={w.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-amber-200 bg-amber-50/60 px-3 py-2 text-[13px] text-ink"
              >
                {days[w.dayOfWeek]} {w.startTime}-{w.endTime}
                <span>({w.timezone})</span>
              </div>
            );
          })}
        </div>
      )}

      {offeredSlots.length === 0 && availabilityWindows.length === 0 && (
        <p className="m-0 text-[13px] text-ink-muted">
          No official applicant time offers have been posted yet.
        </p>
      )}

      {/* Lead sends exactly three proposed times. */}
      {canPostSlots && (
        <form onSubmit={handleSendTimes} className="mt-2 flex flex-col gap-2.5">
          <p>Email 3 proposed interview times</p>
          <label className="flex flex-col gap-1 text-[12.5px] font-semibold text-ink">
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
          <div className="flex flex-col gap-1.5">
            {slotDrafts.map((slot, index) => {
              const conflicts = conflictsFor(
                slot.scheduledAt,
                Number(slot.durationMinutes || 60)
              );
              return (
                <div key={slot.id}>
                  <div className="flex flex-wrap items-center gap-2">
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
                  {renderConflictNote(conflicts)}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className="inline-flex cursor-pointer items-center justify-center rounded-[8px] bg-brand-600 px-3.5 py-2 text-[13px] font-semibold text-white shadow-card hover:bg-brand-700 disabled:pointer-events-none disabled:opacity-50" disabled={pending}>
              {pending ? "Emailing..." : "Email times"}
            </button>
          </div>
          {result && (
            <p className={result.ok ? "m-0 text-[12.5px] font-semibold text-success-600" : "m-0 text-[12.5px] font-semibold text-danger-700"}>
              {result.text}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
