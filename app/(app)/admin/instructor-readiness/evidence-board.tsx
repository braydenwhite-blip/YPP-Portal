"use client";

import { KanbanBoard, KanbanDetailPanel, PanelToast, useToast, type KanbanColumnDef } from "@/components/kanban";
import { updateEvidenceStatus } from "@/lib/readiness-kanban-actions";
import { reviewTrainingEvidence } from "@/lib/training-actions";
import { useRef, useTransition } from "react";

/* ── Types ─────────────────────────────────────────── */

export type EvidenceItem = {
  id: string;
  status: string;
  notes: string | null;
  createdAt: string;
  fileUrl: string;
  reviewNotes?: string | null;
  user: { id: string; name: string; email: string };
  module: { id: string; title: string };
};

/* ── Column definitions ────────────────────────────── */

const COLUMNS: KanbanColumnDef[] = [
  { id: "pending_review", title: "Pending Review", statuses: ["PENDING_REVIEW"], color: "#d97706" },
  { id: "revision_requested", title: "Revision Requested", statuses: ["REVISION_REQUESTED"], color: "#dc2626" },
  { id: "approved", title: "Approved", statuses: ["APPROVED"], color: "#16a34a" },
  { id: "rejected", title: "Rejected", statuses: ["REJECTED"], color: "#71717a" },
];

/* ── Helpers ────────────────────────────────────────── */

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusColor(status: string): string {
  switch (status) {
    case "PENDING_REVIEW": return "#d97706";
    case "REVISION_REQUESTED": return "#dc2626";
    case "APPROVED": return "#16a34a";
    case "REJECTED": return "#71717a";
    default: return "#6b7280";
  }
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getDraftIdFromEvidenceUrl(fileUrl: string): string | null {
  try {
    return new URL(fileUrl, "https://studio.local").searchParams.get("draftId");
  } catch {
    return null;
  }
}

/* ── Card ─────────────────────────────────────────── */

function EvidenceCard({
  item,
  onClick,
  isDragging,
}: {
  item: EvidenceItem;
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
      <div className="kanban-card-name">{item.user.name}</div>
      <div className="kanban-card-meta">
        <span>{item.module.title}</span>
      </div>
      <div className="kanban-card-meta">
        <span style={{ fontSize: 11, color: "var(--muted)" }}>{formatDate(item.createdAt)}</span>
      </div>
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

function DragOverlayCard({ item }: { item: EvidenceItem }) {
  return (
    <div className="kanban-card" style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.15)", width: 264 }}>
      <div className="kanban-card-name">{item.user.name}</div>
      <div className="kanban-card-meta">
        <span>{item.module.title}</span>
      </div>
    </div>
  );
}

/* ── Detail Panel ─────────────────────────────────── */

function EvidenceDetailPanel({
  item,
  onClose,
  onUpdate,
}: {
  item: EvidenceItem;
  onClose: () => void;
  onUpdate: (updated: Partial<EvidenceItem> & { id: string }) => void;
}) {
  const { message, show } = useToast();
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const draftId = getDraftIdFromEvidenceUrl(item.fileUrl);

  function handleReview(formData: FormData) {
    startTransition(async () => {
      try {
        await reviewTrainingEvidence(formData);
        const newStatus = formData.get("status") as string;
        onUpdate({ id: item.id, status: newStatus });
        show("Evidence review submitted");
      } catch (err) {
        show(`Error: ${(err as Error).message}`);
      }
    });
  }

  return (
    <KanbanDetailPanel
      title={item.user.name}
      subtitle={`${item.module.title} - ${item.user.email}`}
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
        {/* File link */}
        <div>
          <h4 style={{ margin: "0 0 8px", fontSize: 13, color: "var(--muted)" }}>Evidence File</h4>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a href={item.fileUrl} target="_blank" rel="noreferrer" className="link">
              Open evidence file
            </a>
            {draftId && (
              <>
                <a
                  href={`/instructor/lesson-design-studio/print?draftId=${draftId}&type=student`}
                  target="_blank"
                  rel="noreferrer"
                  className="link"
                >
                  Student preview
                </a>
                <a
                  href={`/instructor/lesson-design-studio/print?draftId=${draftId}&type=instructor`}
                  target="_blank"
                  rel="noreferrer"
                  className="link"
                >
                  Instructor preview
                </a>
              </>
            )}
          </div>
        </div>

        {/* Notes */}
        {item.notes && (
          <div>
            <h4 style={{ margin: "0 0 4px", fontSize: 13, color: "var(--muted)" }}>Instructor Notes</h4>
            <p style={{ margin: 0, fontSize: 14 }}>{item.notes}</p>
          </div>
        )}

        {item.reviewNotes && (
          <div>
            <h4 style={{ margin: "0 0 4px", fontSize: 13, color: "var(--muted)" }}>Reviewer Notes</h4>
            <p style={{ margin: 0, fontSize: 14 }}>{item.reviewNotes}</p>
          </div>
        )}

        {/* Submission date */}
        <div>
          <h4 style={{ margin: "0 0 4px", fontSize: 13, color: "var(--muted)" }}>Submitted</h4>
          <p style={{ margin: 0, fontSize: 14 }}>{formatDate(item.createdAt)}</p>
        </div>

        {/* Review form */}
        <form ref={formRef} action={handleReview} className="form-grid">
          <input type="hidden" name="submissionId" value={item.id} />
          <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Review Decision</h4>

          <div className="grid two">
            <label className="form-row">
              Decision
              <select name="status" className="input" defaultValue="APPROVED">
                <option value="APPROVED">Approve</option>
                <option value="REVISION_REQUESTED">Request revision</option>
                <option value="REJECTED">Reject</option>
              </select>
            </label>
            <label className="form-row">
              Review notes
              <input name="reviewNotes" className="input" placeholder="Short reviewer note" />
            </label>
          </div>

          {draftId && (
            <>
              <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted)" }}>
                Score guide: 0 missing, 1 emerging, 2 partly working, 3 strong, 4 launch-ready.
              </p>
              <div className="grid four">
                <label className="form-row">
                  Clarity
                  <select name="rubricClarity" className="input" defaultValue="3">
                    {[0, 1, 2, 3, 4].map((score) => (
                      <option key={score} value={score}>{score}</option>
                    ))}
                  </select>
                </label>
                <label className="form-row">
                  Sequencing
                  <select name="rubricSequencing" className="input" defaultValue="3">
                    {[0, 1, 2, 3, 4].map((score) => (
                      <option key={score} value={score}>{score}</option>
                    ))}
                  </select>
                </label>
                <label className="form-row">
                  Student Experience
                  <select name="rubricStudentExperience" className="input" defaultValue="3">
                    {[0, 1, 2, 3, 4].map((score) => (
                      <option key={score} value={score}>{score}</option>
                    ))}
                  </select>
                </label>
                <label className="form-row">
                  Launch Readiness
                  <select name="rubricLaunchReadiness" className="input" defaultValue="3">
                    {[0, 1, 2, 3, 4].map((score) => (
                      <option key={score} value={score}>{score}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid two">
                <label className="form-row">
                  Overview note
                  <textarea name="rubricOverviewNote" className="input" rows={2} placeholder="How clear is the course purpose and promise?" />
                </label>
                <label className="form-row">
                  Course structure note
                  <textarea name="rubricCourseStructureNote" className="input" rows={2} placeholder="Comment on weeks, pacing, session count, or class shape." />
                </label>
              </div>
              <div className="grid two">
                <label className="form-row">
                  Session plans note
                  <textarea name="rubricSessionPlansNote" className="input" rows={2} placeholder="Comment on objectives, activity sequence, and pacing." />
                </label>
                <label className="form-row">
                  Student assignments note
                  <textarea name="rubricStudentAssignmentsNote" className="input" rows={2} placeholder="Comment on at-home assignments and reinforcement." />
                </label>
              </div>
              <label className="form-row">
                Rubric summary
                <textarea name="rubricSummary" className="input" rows={2} placeholder="What should the instructor keep, fix, or do next?" />
              </label>
            </>
          )}

          <button type="submit" className="button small" disabled={isPending}>
            {isPending ? "Submitting..." : "Submit evidence review"}
          </button>
        </form>
      </div>
    </KanbanDetailPanel>
  );
}

/* ── Main export ──────────────────────────────────── */

export default function EvidenceBoard({
  items,
  dragEnabled = true,
}: {
  items: EvidenceItem[];
  dragEnabled?: boolean;
}) {
  return (
    <KanbanBoard<EvidenceItem>
      items={items}
      columns={COLUMNS}
      dragEnabled={dragEnabled}
      searchPlaceholder="Search by instructor name or module..."
      emptyColumnLabel="No submissions"
      getSearchText={(item) =>
        [item.user.name, item.user.email, item.module.title].filter(Boolean).join(" ")
      }
      onStatusChange={async (itemId, newStatus) => {
        const result = await updateEvidenceStatus(itemId, newStatus);
        return { success: result.success, error: result.error };
      }}
      renderCard={(item, { onClick, isDragging }) => (
        <EvidenceCard item={item} onClick={onClick} isDragging={isDragging} />
      )}
      renderDragOverlay={(item) => <DragOverlayCard item={item} />}
      renderDetailPanel={(item, { onClose, onUpdate }) => (
        <EvidenceDetailPanel item={item} onClose={onClose} onUpdate={onUpdate} />
      )}
    />
  );
}
