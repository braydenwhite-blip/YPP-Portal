"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import KanbanBoard, { type KanbanColumnDef } from "@/components/kanban/kanban-board";
import ApplicantPipelineCard from "./ApplicantPipelineCard";
import ApplicantCommandFilters from "./ApplicantCommandFilters";
import ApplicantPipelineOverview, {
  type ApplicantPipelineFilteredCounts,
  type FunnelCounts,
} from "./ApplicantPipelineOverview";
import ApplicantQuickDrawer from "./ApplicantQuickDrawer";
import ArchiveTable from "./ArchiveTable";
import InstructorApplicantsWorkspace, {
  type WorkspaceApplicant,
} from "./InstructorApplicantsWorkspace";
import { formatApplicantDisplayName } from "@/lib/applicant-display-name";
import {
  completeInterviewStage,
  sendToChair,
  updateApplicationStage,
} from "@/lib/instructor-application-actions";
import type { InstructorApplicationStatus } from "@prisma/client";
import { ButtonLink, cn } from "@/components/ui-v2";

type PipelineApp = {
  id: string;
  status: string;
  materialsReadyAt: Date | string | null;
  interviewScheduledAt: Date | string | null;
  archivedAt: Date | string | null;
  overdue?: boolean;
  subjectsOfInterest: string | null;
  legalName?: string | null;
  preferredFirstName?: string | null;
  lastName?: string | null;
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
  applicationTrack?: string;
  instructorSubtype?: string;
  workshopOutlinePresent?: boolean;
  workshopTitle?: string | null;
  workshopAgeRange?: string | null;
  workshopDurationMinutes?: number | null;
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
  workspaceApps?: WorkspaceApplicant[];
  pipelineFilteredCounts?: ApplicantPipelineFilteredCounts;
  funnelCounts?: FunnelCounts;
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
    id: "on_hold",
    title: "On Hold",
    statuses: ["ON_HOLD"],
    color: "#a16207",
  },
  {
    id: "waitlisted",
    title: "Waitlisted",
    statuses: ["WAITLISTED"],
    color: "#7c3aed",
  },
  {
    id: "decided",
    title: "Decided",
    statuses: ["APPROVED", "REJECTED"],
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
  ON_HOLD: "on_hold",
  WAITLISTED: "waitlisted",
};

// Build a flattened column def that handles derived "INTERVIEW_SCHEDULED_READY" logic
const EXTENDED_COLUMNS: KanbanColumnDef[] = [
  { id: "new", title: "New", statuses: ["SUBMITTED"], color: "#6b21c8" },
  { id: "needs_review", title: "Needs Review", statuses: ["UNDER_REVIEW", "INFO_REQUESTED"], color: "#2563eb" },
  { id: "interview_prep", title: "Interview Prep", statuses: ["PRE_APPROVED", "INTERVIEW_SCHEDULED"], color: "#d97706" },
  { id: "ready_for_interview", title: "Ready for Interview", statuses: ["INTERVIEW_SCHEDULED_READY"], color: "#059669" },
  { id: "post_interview", title: "Post-Interview", statuses: ["INTERVIEW_COMPLETED"], color: "#4338ca" },
  { id: "chair_review", title: "Chair Review", statuses: ["CHAIR_REVIEW"], color: "#b45309" },
  { id: "on_hold", title: "On Hold", statuses: ["ON_HOLD"], color: "#a16207" },
  { id: "waitlisted", title: "Waitlisted", statuses: ["WAITLISTED"], color: "#7c3aed" },
  { id: "decided", title: "Decided (30d)", statuses: ["APPROVED", "REJECTED"], color: "#71717a" },
];

type TabValue = "review" | "pipeline" | "archive";

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
  workspaceApps = [],
  pipelineFilteredCounts,
  funnelCounts,
}: InstructorApplicantsCommandCenterProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedDrawerApp, setSelectedDrawerApp] = useState<PipelineApp | null>(null);
  const [boardMessage, setBoardMessage] = useState<{ text: string; ok: boolean } | null>(
    null
  );

  // Drag-to-advance. The board hands us the synthetic target status
  // (`column.statuses[0]`); we translate that into the correct, permission-safe
  // server action so a drop is exactly equivalent to clicking the matching
  // button. Anything that needs a richer step (final decisions, pre-approval,
  // scheduling) is intentionally not drag-driven and returns a helpful nudge.
  async function handleBoardStatusChange(
    itemId: string,
    targetStatus: string
  ): Promise<{ success: boolean; error?: string }> {
    let result: { success: boolean; error?: string };

    if (targetStatus === "INTERVIEW_COMPLETED") {
      const fd = new FormData();
      fd.set("applicationId", itemId);
      result = await completeInterviewStage(fd);
    } else if (targetStatus === "CHAIR_REVIEW") {
      const fd = new FormData();
      fd.set("applicationId", itemId);
      result = await sendToChair(fd);
    } else if (
      targetStatus === "ON_HOLD" ||
      targetStatus === "WAITLISTED" ||
      targetStatus === "UNDER_REVIEW"
    ) {
      result = await updateApplicationStage(
        itemId,
        targetStatus as InstructorApplicationStatus
      );
    } else {
      result = {
        success: false,
        error:
          "That step isn't available by drag — open the applicant to schedule, pre-approve, or record a final decision.",
      };
    }

    setBoardMessage(
      result.success
        ? { text: "Moved. The pipeline is up to date.", ok: true }
        : { text: result.error ?? "Couldn't move that applicant.", ok: false }
    );
    if (result.success) router.refresh();
    return result;
  }

  const rawTab = searchParams.get("view") ?? searchParams.get("tab");
  const activeTab: TabValue =
    rawTab === "pipeline" || rawTab === "archive" ? rawTab : "review";

  function setTab(tab: TabValue) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "review") {
      params.set("view", "review");
      params.delete("tab");
    } else if (tab === "pipeline") {
      params.set("view", "pipeline");
      params.delete("tab");
    } else {
      params.set("view", "archive");
      params.delete("tab");
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

  const tabClass = (active: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 rounded-[8px] px-3.5 py-2 text-[13px] font-semibold transition-colors duration-100",
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400",
      active
        ? "bg-brand-50 text-brand-700"
        : "text-ink-muted hover:bg-surface-soft hover:text-ink"
    );

  return (
    <div className="rounded-[12px] border border-line-soft bg-surface p-4 shadow-card">
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Applicant workflow views"
        className="mb-3 flex flex-wrap items-center gap-1 border-b border-line-soft pb-3"
      >
        <button
          role="tab"
          type="button"
          aria-selected={activeTab === "review"}
          className={tabClass(activeTab === "review")}
          onClick={() => setTab("review")}
        >
          Applicant review
          {workspaceApps.length > 0 && (
            <span
              aria-label={`${workspaceApps.length} in review`}
              className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 py-0.5 text-[10.5px] font-bold text-white"
            >
              {workspaceApps.length}
            </span>
          )}
        </button>
        <button
          role="tab"
          type="button"
          aria-selected={activeTab === "pipeline"}
          className={tabClass(activeTab === "pipeline")}
          onClick={() => setTab("pipeline")}
        >
          Pipeline board
        </button>
        {canSeeChairQueue && chairQueueCount > 0 && (
          <ButtonLink
            href="/admin/instructor-applicants/chair-queue"
            variant="ghost"
            size="sm"
            className="ml-auto text-[12.5px]"
          >
            Chair queue ({chairQueueCount}) →
          </ButtonLink>
        )}
        <button
          role="tab"
          type="button"
          aria-selected={activeTab === "archive"}
          className={tabClass(activeTab === "archive")}
          onClick={() => setTab("archive")}
        >
          Archive
        </button>
      </div>

      {activeTab === "review" && (
        <div role="tabpanel" aria-label="Applicant review" className="flex flex-col gap-3">
          <p className="m-0 text-[13.5px] text-[#717189]">
            Ordered by where each applicant actually is in the process. The reviews already written
            come first — not a new review form.
          </p>
          <Suspense
            fallback={
              <p className="text-[13px] text-[#9a9ab0]">Loading applicant workspace…</p>
            }
          >
            <InstructorApplicantsWorkspace
              applications={workspaceApps}
              canDecide={canSeeChairQueue}
            />
          </Suspense>
        </div>
      )}

      {/* Pipeline tab */}
      {activeTab === "pipeline" && (
        <div role="tabpanel" aria-label="Pipeline view">
          {pipelineFilteredCounts ? (
            <ApplicantPipelineOverview
              filteredCounts={pipelineFilteredCounts}
              funnelCounts={funnelCounts}
            />
          ) : null}
          <ApplicantCommandFilters
            isAdmin={isAdmin}
            chapters={chapters}
            reviewers={reviewers}
            interviewers={interviewers}
            actorId={actorId}
          />
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="m-0 text-[12px] text-ink-muted">
              <span aria-hidden>↔ </span>Drag a card between columns to advance it —
              mark interviews complete, send to the chair, hold, or waitlist.
            </p>
            {boardMessage && (
              <span
                role="status"
                aria-live="polite"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold",
                  boardMessage.ok
                    ? "bg-success-50 text-success-600"
                    : "bg-danger-50 text-danger-700"
                )}
              >
                {boardMessage.text}
                <button
                  type="button"
                  aria-label="Dismiss"
                  className="cursor-pointer text-current/70 hover:text-current"
                  onClick={() => setBoardMessage(null)}
                >
                  ✕
                </button>
              </span>
            )}
          </div>
          <KanbanBoard
            items={kanbanItems}
            columns={EXTENDED_COLUMNS}
            dragEnabled
            onStatusChange={handleBoardStatusChange}
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
                  isAdmin={isAdmin}
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
                app ? formatApplicantDisplayName(app) : "",
                app?.preferredFirstName ?? "",
                app?.lastName ?? "",
                app?.legalName ?? "",
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

      {/* Archive tab */}
      {activeTab === "archive" && (
        <div role="tabpanel" aria-label="Archive">
          <ArchiveTable
            applications={archivedApps as any}
          />
        </div>
      )}

      {/* Standalone drawer state (outside KanbanBoard for imperative open) */}
      {selectedDrawerApp && (
        <ApplicantQuickDrawer
          app={selectedDrawerApp}
          isAdmin={isAdmin}
          onClose={() => setSelectedDrawerApp(null)}
        />
      )}
    </div>
  );
}
