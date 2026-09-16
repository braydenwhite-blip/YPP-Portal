"use client";

import { useCallback, useMemo, startTransition, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ApplicantPipelineCard, {
  matchesPipelineStatusFilter,
} from "./ApplicantPipelineCard";
import ApplicantCommandFilters from "./ApplicantCommandFilters";
import { ApplicantCsvImport } from "./applicant-csv-import";
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
  showChapterFilter?: boolean;
  showKindFilter?: boolean;
  canImportCsv?: boolean;
}

type BoardColumnId = "interview" | "chair";

const BOARD_COLUMNS: Array<{
  id: BoardColumnId;
  title: string;
  statuses: string[];
  icon: "person" | "file";
}> = [
  {
    id: "interview",
    title: "Interviewing",
    statuses: ["PRE_APPROVED", "INTERVIEW_SCHEDULED", "INTERVIEW_SCHEDULED_READY"],
    icon: "person",
  },
  {
    id: "chair",
    title: "Decision needed",
    statuses: ["INTERVIEW_COMPLETED", "CHAIR_REVIEW"],
    icon: "file",
  },
];

function getDerivedStatus(app: PipelineApp): string {
  if (app.status === "INTERVIEW_SCHEDULED") {
    return app.interviewScheduledAt ? "INTERVIEW_SCHEDULED_READY" : app.status;
  }
  return app.status;
}

function columnIdForStatus(status: string): BoardColumnId | null {
  for (const column of BOARD_COLUMNS) {
    if (column.statuses.includes(status)) return column.id;
  }
  return null;
}

function ColumnIcon({ type }: { type: "person" | "file" }) {
  if (type === "person") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" />
        <path
          d="M5 19c1.6-3.2 4-4.8 7-4.8s5.4 1.6 7 4.8"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export default function InstructorApplicantsCommandCenter({
  pipelineApps,
  chapters = [],
  showChapterFilter = false,
  showKindFilter = false,
  canImportCsv = false,
}: InstructorApplicantsCommandCenterProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [, startFilterTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");

  const statusFilter = searchParams.get("status") ?? "";
  const chapterFilter = searchParams.get("chapterId") ?? "";
  const kindFilter = (searchParams.get("kind") ?? "").toLowerCase();

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

  const filteredApps = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return pipelineApps.filter((app): app is PipelineApp => {
      if (!app?.id || !app.status) return false;
      if (kindFilter === "cp" && app.kind !== "cp") return false;
      if (kindFilter === "staff" && app.kind !== "staff") return false;
      if (
        (kindFilter === "instructor" || kindFilter === "instructors") &&
        app.kind !== "instructor" &&
        app.kind != null
      ) {
        return false;
      }
      if (chapterFilter && app.applicant?.chapter?.id !== chapterFilter) return false;
      if (!matchesPipelineStatusFilter(app, statusFilter)) return false;
      if (!q) return true;
      const haystack = [
        formatApplicantDisplayName(app),
        app.applicant?.name ?? "",
        app.applicant?.email ?? "",
        app.applicant?.chapter?.name ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [pipelineApps, statusFilter, kindFilter, chapterFilter, searchQuery]);

  const appsByColumn = useMemo(() => {
    const buckets: Record<BoardColumnId, PipelineApp[]> = {
      interview: [],
      chair: [],
    };
    for (const app of filteredApps) {
      const columnId = columnIdForStatus(getDerivedStatus(app));
      if (columnId) buckets[columnId].push(app);
    }
    return buckets;
  }, [filteredApps]);

  return (
    <div>
      {canImportCsv ? (
        <div className="mb-3 flex justify-end">
          <ApplicantCsvImport enabled={canImportCsv} />
        </div>
      ) : null}

      <ApplicantCommandFilters
        isAdmin={showChapterFilter}
        chapters={chapters}
        showKindFilter={showKindFilter}
        resultCount={filteredApps.length}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {BOARD_COLUMNS.map((column) => {
          const items = appsByColumn[column.id];
          return (
            <section
              key={column.id}
              className="rounded-[16px] border border-line-soft bg-[#f4f2f7] p-3.5 sm:p-4"
            >
              <header className="mb-3.5 flex items-center gap-3 px-0.5">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                  <ColumnIcon type={column.icon} />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[15px] font-bold tracking-[-0.01em] text-ink">
                    {column.title}
                  </h2>
                  <p className="text-[12.5px] text-ink-muted">
                    {items.length} applicant{items.length === 1 ? "" : "s"}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2",
                    "bg-white text-[12px] font-semibold text-ink-muted shadow-sm"
                  )}
                >
                  {items.length}
                </span>
              </header>

              <div className="flex flex-col gap-2.5">
                {items.length === 0 ? (
                  <div className="rounded-[12px] border border-dashed border-line bg-white/70 px-4 py-8 text-center text-[13px] text-ink-muted">
                    No applicants here
                  </div>
                ) : (
                  items.map((app) => (
                    <ApplicantPipelineCard
                      key={app.id}
                      app={app}
                      onClick={() => openApplicantRecord(app)}
                      onFilterStatus={(stage) => setOrToggleParam("status", stage)}
                      onFilterChapter={
                        showChapterFilter
                          ? (chapterId) => setOrToggleParam("chapterId", chapterId)
                          : undefined
                      }
                      activeStatusFilter={statusFilter}
                      activeChapterId={chapterFilter}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
