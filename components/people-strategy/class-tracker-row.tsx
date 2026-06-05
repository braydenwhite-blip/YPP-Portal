import Link from "next/link";

import {
  executingInstructors,
  formatClassDateRange,
  formatClassSchedule,
  type TrackerClass,
} from "@/lib/people-strategy/class-tracker";
import { Pill, StatusPill } from "@/components/people-strategy/pills";
import { PersonLink } from "@/components/people-strategy/person-link";

/**
 * Action Tracker "Class" row. Mirrors the All Actions row layout (title · pill ·
 * status · type label · roles line · meta) but renders a class schedule instead
 * of a deadline.
 *
 * The class data itself is owned by the Classes system, not the Action Tracker,
 * so the row stays read-only in place. When the viewer can manage classes
 * (admins), `detailHref` is supplied and the title deep-links to the editable
 * admin class detail; otherwise the title is inert text (comment #9, §2.4).
 *
 * Surfaces the three roles the stakeholder asked for: Lead Instructor, Partner,
 * and Relationship Lead (the Partner's owner), alongside executing instructors.
 */

const ROLE_LABELS: Record<string, string> = {
  LEAD: "Lead",
  CO_INSTRUCTOR: "Co-Instructor",
  ASSISTANT: "Assistant",
  BACKUP: "Backup",
};

export function ClassTrackerRow({
  offering,
  detailHref,
}: {
  offering: TrackerClass;
  detailHref?: string | null;
}) {
  const schedule = formatClassSchedule(offering);
  const executors = executingInstructors(offering);
  const leadName = offering.instructor.name ?? offering.instructor.email ?? "Unassigned";
  const partner = offering.partner;
  const relationshipLead = partner?.relationshipLead;
  const relationshipLeadName =
    relationshipLead?.name ?? relationshipLead?.email ?? null;

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
        {detailHref ? (
          <Link
            href={detailHref}
            style={{ fontSize: 14, fontWeight: 700, color: "var(--ypp-ink)", textDecoration: "none" }}
          >
            {offering.title}
          </Link>
        ) : (
          <strong style={{ fontSize: 14 }}>{offering.title}</strong>
        )}
        <Pill tone="neutral">{schedule || "Schedule TBD"}</Pill>
      </div>

      {/* Pill row: status, "Class" type label, read-only marker */}
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
        <StatusPill kind="class" status={offering.status} />
        <Pill tone="purple">Class</Pill>
        {detailHref ? null : <Pill tone="neutral">Read-only</Pill>}
        {offering.chapter?.name ? (
          <span className="badge" style={{ fontSize: 11 }}>
            {offering.chapter.name}
          </span>
        ) : null}
        {partner?.name ? (
          <span className="badge" style={{ fontSize: 11 }}>
            Partner: {partner.name}
          </span>
        ) : null}
      </div>

      {/* Roles line: Lead Instructor · Relationship Lead · Executing instructors */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          marginTop: 8,
          fontSize: 12,
          color: "#64748b",
          flexWrap: "wrap",
        }}
      >
        <span>
          Lead Instructor:{" "}
          <PersonLink id={offering.instructor.id} style={{ color: "inherit", fontWeight: 600 }}>
            {leadName}
          </PersonLink>
          {relationshipLeadName ? (
            <>
              {" · "}Relationship Lead:{" "}
              <PersonLink id={relationshipLead?.id} style={{ color: "inherit", fontWeight: 600 }}>
                {relationshipLeadName}
              </PersonLink>
            </>
          ) : ""}
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
