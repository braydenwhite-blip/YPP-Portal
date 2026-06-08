"use client";

import { KanbanBoard, KanbanDetailPanel, type KanbanColumnDef } from "@/components/kanban";
import { statusPillClass, statusLabel, formatDate } from "@/components/kanban/kanban-utils";
import { updateGoalReviewStage } from "@/lib/mentorship-kanban-actions";

/* ── Types ─────────────────────────────────────────── */

export type GoalReviewItem = {
  id: string;
  status: string;
  mentorName: string;
  menteeId: string;
  menteeName: string;
  menteeEmail: string;
  menteeRole: string;
  menteeChapter: string | null;
  cycleNumber: number;
  cycleMonth: string;
  submittedAt: string;
  overallRating: string | null;
  overallComments: string | null;
  planOfAction: string | null;
  isQuarterly: boolean;
  bonusPoints: number | null;
  bonusReason: string | null;
  chairComments: string | null;
  chairApprovedAt: string | null;
  goalRatings: Array<{
    goalTitle: string;
    rating: string | null;
    comment: string | null;
  }>;
  updatedAt: string;
  createdAt: string;
};

/* ── Column definitions ────────────────────────────── */

const COLUMNS: KanbanColumnDef[] = [
  { id: "draft", title: "Draft", statuses: ["DRAFT"], color: "#71717a" },
  { id: "pending", title: "Pending Chair", statuses: ["PENDING_CHAIR_APPROVAL"], color: "#d97706" },
  { id: "changes", title: "Changes Requested", statuses: ["CHANGES_REQUESTED"], color: "#dc2626" },
  { id: "approved", title: "Approved", statuses: ["APPROVED"], color: "#16a34a" },
];

/* ── Rating color helpers ──────────────────────────── */

function ratingDotClass(rating: string | null): string {
  if (!rating) return "";
  switch (rating) {
    case "BEHIND_SCHEDULE": return "rating-dot behind-schedule";
    case "GETTING_STARTED": return "rating-dot getting-started";
    case "ACHIEVED": return "rating-dot achieved";
    case "ABOVE_AND_BEYOND": return "rating-dot above-and-beyond";
    default: return "";
  }
}

function ratingLabel(rating: string | null): string {
  if (!rating) return "Not rated";
  return rating.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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

function GoalReviewCard({
  review,
  onClick,
  isDragging,
}: {
  review: GoalReviewItem;
  onClick: () => void;
  isDragging?: boolean;
}) {
  const monthStr = new Date(review.cycleMonth).toLocaleDateString("en-US", {
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
        <span>Cycle {review.cycleNumber} &middot; {monthStr}</span>
        {review.isQuarterly && (
          <span className="pill pill-small pill-purple">Quarterly</span>
        )}
      </div>
      <div className="kanban-card-footer">
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {review.overallRating && (
            <>
              <span className={ratingDotClass(review.overallRating)} />
              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                {ratingLabel(review.overallRating)}
              </span>
            </>
          )}
        </div>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>
          {review.mentorName}
        </span>
      </div>
    </div>
  );
}

/* ── Drag Overlay ──────────────────────────────────── */

function GoalReviewOverlay({ review }: { review: GoalReviewItem }) {
  return (
    <div className="kanban-card" style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.15)", width: 264 }}>
      <div className="kanban-card-name">{review.menteeName}</div>
      <div className="kanban-card-meta">
        <span>Cycle {review.cycleNumber}</span>
        <span className={roleBadgeClass(review.menteeRole)}>
          {roleLabel(review.menteeRole)}
        </span>
      </div>
    </div>
  );
}

/* ── Detail Panel ──────────────────────────────────── */

function GoalReviewDetailPanel({
  review,
  onClose,
  onUpdate,
}: {
  review: GoalReviewItem;
  onClose: () => void;
  onUpdate: (updated: Partial<GoalReviewItem> & { id: string }) => void;
}) {
  const monthStr = new Date(review.cycleMonth).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <KanbanDetailPanel
      title={review.menteeName}
      subtitle={`Cycle ${review.cycleNumber} \u00B7 ${monthStr} \u00B7 Mentor: ${review.mentorName}`}
      statusBadge={
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className={statusPillClass(review.status)}>{statusLabel(review.status)}</span>
          {review.isQuarterly && <span className="pill pill-small pill-purple">Quarterly</span>}
          {review.overallRating && (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span className={ratingDotClass(review.overallRating)} />
              <span style={{ fontSize: 12 }}>{ratingLabel(review.overallRating)}</span>
            </span>
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
            <div className="slideout-field-label">Submitted</div>
            <div className="slideout-field-value">{formatDate(review.submittedAt)}</div>
          </div>
        </div>
      </div>

      {/* Goal Ratings */}
      {review.goalRatings.length > 0 && (
        <div className="slideout-section">
          <div className="slideout-section-title">Goal Ratings</div>
          {review.goalRatings.map((gr, i) => (
            <div key={i} style={{ marginBottom: 12, padding: "10px 14px", background: "var(--surface-2)", borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <strong style={{ fontSize: 13 }}>{gr.goalTitle}</strong>
                {gr.rating && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span className={ratingDotClass(gr.rating)} />
                    <span style={{ fontSize: 11 }}>{ratingLabel(gr.rating)}</span>
                  </span>
                )}
              </div>
              {gr.comment && (
                <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", whiteSpace: "pre-wrap" }}>
                  {gr.comment}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Overall Comments */}
      {review.overallComments && (
        <div className="slideout-section">
          <div className="slideout-section-title">Overall Comments</div>
          <div className="slideout-field-value">{review.overallComments}</div>
        </div>
      )}

      {/* Plan of Action */}
      {review.planOfAction && (
        <div className="slideout-section">
          <div className="slideout-section-title">Plan of Action</div>
          <div className="slideout-field-value">{review.planOfAction}</div>
        </div>
      )}

      {/* Bonus Points */}
      {(review.bonusPoints || review.bonusReason) && (
        <div className="slideout-section">
          <div className="slideout-section-title">Bonus Points</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
            {review.bonusPoints != null && (
              <div className="slideout-field">
                <div className="slideout-field-label">Points</div>
                <div className="slideout-field-value">{review.bonusPoints}</div>
              </div>
            )}
            {review.bonusReason && (
              <div className="slideout-field">
                <div className="slideout-field-label">Reason</div>
                <div className="slideout-field-value">{review.bonusReason}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chair Decision */}
      {(review.chairComments || review.chairApprovedAt) && (
        <div className="slideout-section">
          <div className="slideout-section-title">Chair Decision</div>
          {review.chairApprovedAt && (
            <div className="slideout-field">
              <div className="slideout-field-label">Approved At</div>
              <div className="slideout-field-value">{formatDate(review.chairApprovedAt)}</div>
            </div>
          )}
          {review.chairComments && (
            <div className="slideout-field">
              <div className="slideout-field-label">Chair Comments</div>
              <div className="slideout-field-value">{review.chairComments}</div>
            </div>
          )}
        </div>
      )}
    </KanbanDetailPanel>
  );
}

/* ── Main export ──────────────────────────────────── */

export default function GoalReviewsBoard({
  reviews,
}: {
  reviews: GoalReviewItem[];
}) {
  return (
    <KanbanBoard<GoalReviewItem>
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
        const result = await updateGoalReviewStage(itemId, newStatus);
        return { success: result.success, error: result.error };
      }}
      renderCard={(review, { onClick, isDragging }) => (
        <GoalReviewCard review={review} onClick={onClick} isDragging={isDragging} />
      )}
      renderDragOverlay={(review) => <GoalReviewOverlay review={review} />}
      renderDetailPanel={(review, { onClose, onUpdate }) => (
        <GoalReviewDetailPanel review={review} onClose={onClose} onUpdate={onUpdate} />
      )}
    />
  );
}
