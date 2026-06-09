import Link from "next/link";

import { formatMonthDay } from "@/lib/leadership-action-center/dates";
import {
  TOUCHPOINT_GROUP_META,
  type TouchpointEvent,
  type TouchpointEventType,
  type TouchpointGroup,
  type TouchpointTimeline,
} from "@/lib/people-strategy/strategic-touchpoint-timeline";

import { EmptyCard } from "./command-center-os";
import { Pill, type PillTone } from "./pills";

/**
 * YPP Execution OS — TOUCHPOINT TIMELINE UI (3.0, Phase E).
 *
 * Pure presentational SERVER components for the normalized touchpoint timeline.
 * Renders the grouped buckets (overdue / upcoming / current / recent / past) the
 * engine produces, each event labelled by type, dated, and linked to its source.
 * Reused by the project detail page, the initiative pages, and (compactly) entity
 * pages. Ships a graceful empty state.
 */

function fmt(iso: string): string {
  return formatMonthDay(new Date(iso));
}

const EVENT_TYPE_META: Record<TouchpointEventType, { label: string; tone: PillTone }> = {
  meeting: { label: "Meeting", tone: "purple" },
  action_created: { label: "Action created", tone: "neutral" },
  action_completed: { label: "Action done", tone: "success" },
  action_due: { label: "Action due", tone: "warning" },
  decision: { label: "Decision", tone: "info" },
  milestone_target: { label: "Milestone", tone: "purple" },
  follow_up: { label: "Follow-up", tone: "warning" },
  partner_touchpoint: { label: "Touchpoint", tone: "neutral" },
};

const IMPORTANCE_BORDER: Record<TouchpointEvent["importance"], string> = {
  critical: "var(--error-color, #991b1b)",
  high: "var(--warning-color, #854d0e)",
  normal: "var(--ypp-purple, #6b21c8)",
  low: "var(--border, #e5e7eb)",
};

export function TouchpointTypeBadge({ event }: { event: TouchpointEvent }) {
  const meta = EVENT_TYPE_META[event.eventType];
  return <Pill tone={meta.tone}>{meta.label}</Pill>;
}

export function TouchpointRow({ event }: { event: TouchpointEvent }) {
  const e = event;
  const body = (
    <div
      className="card cc-focusable"
      style={{
        padding: "9px 13px",
        textDecoration: "none",
        color: "inherit",
        borderLeft: `3px solid ${IMPORTANCE_BORDER[e.importance]}`,
        opacity: e.upcoming ? 0.85 : 1,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
        <strong style={{ fontSize: 13, minWidth: 0 }}>{e.title}</strong>
        <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <TouchpointTypeBadge event={e} />
          {e.overdue ? <Pill tone="overdue">overdue</Pill> : null}
          {e.stale ? <Pill tone="warning">stale</Pill> : null}
          <span style={{ fontSize: 12, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{fmt(e.dateISO)}</span>
        </span>
      </div>
      <div style={{ marginTop: 3, fontSize: 12, color: "var(--text-secondary)" }}>
        {e.summary}
        {e.personName ? ` · ${e.personName}` : ""}
        {e.entity ? ` · ${e.entity.label}` : ""}
      </div>
    </div>
  );

  return e.sourceHref ? (
    <Link href={e.sourceHref} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      {body}
    </Link>
  ) : (
    body
  );
}

function TouchpointGroupSection({ group, events }: { group: TouchpointGroup; events: TouchpointEvent[] }) {
  if (events.length === 0) return null;
  const meta = TOUCHPOINT_GROUP_META[group];
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Pill tone={meta.tone}>{meta.label}</Pill>
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{events.length}</span>
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {events.map((e) => (
          <TouchpointRow key={e.id} event={e} />
        ))}
      </div>
    </div>
  );
}

const GROUP_ORDER: TouchpointGroup[] = ["overdue", "upcoming", "current", "recent", "past"];

export function TouchpointTimelineView({
  timeline,
  pastLimit = 12,
  emptyHint = "No touchpoints yet — meetings, actions, and decisions will appear here as they happen.",
}: {
  timeline: TouchpointTimeline;
  pastLimit?: number;
  emptyHint?: string;
}) {
  if (timeline.isEmpty) return <EmptyCard>{emptyHint}</EmptyCard>;

  const byGroup: Record<TouchpointGroup, TouchpointEvent[]> = {
    overdue: timeline.overdue,
    upcoming: timeline.upcoming,
    current: timeline.current,
    recent: timeline.recent,
    past: timeline.past.slice(0, pastLimit),
  };

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {GROUP_ORDER.map((g) => (
        <TouchpointGroupSection key={g} group={g} events={byGroup[g]} />
      ))}
    </div>
  );
}

/** Compact embeddable timeline for entity pages — a flat recent list. */
export function EntityTouchpoints({
  timeline,
  limit = 6,
  emptyHint = "No recent touchpoints.",
}: {
  timeline: TouchpointTimeline;
  limit?: number;
  emptyHint?: string;
}) {
  const events = timeline.all.slice(0, limit);
  if (events.length === 0) return <EmptyCard>{emptyHint}</EmptyCard>;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {events.map((e) => (
        <TouchpointRow key={e.id} event={e} />
      ))}
    </div>
  );
}
