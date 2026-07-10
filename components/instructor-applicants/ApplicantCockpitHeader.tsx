"use client";

import type { ApplicationSource, InstructorApplicationStatus } from "@prisma/client";
import ApplicationSourceBadge from "@/components/external-intake/ApplicationSourceBadge";
import { formatApplicantDisplayName } from "@/lib/applicant-display-name";

interface Step {
  label: string;
  statuses: InstructorApplicationStatus[];
}

const STEPS: Step[] = [
  { label: "Submitted", statuses: ["SUBMITTED"] },
  { label: "Under Review", statuses: ["UNDER_REVIEW", "INFO_REQUESTED"] },
  { label: "Interview", statuses: ["PRE_APPROVED", "INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED"] },
  { label: "Chair Review", statuses: ["CHAIR_REVIEW"] },
  { label: "Decision", statuses: ["APPROVED", "REJECTED", "ON_HOLD", "WITHDRAWN", "WAITLISTED"] },
];

function getStepIndex(status: InstructorApplicationStatus): number {
  return STEPS.findIndex((s) => s.statuses.includes(status));
}

function StatusPill({ status }: { status: InstructorApplicationStatus }) {
  const map: Partial<Record<InstructorApplicationStatus, { label: string; cls: string }>> = {
    SUBMITTED: { label: "Submitted", cls: "bg-blue-50 text-blue-700" },
    UNDER_REVIEW: { label: "Under Review", cls: "bg-brand-50 text-brand-700" },
    INFO_REQUESTED: { label: "Info Requested", cls: "bg-amber-50 text-amber-800" },
    PRE_APPROVED: { label: "Pre-Approved", cls: "bg-emerald-50 text-emerald-700" },
    INTERVIEW_SCHEDULED: { label: "Interview Scheduled", cls: "bg-amber-50 text-amber-800" },
    INTERVIEW_COMPLETED: { label: "Interview Completed", cls: "bg-emerald-50 text-emerald-700" },
    CHAIR_REVIEW: { label: "Chair Review", cls: "bg-amber-50 text-amber-800" },
    APPROVED: { label: "Approved", cls: "bg-emerald-50 text-emerald-700" },
    REJECTED: { label: "Not Accepted", cls: "bg-rose-50 text-rose-700" },
    ON_HOLD: { label: "On Hold", cls: "bg-gray-100 text-gray-700" },
    WITHDRAWN: { label: "Withdrawn", cls: "bg-rose-50 text-rose-700" },
    WAITLISTED: { label: "Waitlisted", cls: "bg-violet-50 text-violet-700" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-700" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] font-bold ${cls}`}>
      {label}
    </span>
  );
}

interface Props {
  application: {
    id: string;
    status: InstructorApplicationStatus;
    preferredFirstName: string | null;
    lastName: string | null;
    legalName: string | null;
    subjectsOfInterest: string | null;
    schoolName: string | null;
    graduationYear: number | null;
    interviewRound: number;
    applicationTrack?: string | null;
    isReapplication?: boolean;
    previousApplicationId?: string | null;
    source?: ApplicationSource | null;
    reviewer: { id: string; name: string | null } | null;
    interviewerAssignments: Array<{
      id: string;
      role: string;
      round: number;
      interviewer: { id: string; name: string | null; email: string };
    }>;
    applicant: {
      name: string | null;
      chapter: { name: string } | null;
    };
  };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return (parts[0]?.[0] ?? "A").toUpperCase();
}

export default function ApplicantCockpitHeader({ application }: Props) {
  const displayName = formatApplicantDisplayName(application);

  const subjects = (application.subjectsOfInterest ?? "")
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const currentStepIndex = getStepIndex(application.status);
  const currentAssignments = application.interviewerAssignments.filter(
    (assignment) => assignment.round === application.interviewRound
  );
  const leadInterviewer = currentAssignments.find((assignment) => assignment.role === "LEAD");
  const secondInterviewer = currentAssignments.find((assignment) => assignment.role === "SECOND");

  return (
    <header className="rounded-[12px] border border-line-soft bg-surface p-[22px] shadow-card">
      <div className="flex flex-wrap items-start gap-4">
        <div
          className="flex size-[60px] shrink-0 items-center justify-center rounded-full bg-brand-100 text-[20px] font-bold text-brand-700"
          aria-hidden="true"
        >
          {initials(displayName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-[0.11em] text-brand-700">
            Application workspace
          </div>
          <h1 className="m-0 mt-0.5 text-[24px] font-bold leading-tight text-ink">
            {displayName}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {application.applicant.chapter && (
              <span className="inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                {application.applicant.chapter.name}
              </span>
            )}
            {application.applicationTrack === "SUMMER_WORKSHOP_INSTRUCTOR" && (
              <span
                className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800"
                title="This applicant is on the Summer Workshop Instructor track"
              >
                Summer Workshop
              </span>
            )}
            {subjects.map((s) => (
              <span
                key={s}
                className="inline-flex items-center rounded-full border border-line-soft bg-surface-soft px-2 py-0.5 text-[11px] font-medium text-ink-muted"
              >
                {s}
              </span>
            ))}
            {application.isReapplication && (
              <span
                className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800"
                title="This applicant submitted a previous application"
              >
                Re-application
              </span>
            )}
            {application.source && (
              <ApplicationSourceBadge source={application.source} />
            )}
            <StatusPill status={application.status} />
          </div>
          {(application.schoolName || application.graduationYear) && (
            <p className="m-0 mt-1.5 text-[13px] text-ink-muted">
              {[application.schoolName, application.graduationYear && `Class of ${application.graduationYear}`]
                .filter(Boolean)
                .join(" | ")}
            </p>
          )}
          <div className="mt-2.5 flex flex-wrap gap-2" aria-label="Application owners">
            {[
              { label: "Reviewer", name: application.reviewer?.name },
              { label: "Lead Interviewer", name: leadInterviewer?.interviewer.name },
              { label: "Second Interviewer", name: secondInterviewer?.interviewer.name },
            ].map((owner) => (
              <span
                key={owner.label}
                className="inline-grid min-w-36 gap-0.5 rounded-[8px] border border-line-soft bg-surface-soft px-2.5 py-1.5"
              >
                <span className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-ink-muted">
                  {owner.label}
                </span>
                <strong className="text-[12.5px] font-semibold text-ink">
                  {owner.name ?? "Not assigned"}
                </strong>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Progress stepper */}
      <div
        className="mt-4 grid grid-cols-5 gap-1 border-t border-line-soft pt-4 max-md:grid-cols-1"
        aria-label="Application progress"
      >
        {STEPS.map((step, i) => {
          const done = i < currentStepIndex;
          const active = i === currentStepIndex;
          return (
            <div key={step.label} className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <div
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
                    done
                      ? "bg-brand-600 text-white"
                      : active
                        ? "bg-brand-100 text-brand-700 outline-2 outline-brand-400"
                        : "bg-surface-soft text-ink-muted"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 rounded-full max-md:hidden ${done ? "bg-brand-400" : "bg-line-soft"}`}
                  />
                )}
              </div>
              <p
                className={`m-0 text-[11.5px] ${
                  active ? "font-bold text-ink" : done ? "font-medium text-ink" : "text-ink-muted"
                }`}
              >
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </header>
  );
}
