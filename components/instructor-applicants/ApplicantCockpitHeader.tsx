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
  return <span className={`pill ${cls}`} style={{ fontSize: 13 }}>{label}</span>;
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
    <div
      className="card"
      style={{ marginBottom: 24, padding: "20px 24px" }}
    >
      {/* Name + status row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{displayName}</h1>
          <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
            {application.applicant.chapter && (
              <span className="pill pill-purple" style={{ fontSize: 12 }}>
                {application.applicant.chapter.name}
              </span>
            )}
            {subjects.map((s) => (
              <span key={s} className="pill pill-info" style={{ fontSize: 12 }}>
                {s}
              </span>
            ))}
            <StatusPill status={application.status} />
          </div>
          {(application.schoolName || application.graduationYear) && (
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)" }}>
              {[application.schoolName, application.graduationYear && `Class of ${application.graduationYear}`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
      </div>

      {/* Progress stepper */}
      <div style={{ marginTop: 20, display: "flex", gap: 0 }}>
        {STEPS.map((step, i) => {
          const done = i < currentStepIndex;
          const active = i === currentStepIndex;
          return (
            <div key={step.label} style={{ flex: 1, position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: done || active ? "#6b21c8" : "#e5e7eb",
                    border: active ? "3px solid #a855f7" : "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    color: done || active ? "#fff" : "#9ca3af",
                    fontSize: 12,
                    fontWeight: 700,
                    zIndex: 1,
                    position: "relative",
                  }}
                >
                  {done ? "✓" : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    style={{
                      flex: 1,
                      height: 2,
                      background: done ? "#6b21c8" : "#e5e7eb",
                    }}
                  />
                )}
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 11, color: active ? "#6b21c8" : "var(--muted)", fontWeight: active ? 700 : 400 }}>
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
