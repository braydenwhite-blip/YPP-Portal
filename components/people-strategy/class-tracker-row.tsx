import {
  executingInstructors,
  formatClassDateRange,
  formatClassSchedule,
  type TrackerClass,
} from "@/lib/people-strategy/class-tracker";
import { Pill, StatusPill } from "@/components/people-strategy/pills";

/**
 * Read-only Action Tracker "Class" row. Mirrors the All Actions row layout
 * (title · pill · status · type label · roles line · meta) but renders a class
 * schedule instead of a deadline, and carries no edit/link affordance — class
 * data is owned by the Classes system, not the Action Tracker.
 */

const ROLE_LABELS: Record<string, string> = {
  LEAD: "Lead",
  CO_INSTRUCTOR: "Co-Instructor",
  ASSISTANT: "Assistant",
  BACKUP: "Backup",
};

export function ClassTrackerRow({ offering }: { offering: TrackerClass }) {
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
        <Pill tone="neutral">{schedule || "Schedule TBD"}</Pill>
      </div>

      {/* Pill row: status, "Class" type label, read-only marker */}
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
        <StatusPill kind="class" status={offering.status} />
        <Pill tone="purple">Class</Pill>
        <Pill tone="neutral">Read-only</Pill>
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
          color: "var(--gray-400)",
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
