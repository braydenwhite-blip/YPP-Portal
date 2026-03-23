"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  scheduleInterviewSlots,
  acceptAvailabilityAndSchedule,
  cancelInterviewSlot,
  scheduleHiringInterviewSlots,
  type InterviewSchedulePageData,
  type InterviewScheduleItem,
  type InterviewSlotData,
  type AvailabilityRequestData,
} from "@/lib/interview-scheduling-actions";

// ============================================
// STATUS CONFIGS
// ============================================

const GATE_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  REQUIRED: { label: "Needs Scheduling", color: "#d97706", bg: "#fffbeb" },
  SCHEDULED: { label: "Scheduled", color: "#0ea5e9", bg: "#f0f9ff" },
  COMPLETED: { label: "Interview Done", color: "#16a34a", bg: "#f0fdf4" },
  PASSED: { label: "Passed", color: "#16a34a", bg: "#f0fdf4" },
  HOLD: { label: "On Hold", color: "#d97706", bg: "#fffbeb" },
  FAILED: { label: "Failed", color: "#ef4444", bg: "#fef2f2" },
  WAIVED: { label: "Waived", color: "#6b7280", bg: "#f9fafb" },
};

const SLOT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  POSTED: { label: "Available", color: "#0ea5e9" },
  CONFIRMED: { label: "Confirmed", color: "#16a34a" },
  COMPLETED: { label: "Done", color: "#6b7280" },
  CANCELLED: { label: "Cancelled", color: "#ef4444" },
};

// ============================================
// HELPERS
// ============================================

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function defaultSlotTime(offsetHours = 24) {
  const d = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  const local = new Date(d);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 16);
}

function groupByDate(slots: InterviewSlotData[]): Record<string, InterviewSlotData[]> {
  const groups: Record<string, InterviewSlotData[]> = {};
  for (const slot of slots) {
    const date = new Date(slot.scheduledAt).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    if (!groups[date]) groups[date] = [];
    groups[date].push(slot);
  }
  return groups;
}

// ============================================
// SUB-COMPONENTS
// ============================================

function Banner({ type, message, onDismiss }: { type: "success" | "error"; message: string; onDismiss: () => void }) {
  const isSuccess = type === "success";
  return (
    <div
      style={{
        background: isSuccess ? "#f0fdf4" : "#fef2f2",
        border: `1px solid ${isSuccess ? "#bbf7d0" : "#fecaca"}`,
        borderRadius: "var(--radius)",
        padding: "0.75rem 1rem",
        color: isSuccess ? "#16a34a" : "#dc2626",
        fontWeight: 600,
        marginBottom: "1rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span>{isSuccess ? "\u2713" : "\u2717"} {message}</span>
      <button
        onClick={onDismiss}
        style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "1rem", color: "inherit" }}
      >
        \u00d7
      </button>
    </div>
  );
}

function SlotTimeline({ slots, isReviewer, onCancel, cancellingId }: {
  slots: InterviewSlotData[];
  isReviewer: boolean;
  onCancel: (slotId: string) => void;
  cancellingId: string | null;
}) {
  const grouped = groupByDate(slots.filter((s) => s.status !== "CANCELLED"));
  const cancelledSlots = slots.filter((s) => s.status === "CANCELLED");

  if (Object.keys(grouped).length === 0 && cancelledSlots.length === 0) {
    return (
      <p style={{ fontSize: "0.82rem", color: "var(--muted)", fontStyle: "italic" }}>
        No interview slots yet.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {Object.entries(grouped).map(([date, daySlots]) => (
        <div key={date}>
          <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.35rem" }}>
            {date}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            {daySlots.map((slot) => {
              const cfg = SLOT_STATUS_CONFIG[slot.status] ?? { label: slot.status, color: "var(--muted)" };
              const isPast = new Date(slot.scheduledAt) < new Date();
              return (
                <div
                  key={slot.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.5rem 0.75rem",
                    background: slot.status === "CONFIRMED" ? "#f0fdf4" : "var(--surface-alt)",
                    borderRadius: "var(--radius-sm)",
                    borderLeft: `3px solid ${cfg.color}`,
                    opacity: isPast && slot.status === "POSTED" ? 0.6 : 1,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div>
                      <p style={{ fontSize: "0.88rem", fontWeight: 600 }}>
                        {new Date(slot.scheduledAt).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                      <p style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                        {slot.duration} min
                        {slot.source === "INSTRUCTOR_REQUESTED" ? " \u00b7 Instructor requested" : ""}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {slot.meetingLink && (
                      <a
                        href={slot.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="button primary small"
                        style={{ fontSize: "0.7rem", padding: "0.15rem 0.4rem", textDecoration: "none" }}
                      >
                        Join
                      </a>
                    )}
                    <span
                      className="pill"
                      style={{
                        fontSize: "0.68rem",
                        background: cfg.color + "18",
                        color: cfg.color,
                      }}
                    >
                      {cfg.label}
                    </span>
                    {isReviewer && (slot.status === "POSTED" || slot.status === "CONFIRMED") && (
                      <button
                        className="button secondary small"
                        style={{ fontSize: "0.68rem", padding: "0.15rem 0.4rem", color: "#ef4444" }}
                        disabled={cancellingId === slot.id}
                        onClick={() => onCancel(slot.id)}
                      >
                        {cancellingId === slot.id ? "..." : "Cancel"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {cancelledSlots.length > 0 && (
        <details style={{ marginTop: "0.25rem" }}>
          <summary style={{ fontSize: "0.75rem", color: "var(--muted)", cursor: "pointer" }}>
            {cancelledSlots.length} cancelled slot{cancelledSlots.length > 1 ? "s" : ""}
          </summary>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", marginTop: "0.3rem" }}>
            {cancelledSlots.map((slot) => (
              <div
                key={slot.id}
                style={{
                  padding: "0.3rem 0.6rem",
                  background: "var(--surface-alt)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.75rem",
                  color: "var(--muted)",
                  textDecoration: "line-through",
                }}
              >
                {formatDate(slot.scheduledAt)} \u00b7 {slot.duration}min
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function AvailabilityRequestCard({ request, onAccept, isPending }: {
  request: AvailabilityRequestData;
  onAccept: (requestId: string, defaultTime: string) => void;
  isPending: boolean;
}) {
  const firstSlot = request.preferredSlots[0];
  return (
    <div
      style={{
        padding: "0.65rem 0.85rem",
        background: "#fffbeb",
        border: "1px solid #fde68a",
        borderRadius: "var(--radius-sm)",
        marginBottom: "0.4rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.15rem" }}>
            Availability Request from {request.instructorName}
          </p>
          <p style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
            Submitted {new Date(request.createdAt).toLocaleDateString()}
          </p>
        </div>
        <span className="pill" style={{ fontSize: "0.68rem", background: "#fde68a", color: "#92400e" }}>
          Pending
        </span>
      </div>
      <div style={{ marginTop: "0.4rem" }}>
        <p style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", marginBottom: "0.25rem" }}>
          Preferred Times
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
          {request.preferredSlots.map((slot, i) => (
            <span
              key={i}
              style={{
                display: "inline-block",
                fontSize: "0.75rem",
                padding: "0.2rem 0.5rem",
                background: "#fef3c7",
                borderRadius: "99px",
              }}
            >
              {new Date(slot.start).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          ))}
        </div>
      </div>
      {request.note && (
        <p style={{ fontSize: "0.78rem", color: "#78350f", marginTop: "0.35rem", fontStyle: "italic" }}>
          &quot;{request.note}&quot;
        </p>
      )}
      <div style={{ marginTop: "0.5rem" }}>
        <button
          className="button primary small"
          disabled={isPending}
          onClick={() => onAccept(request.id, firstSlot?.start ?? "")}
        >
          Accept & Schedule
        </button>
      </div>
    </div>
  );
}

function AddSlotsForm({ item, onSubmit, isPending }: {
  item: InterviewScheduleItem;
  onSubmit: (formData: FormData) => void;
  isPending: boolean;
}) {
  const [slotCount, setSlotCount] = useState(3);
  const isHiring = item.type === "HIRING";

  return (
    <div
      style={{
        padding: "0.85rem",
        background: "#f5f3ff",
        border: "1px solid #ddd6fe",
        borderRadius: "var(--radius-sm)",
        marginTop: "0.75rem",
      }}
    >
      <p style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: "0.65rem" }}>
        Post Interview Slots
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(new FormData(e.currentTarget));
        }}
        style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}
      >
        {!isHiring && (
          <>
            <input type="hidden" name="instructorId" value={item.instructorId ?? ""} />
            <input type="hidden" name="gateId" value={item.gateId ?? ""} />
          </>
        )}
        {isHiring && (
          <input type="hidden" name="applicationId" value={item.applicationId ?? ""} />
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.5rem" }}>
          {Array.from({ length: slotCount }, (_, i) => (
            <label key={i} style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>
                Slot {i + 1} {i === 0 ? "*" : "(optional)"}
              </span>
              <input
                type="datetime-local"
                name={`slot${i + 1}`}
                className="input"
                required={i === 0}
                defaultValue={defaultSlotTime(24 + i * 24)}
                style={{ fontSize: "0.82rem" }}
              />
            </label>
          ))}
        </div>

        {slotCount < 5 && (
          <button
            type="button"
            className="button secondary small"
            onClick={() => setSlotCount((c) => Math.min(5, c + 1))}
            style={{ alignSelf: "flex-start", fontSize: "0.75rem" }}
          >
            + Add Another Slot
          </button>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>Duration (min)</span>
            <input
              type="number"
              name="duration"
              className="input"
              defaultValue={30}
              min={15}
              max={180}
              style={{ fontSize: "0.82rem" }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>Meeting Link (optional)</span>
            <input
              type="url"
              name="meetingLink"
              className="input"
              placeholder="https://meet.google.com/..."
              style={{ fontSize: "0.82rem" }}
            />
          </label>
        </div>

        <button type="submit" disabled={isPending} className="button primary" style={{ alignSelf: "flex-start" }}>
          {isPending ? "Posting..." : "Post Slots"}
        </button>
      </form>
    </div>
  );
}

function AcceptRequestForm({ request, onSubmit, isPending }: {
  request: AvailabilityRequestData;
  onSubmit: (formData: FormData) => void;
  isPending: boolean;
}) {
  const firstSlot = request.preferredSlots[0];
  const defaultTime = firstSlot ? (() => {
    const d = new Date(firstSlot.start);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  })() : defaultSlotTime();

  return (
    <div
      style={{
        padding: "0.85rem",
        background: "#fffbeb",
        border: "1px solid #fde68a",
        borderRadius: "var(--radius-sm)",
        marginTop: "0.5rem",
      }}
    >
      <p style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.5rem" }}>
        Schedule from Request
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(new FormData(e.currentTarget));
        }}
        style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
      >
        <input type="hidden" name="requestId" value={request.id} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>Scheduled At *</span>
            <input
              type="datetime-local"
              name="scheduledAt"
              className="input"
              required
              defaultValue={defaultTime}
              style={{ fontSize: "0.82rem" }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>Duration (min)</span>
            <input
              type="number"
              name="duration"
              className="input"
              defaultValue={30}
              min={15}
              max={180}
              style={{ fontSize: "0.82rem" }}
            />
          </label>
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>Meeting Link (optional)</span>
          <input
            type="url"
            name="meetingLink"
            className="input"
            placeholder="https://meet.google.com/..."
            style={{ fontSize: "0.82rem" }}
          />
        </label>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <button type="submit" disabled={isPending} className="button primary small">
            {isPending ? "Scheduling..." : "Accept & Schedule"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================
// INTERVIEW CARD
// ============================================

function InterviewScheduleCard({ item, viewer }: {
  item: InterviewScheduleItem;
  viewer: InterviewSchedulePageData["viewer"];
}) {
  const [showAddSlots, setShowAddSlots] = useState(false);
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const statusCfg = GATE_STATUS_CONFIG[item.gateStatus] ?? { label: item.gateStatus, color: "var(--muted)", bg: "var(--surface-alt)" };
  const isHiring = item.type === "HIRING";
  const activeSlots = item.slots.filter((s) => s.status !== "CANCELLED");
  const confirmedSlot = activeSlots.find((s) => s.status === "CONFIRMED");
  const hasPostedSlots = activeSlots.some((s) => s.status === "POSTED");

  function handlePostSlots(formData: FormData) {
    setFeedback(null);
    startTransition(async () => {
      try {
        const action = isHiring ? scheduleHiringInterviewSlots : scheduleInterviewSlots;
        await action(formData);
        setFeedback({ type: "success", message: "Interview slots posted successfully." });
        setShowAddSlots(false);
      } catch (err) {
        setFeedback({ type: "error", message: err instanceof Error ? err.message : "Failed to post slots." });
      }
    });
  }

  function handleAcceptRequest(formData: FormData) {
    setFeedback(null);
    startTransition(async () => {
      try {
        await acceptAvailabilityAndSchedule(formData);
        setFeedback({ type: "success", message: "Request accepted and interview scheduled." });
        setExpandedRequestId(null);
      } catch (err) {
        setFeedback({ type: "error", message: err instanceof Error ? err.message : "Failed to accept request." });
      }
    });
  }

  function handleCancelSlot(slotId: string) {
    setCancellingId(slotId);
    setFeedback(null);
    const formData = new FormData();
    formData.set("slotId", slotId);
    startTransition(async () => {
      try {
        await cancelInterviewSlot(formData);
        setCancellingId(null);
        setFeedback({ type: "success", message: "Slot cancelled." });
      } catch (err) {
        setCancellingId(null);
        setFeedback({ type: "error", message: err instanceof Error ? err.message : "Failed to cancel slot." });
      }
    });
  }

  // Determine CTA label
  let ctaLabel = "Post Interview Slots";
  if (confirmedSlot) ctaLabel = "Add More Slots";
  else if (hasPostedSlots) ctaLabel = "Post Additional Slots";

  return (
    <div
      className="card"
      style={{
        marginBottom: "1rem",
        borderLeft: `4px solid ${statusCfg.color}`,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.65rem" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.15rem" }}>
            <span
              style={{
                fontSize: "0.65rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: isHiring ? "#7c3aed" : "#0ea5e9",
              }}
            >
              {isHiring ? "Hiring" : "Readiness"}
            </span>
            <span
              className="pill"
              style={{ fontSize: "0.68rem", background: statusCfg.bg, color: statusCfg.color }}
            >
              {statusCfg.label}
            </span>
          </div>
          <p style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.1rem" }}>
            {item.personName}
          </p>
          <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
            {isHiring ? item.positionTitle : "Instructor Interview"} \u00b7 {item.chapterName}
            {item.personEmail ? ` \u00b7 ${item.personEmail}` : ""}
          </p>
        </div>
        {isHiring && item.applicationId && (
          <Link
            href={`/applications/${item.applicationId}`}
            className="button secondary small"
            style={{ textDecoration: "none", fontSize: "0.75rem", flexShrink: 0 }}
          >
            Application
          </Link>
        )}
      </div>

      {/* Feedback */}
      {feedback && (
        <Banner type={feedback.type} message={feedback.message} onDismiss={() => setFeedback(null)} />
      )}

      {/* Confirmed interview highlight */}
      {confirmedSlot && (
        <div
          style={{
            padding: "0.65rem 0.85rem",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "var(--radius-sm)",
            marginBottom: "0.75rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <p style={{ fontWeight: 700, color: "#16a34a", fontSize: "0.88rem" }}>
              Interview Confirmed
            </p>
            <p style={{ fontSize: "0.82rem", color: "#166534" }}>
              {formatDate(confirmedSlot.scheduledAt)} \u00b7 {confirmedSlot.duration} min
            </p>
          </div>
          {confirmedSlot.meetingLink && (
            <a
              href={confirmedSlot.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="button primary small"
              style={{ textDecoration: "none" }}
            >
              Join Meeting
            </a>
          )}
        </div>
      )}

      {/* Pending availability requests (readiness only) */}
      {!isHiring && item.pendingRequests.length > 0 && (
        <div style={{ marginBottom: "0.75rem" }}>
          <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.4rem" }}>
            Availability Requests ({item.pendingRequests.length})
          </p>
          {item.pendingRequests.map((req) => (
            <div key={req.id}>
              <AvailabilityRequestCard
                request={req}
                onAccept={(id) => setExpandedRequestId(expandedRequestId === id ? null : id)}
                isPending={isPending}
              />
              {expandedRequestId === req.id && (
                <AcceptRequestForm
                  request={req}
                  onSubmit={handleAcceptRequest}
                  isPending={isPending}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Slot timeline */}
      <div style={{ marginBottom: "0.65rem" }}>
        <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.4rem" }}>
          Interview Slots ({activeSlots.length})
        </p>
        <SlotTimeline
          slots={item.slots}
          isReviewer={viewer.isReviewer}
          onCancel={handleCancelSlot}
          cancellingId={cancellingId}
        />
      </div>

      {/* Actions */}
      {viewer.isReviewer && (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {!showAddSlots ? (
            <button
              className="button primary small"
              onClick={() => setShowAddSlots(true)}
            >
              {ctaLabel}
            </button>
          ) : (
            <button
              className="button secondary small"
              onClick={() => setShowAddSlots(false)}
            >
              Cancel
            </button>
          )}
          {!isHiring && (
            <Link
              href={`/interviews?scope=readiness&view=team`}
              className="button secondary small"
              style={{ textDecoration: "none" }}
            >
              View in Command Center
            </Link>
          )}
        </div>
      )}

      {/* Add slots form */}
      {showAddSlots && viewer.isReviewer && (
        <AddSlotsForm item={item} onSubmit={handlePostSlots} isPending={isPending} />
      )}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

interface Props {
  data: InterviewSchedulePageData;
}

export default function InterviewScheduleClient({ data }: Props) {
  const [filter, setFilter] = useState<"all" | "READINESS" | "HIRING">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "needs_scheduling" | "scheduled" | "completed">("all");

  const filtered = data.items.filter((item) => {
    if (filter !== "all" && item.type !== filter) return false;
    if (statusFilter === "needs_scheduling") {
      return item.gateStatus === "REQUIRED" || item.gateStatus === "HOLD" || item.gateStatus === "FAILED";
    }
    if (statusFilter === "scheduled") {
      return item.gateStatus === "SCHEDULED";
    }
    if (statusFilter === "completed") {
      return item.gateStatus === "COMPLETED" || item.gateStatus === "PASSED" || item.gateStatus === "WAIVED";
    }
    return true;
  });

  // Summary stats
  const needsScheduling = data.items.filter(
    (i) => i.gateStatus === "REQUIRED" || i.gateStatus === "HOLD" || i.gateStatus === "FAILED"
  ).length;
  const scheduled = data.items.filter((i) => i.gateStatus === "SCHEDULED").length;
  const pendingRequests = data.items.reduce((sum, i) => sum + i.pendingRequests.length, 0);

  return (
    <div>
      {/* Page header */}
      <div className="topbar">
        <div>
          <p className="badge">Interview Ops</p>
          <h1 className="page-title">Interview Scheduling</h1>
          <p className="page-subtitle">
            Schedule, manage, and track all interview slots in one place.
          </p>
        </div>
        <Link href="/interviews" className="button secondary small" style={{ textDecoration: "none" }}>
          Command Center
        </Link>
      </div>

      {/* Summary cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "0.75rem",
          marginBottom: "1.25rem",
        }}
      >
        <div className="card" style={{ padding: "0.85rem", textAlign: "center" }}>
          <p style={{ fontSize: "1.75rem", fontWeight: 800, color: "#d97706" }}>{needsScheduling}</p>
          <p style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>Needs Scheduling</p>
        </div>
        <div className="card" style={{ padding: "0.85rem", textAlign: "center" }}>
          <p style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0ea5e9" }}>{scheduled}</p>
          <p style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>Scheduled</p>
        </div>
        <div className="card" style={{ padding: "0.85rem", textAlign: "center" }}>
          <p style={{ fontSize: "1.75rem", fontWeight: 800, color: "#f59e0b" }}>{pendingRequests}</p>
          <p style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>Pending Requests</p>
        </div>
        <div className="card" style={{ padding: "0.85rem", textAlign: "center" }}>
          <p style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--muted)" }}>{data.items.length}</p>
          <p style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>Total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: "1rem", padding: "0.75rem 1rem" }}>
        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", marginBottom: "0.3rem" }}>
              Type
            </p>
            <div style={{ display: "flex", gap: "0.35rem" }}>
              {(["all", "READINESS", "HIRING"] as const).map((f) => (
                <button
                  key={f}
                  className={`button small ${filter === f ? "primary" : "secondary"}`}
                  onClick={() => setFilter(f)}
                  style={{ fontSize: "0.72rem", padding: "0.2rem 0.6rem" }}
                >
                  {f === "all" ? "All" : f === "READINESS" ? "Readiness" : "Hiring"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", marginBottom: "0.3rem" }}>
              Status
            </p>
            <div style={{ display: "flex", gap: "0.35rem" }}>
              {(["all", "needs_scheduling", "scheduled", "completed"] as const).map((f) => (
                <button
                  key={f}
                  className={`button small ${statusFilter === f ? "primary" : "secondary"}`}
                  onClick={() => setStatusFilter(f)}
                  style={{ fontSize: "0.72rem", padding: "0.2rem 0.6rem" }}
                >
                  {f === "all" ? "All" : f === "needs_scheduling" ? "Needs Scheduling" : f === "scheduled" ? "Scheduled" : "Completed"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Interview list */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ fontSize: "1.25rem", marginBottom: "0.5rem", color: "var(--muted)" }}>
            No interviews match this filter.
          </p>
          <p style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
            {data.items.length === 0
              ? data.viewer.isReviewer
                ? "No active interviews require scheduling right now."
                : "You have no pending interview scheduling items."
              : "Try adjusting the filters above."}
          </p>
        </div>
      ) : (
        <div>
          {filtered.map((item) => (
            <InterviewScheduleCard key={item.id} item={item} viewer={data.viewer} />
          ))}
        </div>
      )}
    </div>
  );
}
