import type { ClassOfferingStatus } from "@prisma/client";

import {
  executingInstructors,
  formatClassDateRange,
  formatClassSchedule,
  type TrackerClass,
} from "@/lib/people-strategy/class-tracker";

/**
 * Read-only Action Tracker "Class" row. Mirrors the All Actions row layout
 * (title · pill · status · type label · roles line · meta) but renders a class
 * schedule instead of a deadline, and carries no edit/link affordance — class
 * data is owned by the Classes system, not the Action Tracker.
 */

const STATUS_LABELS: Record<ClassOfferingStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const STATUS_STYLES: Record<ClassOfferingStatus, { bg: string; color: string }> = {
  DRAFT: { bg: "#f1f5f9", color: "#475569" },
  PUBLISHED: { bg: "#eff6ff", color: "#1d4ed8" },
  IN_PROGRESS: { bg: "#ecfdf5", color: "#047857" },
  COMPLETED: { bg: "#f1f5f9", color: "#475569" },
  CANCELLED: { bg: "#fef2f2", color: "#b91c1c" },
};

const ROLE_LABELS: Record<string, string> = {
  LEAD: "Lead",
  CO_INSTRUCTOR: "Co-Instructor",
  ASSISTANT: "Assistant",
  BACKUP: "Backup",
};

function Pill({
  children,
  bg,
  color,
  border,
}: {
  children: React.ReactNode;
  bg?: string;
  color?: string;
  border?: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1.4,
        padding: "2px 8px",
        borderRadius: 999,
        whiteSpace: "nowrap",
        background: bg ?? "#f1f5f9",
        color: color ?? "#475569",
        border: border ? `1px solid ${border}` : "1px solid transparent",
      }}
    >
      {children}
    </span>
  );
}

export function ClassTrackerRow({ offering }: { offering: TrackerClass }) {
  const status = STATUS_STYLES[offering.status];
  const schedule = formatClassSchedule(offering);
  const executors = executingInstructors(offering);
  const leadName = offering.instructor.name ?? offering.instructor.email ?? "Unassigned";

  return (
    <div
      className="card"
      aria-readonly="true"
      style={{
        display: "block",
        padding: "12px 14px",
        borderLeft: "3px solid transparent",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <strong style={{ fontSize: 14 }}>{offering.title}</strong>
        <Pill bg="#f8fafc" color="#64748b" border="#e2e8f0">
          🗓️ {schedule || "Schedule TBD"}
        </Pill>
      </div>

      {/* Pill row: status, "Class" type label, read-only marker */}
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Pill bg={status.bg} color={status.color}>
          {STATUS_LABELS[offering.status]}
        </Pill>
        <Pill bg="#eef2ff" color="#4338ca" border="#c7d2fe">
          Class
        </Pill>
        <Pill bg="#f8fafc" color="#94a3b8" border="#e2e8f0">
          Read-only
        </Pill>
        {offering.chapter?.name ? (
          <span className="badge" style={{ fontSize: 11 }}>
            {offering.chapter.name}
          </span>
        ) : null}
      </div>

      {/* Instructor roles line + date range */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          marginTop: 8,
          fontSize: 12,
          color: "#94a3b8",
          flexWrap: "wrap",
        }}
      >
        <span>
          Lead Instructor: {leadName}
          {executors.length > 0
            ? ` · Executing: ${executors
                .map((e) => `${e.name} (${ROLE_LABELS[e.role] ?? e.role})`)
                .join(", ")}`
            : ""}
        </span>
        <span style={{ whiteSpace: "nowrap" }}>{formatClassDateRange(offering)}</span>
      </div>
    </div>
  );
}
