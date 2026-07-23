"use client";

import { useCallback, useMemo, startTransition, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import KanbanBoard, { type KanbanColumnDef } from "@/components/kanban/kanban-board";
import ApplicantPipelineCard, {
  matchesPipelineStatusFilter,
} from "./ApplicantPipelineCard";
import ApplicantCommandFilters from "./ApplicantCommandFilters";
import ArchiveTable from "./ArchiveTable";
import { formatApplicantDisplayName } from "@/lib/applicant-display-name";
import { applicantDetailHref } from "@/lib/applicant-board-kind";
import { cn } from "@/components/ui-v2";

type PipelineApp = {
  id: string;
  status: string;
  interviewScheduledAt: Date | string | null;
  archivedAt: Date | string | null;
  subjectsOfInterest: string | null;
  legalName?: string | null;
  preferredFirstName?: string | null;
  lastName?: string | null;
  kind?: "instructor" | "cp" | "staff";
  applicant: {
    id: string;
    name: string | null;
    email: string;
    chapter: { id: string; name: string } | null;
  };
  reviewer: { id: string; name: string | null } | null;
  updatedAt: Date | string;
};

type FilterUser = { id: string; name: string | null; email: string };

interface InstructorApplicantsCommandCenterProps {
  pipelineApps: PipelineApp[];
  archivedApps: PipelineApp[];
  chapters?: Array<{ id: string; name: string }>;
  reviewers?: FilterUser[];
  interviewers?: FilterUser[];
  actorId?: string;
  /** Show chapter dropdown (network-scope admins / hiring chairs). */
  showChapterFilter?: boolean;
  /** Show Instructor / CP / All roles filter (admin unified board). */
  showKindFilter?: boolean;
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
  chapters = [],
  reviewers = [],
  interviewers = [],
  actorId,
  showChapterFilter = false,
  showKindFilter = false,
}: InstructorApplicantsCommandCenterProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [, startFilterTransition] = useTransition();

  const rawTab = searchParams.get("view") ?? searchParams.get("tab");
  const activeTab: TabValue = rawTab === "archive" ? "archive" : "pipeline";
  const statusFilter = searchParams.get("status") ?? "";
  const chapterFilter = searchParams.get("chapterId") ?? "";
  const kindFilter = (searchParams.get("kind") ?? "").toLowerCase();

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

  function openApplicantRecord(app: PipelineApp) {
    const kind =
      app.kind === "cp" ? "cp" : app.kind === "staff" ? "staff" : "instructor";
    startTransition(() => {
      router.push(applicantDetailHref(kind, app.id));
    });
  }

  const setOrToggleParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const current = params.get(key) ?? "";
      if (current === value) {
        params.delete(key);
      } else if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      startFilterTransition(() => {
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams]
  );

  const filteredApps = useMemo(
    () =>
      pipelineApps.filter((app): app is PipelineApp => {
        if (!app?.id || !app.status) return false;
        if (kindFilter === "cp" && app.kind !== "cp") return false;
        if (kindFilter === "staff" && app.kind !== "staff") return false;
        if (kindFilter === "instructor" && app.kind !== "instructor" && app.kind != null) {
          return false;
        }
        return matchesPipelineStatusFilter(app, statusFilter);
      }),
    [pipelineApps, statusFilter, kindFilter]
  );

  const kanbanItems = useMemo(
    () =>
      filteredApps.map((app) => ({
        ...app,
        status: getDerivedStatus(app),
      })),
    [filteredApps]
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
            Board ({filteredApps.length}
            {statusFilter && filteredApps.length !== pipelineApps.length
              ? ` of ${pipelineApps.length}`
              : ""}
            )
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
      </div>

      {activeTab === "pipeline" ? (
        <>
          <ApplicantCommandFilters
            isAdmin={showChapterFilter}
            chapters={chapters}
            showKindFilter={showKindFilter}
          />
          <KanbanBoard
            items={kanbanItems}
            columns={visibleColumns}
            dragEnabled={false}
            renderCard={(item, { isDragging }) => (
              <ApplicantPipelineCard
                app={item}
                onClick={() => openApplicantRecord(item)}
                isDragging={isDragging}
                onFilterStatus={(stage) => setOrToggleParam("status", stage)}
                onFilterChapter={
                  showChapterFilter
                    ? (chapterId) => setOrToggleParam("chapterId", chapterId)
                    : undefined
                }
                activeStatusFilter={statusFilter}
                activeChapterId={chapterFilter}
              />
            )}
            renderDragOverlay={(item) => (
              <ApplicantPipelineCard app={item} onClick={() => {}} isDragging />
            )}
            getSearchText={(item) =>
              [
                formatApplicantDisplayName(item),
                item.applicant?.name ?? "",
                item.applicant?.email ?? "",
                item.applicant?.chapter?.name ?? "",
              ]
                .join(" ")
                .toLowerCase()
            }
            searchPlaceholder="Search…"
            emptyColumnLabel="Empty"
          />
        </>
      ) : (
        <ArchiveTable applications={archivedApps as any} />
      )}
    </div>
  );
}
