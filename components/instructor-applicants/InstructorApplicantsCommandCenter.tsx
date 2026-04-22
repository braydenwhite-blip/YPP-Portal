"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import KanbanBoard, { type KanbanColumnDef } from "@/components/kanban/kanban-board";
import ApplicantPipelineCard from "./ApplicantPipelineCard";
import ApplicantCommandFilters from "./ApplicantCommandFilters";
import ApplicantQuickDrawer from "./ApplicantQuickDrawer";
import ArchiveTable from "./ArchiveTable";

type PipelineApp = {
  id: string;
  status: string;
  materialsReadyAt: Date | string | null;
  interviewScheduledAt: Date | string | null;
  archivedAt: Date | string | null;
  overdue?: boolean;
  subjectsOfInterest: string | null;
  applicant: {
    id: string;
    name: string | null;
    email: string;
    chapter: { id: string; name: string } | null;
  };
  reviewer: { id: string; name: string | null } | null;
  interviewerAssignments: Array<{
    id: string;
    role: string;
    interviewer: { id: string; name: string | null };
  }>;
  applicationReviews?: Array<{
    summary: string | null;
    nextStep: string | null;
    overallRating: string | null;
  }>;
  chairDecision?: { action: string; decidedAt: Date | string } | null;
  updatedAt: Date | string;
};

type FilterUser = { id: string; name: string | null; email: string };

interface InstructorApplicantsCommandCenterProps {
  scope: "global" | "chapter";
  chapterId?: string;
  pipelineApps: PipelineApp[];
  archivedApps: PipelineApp[];
  chairQueueCount?: number;
  canSeeChairQueue?: boolean;
  chapters?: Array<{ id: string; name: string }>;
  reviewers?: FilterUser[];
  interviewers?: FilterUser[];
  actorId?: string;
  isAdmin?: boolean;
}

// Derived column → kanban column definition
const KANBAN_COLUMNS: KanbanColumnDef[] = [
  {
    id: "new",
    title: "New",
    statuses: ["SUBMITTED"],
    color: "#6b21c8",
  },
  {
    id: "needs_review",
    title: "Needs Review",
    statuses: ["UNDER_REVIEW", "INFO_REQUESTED"],
    color: "#2563eb",
  },
  {
    id: "interview_prep",
    title: "Interview Prep",
    statuses: ["PRE_APPROVED", "INTERVIEW_SCHEDULED"],
    color: "#d97706",
  },
  {
    id: "ready_for_interview",
    title: "Ready for Interview",
    statuses: ["INTERVIEW_SCHEDULED"],
    color: "#059669",
  },
  {
    id: "post_interview",
    title: "Post-Interview",
    statuses: ["INTERVIEW_COMPLETED"],
    color: "#4338ca",
  },
  {
    id: "chair_review",
    title: "Chair Review",
    statuses: ["CHAIR_REVIEW"],
    color: "#b45309",
  },
  {
    id: "decided",
    title: "Decided",
    statuses: ["APPROVED", "REJECTED", "ON_HOLD"],
    color: "#71717a",
  },
];

function getDerivedStatus(app: PipelineApp): string {
  // For kanban, we use a synthetic status key per derived column
  if (app.status === "INTERVIEW_SCHEDULED") {
    return app.interviewScheduledAt ? "INTERVIEW_SCHEDULED_READY" : app.status;
  }
  return app.status;
}

const COLUMN_FOR_STATUS: Record<string, string> = {
  SUBMITTED: "new",
  UNDER_REVIEW: "needs_review",
  INFO_REQUESTED: "needs_review",
  PRE_APPROVED: "interview_prep",
  INTERVIEW_SCHEDULED: "interview_prep",
  INTERVIEW_SCHEDULED_READY: "ready_for_interview",
  INTERVIEW_COMPLETED: "post_interview",
  CHAIR_REVIEW: "chair_review",
  APPROVED: "decided",
  REJECTED: "decided",
  ON_HOLD: "decided",
};

// Build a flattened column def that handles derived "INTERVIEW_SCHEDULED_READY" logic
const EXTENDED_COLUMNS: KanbanColumnDef[] = [
  { id: "new", title: "New", statuses: ["SUBMITTED"], color: "#6b21c8" },
  { id: "needs_review", title: "Needs Review", statuses: ["UNDER_REVIEW", "INFO_REQUESTED"], color: "#2563eb" },
  { id: "interview_prep", title: "Interview Prep", statuses: ["PRE_APPROVED", "INTERVIEW_SCHEDULED"], color: "#d97706" },
  { id: "ready_for_interview", title: "Ready for Interview", statuses: ["INTERVIEW_SCHEDULED_READY"], color: "#059669" },
  { id: "post_interview", title: "Post-Interview", statuses: ["INTERVIEW_COMPLETED"], color: "#4338ca" },
  { id: "chair_review", title: "Chair Review", statuses: ["CHAIR_REVIEW"], color: "#b45309" },
  { id: "decided", title: "Decided (30d)", statuses: ["APPROVED", "REJECTED", "ON_HOLD"], color: "#71717a" },
];

type TabValue = "pipeline" | "chair_queue" | "archive";

export default function InstructorApplicantsCommandCenter({
  pipelineApps,
  archivedApps,
  chairQueueCount = 0,
  canSeeChairQueue = false,
  chapters = [],
  reviewers = [],
  interviewers = [],
  actorId,
  isAdmin = false,
}: InstructorApplicantsCommandCenterProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedDrawerApp, setSelectedDrawerApp] = useState<PipelineApp | null>(null);

  const rawTab = searchParams.get("tab");
  const activeTab: TabValue =
    rawTab === "chair_queue" || rawTab === "archive" ? rawTab : "pipeline";

  function setTab(tab: TabValue) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "pipeline") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  // Enrich apps with derived status for kanban column mapping
  const kanbanItems = useMemo(
    () =>
      pipelineApps.map((app) => ({
        ...app,
        status: getDerivedStatus(app),
      })),
    [pipelineApps]
  );

  return (
    <div className="applicant-command">
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Applicant workflow views"
        className="applicant-command-tabs"
      >
        <button
          role="tab"
          type="button"
          aria-selected={activeTab === "pipeline"}
          className="applicant-command-tab"
          data-active={activeTab === "pipeline"}
          onClick={() => setTab("pipeline")}
        >
          Pipeline
        </button>
        {canSeeChairQueue && (
          <button
            role="tab"
            type="button"
            aria-selected={activeTab === "chair_queue"}
            className="applicant-command-tab"
            data-active={activeTab === "chair_queue"}
            onClick={() => setTab("chair_queue")}
          >
            Chair Queue
            {chairQueueCount > 0 && (
              <span
                aria-label={`${chairQueueCount} pending`}
                className="applicant-command-tab-count"
              >
                {chairQueueCount}
              </span>
            )}
          </button>
        )}
        <button
          role="tab"
          type="button"
          aria-selected={activeTab === "archive"}
          className="applicant-command-tab"
          data-active={activeTab === "archive"}
          onClick={() => setTab("archive")}
        >
          Archive
        </button>
      </div>

      {/* Pipeline tab */}
      {activeTab === "pipeline" && (
        <div role="tabpanel" aria-label="Pipeline view" className="applicant-command-panel">
          <ApplicantCommandFilters
            isAdmin={isAdmin}
            chapters={chapters}
            reviewers={reviewers}
            interviewers={interviewers}
            actorId={actorId}
          />
          <KanbanBoard
            items={kanbanItems}
            columns={EXTENDED_COLUMNS}
            dragEnabled={false}
            renderCard={(item, { onClick, isDragging }) => {
              const originalApp = pipelineApps.find((a) => a.id === item.id)!;
              return (
                <ApplicantPipelineCard
                  app={originalApp}
                  onClick={onClick}
                  isDragging={isDragging}
                />
              );
            }}
            renderDragOverlay={(item) => {
              const originalApp = pipelineApps.find((a) => a.id === item.id)!;
              return (
                <ApplicantPipelineCard
                  app={originalApp}
                  onClick={() => {}}
                  isDragging
                />
              );
            }}
            renderDetailPanel={(item, { onClose }) => {
              const originalApp = pipelineApps.find((a) => a.id === item.id) ?? null;
              if (!originalApp) return null;
              return (
                <ApplicantQuickDrawer
                  app={originalApp}
                  onClose={() => {
                    setSelectedDrawerApp(null);
                    onClose();
                  }}
                />
              );
            }}
            getSearchText={(item) => {
              const app = pipelineApps.find((a) => a.id === item.id);
              return [
                app?.applicant.name ?? "",
                app?.applicant.email ?? "",
                app?.applicant.chapter?.name ?? "",
                app?.subjectsOfInterest ?? "",
                app?.reviewer?.name ?? "",
              ]
                .join(" ")
                .toLowerCase();
            }}
            searchPlaceholder="Search applicants..."
            emptyColumnLabel="No applicants"
          />
        </div>
      )}

      {/* Chair Queue tab — redirects to dedicated page */}
      {activeTab === "chair_queue" && canSeeChairQueue && (
        <div role="tabpanel" aria-label="Chair queue" className="applicant-command-empty">
          <p>
            The Chair Queue is now a dedicated page.
          </p>
          <a href="/admin/instructor-applicants/chair-queue" className="button">
            Open Chair Queue
          </a>
        </div>
      )}

      {/* Archive tab */}
      {activeTab === "archive" && (
        <div role="tabpanel" aria-label="Archive" className="applicant-command-panel">
          <ArchiveTable
            applications={archivedApps as any}
          />
        </div>
      )}

      {/* Standalone drawer state (outside KanbanBoard for imperative open) */}
      {selectedDrawerApp && (
        <ApplicantQuickDrawer
          app={selectedDrawerApp}
          onClose={() => setSelectedDrawerApp(null)}
        />
      )}
    </div>
  );
}
