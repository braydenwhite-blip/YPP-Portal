"use client";

import { KanbanBoard, KanbanDetailPanel, type KanbanColumnDef } from "@/components/kanban";
import { statusPillClass, statusLabel, formatDate } from "@/components/kanban/kanban-utils";
import { updateMonthlyReviewStage } from "@/lib/mentorship-kanban-actions";

/* ── Types ─────────────────────────────────────────── */

export type MonthlyReviewItem = {
  id: string;
  status: string;
  mentorName: string;
  menteeId: string;
  menteeName: string;
  menteeEmail: string;
  menteeRole: string;
  menteeChapter: string | null;
  month: string;
  overallStatus: string | null;
  overallComments: string | null;
  strengths: string | null;
  focusAreas: string | null;
  chairDecisionNotes: string | null;
  chairDecisionAt: string | null;
  mentorSubmittedAt: string | null;
  updatedAt: string;
  createdAt: string;
};

/* ── Column definitions ────────────────────────────── */

const COLUMNS: KanbanColumnDef[] = [
  { id: "draft", title: "Draft", statuses: ["DRAFT"], color: "#71717a" },
  { id: "pending", title: "Pending Chair", statuses: ["PENDING_CHAIR_APPROVAL"], color: "#d97706" },
  { id: "approved", title: "Approved", statuses: ["APPROVED"], color: "#16a34a" },
  { id: "returned", title: "Returned", statuses: ["RETURNED"], color: "#dc2626" },
];

/* ── Helpers ──────────────────────────────────────── */

function progressLabel(status: string | null): string {
  if (!status) return "No rating";
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

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

function ReviewCard({
  review,
  onClick,
  isDragging,
}: {
  review: MonthlyReviewItem;
  onClick: () => void;
  isDragging?: boolean;
}) {
  const monthStr = new Date(review.month).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  return (
    <div
      className={`kanban-card${isDragging ? " dragging" : ""}`}
      onClick={(e) => {
        if (e.defaultPrevented) return;
        onClick();
      }}
    >
      <div className="kanban-card-name">{review.menteeName}</div>
      <div className="kanban-card-meta">
        <span className={roleBadgeClass(review.menteeRole)}>
          {roleLabel(review.menteeRole)}
        </span>
        {review.menteeChapter && (
          <span className="kanban-card-chapter">{review.menteeChapter}</span>
        )}
      </div>
      <div className="kanban-card-meta">
        <span>{monthStr}</span>
        {review.overallStatus && (
          <span className="pill pill-small">{progressLabel(review.overallStatus)}</span>
        )}
      </div>
      <div className="kanban-card-footer">
        <span style={{ fontSize: 11, color: "var(--muted)" }}>
          Mentor: {review.mentorName}
        </span>
      </div>
    </div>
  );
}

/* ── Drag Overlay ──────────────────────────────────── */

function ReviewOverlay({ review }: { review: MonthlyReviewItem }) {
  return (
    <div className="kanban-card" style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.15)", width: 264 }}>
      <div className="kanban-card-name">{review.menteeName}</div>
      <div className="kanban-card-meta">
        <span className={roleBadgeClass(review.menteeRole)}>
          {roleLabel(review.menteeRole)}
        </span>
      </div>
    </div>
  );
}

/* ── Detail Panel ──────────────────────────────────── */

function ReviewDetailPanel({
  review,
  onClose,
}: {
  review: MonthlyReviewItem;
  onClose: () => void;
  onUpdate: (updated: Partial<MonthlyReviewItem> & { id: string }) => void;
}) {
  const monthStr = new Date(review.month).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <KanbanDetailPanel
      title={review.menteeName}
      subtitle={`${monthStr} \u00B7 Mentor: ${review.mentorName}`}
      statusBadge={
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className={statusPillClass(review.status)}>{statusLabel(review.status)}</span>
          {review.overallStatus && (
            <span className="pill pill-small">{progressLabel(review.overallStatus)}</span>
          )}
        </div>
      }
      onClose={onClose}
    >
      {/* Mentee Info */}
      <div className="slideout-section">
        <div className="slideout-section-title">Mentee Info</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
          <div className="slideout-field">
            <div className="slideout-field-label">Email</div>
            <div className="slideout-field-value">{review.menteeEmail}</div>
          </div>
          <div className="slideout-field">
            <div className="slideout-field-label">Role</div>
            <div className="slideout-field-value">{roleLabel(review.menteeRole)}</div>
          </div>
          {review.menteeChapter && (
            <div className="slideout-field">
              <div className="slideout-field-label">Chapter</div>
              <div className="slideout-field-value">{review.menteeChapter}</div>
            </div>
          )}
          <div className="slideout-field">
            <div className="slideout-field-label">Month</div>
            <div className="slideout-field-value">{monthStr}</div>
          </div>
        </div>
      </div>

      {/* Mentor Assessment */}
      <div className="slideout-section">
        <div className="slideout-section-title">Mentor Assessment</div>
        {review.mentorSubmittedAt && (
          <div className="slideout-field">
            <div className="slideout-field-label">Submitted</div>
            <div className="slideout-field-value">{formatDate(review.mentorSubmittedAt)}</div>
          </div>
        )}
        {review.overallComments && (
          <div className="slideout-field">
            <div className="slideout-field-label">Overall Comments</div>
            <div className="slideout-field-value">{review.overallComments}</div>
          </div>
        )}
        {review.strengths && (
          <div className="slideout-field">
            <div className="slideout-field-label">Strengths</div>
            <div className="slideout-field-value">{review.strengths}</div>
          </div>
        )}
        {review.focusAreas && (
          <div className="slideout-field">
            <div className="slideout-field-label">Focus Areas</div>
            <div className="slideout-field-value">{review.focusAreas}</div>
          </div>
        )}
      </div>

      {/* Chair Decision */}
      {(review.chairDecisionNotes || review.chairDecisionAt) && (
        <div className="slideout-section">
          <div className="slideout-section-title">Chair Decision</div>
          {review.chairDecisionAt && (
            <div className="slideout-field">
              <div className="slideout-field-label">Decision Date</div>
              <div className="slideout-field-value">{formatDate(review.chairDecisionAt)}</div>
            </div>
          )}
          {review.chairDecisionNotes && (
            <div className="slideout-field">
              <div className="slideout-field-label">Chair Notes</div>
              <div className="slideout-field-value">{review.chairDecisionNotes}</div>
            </div>
          )}
        </div>
      )}
    </KanbanDetailPanel>
  );
}

/* ── Main export ──────────────────────────────────── */

export default function ReviewApprovalsBoard({
  reviews,
}: {
  reviews: MonthlyReviewItem[];
}) {
  return (
    <KanbanBoard<MonthlyReviewItem>
      items={reviews}
      columns={COLUMNS}
      dragEnabled
      searchPlaceholder="Search by mentee name, email, mentor, or chapter..."
      emptyColumnLabel="No reviews"
      getSearchText={(r) =>
        [r.menteeName, r.menteeEmail, r.mentorName, r.menteeChapter]
          .filter(Boolean)
          .join(" ")
      }
      onStatusChange={async (itemId, newStatus) => {
        const result = await updateMonthlyReviewStage(itemId, newStatus);
        return { success: result.success, error: result.error };
      }}
      renderCard={(review, { onClick, isDragging }) => (
        <ReviewCard review={review} onClick={onClick} isDragging={isDragging} />
      )}
      renderDragOverlay={(review) => <ReviewOverlay review={review} />}
      renderDetailPanel={(review, { onClose, onUpdate }) => (
        <ReviewDetailPanel review={review} onClose={onClose} onUpdate={onUpdate} />
      )}
    />
  );
}
