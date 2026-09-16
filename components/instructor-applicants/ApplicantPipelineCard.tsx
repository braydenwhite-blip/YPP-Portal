"use client";

import type { ReactNode, MouseEvent } from "react";
import { formatApplicantDisplayName } from "@/lib/applicant-display-name";
import { cn } from "@/components/ui-v2";

export type PipelineCardApp = {
  id: string;
  status: string;
  interviewScheduledAt?: Date | string | null;
  legalName?: string | null;
  preferredFirstName?: string | null;
  lastName?: string | null;
  kind?: "instructor" | "cp" | "staff";
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
  PRE_APPROVED: "Ready to schedule",
  INTERVIEW_SCHEDULED: "Needs scheduling",
  INTERVIEW_SCHEDULED_READY: "Scheduled",
  INTERVIEW_COMPLETED: "Interview done",
  CHAIR_REVIEW: "Needs hire decision",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  ON_HOLD: "On Hold",
  WAITLISTED: "Waitlisted",
};

export const PIPELINE_STAGE_FILTERS = [
  { value: "", label: "All stages" },
  { value: "interview", label: "Interviewing" },
  { value: "chair", label: "Decision needed" },
  { value: "decided", label: "Closed" },
] as const;

export const PIPELINE_STAGE_LABELS: Record<string, string> = Object.fromEntries(
  PIPELINE_STAGE_FILTERS.filter((o) => o.value).map((o) => [o.value, o.label])
);

const STAGE_STATUSES: Record<string, string[]> = {
  interview: ["PRE_APPROVED", "INTERVIEW_SCHEDULED", "INTERVIEW_SCHEDULED_READY"],
  chair: ["INTERVIEW_COMPLETED", "CHAIR_REVIEW"],
  decided: ["APPROVED", "REJECTED"],
};

/** @deprecated Prefer PIPELINE_STAGE_FILTERS */
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
  if (!filter || filter === "waitlisted") return true;
  const stageStatuses = STAGE_STATUSES[filter];
  if (stageStatuses) {
    const derived = cardStatusFilterValue(app);
    return stageStatuses.includes(derived) || stageStatuses.includes(app.status);
  }
  return cardStatusFilterValue(app) === filter;
}

function roleLabel(kind: PipelineCardApp["kind"]): string | null {
  if (kind === "cp") return "CP";
  if (kind === "staff") return "TM";
  if (kind === "instructor") return "Instructor";
  return null;
}

const AVATAR_TONES = [
  "bg-brand-100 text-brand-800",
  "bg-sky-100 text-sky-800",
  "bg-orange-100 text-orange-800",
  "bg-rose-100 text-rose-800",
  "bg-emerald-100 text-emerald-800",
  "bg-violet-100 text-violet-800",
  "bg-amber-100 text-amber-900",
] as const;

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function avatarTone(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

function formatInterviewWhen(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((startTarget.getTime() - startToday.getTime()) / 86400000);
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  if (dayDiff === 0) return `Today, ${time}`;
  if (dayDiff === 1) return `Tomorrow, ${time}`;
  if (dayDiff === -1) return `Yesterday, ${time}`;
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
}

type StatusVisual = {
  label: string;
  className: string;
  icon: "calendar" | "clock" | "file";
};

function statusVisual(status: string): StatusVisual {
  if (status === "PRE_APPROVED") {
    return {
      label: "Ready to schedule",
      className: "bg-emerald-50 text-emerald-800",
      icon: "calendar",
    };
  }
  if (status === "INTERVIEW_SCHEDULED") {
    return {
      label: "Needs scheduling",
      className: "bg-orange-50 text-orange-800",
      icon: "clock",
    };
  }
  if (status === "INTERVIEW_SCHEDULED_READY") {
    return {
      label: "Scheduled",
      className: "bg-sky-50 text-sky-800",
      icon: "calendar",
    };
  }
  if (status === "INTERVIEW_COMPLETED" || status === "CHAIR_REVIEW") {
    return {
      label: "Needs hire decision",
      className: "bg-rose-50 text-rose-800",
      icon: "file",
    };
  }
  if (status === "APPROVED") {
    return { label: "Approved", className: "bg-emerald-50 text-emerald-800", icon: "calendar" };
  }
  if (status === "REJECTED") {
    return { label: "Rejected", className: "bg-rose-50 text-rose-800", icon: "file" };
  }
  return {
    label: PIPELINE_STATUS_LABELS[status] ?? status.replace(/_/g, " "),
    className: "bg-surface-soft text-ink-muted",
    icon: "file",
  };
}

function StatusIcon({ type }: { type: StatusVisual["icon"] }) {
  if (type === "clock") {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "calendar") {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

interface ApplicantPipelineCardProps {
  app: PipelineCardApp;
  onClick: () => void;
  isDragging?: boolean;
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
  if (!app) return null;
  const displayName = formatApplicantDisplayName(app);
  const statusFilterValue = cardStatusFilterValue(app);
  const stageValue = stageForStatus(app);
  const visual = statusVisual(statusFilterValue);
  const chapter = app.applicant?.chapter ?? null;
  const locationLabel = app.kind === "staff" ? "location" : "chapter";
  const statusActive =
    activeStatusFilter === stageValue || activeStatusFilter === statusFilterValue;
  const chapterActive = Boolean(chapter?.id && activeChapterId === chapter.id);
  const kindLabel = roleLabel(app.kind);
  const when =
    statusFilterValue === "INTERVIEW_SCHEDULED_READY"
      ? formatInterviewWhen(app.interviewScheduledAt)
      : null;

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
      className={cn(
        "group flex w-full items-center gap-3 rounded-[12px] border border-line-soft bg-white px-3 py-2.5 text-left shadow-sm",
        "transition-[border-color,box-shadow] duration-150",
        "hover:border-brand-200 hover:shadow-md",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-400",
        isDragging && "opacity-70"
      )}
    >
      <span
        className={cn(
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
          avatarTone(displayName)
        )}
        aria-hidden
      >
        {initialsFor(displayName)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold tracking-[-0.01em] text-ink">
          {displayName}
        </div>
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-[12px] text-ink-muted">
          {kindLabel ? <span>{kindLabel}</span> : null}
          {kindLabel && chapter?.name ? (
            <span aria-hidden className="text-ink-muted/40">
              ·
            </span>
          ) : null}
          {chapter?.name ? (
            onFilterChapter && chapter.id ? (
              <span
                role="button"
                tabIndex={0}
                title={
                  chapterActive ? `Clear ${locationLabel} filter` : `Filter: ${chapter.name}`
                }
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
                  "truncate rounded px-0.5 hover:text-brand-800",
                  chapterActive && "font-semibold text-brand-800"
                )}
              >
                {chapter.name}
              </span>
            ) : (
              <span className="truncate">{chapter.name}</span>
            )
          ) : app.kind === "staff" ? (
            <span className="italic">No location</span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        {onFilterStatus ? (
          <span
            role="button"
            tabIndex={0}
            title={statusActive ? "Clear status filter" : `Filter: ${visual.label}`}
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
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold",
              visual.className,
              statusActive && "ring-2 ring-brand-400 ring-offset-1"
            )}
          >
            <StatusIcon type={visual.icon} />
            {visual.label}
          </span>
        ) : (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold",
              visual.className
            )}
          >
            <StatusIcon type={visual.icon} />
            {visual.label}
          </span>
        )}
        {when ? <span className="text-[11px] font-medium text-ink-muted">{when}</span> : null}
      </div>

      <span
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-muted opacity-60 group-hover:bg-surface-soft group-hover:opacity-100"
        aria-hidden
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.7" />
          <circle cx="12" cy="12" r="1.7" />
          <circle cx="12" cy="19" r="1.7" />
        </svg>
      </span>
    </button>
  );
}
