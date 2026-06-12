import type { CSSProperties, ReactNode } from "react";
import type { ApplicationSource } from "@prisma/client";
import { PROGRESS_RATING_OPTIONS } from "@/lib/instructor-review-config";
import { formatScheduleDateTime } from "@/lib/scheduling/shared";
import { describeApplicationSource } from "@/lib/application-source-config";
import {
  formatApplicantDisplayName,
  isApplicantLastNameMissing,
} from "@/lib/applicant-display-name";

type PipelineCardApp = {
  id: string;
  status: string;
  materialsReadyAt: Date | string | null;
  interviewScheduledAt?: Date | string | null;
  updatedAt?: Date | string;
  overdue?: boolean;
  stuck?: boolean;
  awaitingSlots?: boolean;
  subjectsOfInterest: string | null;
  legalName?: string | null;
  preferredFirstName?: string | null;
  lastName?: string | null;
  applicant: {
    name: string | null;
    email: string;
    chapter: { name: string } | null;
  };
  reviewer: { id: string; name: string | null } | null;
  applicationReviews?: Array<{
    overallRating: string | null;
  }>;
  interviewerAssignments: Array<{
    id: string;
    role: string;
    interviewer: { id: string; name: string | null };
  }>;
  applicationTrack?: string;
  instructorSubtype?: string;
  workshopTitle?: string | null;
  workshopAgeRange?: string | null;
  workshopDurationMinutes?: number | null;
  chairDecision?: { action: string; rationale?: string | null } | null;
  /**
   * Where the application came from. Defaults to PORTAL when the parent
   * doesn't pass it (legacy callers / archive items missing the field).
   */
  source?: ApplicationSource | string | null;
};

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "New",
  UNDER_REVIEW: "Under Review",
  INFO_REQUESTED: "Info Requested",
  PRE_APPROVED: "Pre-Approved",
  // INTERVIEW_SCHEDULED is set the moment an applicant enters the interview
  // stage, before any time is offered/confirmed. The label is resolved at
  // render time (see statusLabel below) so we only claim "Interview Scheduled"
  // once an actual time exists; otherwise the pill reads "Awaiting Time".
  INTERVIEW_SCHEDULED: "Awaiting Time",
  INTERVIEW_SCHEDULED_READY: "Interview Scheduled",
  INTERVIEW_COMPLETED: "Interview Completed",
  CHAIR_REVIEW: "Chair Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  ON_HOLD: "On Hold",
  WITHDRAWN: "Withdrawn",
  WAITLISTED: "Waitlisted",
};

interface ApplicantPipelineCardProps {
  app: PipelineCardApp;
  onClick: () => void;
  isDragging?: boolean;
}

function initials(name: string | null | undefined, email: string): string {
  if (name) {
    const parts = name.trim().split(" ");
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : (parts[0][0] ?? "?").toUpperCase();
  }
  return (email[0] ?? "?").toUpperCase();
}

function Avatar({ name, email, title }: { name: string | null; email: string; title?: string }): ReactNode {
  return (
    <div
      title={title ?? (name ?? email)}
      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700"
    >
      {initials(name, email)}
    </div>
  );
}

/** Status pill tones — concrete stage states, ui-v2 badge vocabulary. */
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
  WITHDRAWN: "bg-gray-100 text-gray-600",
  WAITLISTED: "bg-violet-50 text-violet-700",
};

function MetaPill({
  children,
  tone = "neutral",
  title,
  ariaLabel,
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "attention" | "info";
  title?: string;
  ariaLabel?: string;
}): ReactNode {
  const tones: Record<string, string> = {
    neutral: "bg-surface-soft text-ink-muted border border-line-soft",
    brand: "bg-brand-50 text-brand-700 border border-brand-200",
    attention: "bg-amber-50 text-amber-800 border border-amber-200",
    info: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${tones[tone]}`}
      title={title}
      aria-label={ariaLabel}
    >
      {children}
    </span>
  );
}

export default function ApplicantPipelineCard({
  app,
  onClick,
  isDragging = false,
}: ApplicantPipelineCardProps): ReactNode {
  const subjectTags = (app.subjectsOfInterest ?? "")
    .split(/[\s,;]+/)
    .filter(Boolean)
    .slice(0, 3);

  const leadInterviewer = app.interviewerAssignments.find((a) => a.role === "LEAD");
  const secondInterviewer = app.interviewerAssignments.find((a) => a.role === "SECOND");
  const latestRating = app.applicationReviews?.find((review) => review.overallRating)
    ?.overallRating;
  const ratingOption = PROGRESS_RATING_OPTIONS.find((option) => option.value === latestRating);
  const hasInterviewTime = Boolean(app.interviewScheduledAt);
  const displayName = formatApplicantDisplayName(app);
  const missingLastName = isApplicantLastNameMissing(app);
  // Only claim the interview is scheduled when a real time exists. An app can
  // sit in INTERVIEW_SCHEDULED with no time yet (interviewScheduledAt === null)
  // while the lead interviewer is still arranging a time.
  const statusLabel =
    app.status === "INTERVIEW_SCHEDULED" && hasInterviewTime
      ? "Interview Scheduled"
      : STATUS_LABELS[app.status] ?? app.status.replace(/_/g, " ");
  const statusTone =
    app.status === "INTERVIEW_SCHEDULED" && hasInterviewTime
      ? STATUS_TONES.INTERVIEW_SCHEDULED_READY
      : STATUS_TONES[app.status] ?? "bg-surface-soft text-ink-muted";
  const hasMaterials = Boolean(app.materialsReadyAt);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full cursor-pointer rounded-[10px] border border-line-soft bg-surface p-3 text-left shadow-card transition-shadow duration-100 hover:border-brand-400 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-400${isDragging ? " opacity-70" : ""}`}
    >
      <div className="flex items-start gap-2.5">
        <Avatar name={displayName} email={app.applicant.email} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-semibold text-ink">{displayName}</div>

          <div className="mt-1 flex flex-wrap items-center gap-1">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold ${statusTone}`}
              aria-label={`Status: ${statusLabel}`}
              title={statusLabel}
            >
              {statusLabel}
            </span>
            {missingLastName && (
              <MetaPill tone="attention" title="This legacy application is missing an explicit last name.">
                Missing last name
              </MetaPill>
            )}

            {app.applicationTrack === "SUMMER_WORKSHOP_INSTRUCTOR" && (
              <MetaPill
                tone="brand"
                title="Summer Workshop Instructor applicant"
                ariaLabel="Summer Workshop Instructor applicant"
              >
                SW
              </MetaPill>
            )}

            {app.source && app.source !== "PORTAL" && (() => {
              const descriptor = describeApplicationSource(app.source as ApplicationSource);
              return (
                <MetaPill
                  tone="info"
                  title={`Source: ${descriptor.longLabel}`}
                  ariaLabel={`Application source: ${descriptor.longLabel}`}
                >
                  {descriptor.shortLabel}
                </MetaPill>
              );
            })()}

            {app.interviewScheduledAt && (
              <MetaPill title={`Interview: ${formatScheduleDateTime(app.interviewScheduledAt)}`}>
                {formatScheduleDateTime(app.interviewScheduledAt)}
              </MetaPill>
            )}

            {app.applicationTrack !== "SUMMER_WORKSHOP_INSTRUCTOR" && (
              <MetaPill
                tone={hasMaterials ? "brand" : "attention"}
                title={hasMaterials ? "Materials ready" : "Materials missing"}
              >
                {hasMaterials ? "Materials" : "Missing"}
              </MetaPill>
            )}
          </div>

          {app.applicant.chapter && (
            <div className="mt-1">
              <MetaPill tone="brand">{app.applicant.chapter.name}</MetaPill>
            </div>
          )}

          {app.status === "ON_HOLD" && app.chairDecision?.rationale && (
            <div
              className="mt-1.5 line-clamp-2 rounded-[6px] border border-amber-200 bg-amber-50 px-2 py-1 text-[12px] leading-snug text-amber-900"
              title={`Hold reason: ${app.chairDecision.rationale}`}
            >
              <strong className="font-semibold">Hold: </strong>
              {app.chairDecision.rationale}
            </div>
          )}

          {app.applicationTrack === "SUMMER_WORKSHOP_INSTRUCTOR" && app.workshopTitle && (
            <div
              className="mt-1 truncate text-[12px] text-ink-muted"
              title={`Workshop: ${app.workshopTitle}${
                app.workshopAgeRange ? ` · ${app.workshopAgeRange}` : ""
              }${
                app.workshopDurationMinutes ? ` · ${app.workshopDurationMinutes}m` : ""
              }`}
            >
              <strong className="font-semibold text-ink">Workshop:</strong>{" "}
              {app.workshopTitle}
              {app.workshopAgeRange ? ` · ${app.workshopAgeRange}` : ""}
              {app.workshopDurationMinutes ? ` · ${app.workshopDurationMinutes}m` : ""}
            </div>
          )}
        </div>
        {ratingOption && (
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
            style={{ background: ratingOption.color } as CSSProperties}
            title={`${ratingOption.label}: ${ratingOption.helperLabel}`}
          >
            {ratingOption.label[0]}
          </span>
        )}
      </div>

      {subjectTags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {subjectTags.map((tag) => (
            <span
              key={tag}
              className="rounded-[6px] bg-surface-soft px-1.5 py-0.5 text-[11px] text-ink-muted"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {(app.overdue || app.stuck || app.awaitingSlots) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {app.overdue && (
            <MetaPill tone="attention" ariaLabel="Overdue review">
              Overdue
            </MetaPill>
          )}
          {app.stuck && (
            <MetaPill
              tone="attention"
              ariaLabel="Stuck - interviewer review pending over 7 days"
              title="INTERVIEW_COMPLETED for more than 7 days - use Force to Chair to unblock"
            >
              Stuck
            </MetaPill>
          )}
          {app.awaitingSlots && (
            <MetaPill
              tone="attention"
              ariaLabel="Lead interviewer has not yet offered times"
              title="No interview times offered after 5+ days - lead interviewer needs to send slots"
            >
              Awaiting slots
            </MetaPill>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-1 border-t border-line-soft pt-2">
        <span className="inline-flex items-baseline gap-1 text-[11px] text-ink-muted">
          Reviewer
          <strong className="font-semibold text-ink">{app.reviewer?.name ?? "Not assigned"}</strong>
        </span>
        {leadInterviewer && (
          <span className="inline-flex items-baseline gap-1 text-[11px] text-ink-muted">
            · Lead
            <strong className="font-semibold text-ink">{leadInterviewer.interviewer.name ?? "Unknown"}</strong>
          </span>
        )}
        {secondInterviewer && (
          <span className="inline-flex items-baseline gap-1 text-[11px] text-ink-muted">
            · Second
            <strong className="font-semibold text-ink">{secondInterviewer.interviewer.name ?? "Unknown"}</strong>
          </span>
        )}
      </div>
    </button>
  );
}
