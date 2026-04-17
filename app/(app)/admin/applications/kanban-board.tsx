"use client";

import { KanbanBoard, type KanbanColumnDef } from "@/components/kanban";
import { statusLabel } from "@/components/kanban/kanban-utils";
import { updateJobApplicationStage } from "@/lib/application-kanban-actions";
import ApplicationDetailPanel from "./application-detail-panel";

/* -- Types ------------------------------------------------- */

export type JobApplication = {
  id: string;
  status: string;
  submittedAt: string;
  updatedAt: string;
  applicant: {
    id: string;
    name: string;
    email: string;
  };
  position: {
    title: string;
    type: string;
    chapter: { name: string } | null;
  };
  interviewSlots: {
    id: string;
    scheduledAt: string;
    status: string;
    isConfirmed: boolean;
  }[];
  decision: {
    accepted: boolean;
    decidedAt: string;
    hiringChairStatus: string | null;
  } | null;
};

/* -- Column definitions ------------------------------------ */

const COLUMNS: KanbanColumnDef[] = [
  { id: "submitted", title: "Submitted", statuses: ["SUBMITTED"], color: "#6b21c8" },
  { id: "under_review", title: "Under Review", statuses: ["UNDER_REVIEW"], color: "#2563eb" },
  { id: "interview", title: "Interview", statuses: ["INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED"], color: "#4338ca" },
  { id: "accepted", title: "Accepted", statuses: ["ACCEPTED"], color: "#16a34a" },
  { id: "rejected", title: "Rejected", statuses: ["REJECTED"], color: "#dc2626" },
  { id: "withdrawn", title: "Withdrawn", statuses: ["WITHDRAWN"], color: "#71717a" },
];

/* -- Helpers ----------------------------------------------- */

function positionTypeBadgeClass(type: string): string {
  switch (type) {
    case "INSTRUCTOR":
      return "pill pill-pathway";
    case "CHAPTER_PRESIDENT":
      return "pill pill-success";
    case "MENTOR":
      return "pill";
    case "STAFF":
      return "pill pill-pending";
    default:
      return "pill";
  }
}

function decisionPillInfo(
  decision: JobApplication["decision"]
): { label: string; className: string } | null {
  if (!decision) return null;
  const chairStatus = decision.hiringChairStatus ?? "APPROVED";
  if (chairStatus === "PENDING_CHAIR") {
    return { label: "Chair Review", className: "pill pill-pathway" };
  }
  if (chairStatus === "RETURNED") {
    return { label: "Returned", className: "pill pill-pending" };
  }
  // APPROVED chair status - show actual decision
  return {
    label: decision.accepted ? "Accepted" : "Rejected",
    className: `pill ${decision.accepted ? "pill-success" : "pill-declined"}`,
  };
}

function getNextInterview(slots: JobApplication["interviewSlots"]): string | null {
  const now = new Date();
  const upcoming = slots.find((s) => new Date(s.scheduledAt) >= now);
  if (!upcoming) return null;
  const d = new Date(upcoming.scheduledAt);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* -- Card -------------------------------------------------- */

function ApplicationCard({
  app,
  onClick,
  isDragging,
}: {
  app: JobApplication;
  onClick: () => void;
  isDragging?: boolean;
}) {
  const nextInterview = getNextInterview(app.interviewSlots);
  const decisionInfo = decisionPillInfo(app.decision);

  return (
    <div
      className={`kanban-card${isDragging ? " dragging" : ""}`}
      onClick={(e) => {
        if (e.defaultPrevented) return;
        onClick();
      }}
    >
      <div className="kanban-card-name">{app.applicant.name}</div>
      <div className="kanban-card-meta">
        <span style={{ fontSize: 12, fontWeight: 500 }}>{app.position.title}</span>
      </div>
      <div className="kanban-card-meta">
        <span className={positionTypeBadgeClass(app.position.type)} style={{ fontSize: 10, padding: "1px 6px" }}>
          {app.position.type.replace(/_/g, " ")}
        </span>
        {app.position.chapter && (
          <span className="kanban-card-chapter">{app.position.chapter.name}</span>
        )}
      </div>
      {nextInterview && (
        <div className="kanban-card-deadline normal">
          Interview {nextInterview}
        </div>
      )}
      {decisionInfo && (
        <div className="kanban-card-footer">
          <span className={decisionInfo.className} style={{ fontSize: 10, padding: "1px 6px" }}>
            {decisionInfo.label}
          </span>
        </div>
      )}
    </div>
  );
}

/* -- Drag Overlay Card ------------------------------------- */

function DragOverlayCard({ app }: { app: JobApplication }) {
  return (
    <div className="kanban-card" style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.15)", width: 264 }}>
      <div className="kanban-card-name">{app.applicant.name}</div>
      <div className="kanban-card-meta">
        <span style={{ fontSize: 12 }}>{app.position.title}</span>
      </div>
    </div>
  );
}

/* -- Main export ------------------------------------------- */

export default function ApplicationKanbanBoard({
  applications,
}: {
  applications: JobApplication[];
}) {
  return (
    <KanbanBoard<JobApplication>
      items={applications}
      columns={COLUMNS}
      dragEnabled
      searchPlaceholder="Search by name, position, or chapter..."
      emptyColumnLabel="No applications"
      getSearchText={(app) =>
        [
          app.applicant.name,
          app.applicant.email,
          app.position.title,
          app.position.type,
          app.position.chapter?.name,
        ]
          .filter(Boolean)
          .join(" ")
      }
      onStatusChange={async (itemId, newStatus) => {
        const result = await updateJobApplicationStage(itemId, newStatus);
        return { success: result.success, error: result.error };
      }}
      renderCard={(app, { onClick, isDragging }) => (
        <ApplicationCard app={app} onClick={onClick} isDragging={isDragging} />
      )}
      renderDragOverlay={(app) => <DragOverlayCard app={app} />}
      renderDetailPanel={(app, { onClose, onUpdate }) => (
        <ApplicationDetailPanel
          app={app}
          onClose={onClose}
          onUpdate={onUpdate}
        />
      )}
    />
  );
}
