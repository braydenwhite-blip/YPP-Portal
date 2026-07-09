import type { ReactNode } from "react";
import { formatApplicantDisplayName } from "@/lib/applicant-display-name";

type PipelineCardApp = {
  id: string;
  status: string;
  interviewScheduledAt?: Date | string | null;
  legalName?: string | null;
  preferredFirstName?: string | null;
  lastName?: string | null;
  applicant: {
    name: string | null;
    email: string;
    chapter: { name: string } | null;
  };
};

const STATUS_LABELS: Record<string, string> = {
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

interface ApplicantPipelineCardProps {
  app: PipelineCardApp;
  onClick: () => void;
  isDragging?: boolean;
}

export default function ApplicantPipelineCard({
  app,
  onClick,
  isDragging = false,
}: ApplicantPipelineCardProps): ReactNode {
  const displayName = formatApplicantDisplayName(app);
  const hasInterviewTime = Boolean(app.interviewScheduledAt);
  const statusLabel =
    app.status === "INTERVIEW_SCHEDULED" && hasInterviewTime
      ? "Interview Scheduled"
      : STATUS_LABELS[app.status] ?? app.status.replace(/_/g, " ");
  const statusTone =
    app.status === "INTERVIEW_SCHEDULED" && hasInterviewTime
      ? STATUS_TONES.INTERVIEW_SCHEDULED_READY
      : STATUS_TONES[app.status] ?? "bg-surface-soft text-ink-muted";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full cursor-pointer rounded-[10px] border border-line-soft bg-surface p-2.5 text-left shadow-card transition-shadow duration-100 hover:border-brand-400 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-400${isDragging ? " opacity-70" : ""}`}
    >
      <div className="truncate text-[13px] font-semibold text-ink">{displayName}</div>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold ${statusTone}`}
        >
          {statusLabel}
        </span>
        {app.applicant.chapter ? (
          <span className="inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10.5px] font-semibold text-brand-700">
            {app.applicant.chapter.name}
          </span>
        ) : null}
      </div>
    </button>
  );
}
