"use client";

import { KanbanBoard, type KanbanColumnDef } from "@/components/kanban";
import {
  compositeScore,
  formatDeadline,
  recommendationInfo,
} from "@/components/kanban/kanban-utils";
// Note: CP model lacks decisionRecommendation and actionDueDate fields
// (those exist only on InstructorApplication). We handle them as optional.
import { updateCPApplicationStage } from "@/lib/cp-application-kanban-actions";
import CPDetailPanel from "./cp-detail-panel";

/* ── Types ─────────────────────────────────────────── */

export type CPApp = {
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
  chapter: { name: string } | null;
  reviewer: { name: string } | null;
  reviewerId: string | null;
  scoreLeadership: number | null;
  scoreVision: number | null;
  scoreOrganization: number | null;
  scoreCommitment: number | null;
  scoreFit: number | null;
  decisionRecommendation?: string | null;
  actionDueDate?: string | null;
  createdAt: string;
  updatedAt: string;
  interviewScheduledAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  whyChapterPresident: string | null;
  leadershipExperience: string;
  chapterVision: string;
  recruitmentPlan: string | null;
  launchPlan: string | null;
  priorOrganizing: string | null;
  extracurriculars: string | null;
  specialSkills: string | null;
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
  preferredStartDate: string | null;
  referralEmails: string | null;
  reviewerNotes: string | null;
  infoRequest: string | null;
  applicantResponse: string | null;
  rejectionReason: string | null;
  partnerSchool: string | null;
  hearAboutYPP: string | null;
  ethnicity: string | null;
  documentUrl: string | null;
  instructorApplicantPosition: string | null;
  classInMind: string | null;
  instructorTeachingDesc: string | null;
  customResponses: {
    id: string;
    value: string;
    fileUrl: string | null;
    field: { label: string; fieldType: string };
  }[];
};

export type Reviewer = {
  id: string;
  name: string;
};

/* ── Column definitions ────────────────────────────── */

const COLUMNS: KanbanColumnDef[] = [
  { id: "applied", title: "Applied", statuses: ["SUBMITTED"], color: "#6b21c8" },
  { id: "review", title: "Under Review", statuses: ["UNDER_REVIEW", "INFO_REQUESTED"], color: "#2563eb" },
  { id: "interview", title: "Interview", statuses: ["INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED"], color: "#4338ca" },
  { id: "accepted", title: "Accepted", statuses: ["APPROVED"], color: "#16a34a" },
  { id: "rejected", title: "Rejected", statuses: ["REJECTED"], color: "#dc2626" },
];

/* ── CP-specific deadline formatting ────────────────── */

function formatCPDeadline(app: CPApp): { text: string; className: string } | null {
  const base = formatDeadline(app.actionDueDate ?? null);
  if (base) return base;
  if (app.status === "INTERVIEW_SCHEDULED" && app.interviewScheduledAt) {
    const d = new Date(app.interviewScheduledAt);
    return {
      text: `Interview ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      className: "kanban-card-deadline normal",
    };
  }
  return null;
}

/* ── Card ─────────────────────────────────────────── */

function CPApplicantCard({
  app,
  onClick,
  isDragging,
}: {
  app: CPApp;
  onClick: () => void;
  isDragging?: boolean;
}) {
  const comp = compositeScore([
    app.scoreLeadership,
    app.scoreVision,
    app.scoreOrganization,
    app.scoreCommitment,
    app.scoreFit,
  ]);
  const deadline = formatCPDeadline(app);
  const rec = recommendationInfo(app.decisionRecommendation ?? null);
  const displayName = app.legalName || app.applicant.name;
  const chapterName = app.chapter?.name || app.applicant.chapter?.name;

  return (
    <div
      className={`kanban-card${isDragging ? " dragging" : ""}`}
      onClick={(e) => {
        if (e.defaultPrevented) return;
        onClick();
      }}
    >
      <div className="kanban-card-name">{displayName}</div>
      <div className="kanban-card-meta">
        {chapterName ? (
          <span className="kanban-card-chapter">{chapterName}</span>
        ) : (
          <span className="kanban-card-chapter" style={{ background: "#fef3c7", color: "#d97706" }}>
            New Chapter
          </span>
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
            <span
              className="kanban-card-score-dot no-info"
              title="Not scored yet"
              style={{ width: 16, height: 8, borderRadius: 3 }}
            />
          )}
        </div>
        {rec && <span className={rec.className}>{rec.label}</span>}
      </div>
    </div>
  );
}

/* ── Drag Overlay Card ─────────────────────────────── */

function DragOverlayCard({ app }: { app: CPApp }) {
  const displayName = app.legalName || app.applicant.name;
  return (
    <div className="kanban-card" style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.15)", width: 264 }}>
      <div className="kanban-card-name">{displayName}</div>
      <div className="kanban-card-meta">
        {(app.chapter?.name || app.applicant.chapter?.name) && (
          <span className="kanban-card-chapter">
            {app.chapter?.name || app.applicant.chapter?.name}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Main export ──────────────────────────────────── */

export default function CPKanbanBoard({
  applications,
  reviewers,
}: {
  applications: CPApp[];
  reviewers: Reviewer[];
}) {
  return (
    <KanbanBoard<CPApp>
      items={applications}
      columns={COLUMNS}
      dragEnabled
      searchPlaceholder="Search by name, email, chapter, or school..."
      emptyColumnLabel="No applicants"
      getSearchText={(app) =>
        [
          app.legalName,
          app.applicant.name,
          app.applicant.email,
          app.chapter?.name,
          app.applicant.chapter?.name,
          app.schoolName,
        ]
          .filter(Boolean)
          .join(" ")
      }
      onStatusChange={async (itemId, newStatus) => {
        const result = await updateCPApplicationStage(itemId, newStatus);
        return { success: result.success, error: result.error };
      }}
      renderCard={(app, { onClick, isDragging }) => (
        <CPApplicantCard app={app} onClick={onClick} isDragging={isDragging} />
      )}
      renderDragOverlay={(app) => <DragOverlayCard app={app} />}
      renderDetailPanel={(app, { onClose, onUpdate }) => (
        <CPDetailPanel
          app={app}
          reviewers={reviewers}
          onClose={onClose}
          onUpdate={onUpdate}
        />
      )}
    />
  );
}
