"use client";

import { useMemo, startTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import KanbanBoard, { type KanbanColumnDef } from "@/components/kanban/kanban-board";
import ApplicantPipelineCard from "./ApplicantPipelineCard";
import ArchiveTable from "./ArchiveTable";
import { formatApplicantDisplayName } from "@/lib/applicant-display-name";
import { ButtonLink, cn } from "@/components/ui-v2";

type PipelineApp = {
  id: string;
  status: string;
  interviewScheduledAt: Date | string | null;
  archivedAt: Date | string | null;
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
  updatedAt: Date | string;
};

interface InstructorApplicantsCommandCenterProps {
  pipelineApps: PipelineApp[];
  archivedApps: PipelineApp[];
  chairQueueCount?: number;
  canSeeChairQueue?: boolean;
}

const BOARD_COLUMNS: KanbanColumnDef[] = [
  { id: "new", title: "New", statuses: ["SUBMITTED"], color: "#6b21c8" },
  {
    id: "review",
    title: "Review",
    statuses: ["UNDER_REVIEW", "INFO_REQUESTED"],
    color: "#2563eb",
  },
  {
    id: "interview",
    title: "Interview",
    statuses: ["PRE_APPROVED", "INTERVIEW_SCHEDULED", "INTERVIEW_SCHEDULED_READY"],
    color: "#d97706",
  },
  {
    id: "chair",
    title: "Chair",
    statuses: ["INTERVIEW_COMPLETED", "CHAIR_REVIEW"],
    color: "#b45309",
  },
  { id: "on_hold", title: "On Hold", statuses: ["ON_HOLD"], color: "#a16207" },
  { id: "waitlisted", title: "Waitlisted", statuses: ["WAITLISTED"], color: "#7c3aed" },
  { id: "decided", title: "Decided", statuses: ["APPROVED", "REJECTED"], color: "#71717a" },
];

const CORE_COLUMN_IDS = new Set(["new", "review", "interview", "chair"]);

function getDerivedStatus(app: PipelineApp): string {
  if (app.status === "INTERVIEW_SCHEDULED") {
    return app.interviewScheduledAt ? "INTERVIEW_SCHEDULED_READY" : app.status;
  }
  return app.status;
}

function columnIdForStatus(status: string): string {
  for (const column of BOARD_COLUMNS) {
    if (column.statuses.includes(status)) return column.id;
  }
  return BOARD_COLUMNS[0]?.id ?? "new";
}

type TabValue = "pipeline" | "archive";

export default function InstructorApplicantsCommandCenter({
  pipelineApps,
  archivedApps,
  chairQueueCount = 0,
  canSeeChairQueue = false,
}: InstructorApplicantsCommandCenterProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const rawTab = searchParams.get("view") ?? searchParams.get("tab");
  const activeTab: TabValue = rawTab === "archive" ? "archive" : "pipeline";

  function setTab(tab: TabValue) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "archive") {
      params.set("view", "archive");
    } else {
      params.set("view", "pipeline");
    }
    params.delete("tab");
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  function openApplicantRecord(applicationId: string) {
    startTransition(() => {
      router.push(`/admin/instructor-applicants/${applicationId}`);
    });
  }

  const kanbanItems = useMemo(
    () =>
      pipelineApps.map((app) => ({
        ...app,
        status: getDerivedStatus(app),
      })),
    [pipelineApps]
  );

  const visibleColumns = useMemo(() => {
    const counts: Record<string, number> = Object.fromEntries(
      BOARD_COLUMNS.map((column) => [column.id, 0])
    );
    for (const item of kanbanItems) {
      const columnId = columnIdForStatus(item.status);
      counts[columnId] = (counts[columnId] ?? 0) + 1;
    }
    return BOARD_COLUMNS.filter(
      (column) => CORE_COLUMN_IDS.has(column.id) || counts[column.id] > 0
    );
  }, [kanbanItems]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <nav aria-label="Applicant views" className="seg-tabs w-fit">
          <button
            type="button"
            className={cn("seg-tab", activeTab === "pipeline" && "active")}
            aria-current={activeTab === "pipeline" ? "page" : undefined}
            onClick={() => setTab("pipeline")}
          >
            Board ({pipelineApps.length})
          </button>
          <button
            type="button"
            className={cn("seg-tab", activeTab === "archive" && "active")}
            aria-current={activeTab === "archive" ? "page" : undefined}
            onClick={() => setTab("archive")}
          >
            Archive
          </button>
        </nav>
        {canSeeChairQueue && chairQueueCount > 0 ? (
          <ButtonLink
            href="/admin/instructor-applicants/chair-queue"
            variant="ghost"
            size="sm"
            className="text-[12.5px]"
          >
            Chair queue ({chairQueueCount})
          </ButtonLink>
        ) : null}
      </div>

      {activeTab === "pipeline" ? (
        <KanbanBoard
          items={kanbanItems}
          columns={visibleColumns}
          dragEnabled={false}
          renderCard={(item, { isDragging }) => {
            const originalApp = pipelineApps.find((app) => app.id === item.id)!;
            return (
              <ApplicantPipelineCard
                app={originalApp}
                onClick={() => openApplicantRecord(item.id)}
                isDragging={isDragging}
              />
            );
          }}
          renderDragOverlay={(item) => {
            const originalApp = pipelineApps.find((app) => app.id === item.id)!;
            return (
              <ApplicantPipelineCard app={originalApp} onClick={() => {}} isDragging />
            );
          }}
          getSearchText={(item) => {
            const app = pipelineApps.find((candidate) => candidate.id === item.id);
            return [
              app ? formatApplicantDisplayName(app) : "",
              app?.applicant.name ?? "",
              app?.applicant.email ?? "",
              app?.applicant.chapter?.name ?? "",
            ]
              .join(" ")
              .toLowerCase();
          }}
          searchPlaceholder="Search…"
          emptyColumnLabel="Empty"
        />
      ) : (
        <ArchiveTable applications={archivedApps as any} />
      )}
    </div>
  );
}
