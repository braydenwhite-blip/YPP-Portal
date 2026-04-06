"use client";

import { useState, useCallback, useTransition, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { updateApplicationStage } from "@/lib/instructor-application-actions";
import ApplicantDetailPanel from "./applicant-detail-panel";
import "./kanban-board.css";

/* ── Types ─────────────────────────────────────────── */

export type InstructorApp = {
  id: string;
  status: string;
  legalName: string | null;
  preferredFirstName: string | null;
  applicantId: string;
  applicant: {
    id: string;
    name: string;
    email: string;
    chapter: { name: string } | null;
  };
  reviewer: { name: string } | null;
  reviewerId: string | null;
  scoreAcademic: number | null;
  scoreCommunication: number | null;
  scoreLeadership: number | null;
  scoreMotivation: number | null;
  scoreFit: number | null;
  decisionRecommendation: string | null;
  actionDueDate: string | null;
  createdAt: string;
  updatedAt: string;
  interviewScheduledAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  // Application details
  motivation: string | null;
  motivationVideoUrl: string | null;
  teachingExperience: string;
  availability: string;
  phoneNumber: string | null;
  city: string | null;
  stateProvince: string | null;
  country: string | null;
  schoolName: string | null;
  graduationYear: number | null;
  gpa: string | null;
  classRank: string | null;
  hoursPerWeek: number | null;
  whyYPP: string | null;
  extracurriculars: string | null;
  priorLeadership: string | null;
  specialSkills: string | null;
  subjectsOfInterest: string | null;
  preferredStartDate: string | null;
  referralEmails: string | null;
  reviewerNotes: string | null;
  infoRequest: string | null;
  applicantResponse: string | null;
  rejectionReason: string | null;
};

export type Reviewer = {
  id: string;
  name: string;
};

/* ── Column definitions ────────────────────────────── */

type ColumnDef = {
  id: string;
  title: string;
  statuses: string[];
  color: string;
};

const COLUMNS: ColumnDef[] = [
  { id: "applied", title: "Applied", statuses: ["SUBMITTED"], color: "#6b21c8" },
  { id: "review", title: "Under Review", statuses: ["UNDER_REVIEW", "INFO_REQUESTED"], color: "#2563eb" },
  { id: "interview", title: "Interview", statuses: ["INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED"], color: "#4338ca" },
  { id: "accepted", title: "Accepted", statuses: ["APPROVED"], color: "#16a34a" },
  { id: "rejected", title: "Rejected", statuses: ["REJECTED"], color: "#dc2626" },
  { id: "on_hold", title: "On Hold", statuses: ["ON_HOLD"], color: "#71717a" },
];

function getColumnForStatus(status: string): string {
  for (const col of COLUMNS) {
    if (col.statuses.includes(status)) return col.id;
  }
  return "applied";
}

function getTargetStatusForColumn(columnId: string): string {
  const col = COLUMNS.find((c) => c.id === columnId);
  if (!col) return "SUBMITTED";
  return col.statuses[0];
}

/* ── Deadline formatting ───────────────────────────── */

function formatDeadline(app: InstructorApp): { text: string; className: string } | null {
  if (app.actionDueDate) {
    const due = new Date(app.actionDueDate);
    const now = new Date();
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const dateStr = due.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (diffDays < 0) {
      return { text: `Overdue by ${Math.abs(diffDays)}d`, className: "kanban-card-deadline overdue" };
    }
    if (diffDays <= 3) {
      return { text: `Due ${dateStr}`, className: "kanban-card-deadline upcoming" };
    }
    return { text: `Due ${dateStr}`, className: "kanban-card-deadline normal" };
  }
  // Contextual fallback
  if (app.status === "INTERVIEW_SCHEDULED" && app.interviewScheduledAt) {
    const d = new Date(app.interviewScheduledAt);
    return { text: `Interview ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, className: "kanban-card-deadline normal" };
  }
  return null;
}

/* ── Composite score ──────────────────────────────── */

function compositeScore(app: InstructorApp): number | null {
  const scores = [app.scoreAcademic, app.scoreCommunication, app.scoreLeadership, app.scoreMotivation, app.scoreFit];
  const valid = scores.filter((s): s is number => s != null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

/* ── Recommendation label ─────────────────────────── */

function recommendationInfo(rec: string | null): { label: string; className: string } | null {
  if (!rec) return null;
  switch (rec) {
    case "STRONG_YES": return { label: "Strong Yes", className: "kanban-card-recommendation strong-yes" };
    case "YES": return { label: "Yes", className: "kanban-card-recommendation yes" };
    case "MAYBE": return { label: "Maybe", className: "kanban-card-recommendation maybe" };
    case "NO": return { label: "No", className: "kanban-card-recommendation no" };
    default: return null;
  }
}

/* ── Applicant Card ────────────────────────────────── */

function ApplicantCard({
  app,
  onClick,
  isDragging,
}: {
  app: InstructorApp;
  onClick: () => void;
  isDragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: app.id,
    data: { app },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const comp = compositeScore(app);
  const deadline = formatDeadline(app);
  const rec = recommendationInfo(app.decisionRecommendation);
  const displayName = app.legalName || app.applicant.name;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`kanban-card${isDragging ? " dragging" : ""}`}
      onClick={(e) => {
        // Don't open detail if user is dragging
        if (e.defaultPrevented) return;
        onClick();
      }}
    >
      <div className="kanban-card-name">{displayName}</div>
      <div className="kanban-card-meta">
        {app.applicant.chapter && (
          <span className="kanban-card-chapter">{app.applicant.chapter.name}</span>
        )}
        <span className={`kanban-card-reviewer${app.reviewer ? "" : " unassigned"}`}>
          {app.reviewer ? app.reviewer.name : "Unassigned"}
        </span>
      </div>
      {deadline && <div className={deadline.className}>{deadline.text}</div>}
      <div className="kanban-card-footer">
        <div className="kanban-card-score">
          {comp != null ? (
            <>
              {[1, 2, 3, 4, 5].map((n) => (
                <div
                  key={n}
                  className={`kanban-card-score-dot ${n <= Math.round(comp) ? "filled" : "empty"}`}
                />
              ))}
              <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: 4 }}>
                {comp.toFixed(1)}
              </span>
            </>
          ) : (
            <span className="kanban-card-score-dot no-info" title="Not scored yet" style={{ width: 16, height: 8, borderRadius: 3 }} />
          )}
        </div>
        {rec && <span className={rec.className}>{rec.label}</span>}
      </div>
    </div>
  );
}

/* ── Overlay card (shown while dragging) ───────────── */

function DragOverlayCard({ app }: { app: InstructorApp }) {
  const displayName = app.legalName || app.applicant.name;
  return (
    <div className="kanban-card" style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.15)", width: 264 }}>
      <div className="kanban-card-name">{displayName}</div>
      <div className="kanban-card-meta">
        {app.applicant.chapter && (
          <span className="kanban-card-chapter">{app.applicant.chapter.name}</span>
        )}
      </div>
    </div>
  );
}

/* ── Kanban Column ─────────────────────────────────── */

function KanbanColumn({
  column,
  apps,
  onCardClick,
  isOver,
}: {
  column: ColumnDef;
  apps: InstructorApp[];
  onCardClick: (app: InstructorApp) => void;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: column.id });

  return (
    <div className={`kanban-column${isOver ? " drag-over" : ""}`} ref={setNodeRef}>
      <div className="kanban-column-header">
        <span className="kanban-column-title" style={{ color: column.color }}>
          {column.title}
        </span>
        <span className="kanban-column-count">{apps.length}</span>
      </div>
      <div className="kanban-column-body">
        {apps.map((app) => (
          <ApplicantCard key={app.id} app={app} onClick={() => onCardClick(app)} />
        ))}
      </div>
    </div>
  );
}

/* ── Main Kanban Board ─────────────────────────────── */

export default function KanbanBoard({
  applications: initialApplications,
  reviewers,
}: {
  applications: InstructorApp[];
  reviewers: Reviewer[];
}) {
  const [applications, setApplications] = useState(initialApplications);
  const [selectedApp, setSelectedApp] = useState<InstructorApp | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Filter applications by search query
  const filteredApplications = useMemo(() => {
    if (!searchQuery.trim()) return applications;
    const q = searchQuery.toLowerCase();
    return applications.filter((app) => {
      const name = (app.legalName || app.applicant.name || "").toLowerCase();
      const email = app.applicant.email.toLowerCase();
      const chapter = app.applicant.chapter?.name?.toLowerCase() || "";
      const school = (app.schoolName || "").toLowerCase();
      return name.includes(q) || email.includes(q) || chapter.includes(q) || school.includes(q);
    });
  }, [applications, searchQuery]);

  // Group applications by column
  const columnApps = useMemo(() => {
    const groups: Record<string, InstructorApp[]> = {};
    for (const col of COLUMNS) {
      groups[col.id] = [];
    }
    for (const app of filteredApplications) {
      const colId = getColumnForStatus(app.status);
      if (groups[colId]) {
        groups[colId].push(app);
      }
    }
    return groups;
  }, [filteredApplications]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over?.id as string | undefined;
    if (overId && COLUMNS.some((c) => c.id === overId)) {
      setOverColumnId(overId);
    } else {
      setOverColumnId(null);
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      setOverColumnId(null);

      const { active, over } = event;
      if (!over) return;

      const appId = active.id as string;
      const targetColumnId = over.id as string;
      const column = COLUMNS.find((c) => c.id === targetColumnId);
      if (!column) return;

      const app = applications.find((a) => a.id === appId);
      if (!app) return;

      // Don't move if already in the same column
      if (column.statuses.includes(app.status)) return;

      const newStatus = getTargetStatusForColumn(targetColumnId);

      // Optimistic update
      setApplications((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status: newStatus } : a))
      );

      // Also update selectedApp if it's the one being moved
      if (selectedApp?.id === appId) {
        setSelectedApp((prev) => prev ? { ...prev, status: newStatus } : null);
      }

      // Persist to server
      startTransition(async () => {
        const result = await updateApplicationStage(appId, newStatus as any);
        if (!result.success) {
          // Revert on failure
          setApplications((prev) =>
            prev.map((a) => (a.id === appId ? { ...a, status: app.status } : a))
          );
        }
      });
    },
    [applications, selectedApp, startTransition]
  );

  const activeApp = activeId ? applications.find((a) => a.id === activeId) : null;

  // Callback for when detail panel updates an application
  const handleAppUpdate = useCallback((updated: Partial<InstructorApp> & { id: string }) => {
    setApplications((prev) =>
      prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a))
    );
    if (selectedApp?.id === updated.id) {
      setSelectedApp((prev) => prev ? { ...prev, ...updated } : null);
    }
  }, [selectedApp]);

  return (
    <>
      {/* Search bar */}
      <div style={{ marginBottom: 16 }}>
        <input
          className="input"
          placeholder="Search by name, email, chapter, or school..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ maxWidth: 360, marginBottom: 0 }}
        />
      </div>

      {/* Board */}
      <div className="kanban-wrapper">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="kanban-board">
            {COLUMNS.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                apps={columnApps[column.id] || []}
                onCardClick={setSelectedApp}
                isOver={overColumnId === column.id}
              />
            ))}
          </div>

          <DragOverlay>
            {activeApp ? <DragOverlayCard app={activeApp} /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Detail panel */}
      {selectedApp && (
        <ApplicantDetailPanel
          app={selectedApp}
          reviewers={reviewers}
          onClose={() => setSelectedApp(null)}
          onUpdate={handleAppUpdate}
        />
      )}
    </>
  );
}
