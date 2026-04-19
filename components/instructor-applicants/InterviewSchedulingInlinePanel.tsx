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
  startAt: Date;
  endAt: Date;
  note: string | null;
  applicant?: { name: string | null };
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
    <section id="section-scheduling" className="card" style={{ padding: "20px 24px", marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Scheduling</h2>
        <a
          href={`/interviews/schedule?applicationId=${applicationId}`}
          className="button outline"
          style={{ fontSize: 13, padding: "4px 12px" }}
        >
          Open in scheduling workspace →
        </a>
      </div>

      {/* Confirmed slots */}
      {confirmed.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: "#16a34a" }}>
            Confirmed ({confirmed.length})
          </p>
          {confirmed.map((slot) => (
            <div
              key={slot.id}
              style={{
                padding: "8px 12px",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 6,
                marginBottom: 6,
                fontSize: 13,
              }}
            >
              ✓ {formatDt(slot.scheduledAt)} · {slot.durationMinutes} min
            </div>
          ))}
        </div>
      )}

      {/* Posted (pending confirmation) */}
      {pending_slots.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>
            Awaiting Confirmation ({pending_slots.length})
          </p>
          {pending_slots.map((slot) => (
            <div
              key={slot.id}
              style={{
                padding: "8px 12px",
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                marginBottom: 6,
                fontSize: 13,
              }}
            >
              {formatDt(slot.scheduledAt)} · {slot.durationMinutes} min · by {slot.offeredBy.name ?? "Unknown"}
            </div>
          ))}
        </div>
      )}

      {/* Applicant availability windows */}
      {availabilityWindows.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: "#b45309" }}>
            Applicant Availability Requests ({availabilityWindows.length})
          </p>
          {availabilityWindows.map((w) => (
            <div
              key={w.id}
              style={{
                padding: "8px 12px",
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: 6,
                marginBottom: 6,
                fontSize: 13,
              }}
            >
              {formatDt(w.startAt)} – {formatDt(w.endAt)}
              {w.note && <span style={{ marginLeft: 8, color: "var(--muted)" }}>· {w.note}</span>}
            </div>
          ))}
        </div>
      )}

      {offeredSlots.length === 0 && availabilityWindows.length === 0 && (
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 16px" }}>
          No slots posted yet.
        </p>
      )}

      {/* Quick post-slot form */}
      {canPostSlots && (
        <form onSubmit={handlePostSlot} style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600 }}>Post a Slot</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="datetime-local"
              name="scheduledAt"
              required
              className="input"
              style={{ fontSize: 13 }}
            />
            <select name="durationMinutes" className="input" style={{ fontSize: 13, width: "auto" }}>
              <option value="30">30 min</option>
              <option value="45">45 min</option>
              <option value="60" defaultValue="60">60 min</option>
              <option value="90">90 min</option>
            </select>
            <button type="submit" className="button" disabled={pending} style={{ fontSize: 13 }}>
              {pending ? "Posting…" : "Post"}
            </button>
          </div>
          {result && (
            <p style={{ margin: "8px 0 0", fontSize: 13, color: result.startsWith("Failed") ? "#dc2626" : "#16a34a" }}>
              {result}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
