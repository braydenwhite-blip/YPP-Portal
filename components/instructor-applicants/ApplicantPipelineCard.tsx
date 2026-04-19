import type { ReactNode } from "react";
import MaterialsMissingChip from "./MaterialsMissingChip";

type PipelineCardApp = {
  id: string;
  status: string;
  materialsReadyAt: Date | string | null;
  overdue?: boolean;
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
  return email[0].toUpperCase();
}

function Avatar({ name, email, title }: { name: string | null; email: string; title?: string }): ReactNode {
  return (
    <div
      title={title ?? (name ?? email)}
      style={{
        width: 22,
        height: 22,
        borderRadius: "50%",
        background: "#e0e7ff",
        color: "#4338ca",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: 9,
        flexShrink: 0,
      }}
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

  return (
    <div
      className={`kanban-card${isDragging ? " dragging" : ""}`}
      onClick={onClick}
    >
      <div className="kanban-card-name">
        {app.applicant.name ?? app.applicant.email}
      </div>

      {app.applicant.chapter && (
        <div className="kanban-card-meta">
          <span className="kanban-card-chapter">{app.applicant.chapter.name}</span>
        </div>
      )}

      {subjectTags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
          {subjectTags.map((tag) => (
            <span
              key={tag}
              style={{
                background: "#f3e8ff",
                color: "#6b21c8",
                borderRadius: 4,
                padding: "1px 6px",
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
        <MaterialsMissingChip materialsReadyAt={app.materialsReadyAt} />
        {app.overdue && (
          <span className="pill pill-attention pill-small">Overdue</span>
        )}
      </div>

      <div className="kanban-card-footer">
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {app.reviewer ? (
            <span title={`Reviewer: ${app.reviewer.name ?? "Unknown"}`}>
              <Avatar name={app.reviewer.name} email="" title={`Reviewer: ${app.reviewer.name ?? "Unknown"}`} />
            </span>
          ) : (
            <span
              style={{
                fontSize: 10,
                fontStyle: "italic",
                color: "#d97706",
              }}
            >
              No reviewer
            </span>
          )}
        </div>

        {(leadInterviewer || secondInterviewer) && (
          <div style={{ display: "flex", gap: 3 }}>
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
