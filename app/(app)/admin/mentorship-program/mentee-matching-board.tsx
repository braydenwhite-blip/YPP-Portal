"use client";

import { KanbanBoard, KanbanDetailPanel, type KanbanColumnDef } from "@/components/kanban";
import { statusPillClass, statusLabel } from "@/components/kanban/kanban-utils";
import { updateMenteeMatchingStage } from "@/lib/mentorship-kanban-actions";
import Link from "next/link";

/* ── Types ─────────────────────────────────────────── */

export type MenteeMatchItem = {
  id: string;
  status: string; // "UNASSIGNED" | "HAS_MENTOR" (virtual statuses derived from data)
  name: string;
  email: string;
  primaryRole: string;
  lane: string;
  chapterName: string | null;
  circleGaps?: string[];
  mentorName?: string | null;
  mentorshipId?: string | null;
};

/* ── Column definitions ────────────────────────────── */

const COLUMNS: KanbanColumnDef[] = [
  { id: "unassigned", title: "Needs Mentor", statuses: ["UNASSIGNED"], color: "#dc2626" },
  { id: "matched", title: "Has Mentor", statuses: ["HAS_MENTOR"], color: "#16a34a" },
];

/* ── Helpers ──────────────────────────────────────── */

function roleLabel(role: string): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function roleBadgeClass(role: string): string {
  switch (role) {
    case "INSTRUCTOR": return "role-badge instructor";
    case "CHAPTER_PRESIDENT": return "role-badge chapter-president";
    default: return "role-badge global-leadership";
  }
}

/* ── Card ─────────────────────────────────────────── */

function MenteeCard({
  mentee,
  onClick,
  isDragging,
}: {
  mentee: MenteeMatchItem;
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
      <div className="kanban-card-name">{mentee.name}</div>
      <div className="kanban-card-meta">
        <span className={roleBadgeClass(mentee.primaryRole)}>
          {roleLabel(mentee.primaryRole)}
        </span>
        {mentee.chapterName && (
          <span className="kanban-card-chapter">{mentee.chapterName}</span>
        )}
      </div>
      {mentee.mentorName && (
        <div className="kanban-card-meta">
          <span>Mentor: {mentee.mentorName}</span>
        </div>
      )}
      {mentee.circleGaps && mentee.circleGaps.length > 0 && (
        <div className="kanban-card-footer">
          <span style={{ fontSize: 11, color: "#d97706" }}>
            Gaps: {mentee.circleGaps.join(", ")}
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Drag Overlay ──────────────────────────────────── */

function MenteeOverlay({ mentee }: { mentee: MenteeMatchItem }) {
  return (
    <div className="kanban-card" style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.15)", width: 264 }}>
      <div className="kanban-card-name">{mentee.name}</div>
      <div className="kanban-card-meta">
        <span className={roleBadgeClass(mentee.primaryRole)}>
          {roleLabel(mentee.primaryRole)}
        </span>
      </div>
    </div>
  );
}

/* ── Detail Panel ──────────────────────────────────── */

function MenteeDetailPanel({
  mentee,
  onClose,
  lane,
}: {
  mentee: MenteeMatchItem;
  onClose: () => void;
  onUpdate: (updated: Partial<MenteeMatchItem> & { id: string }) => void;
  lane: string;
}) {
  return (
    <KanbanDetailPanel
      title={mentee.name}
      subtitle={mentee.email}
      statusBadge={
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className={roleBadgeClass(mentee.primaryRole)}>
            {roleLabel(mentee.primaryRole)}
          </span>
          {mentee.status === "UNASSIGNED" ? (
            <span className="status-pill" style={{ background: "#fee2e2", color: "#dc2626" }}>
              Needs Mentor
            </span>
          ) : (
            <span className="status-pill" style={{ background: "#dcfce7", color: "#16a34a" }}>
              Has Mentor
            </span>
          )}
        </div>
      }
      onClose={onClose}
    >
      {/* Info */}
      <div className="slideout-section">
        <div className="slideout-section-title">Details</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
          <div className="slideout-field">
            <div className="slideout-field-label">Email</div>
            <div className="slideout-field-value">{mentee.email}</div>
          </div>
          <div className="slideout-field">
            <div className="slideout-field-label">Role</div>
            <div className="slideout-field-value">{roleLabel(mentee.primaryRole)}</div>
          </div>
          {mentee.chapterName && (
            <div className="slideout-field">
              <div className="slideout-field-label">Chapter</div>
              <div className="slideout-field-value">{mentee.chapterName}</div>
            </div>
          )}
          <div className="slideout-field">
            <div className="slideout-field-label">Lane</div>
            <div className="slideout-field-value">{roleLabel(mentee.lane)}</div>
          </div>
        </div>
      </div>

      {/* Mentor */}
      {mentee.mentorName && (
        <div className="slideout-section">
          <div className="slideout-section-title">Current Mentor</div>
          <div className="slideout-field-value">{mentee.mentorName}</div>
        </div>
      )}

      {/* Circle Gaps */}
      {mentee.circleGaps && mentee.circleGaps.length > 0 && (
        <div className="slideout-section">
          <div className="slideout-section-title">Circle Gaps</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {mentee.circleGaps.map((gap, i) => (
              <span key={i} className="pill pill-small pill-pending">{gap}</span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="slideout-section">
        <div className="slideout-section-title">Actions</div>
        <div className="action-bar">
          <Link
            href={`/admin/mentorship-program?lane=${lane}&focus=matching&menteeId=${mentee.id}`}
            className="button primary small"
          >
            Find Matches
          </Link>
          {mentee.mentorshipId && (
            <Link
              href={`/mentorship/mentees/${mentee.id}`}
              className="button secondary small"
            >
              Open Circle
            </Link>
          )}
        </div>
      </div>
    </KanbanDetailPanel>
  );
}

/* ── Main export ──────────────────────────────────── */

export default function MenteeMatchingBoard({
  unassigned,
  matched,
  lane,
}: {
  unassigned: MenteeMatchItem[];
  matched: MenteeMatchItem[];
  lane: string;
}) {
  const allMentees = [
    ...unassigned.map((m) => ({ ...m, status: "UNASSIGNED" })),
    ...matched.map((m) => ({ ...m, status: "HAS_MENTOR" })),
  ];

  return (
    <KanbanBoard<MenteeMatchItem>
      items={allMentees}
      columns={COLUMNS}
      dragEnabled={false}
      searchPlaceholder="Search by name, email, or chapter..."
      emptyColumnLabel="No mentees"
      getSearchText={(m) =>
        [m.name, m.email, m.chapterName, m.mentorName]
          .filter(Boolean)
          .join(" ")
      }
      onStatusChange={async (itemId, newStatus) => {
        const result = await updateMenteeMatchingStage(itemId, newStatus);
        return { success: result.success, error: result.error };
      }}
      renderCard={(mentee, { onClick, isDragging }) => (
        <MenteeCard mentee={mentee} onClick={onClick} isDragging={isDragging} />
      )}
      renderDragOverlay={(mentee) => <MenteeOverlay mentee={mentee} />}
      renderDetailPanel={(mentee, { onClose, onUpdate }) => (
        <MenteeDetailPanel mentee={mentee} onClose={onClose} onUpdate={onUpdate} lane={lane} />
      )}
    />
  );
}
