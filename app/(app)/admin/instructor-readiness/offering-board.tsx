"use client";

import { KanbanBoard, KanbanDetailPanel, PanelToast, useToast, type KanbanColumnDef } from "@/components/kanban";
import { updateOfferingApprovalStatus } from "@/lib/readiness-kanban-actions";
import {
  approveOfferingApproval,
  requestOfferingApprovalRevision,
} from "@/lib/offering-approval-actions";
import { useRef, useTransition } from "react";

/* ── Types ─────────────────────────────────────────── */

export type OfferingApprovalItem = {
  id: string;
  offeringId: string;
  status: string;
  requestNotes: string | null;
  requestedAt: string | null;
  reviewNotes: string | null;
  offering: {
    title: string;
    chapter: { name: string } | null;
    template: { learnerFitLabel: string | null };
    instructor: { id: string; name: string; email: string };
  };
};

/* ── Column definitions ────────────────────────────── */

const COLUMNS: KanbanColumnDef[] = [
  { id: "requested", title: "Requested", statuses: ["REQUESTED"], color: "#6b21c8" },
  { id: "under_review", title: "Under Review", statuses: ["UNDER_REVIEW"], color: "#2563eb" },
  { id: "changes_requested", title: "Changes Requested", statuses: ["CHANGES_REQUESTED"], color: "#dc2626" },
  { id: "approved", title: "Approved", statuses: ["APPROVED"], color: "#16a34a" },
  { id: "rejected", title: "Rejected", statuses: ["REJECTED"], color: "#71717a" },
];

/* ── Helpers ────────────────────────────────────────── */

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusColor(status: string): string {
  switch (status) {
    case "REQUESTED": return "#6b21c8";
    case "UNDER_REVIEW": return "#2563eb";
    case "CHANGES_REQUESTED": return "#dc2626";
    case "APPROVED": return "#16a34a";
    case "REJECTED": return "#71717a";
    default: return "#6b7280";
  }
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ── Card ─────────────────────────────────────────── */

function OfferingCard({
  item,
  onClick,
  isDragging,
}: {
  item: OfferingApprovalItem;
  onClick: () => void;
  isDragging?: boolean;
}) {
  return (
    <div
      className={`kanban-card${isDragging ? " dragging" : ""}`}
      onClick={(e) => {
        if (e.defaultPrevented) return;
        onClick();
      }}
    >
      <div className="kanban-card-name">{item.offering.title}</div>
      <div className="kanban-card-meta">
        <span>{item.offering.instructor.name}</span>
        {item.offering.chapter && (
          <span className="kanban-card-chapter">{item.offering.chapter.name}</span>
        )}
      </div>
      {item.offering.template.learnerFitLabel && (
        <div className="kanban-card-meta">
          <span style={{ fontSize: 11, color: "var(--muted)" }}>{item.offering.template.learnerFitLabel}</span>
        </div>
      )}
      <div style={{ marginTop: 4 }}>
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
      </div>
    </div>
  );
}

/* ── Drag Overlay ─────────────────────────────────── */

function DragOverlayCard({ item }: { item: OfferingApprovalItem }) {
  return (
    <div className="kanban-card" style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.15)", width: 264 }}>
      <div className="kanban-card-name">{item.offering.title}</div>
      <div className="kanban-card-meta">
        <span>{item.offering.instructor.name}</span>
      </div>
    </div>
  );
}

/* ── Detail Panel ─────────────────────────────────── */

function OfferingDetailPanel({
  item,
  onClose,
  onUpdate,
}: {
  item: OfferingApprovalItem;
  onClose: () => void;
  onUpdate: (updated: Partial<OfferingApprovalItem> & { id: string }) => void;
}) {
  const { message, show } = useToast();
  const [isPending, startTransition] = useTransition();
  const approveFormRef = useRef<HTMLFormElement>(null);
  const revisionFormRef = useRef<HTMLFormElement>(null);

  function handleApprove(formData: FormData) {
    startTransition(async () => {
      try {
        await approveOfferingApproval(formData);
        onUpdate({ id: item.id, status: "APPROVED" });
        show("Offering approved");
      } catch (err) {
        show(`Error: ${(err as Error).message}`);
      }
    });
  }

  function handleRevision(formData: FormData) {
    startTransition(async () => {
      try {
        await requestOfferingApprovalRevision(formData);
        const newStatus = formData.get("status") as string;
        onUpdate({ id: item.id, status: newStatus });
        show("Offering updated");
      } catch (err) {
        show(`Error: ${(err as Error).message}`);
      }
    });
  }

  return (
    <KanbanDetailPanel
      title={item.offering.title}
      subtitle={`${item.offering.instructor.name} - ${item.offering.instructor.email}`}
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
        {/* Offering details */}
        <div>
          <h4 style={{ margin: "0 0 8px", fontSize: 13, color: "var(--muted)" }}>Offering Details</h4>
          <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
            <div>
              <strong>Chapter:</strong> {item.offering.chapter?.name || "No chapter"}
            </div>
            <div>
              <strong>Learner Fit:</strong> {item.offering.template.learnerFitLabel || "Coming soon"}
            </div>
            <div>
              <strong>Requested:</strong> {formatDate(item.requestedAt)}
            </div>
          </div>
        </div>

        {/* Notes */}
        {item.requestNotes && (
          <div>
            <h4 style={{ margin: "0 0 4px", fontSize: 13, color: "var(--muted)" }}>Request Notes</h4>
            <p style={{ margin: 0, fontSize: 14 }}>{item.requestNotes}</p>
          </div>
        )}

        {item.reviewNotes && (
          <div>
            <h4 style={{ margin: "0 0 4px", fontSize: 13, color: "var(--muted)" }}>Review Notes</h4>
            <p style={{ margin: 0, fontSize: 14 }}>{item.reviewNotes}</p>
          </div>
        )}

        {/* Approve form */}
        <form ref={approveFormRef} action={handleApprove} className="form-grid">
          <input type="hidden" name="offeringId" value={item.offeringId} />
          <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Approve</h4>
          <label className="form-row">
            Approval note
            <input name="reviewNotes" className="input" placeholder="Optional note" />
          </label>
          <button type="submit" className="button small" disabled={isPending}>
            {isPending ? "Processing..." : "Approve offering"}
          </button>
        </form>

        {/* Request changes / Reject form */}
        <form ref={revisionFormRef} action={handleRevision} className="form-grid">
          <input type="hidden" name="offeringId" value={item.offeringId} />
          <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Request Changes / Reject</h4>
          <div className="grid two">
            <label className="form-row">
              Status
              <select name="status" className="input" defaultValue="CHANGES_REQUESTED">
                <option value="CHANGES_REQUESTED">Changes requested</option>
                <option value="REJECTED">Reject offering</option>
              </select>
            </label>
            <label className="form-row">
              Reviewer note
              <input name="reviewNotes" className="input" placeholder="Explain what is missing" />
            </label>
          </div>
          <button type="submit" className="button small outline" disabled={isPending}>
            {isPending ? "Processing..." : "Send update"}
          </button>
        </form>
      </div>
    </KanbanDetailPanel>
  );
}

/* ── Main export ──────────────────────────────────── */

export default function OfferingBoard({
  items,
  dragEnabled = true,
}: {
  items: OfferingApprovalItem[];
  dragEnabled?: boolean;
}) {
  return (
    <KanbanBoard<OfferingApprovalItem>
      items={items}
      columns={COLUMNS}
      dragEnabled={dragEnabled}
      searchPlaceholder="Search by offering title, instructor, or chapter..."
      emptyColumnLabel="No approvals"
      getSearchText={(item) =>
        [
          item.offering.title,
          item.offering.instructor.name,
          item.offering.instructor.email,
          item.offering.chapter?.name,
        ]
          .filter(Boolean)
          .join(" ")
      }
      onStatusChange={async (itemId, newStatus) => {
        const result = await updateOfferingApprovalStatus(itemId, newStatus);
        return { success: result.success, error: result.error };
      }}
      renderCard={(item, { onClick, isDragging }) => (
        <OfferingCard item={item} onClick={onClick} isDragging={isDragging} />
      )}
      renderDragOverlay={(item) => <DragOverlayCard item={item} />}
      renderDetailPanel={(item, { onClose, onUpdate }) => (
        <OfferingDetailPanel item={item} onClose={onClose} onUpdate={onUpdate} />
      )}
    />
  );
}
