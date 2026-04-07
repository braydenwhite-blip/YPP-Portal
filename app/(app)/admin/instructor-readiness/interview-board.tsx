"use client";

import Link from "next/link";
import { KanbanBoard, KanbanDetailPanel, PanelToast, useToast, type KanbanColumnDef } from "@/components/kanban";
import { updateInterviewGateStatus } from "@/lib/readiness-kanban-actions";
import { useTransition } from "react";

/* ── Types ─────────────────────────────────────────── */

export type InterviewSlot = {
  id: string;
  status: string;
  scheduledAt: string;
  duration: number;
  meetingLink: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
};

export type InterviewGateItem = {
  id: string;
  status: string;
  outcome: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
  reviewNotes: string | null;
  updatedAt: string;
  instructor: {
    id: string;
    name: string;
    email: string;
    chapter: { name: string } | null;
  };
  slots: InterviewSlot[];
  availabilityRequests: { id: string; status: string; createdAt: string }[];
};

/* ── Column definitions ────────────────────────────── */

const COLUMNS: KanbanColumnDef[] = [
  { id: "required", title: "Required", statuses: ["REQUIRED"], color: "#6b21c8" },
  { id: "scheduled", title: "Scheduled", statuses: ["SCHEDULED"], color: "#2563eb" },
  { id: "completed", title: "Completed", statuses: ["COMPLETED"], color: "#4338ca" },
  { id: "passed", title: "Passed", statuses: ["PASSED"], color: "#16a34a" },
  { id: "failed", title: "Failed", statuses: ["FAILED"], color: "#dc2626" },
  { id: "hold", title: "Hold", statuses: ["HOLD"], color: "#71717a" },
  { id: "waived", title: "Waived", statuses: ["WAIVED"], color: "#a3a3a3" },
];

/* ── Helpers ────────────────────────────────────────── */

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusColor(status: string): string {
  switch (status) {
    case "REQUIRED": return "#6b21c8";
    case "SCHEDULED": return "#2563eb";
    case "COMPLETED": return "#4338ca";
    case "PASSED": return "#16a34a";
    case "FAILED": return "#dc2626";
    case "HOLD": return "#71717a";
    case "WAIVED": return "#a3a3a3";
    default: return "#6b7280";
  }
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(d: string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ── Card ─────────────────────────────────────────── */

function InterviewCard({
  item,
  onClick,
  isDragging,
}: {
  item: InterviewGateItem;
  onClick: () => void;
  isDragging?: boolean;
}) {
  const confirmedSlots = item.slots.filter((s) => s.status === "CONFIRMED" || s.status === "COMPLETED");

  return (
    <div
      className={`kanban-card${isDragging ? " dragging" : ""}`}
      onClick={(e) => {
        if (e.defaultPrevented) return;
        onClick();
      }}
    >
      <div className="kanban-card-name">{item.instructor.name}</div>
      <div className="kanban-card-meta">
        {item.instructor.chapter && (
          <span className="kanban-card-chapter">{item.instructor.chapter.name}</span>
        )}
      </div>
      <div className="kanban-card-footer">
        <span
          style={{
            display: "inline-block",
            fontSize: 10,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 9999,
            color: "#fff",
            background: statusColor(item.status),
          }}
        >
          {statusLabel(item.status)}
        </span>
        {confirmedSlots.length > 0 && (
          <span style={{ fontSize: 11, color: "var(--muted)" }}>
            {confirmedSlots.length} slot{confirmedSlots.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Drag Overlay ─────────────────────────────────── */

function DragOverlayCard({ item }: { item: InterviewGateItem }) {
  return (
    <div className="kanban-card" style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.15)", width: 264 }}>
      <div className="kanban-card-name">{item.instructor.name}</div>
      <div className="kanban-card-meta">
        {item.instructor.chapter && (
          <span className="kanban-card-chapter">{item.instructor.chapter.name}</span>
        )}
      </div>
    </div>
  );
}

/* ── Detail Panel ─────────────────────────────────── */

function InterviewDetailPanel({
  item,
  onClose,
  onUpdate,
}: {
  item: InterviewGateItem;
  onClose: () => void;
  onUpdate: (updated: Partial<InterviewGateItem> & { id: string }) => void;
}) {
  const { message, show } = useToast();
  const [isPending, startTransition] = useTransition();

  const confirmedSlot = item.slots.find((s) => s.status === "CONFIRMED");
  const completedSlot = item.slots.find((s) => s.status === "COMPLETED");

  function handleStatusUpdate(newStatus: string) {
    startTransition(async () => {
      const result = await updateInterviewGateStatus(item.id, newStatus);
      if (result.success) {
        onUpdate({ id: item.id, status: newStatus });
        show(`Status updated to ${statusLabel(newStatus)}`);
      } else {
        show(`Error: ${result.error}`);
      }
    });
  }

  return (
    <KanbanDetailPanel
      title={item.instructor.name}
      subtitle={`${item.instructor.email} - ${item.instructor.chapter?.name || "No chapter"}`}
      statusBadge={
        <span
          style={{
            display: "inline-block",
            fontSize: 11,
            fontWeight: 600,
            padding: "2px 10px",
            borderRadius: 9999,
            color: "#fff",
            background: statusColor(item.status),
          }}
        >
          {statusLabel(item.status)}
        </span>
      }
      onClose={onClose}
    >
      <PanelToast message={message} />

      <div style={{ padding: "16px 24px", display: "grid", gap: 16 }}>
        {/* Interview details */}
        <div>
          <h4 style={{ margin: "0 0 8px", fontSize: 13, color: "var(--muted)" }}>Interview Details</h4>
          <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
            <div>
              <strong>Current Status:</strong> {statusLabel(item.status)}
            </div>
            {item.outcome && (
              <div>
                <strong>Outcome:</strong> {item.outcome}
              </div>
            )}
            <div>
              <strong>Last Updated:</strong> {formatDate(item.updatedAt)}
            </div>
          </div>
        </div>

        {/* Slot info */}
        {confirmedSlot && (
          <div>
            <h4 style={{ margin: "0 0 8px", fontSize: 13, color: "var(--muted)" }}>Confirmed Slot</h4>
            <div style={{ display: "grid", gap: 4, fontSize: 14 }}>
              <div>{formatDateTime(confirmedSlot.scheduledAt)} ({confirmedSlot.duration} min)</div>
              {confirmedSlot.meetingLink && (
                <a href={confirmedSlot.meetingLink} target="_blank" rel="noreferrer" className="link">
                  Join meeting
                </a>
              )}
            </div>
          </div>
        )}

        {completedSlot && (
          <div>
            <h4 style={{ margin: "0 0 8px", fontSize: 13, color: "var(--muted)" }}>Completed Slot</h4>
            <div style={{ fontSize: 14 }}>
              Completed: {formatDateTime(completedSlot.completedAt)}
            </div>
          </div>
        )}

        {/* All slots summary */}
        {item.slots.length > 0 && (
          <div>
            <h4 style={{ margin: "0 0 8px", fontSize: 13, color: "var(--muted)" }}>
              All Slots ({item.slots.length})
            </h4>
            <div style={{ display: "grid", gap: 6 }}>
              {item.slots.map((slot) => (
                <div
                  key={slot.id}
                  style={{
                    fontSize: 13,
                    padding: "6px 10px",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>{formatDateTime(slot.scheduledAt)} ({slot.duration} min)</span>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{slot.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending availability requests */}
        {item.availabilityRequests.length > 0 && (
          <div>
            <h4 style={{ margin: "0 0 4px", fontSize: 13, color: "var(--muted)" }}>
              Pending Availability Requests: {item.availabilityRequests.length}
            </h4>
          </div>
        )}

        {/* Review notes */}
        {item.reviewNotes && (
          <div>
            <h4 style={{ margin: "0 0 4px", fontSize: 13, color: "var(--muted)" }}>Review Notes</h4>
            <p style={{ margin: 0, fontSize: 14 }}>{item.reviewNotes}</p>
          </div>
        )}

        {/* Action buttons */}
        <div>
          <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Actions</h4>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {item.status === "COMPLETED" && (
              <>
                <button
                  className="button small"
                  onClick={() => handleStatusUpdate("PASSED")}
                  disabled={isPending}
                >
                  Mark Passed
                </button>
                <button
                  className="button small outline"
                  onClick={() => handleStatusUpdate("FAILED")}
                  disabled={isPending}
                >
                  Mark Failed
                </button>
              </>
            )}
            {item.status === "REQUIRED" && (
              <button
                className="button small outline"
                onClick={() => handleStatusUpdate("WAIVED")}
                disabled={isPending}
              >
                Waive Interview
              </button>
            )}
            {(item.status === "REQUIRED" || item.status === "SCHEDULED") && (
              <button
                className="button small outline"
                onClick={() => handleStatusUpdate("HOLD")}
                disabled={isPending}
              >
                Put on Hold
              </button>
            )}
            {item.status === "HOLD" && (
              <button
                className="button small"
                onClick={() => handleStatusUpdate("REQUIRED")}
                disabled={isPending}
              >
                Resume (Required)
              </button>
            )}
            {item.status === "FAILED" && (
              <button
                className="button small"
                onClick={() => handleStatusUpdate("REQUIRED")}
                disabled={isPending}
              >
                Re-require Interview
              </button>
            )}
            <Link
              href="/interviews?scope=readiness&view=team&state=needs_action"
              className="button small outline"
              style={{ textDecoration: "none" }}
            >
              Interview Command Center
            </Link>
          </div>
        </div>
      </div>
    </KanbanDetailPanel>
  );
}

/* ── Main export ──────────────────────────────────── */

export default function InterviewBoard({
  items,
  dragEnabled = true,
}: {
  items: InterviewGateItem[];
  dragEnabled?: boolean;
}) {
  return (
    <KanbanBoard<InterviewGateItem>
      items={items}
      columns={COLUMNS}
      dragEnabled={dragEnabled}
      searchPlaceholder="Search by instructor name or chapter..."
      emptyColumnLabel="No interview gates"
      getSearchText={(item) =>
        [item.instructor.name, item.instructor.email, item.instructor.chapter?.name]
          .filter(Boolean)
          .join(" ")
      }
      onStatusChange={async (itemId, newStatus) => {
        const result = await updateInterviewGateStatus(itemId, newStatus);
        return { success: result.success, error: result.error };
      }}
      renderCard={(item, { onClick, isDragging }) => (
        <InterviewCard item={item} onClick={onClick} isDragging={isDragging} />
      )}
      renderDragOverlay={(item) => <DragOverlayCard item={item} />}
      renderDetailPanel={(item, { onClose, onUpdate }) => (
        <InterviewDetailPanel item={item} onClose={onClose} onUpdate={onUpdate} />
      )}
    />
  );
}
