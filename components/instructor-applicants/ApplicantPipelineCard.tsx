"use client";

import type { ReactNode, MouseEvent } from "react";
import { formatApplicantDisplayName } from "@/lib/applicant-display-name";
import { cn } from "@/components/ui-v2";

type PipelineCardApp = {
  id: string;
  status: string;
  interviewScheduledAt?: Date | string | null;
  legalName?: string | null;
  preferredFirstName?: string | null;
  lastName?: string | null;
  /** When set, card shows Instructor vs CP. */
  kind?: "instructor" | "cp";
  applicant: {
    name: string | null;
    email: string;
    chapter: { id?: string; name: string } | null;
  };
};

export const PIPELINE_STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "New",
  UNDER_REVIEW: "Under Review",
  INFO_REQUESTED: "Info Requested",
  PRE_APPROVED: "Pre-Approved",
  INTERVIEW_SCHEDULED: "Awaiting Time",
  INTERVIEW_SCHEDULED_READY: "Interview Scheduled",
  INTERVIEW_COMPLETED: "Interview Done",
  CHAIR_REVIEW: "Chair Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  ON_HOLD: "On Hold",
  WAITLISTED: "Waitlisted",
};

const STATUS_TONES: Record<string, string> = {
  SUBMITTED: "bg-brand-50 text-brand-700",
  UNDER_REVIEW: "bg-blue-50 text-blue-700",
  INFO_REQUESTED: "bg-amber-50 text-amber-700",
  PRE_APPROVED: "bg-emerald-50 text-emerald-700",
  INTERVIEW_SCHEDULED: "bg-amber-50 text-amber-700",
  INTERVIEW_SCHEDULED_READY: "bg-emerald-50 text-emerald-700",
  INTERVIEW_COMPLETED: "bg-indigo-50 text-indigo-700",
  CHAIR_REVIEW: "bg-amber-50 text-amber-800",
  APPROVED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-rose-50 text-rose-700",
  ON_HOLD: "bg-amber-50 text-amber-800",
  WAITLISTED: "bg-violet-50 text-violet-700",
};

/** Board-column stages for the simple status filter. */
export const PIPELINE_STAGE_FILTERS = [
  { value: "", label: "All Stages" },
  { value: "new", label: "New" },
  { value: "review", label: "Review" },
  { value: "interview", label: "Interview" },
  { value: "chair", label: "Chair" },
  { value: "on_hold", label: "On Hold" },
  { value: "waitlisted", label: "Waitlisted" },
] as const;

export const PIPELINE_STAGE_LABELS: Record<string, string> = Object.fromEntries(
  PIPELINE_STAGE_FILTERS.filter((o) => o.value).map((o) => [o.value, o.label])
);

const STAGE_STATUSES: Record<string, string[]> = {
  new: ["SUBMITTED"],
  review: ["UNDER_REVIEW", "INFO_REQUESTED"],
  interview: ["PRE_APPROVED", "INTERVIEW_SCHEDULED", "INTERVIEW_SCHEDULED_READY"],
  chair: ["INTERVIEW_COMPLETED", "CHAIR_REVIEW"],
  on_hold: ["ON_HOLD"],
  waitlisted: ["WAITLISTED"],
};

/** @deprecated Prefer PIPELINE_STAGE_FILTERS — kept for any leftover imports. */
export const PIPELINE_STATUS_FILTERS = PIPELINE_STAGE_FILTERS;

export function cardStatusFilterValue(app: {
  status: string;
  interviewScheduledAt?: Date | string | null;
}): string {
  if (app.status === "INTERVIEW_SCHEDULED") {
    return app.interviewScheduledAt ? "INTERVIEW_SCHEDULED_READY" : "INTERVIEW_SCHEDULED";
  }
  return app.status;
}

export function stageForStatus(app: {
  status: string;
  interviewScheduledAt?: Date | string | null;
}): string {
  const derived = cardStatusFilterValue(app);
  for (const [stage, statuses] of Object.entries(STAGE_STATUSES)) {
    if (statuses.includes(derived) || statuses.includes(app.status)) return stage;
  }
  return "";
}

export function matchesPipelineStatusFilter(
  app: { status: string; interviewScheduledAt?: Date | string | null },
  filter: string
): boolean {
  if (!filter) return true;
  const stageStatuses = STAGE_STATUSES[filter];
  if (stageStatuses) {
    const derived = cardStatusFilterValue(app);
    return stageStatuses.includes(derived) || stageStatuses.includes(app.status);
  }
  // Legacy fine-grained status params (e.g. from older links) still work.
  return cardStatusFilterValue(app) === filter;
}

interface ApplicantPipelineCardProps {
  app: PipelineCardApp;
  onClick: () => void;
  isDragging?: boolean;
  /** When set, status / chapter tags become filter toggles. */
  onFilterStatus?: (status: string) => void;
  onFilterChapter?: (chapterId: string) => void;
  activeStatusFilter?: string;
  activeChapterId?: string;
}

export default function ApplicantPipelineCard({
  app,
  onClick,
  isDragging = false,
  onFilterStatus,
  onFilterChapter,
  activeStatusFilter = "",
  activeChapterId = "",
}: ApplicantPipelineCardProps): ReactNode {
  const displayName = formatApplicantDisplayName(app);
  const statusFilterValue = cardStatusFilterValue(app);
  const stageValue = stageForStatus(app);
  const statusLabel =
    PIPELINE_STATUS_LABELS[statusFilterValue] ??
    PIPELINE_STATUS_LABELS[app.status] ??
    app.status.replace(/_/g, " ");
  const statusTone =
    STATUS_TONES[statusFilterValue] ??
    STATUS_TONES[app.status] ??
    "bg-surface-soft text-ink-muted";
  const chapter = app.applicant.chapter;
  const statusActive =
    activeStatusFilter === stageValue || activeStatusFilter === statusFilterValue;
  const chapterActive = Boolean(chapter?.id && activeChapterId === chapter.id);

  function stopAnd(filter: () => void) {
    return (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      filter();
    };
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full cursor-pointer rounded-[10px] border border-line-soft bg-surface p-2.5 text-left shadow-card transition-shadow duration-100 hover:border-brand-400 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-400${isDragging ? " opacity-70" : ""}`}
    >
      <div className="truncate text-[13px] font-semibold text-ink">{displayName}</div>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        {app.kind ? (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold",
              app.kind === "cp"
                ? "bg-violet-50 text-violet-800"
                : "bg-surface-soft text-ink-muted"
            )}
          >
            {app.kind === "cp" ? "CP" : "Instructor"}
          </span>
        ) : null}
        {onFilterStatus ? (
          <span
            role="button"
            tabIndex={0}
            title={statusActive ? "Clear status filter" : `Filter: ${statusLabel}`}
            aria-pressed={statusActive}
            onClick={stopAnd(() => onFilterStatus(stageValue))}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                onFilterStatus(stageValue);
              }
            }}
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold ring-offset-1 hover:ring-2 hover:ring-brand-300",
              statusTone,
              statusActive && "ring-2 ring-brand-500"
            )}
          >
            {statusLabel}
          </span>
        ) : (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold ${statusTone}`}
          >
            {statusLabel}
          </span>
        )}
        {chapter ? (
          onFilterChapter && chapter.id ? (
            <span
              role="button"
              tabIndex={0}
              title={chapterActive ? "Clear chapter filter" : `Filter: ${chapter.name}`}
              aria-pressed={chapterActive}
              onClick={stopAnd(() => onFilterChapter(chapter.id!))}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  onFilterChapter(chapter.id!);
                }
              }}
              className={cn(
                "inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10.5px] font-semibold text-brand-700 ring-offset-1 hover:ring-2 hover:ring-brand-300",
                chapterActive && "ring-2 ring-brand-500"
              )}
            >
              {chapter.name}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10.5px] font-semibold text-brand-700">
              {chapter.name}
            </span>
          )
        ) : null}
      </div>
    </button>
  );
}
