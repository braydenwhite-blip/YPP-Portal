import type { ReactNode } from "react";
import MaterialsMissingChip from "./MaterialsMissingChip";

type PipelineCardApp = {
  id: string;
  status: string;
  materialsReadyAt: Date | string | null;
  overdue?: boolean;
  stuck?: boolean;
  subjectsOfInterest: string | null;
  applicant: {
    name: string | null;
    email: string;
    chapter: { name: string } | null;
  };
  reviewer: { id: string; name: string | null } | null;
  interviewerAssignments: Array<{
    id: string;
    role: string;
    interviewer: { id: string; name: string | null };
  }>;
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
      className="applicant-card-avatar"
    >
      {initials(name, email)}
    </div>
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
  const stageClass = app.status.toLowerCase().replace(/_/g, "-");

  return (
    <div
      className={`kanban-card applicant-pipeline-card stage-${stageClass}${isDragging ? " dragging" : ""}`}
      onClick={onClick}
    >
      <div className="applicant-pipeline-card-top">
        <Avatar name={app.applicant.name} email={app.applicant.email} />
        <div>
          <div className="kanban-card-name">
            {app.applicant.name ?? app.applicant.email}
          </div>

          {app.applicant.chapter && (
            <div className="kanban-card-meta">
              <span className="kanban-card-chapter">{app.applicant.chapter.name}</span>
            </div>
          )}
        </div>
      </div>

      {subjectTags.length > 0 && (
        <div className="applicant-card-tags">
          {subjectTags.map((tag) => (
            <span
              key={tag}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="applicant-card-alerts">
        <MaterialsMissingChip materialsReadyAt={app.materialsReadyAt} />
        {app.overdue && (
          <span className="pill pill-attention pill-small" aria-label="Overdue review">Overdue</span>
        )}
        {app.stuck && (
          <span
            className="pill pill-attention pill-small"
            aria-label="Stuck - interviewer review pending over 7 days"
            title="INTERVIEW_COMPLETED for more than 7 days - use Force to Chair to unblock"
          >
            Stuck
          </span>
        )}
      </div>

      <div className="kanban-card-footer">
        <div className="applicant-card-people">
          {app.reviewer ? (
            <span title={`Reviewer: ${app.reviewer.name ?? "Unknown"}`}>
              <Avatar name={app.reviewer.name} email="" title={`Reviewer: ${app.reviewer.name ?? "Unknown"}`} />
            </span>
          ) : (
            <span className="applicant-card-unassigned">
              No reviewer
            </span>
          )}
        </div>

        {(leadInterviewer || secondInterviewer) && (
          <div className="applicant-card-people">
            {leadInterviewer && (
              <Avatar
                name={leadInterviewer.interviewer.name}
                email=""
                title={`Lead: ${leadInterviewer.interviewer.name ?? "Unknown"}`}
              />
            )}
            {secondInterviewer && (
              <Avatar
                name={secondInterviewer.interviewer.name}
                email=""
                title={`2nd: ${secondInterviewer.interviewer.name ?? "Unknown"}`}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
