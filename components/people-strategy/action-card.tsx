import Link from "next/link";

import { formatDueDate } from "@/lib/leadership-action-center/dates";
import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import { ACTION_VISIBILITY_LABELS } from "@/lib/people-strategy/constants";
import {
  effectiveDeadline,
  isActionOverdue,
} from "@/lib/people-strategy/my-actions-selectors";
import { getUserTitle } from "@/lib/user-title";
import {
  ActionTypePill,
  Pill,
  PriorityPill,
  StatusPill,
} from "@/components/people-strategy/pills";

/**
 * Shared Action Tracker list card (All Actions + My Actions).
 *
 * Leadership feedback #11: the card should read by a person's *title*, not their
 * account type. We resolve the Lead's title through `getUserTitle` (stored title
 * → admin-subtype label → formatted role) so e.g. an admin shows as "Leadership"
 * rather than "Admin". The whole card is a single link to the action, so people
 * names render as text here (clickable profiles live on the detail view + people
 * lists, which aren't wrapped in an outer link).
 */

const OVERDUE_ACCENT = "var(--error-color)";

type CardPerson = {
  name: string | null;
  email: string;
  title: string | null;
  primaryRole: string | null;
  adminSubtypes: { subtype: string }[];
};

function personLabel(
  person: CardPerson | null | undefined
): { name: string; title: string } | null {
  if (!person) return null;
  return {
    name: person.name ?? person.email,
    title: getUserTitle({
      title: person.title,
      primaryRole: person.primaryRole,
      adminSubtypes: person.adminSubtypes.map((s) => s.subtype),
    }),
  };
}

export function ActionCard({
  item,
  now,
  prompt,
}: {
  item: ActionItemWithRelations;
  now: Date;
  /** Optional context line (e.g. the input request shown on My Actions). */
  prompt?: string | null;
}) {
  const overdue = isActionOverdue(item, now);
  const due = effectiveDeadline(item);
  const executors = item.assignments.filter((a) => a.role === "EXECUTING");
  const inputs = item.assignments.filter((a) => a.role === "INPUT");
  const lead = personLabel(item.lead);

  // Left rail color makes the list scannable at a glance: overdue always wins
  // (red), otherwise the rail carries the priority signal so urgent/high work
  // stands out without reading every pill.
  const railColor = overdue
    ? OVERDUE_ACCENT
    : item.priority === "URGENT"
      ? OVERDUE_ACCENT
      : item.priority === "HIGH"
        ? "var(--warning-color)"
        : "transparent";

  return (
    <Link
      href={`/actions/${item.id}`}
      className="card ps-action-card"
      style={{
        display: "block",
        padding: "12px 14px",
        textDecoration: "none",
        color: "inherit",
        borderLeft: `3px solid ${railColor}`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "baseline",
        }}
      >
        <strong className="ps-action-card-title" style={{ fontSize: 14 }}>
          {item.title}
        </strong>
        <Pill tone={overdue ? "overdue" : "neutral"}>
          {overdue ? "Overdue · " : "Due "}
          {formatDueDate(due)}
        </Pill>
      </div>

      {/* Pill row: status, priority, department, officer-meeting, visibility */}
      <div
        style={{
          display: "flex",
          gap: 6,
          marginTop: 8,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <StatusPill status={item.status} />
        <PriorityPill priority={item.priority} hideLow />
        <ActionTypePill actionType={item.actionType} />
        {item.department ? (
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            {item.department.name}
          </span>
        ) : null}
        {item.officerMeeting ? (
          <Pill tone="purple">
            Source: {item.officerMeeting.title ?? "Meeting"} · {formatDueDate(item.officerMeeting.date)}
          </Pill>
        ) : item.officerMeetingId ? (
          <Pill tone="purple">Source: Meeting</Pill>
        ) : null}
        <Pill tone={item.visibility === "OFFICERS_ONLY" ? "warning" : "neutral"}>
          {ACTION_VISIBILITY_LABELS[item.visibility]}
        </Pill>
      </div>

      {prompt ? (
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 12,
            color: "var(--text-secondary)",
            fontStyle: "italic",
          }}
        >
          &ldquo;{prompt}&rdquo;
        </p>
      ) : null}

      {/* Roles line (lead by title) + comment count */}
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
          {lead ? (
            <>
              Lead:{" "}
              <strong style={{ color: "var(--ypp-ink)", fontWeight: 600 }}>
                {lead.name}
              </strong>
              <span style={{ color: "var(--muted)" }}> · {lead.title}</span>
            </>
          ) : (
            "Unassigned"
          )}
          {executors.length > 0 ? ` · Executing: ${executors.length}` : ""}
          {inputs.length > 0 ? ` · Input: ${inputs.length}` : ""}
        </span>
        <span style={{ whiteSpace: "nowrap" }}>
          {item.comments.length}{" "}
          {item.comments.length === 1 ? "comment" : "comments"}
        </span>
      </div>
    </Link>
  );
}
