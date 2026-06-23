import Link from "next/link";

import { EntityLink } from "@/components/operations/entity-link";
import { PersonLink } from "@/components/people-strategy/person-link";
import { formatDueDate } from "@/lib/leadership-action-center/dates";
import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import { ACTION_VISIBILITY_LABELS } from "@/lib/people-strategy/constants";
import {
  effectiveDeadline,
  isActionOverdue,
} from "@/lib/people-strategy/my-actions-selectors";
import { deriveActionStrategicLinkage } from "@/lib/people-strategy/action-source";
import { getUserTitle } from "@/lib/user-title";
import {
  ActionTypePill,
  Pill,
  PriorityPill,
  StatusPill,
} from "@/components/people-strategy/pills";
import { RelatedEntityBadge } from "@/components/people-strategy/operational-badges";

/**
 * Shared Action Tracker list card (All Actions + My Actions).
 *
 * Leadership feedback #11: the card should read by a person's *title*, not their
 * account type. We resolve the Lead's title through `getUserTitle` (stored title
 * → admin-subtype label → formatted role) so e.g. an admin shows as "Leadership"
 * rather than "Admin".
 *
 * The card is a container, not one big link, so everything inside is genuinely
 * clickable: the title opens the Action 360 panel in place (modifier clicks
 * still navigate to /actions/[id]), the Lead opens their person panel, and the
 * related-entity badge opens the linked class/partner/person panel.
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
  selectable = false,
  selected = false,
  onSelectChange,
  selectionDisabled = false,
}: {
  item: ActionItemWithRelations;
  now: Date;
  /** Optional context line (e.g. the input request shown on My Actions). */
  prompt?: string | null;
  selectable?: boolean;
  selected?: boolean;
  onSelectChange?: (checked: boolean) => void;
  selectionDisabled?: boolean;
}) {
  const overdue = isActionOverdue(item, now);
  const due = effectiveDeadline(item);
  const executors = item.assignments.filter((a) => a.role === "EXECUTING");
  const inputs = item.assignments.filter((a) => a.role === "INPUT");
  const lead = personLabel(item.lead);
  const strategic = deriveActionStrategicLinkage(item);

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
    <div
      className={`card ps-action-card${selected ? " is-selected" : ""}`}
      style={{
        display: "block",
        padding: "12px 14px",
        color: "inherit",
        borderLeft: `3px solid ${railColor}`,
        ...(selected
          ? {
              boxShadow: "inset 0 0 0 1px var(--ypp-purple-300, var(--border))",
              background: "var(--ypp-purple-50, var(--surface))",
            }
          : null),
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
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0, flex: 1 }}>
          {selectable ? (
            <input
              type="checkbox"
              checked={selected}
              disabled={selectionDisabled}
              onChange={(event) => onSelectChange?.(event.target.checked)}
              aria-label={`Select ${item.title}`}
              style={{ marginTop: 3, flexShrink: 0 }}
            />
          ) : null}
          <EntityLink
            type="action"
            id={item.id}
            className="ps-action-card-title"
            style={{ fontSize: 14, fontWeight: 700, color: "inherit", minWidth: 0 }}
          >
            {item.title}
          </EntityLink>
        </div>
        <Pill tone={overdue ? "overdue" : "neutral"}>
          {overdue ? "Overdue · " : "Due "}
          {formatDueDate(due)}
        </Pill>
      </div>

      {/* Pill row: status, priority, department, visibility */}
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
        {item.relatedEntityType ? (
          <RelatedEntityBadge
            type={item.relatedEntityType}
            id={item.relatedEntityId}
          />
        ) : null}
        {strategic.initiativeTitle ? (
          <Pill tone="purple">Initiative: {strategic.initiativeTitle}</Pill>
        ) : null}
        {strategic.projectTitle ? (
          <Pill tone="neutral">Project: {strategic.projectTitle}</Pill>
        ) : null}
        {item.visibility === "OFFICERS_ONLY" ? (
          <Pill tone="warning">{ACTION_VISIBILITY_LABELS[item.visibility]}</Pill>
        ) : null}
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
              <PersonLink
                id={item.leadId}
                style={{ color: "var(--ypp-ink)", fontWeight: 600 }}
              >
                {lead.name}
              </PersonLink>
              <span style={{ color: "var(--muted)" }}> · {lead.title}</span>
            </>
          ) : (
            "Unassigned"
          )}
          {executors.length > 0 ? ` · Executing: ${executors.length}` : ""}
          {inputs.length > 0 ? ` · Input: ${inputs.length}` : ""}
        </span>
        <span style={{ whiteSpace: "nowrap", display: "inline-flex", gap: 10, alignItems: "baseline" }}>
          {item.comments.length}{" "}
          {item.comments.length === 1 ? "comment" : "comments"}
          <Link
            href={`/actions/${item.id}`}
            style={{ color: "var(--ypp-purple-600, #6b21c8)", fontWeight: 600, textDecoration: "none" }}
          >
            Open →
          </Link>
        </span>
      </div>
    </div>
  );
}
