"use client";

import Link from "next/link";
import KanbanBoard, { type KanbanColumnDef } from "@/components/kanban/kanban-board";
import type { InstructorOpsRecord } from "@/lib/instructor-ops";

const COLUMNS: KanbanColumnDef[] = [
  { id: "applicants", title: "Applicants", statuses: ["APPLICANTS"], color: "#6b21c8" },
  { id: "interview", title: "Interview", statuses: ["INTERVIEW"], color: "#0f766e" },
  { id: "review", title: "Review", statuses: ["REVIEW"], color: "#2563eb" },
  { id: "onboarding", title: "Onboarding", statuses: ["ONBOARDING"], color: "#b45309" },
  { id: "ready", title: "Ready", statuses: ["READY"], color: "#059669" },
  { id: "active", title: "Active", statuses: ["ACTIVE"], color: "#4338ca" },
  { id: "leadership", title: "Leadership", statuses: ["LEADERSHIP"], color: "#7c3aed" },
  { id: "paused", title: "Paused", statuses: ["PAUSED"], color: "#71717a" },
  { id: "needs_attention", title: "Needs Attention", statuses: ["NEEDS_ATTENTION"], color: "#dc2626" },
];

function initials(name: string, email: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return (parts[0]?.[0] ?? email[0] ?? "?").toUpperCase();
}

function primaryAction(record: InstructorOpsRecord) {
  if (record.application && ["APPLICANTS", "INTERVIEW", "REVIEW"].includes(record.stage)) {
    return {
      href: `/admin/instructor-applicants/${record.application.id}`,
      label: "Open application",
    };
  }
  if (record.stage === "ONBOARDING") {
    return { href: "/admin/instructor-readiness", label: "Readiness" };
  }
  if (record.stage === "LEADERSHIP") {
    return { href: "/admin/mentorship-program", label: "Mentorship" };
  }
  if (record.stage === "NEEDS_ATTENTION") {
    return { href: "/admin/instructors/attention", label: "Review flag" };
  }
  return { href: "/admin/classes", label: "Assignments" };
}

function InstructorCard({
  record,
  onClick,
  isDragging = false,
}: {
  record: InstructorOpsRecord;
  onClick: () => void;
  isDragging?: boolean;
}) {
  const action = primaryAction(record);

  return (
    <div
      role="button"
      tabIndex={0}
      className={`kanban-card instructor-ops-card${isDragging ? " dragging" : ""}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <div className="instructor-ops-card-header">
        <div className="instructor-ops-avatar" aria-hidden="true">
          {record.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- small admin avatar, not page-critical.
            <img src={record.avatarUrl} alt="" />
          ) : (
            initials(record.name, record.email)
          )}
        </div>
        <div className="instructor-ops-card-title">
          <div className="kanban-card-name">{record.name}</div>
          <div className="kanban-card-meta">
            <span>{record.chapterName}</span>
            <span>{record.currentLoadLabel}</span>
          </div>
        </div>
      </div>

      <div className="instructor-ops-card-badges">
        <span className={`pill pill-small ${record.needsAttention ? "pill-attention" : "pill-purple"}`}>
          {record.stageLabel}
        </span>
        <span className="pill pill-small">
          {record.activeAssignmentCount} active
        </span>
        {record.leadershipTrack && (
          <span className="pill pill-small pill-info">Leadership</span>
        )}
      </div>

      {record.tags.length > 0 && (
        <div className="instructor-ops-tag-row">
          {record.tags.slice(0, 4).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      )}

      {record.attentionFlags.length > 0 && (
        <div className="instructor-ops-warning-stack">
          {record.attentionFlags.slice(0, 2).map((flag) => (
            <span key={`${record.id}-${flag.kind}`} className={`instructor-ops-warning is-${flag.tone}`}>
              {flag.title}
            </span>
          ))}
        </div>
      )}

      <div className="instructor-ops-card-actions">
        <Link
          href={record.profileHref}
          onClick={(event) => event.stopPropagation()}
          className="button small outline"
        >
          Profile
        </Link>
        <Link
          href={action.href}
          onClick={(event) => event.stopPropagation()}
          className="button small"
        >
          {action.label}
        </Link>
      </div>
    </div>
  );
}

function InstructorDetailPanel({
  record,
  onClose,
}: {
  record: InstructorOpsRecord;
  onClose: () => void;
}) {
  const action = primaryAction(record);
  return (
    <>
      <button className="slideout-backdrop" onClick={onClose} aria-label="Close instructor preview" />
      <aside className="slideout-panel" aria-label={`${record.name} operations preview`}>
        <div className="slideout-header">
          <div>
            <p className="badge">{record.stageLabel}</p>
            <h2 style={{ margin: "8px 0 2px" }}>{record.name}</h2>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
              {record.email} | {record.chapterName}
            </p>
          </div>
          <button type="button" className="slideout-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="slideout-body">
          <div className="slideout-section">
            <div className="slideout-section-title">Pipeline</div>
            <p style={{ margin: 0 }}>{record.stageDetail}</p>
            <div className="instructor-ops-card-badges" style={{ marginTop: 10 }}>
              <span className="pill pill-small">{record.currentLoadLabel}</span>
              <span className="pill pill-small">{record.trainingCompleted}/{record.trainingTotal} training</span>
              <span className="pill pill-small">{record.assignmentCount} assignments</span>
            </div>
          </div>

          <div className="slideout-section">
            <div className="slideout-section-title">Needs Attention</div>
            {record.attentionFlags.length === 0 ? (
              <p style={{ margin: 0, color: "var(--muted)" }}>No active attention flags.</p>
            ) : (
              <div className="instructor-ops-attention-list">
                {record.attentionFlags.map((flag) => (
                  <Link key={flag.kind} href={flag.href} className={`instructor-ops-attention-item is-${flag.tone}`}>
                    <strong>{flag.title}</strong>
                    <span>{flag.detail}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="slideout-section">
            <div className="slideout-section-title">Tags</div>
            <div className="instructor-ops-tag-row is-large">
              {record.tags.length > 0 ? record.tags.map((tag) => <span key={tag}>{tag}</span>) : <span>No tags yet</span>}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href={record.profileHref} className="button">
              Open canonical profile
            </Link>
            <Link href={action.href} className="button secondary">
              {action.label}
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}

export default function InstructorOpsKanban({
  records,
}: {
  records: InstructorOpsRecord[];
}) {
  return (
    <div className="instructor-ops-kanban applicant-command">
      <KanbanBoard
        items={records}
        columns={COLUMNS}
        dragEnabled={false}
        emptyColumnLabel="No instructors"
        searchPlaceholder="Search instructors, chapters, tags, or flags..."
        getSearchText={(record) =>
          [
            record.name,
            record.email,
            record.chapterName,
            record.stageLabel,
            record.currentLoadLabel,
            ...record.tags,
            ...record.attentionFlags.map((flag) => `${flag.title} ${flag.detail}`),
          ].join(" ")
        }
        toolbarExtra={
          <div className="instructor-ops-kanban-toolbar">
            <Link href="/admin/instructors/directory" className="button small secondary">
              Directory
            </Link>
            <Link href="/admin/instructors/attention" className="button small">
              Attention inbox
            </Link>
          </div>
        }
        renderCard={(record, { onClick, isDragging }) => (
          <InstructorCard record={record} onClick={onClick} isDragging={isDragging} />
        )}
        renderDragOverlay={(record) => (
          <InstructorCard record={record} onClick={() => {}} isDragging />
        )}
        renderDetailPanel={(record, { onClose }) => (
          <InstructorDetailPanel record={record} onClose={onClose} />
        )}
      />
    </div>
  );
}
