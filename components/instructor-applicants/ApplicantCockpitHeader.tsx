"use client";

import type { InstructorApplicationStatus } from "@prisma/client";

interface Step {
  label: string;
  statuses: InstructorApplicationStatus[];
}

const STEPS: Step[] = [
  { label: "Submitted", statuses: ["SUBMITTED"] },
  { label: "Under Review", statuses: ["UNDER_REVIEW", "INFO_REQUESTED"] },
  { label: "Interview", statuses: ["PRE_APPROVED", "INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED"] },
  { label: "Chair Review", statuses: ["CHAIR_REVIEW"] },
  { label: "Decision", statuses: ["APPROVED", "REJECTED", "ON_HOLD", "WITHDRAWN"] },
];

function getStepIndex(status: InstructorApplicationStatus): number {
  return STEPS.findIndex((s) => s.statuses.includes(status));
}

function StatusPill({ status }: { status: InstructorApplicationStatus }) {
  const map: Partial<Record<InstructorApplicationStatus, { label: string; cls: string }>> = {
    SUBMITTED: { label: "Submitted", cls: "pill-info" },
    UNDER_REVIEW: { label: "Under Review", cls: "pill-purple" },
    INFO_REQUESTED: { label: "Info Requested", cls: "pill-attention" },
    PRE_APPROVED: { label: "Pre-Approved", cls: "pill-success" },
    INTERVIEW_SCHEDULED: { label: "Interview Scheduled", cls: "pill-interview-prep" },
    INTERVIEW_COMPLETED: { label: "Interview Completed", cls: "pill-ready-for-interview" },
    CHAIR_REVIEW: { label: "Chair Review", cls: "pill-chair-review" },
    APPROVED: { label: "Approved", cls: "pill-success" },
    REJECTED: { label: "Not Accepted", cls: "pill-declined" },
    ON_HOLD: { label: "On Hold", cls: "pill-pending" },
    WITHDRAWN: { label: "Withdrawn", cls: "pill-declined" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "" };
  return <span className={`pill cockpit-hero-status ${cls}`}>{label}</span>;
}

interface Props {
  application: {
    id: string;
    status: InstructorApplicationStatus;
    preferredFirstName: string | null;
    legalName: string | null;
    subjectsOfInterest: string | null;
    schoolName: string | null;
    graduationYear: number | null;
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
  const displayName =
    application.preferredFirstName && application.legalName
      ? `${application.preferredFirstName} (${application.legalName})`
      : application.preferredFirstName ?? application.legalName ?? application.applicant.name ?? "Applicant";

  const subjects = (application.subjectsOfInterest ?? "")
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const currentStepIndex = getStepIndex(application.status);

  return (
    <header className="applicant-cockpit-hero">
      <div className="applicant-cockpit-hero-main">
        <div className="applicant-cockpit-avatar" aria-hidden="true">
          {initials(displayName)}
        </div>
        <div className="applicant-cockpit-identity">
          <div className="applicant-cockpit-eyebrow">Instructor applicant workspace</div>
          <h1>{displayName}</h1>
          <div className="applicant-cockpit-chip-row">
            {application.applicant.chapter && (
              <span className="pill pill-purple cockpit-hero-chip">
                {application.applicant.chapter.name}
              </span>
            )}
            {subjects.map((s) => (
              <span key={s} className="pill pill-info cockpit-hero-chip">
                {s}
              </span>
            ))}
            <StatusPill status={application.status} />
          </div>
          {(application.schoolName || application.graduationYear) && (
            <p className="applicant-cockpit-school">
              {[application.schoolName, application.graduationYear && `Class of ${application.graduationYear}`]
                .filter(Boolean)
                .join(" | ")}
            </p>
          )}
        </div>
      </div>

      {/* Progress stepper */}
      <div className="applicant-cockpit-stepper" aria-label="Application progress">
        {STEPS.map((step, i) => {
          const done = i < currentStepIndex;
          const active = i === currentStepIndex;
          return (
            <div
              key={step.label}
              className={`applicant-cockpit-step${done ? " is-done" : ""}${active ? " is-active" : ""}`}
            >
              <div className="applicant-cockpit-step-track">
                <div className="applicant-cockpit-step-dot">
                  {done ? "✓" : i + 1}
                </div>
                {i < STEPS.length - 1 && <div className="applicant-cockpit-step-line" />}
              </div>
              <p>
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </header>
  );
}
