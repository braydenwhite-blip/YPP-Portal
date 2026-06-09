import Link from "next/link";

import { formatMonthDay } from "@/lib/leadership-action-center/dates";
import type {
  OperationalTimelineEvent,
  OperationalTimelineEventType,
} from "@/lib/people-strategy/operational-timeline";

/**
 * OperationalTimeline — the entity's story as one chronological stream. Pure
 * presentational server component (no "use client", no data load): the page
 * derives the events from the operational context it already loaded and hands
 * them here. Ships compact (panel) and full (entity page) modes plus a clean,
 * actionable empty state, mirroring the OperationalContextPanel conventions.
 */

const TYPE_META: Record<
  OperationalTimelineEventType,
  { label: string; color: string }
> = {
  meeting: { label: "Meeting", color: "var(--ypp-purple, #6b21c8)" },
  action_created: { label: "Action created", color: "#1d4ed8" },
  action_completed: { label: "Completed", color: "var(--success-color, #16a34a)" },
  decision: { label: "Decision", color: "#0d9488" },
  follow_up: { label: "Follow-up", color: "var(--warning-color, #d97706)" },
  health_signal: { label: "Health", color: "#6b7280" },
};

const SEVERITY_COLOR: Partial<Record<OperationalTimelineEvent["severity"], string>> = {
  critical: "var(--error-color, #991b1b)",
  positive: "var(--success-color, #16a34a)",
};

function dotColor(event: OperationalTimelineEvent): string {
  return SEVERITY_COLOR[event.severity] ?? TYPE_META[event.type].color;
}

export function OperationalTimelineItem({ event }: { event: OperationalTimelineEvent }) {
  const meta = TYPE_META[event.type];
  return (
    <li style={{ position: "relative", paddingLeft: 22, paddingBottom: 14 }}>
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 1,
          top: 4,
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: dotColor(event),
          boxShadow: "0 0 0 3px var(--surface, #fff)",
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, color: meta.color }}>
          {meta.label}
        </span>
        <span style={{ fontSize: 11.5, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
          {formatMonthDay(event.occurredAt)}
        </span>
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 2 }}>
        {event.href ? (
          <Link href={event.href} style={{ color: "inherit", textDecoration: "none" }}>
            {event.title}
          </Link>
        ) : (
          event.title
        )}
      </div>
      {event.description ? (
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
          {event.description}
        </div>
      ) : null}
    </li>
  );
}

export function OperationalTimeline({
  events,
  title = "Operational timeline",
  compact = false,
  maxEvents,
  createActionHref = null,
  createMeetingHref = null,
}: {
  events: OperationalTimelineEvent[];
  title?: string;
  compact?: boolean;
  maxEvents?: number;
  createActionHref?: string | null;
  createMeetingHref?: string | null;
}) {
  const limit = maxEvents ?? (compact ? 6 : 30);
  const shown = events.slice(0, limit);
  const remaining = events.length - shown.length;

  return (
    <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          {title}
        </h2>
        {events.length > 0 ? (
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            {events.length} event{events.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      {events.length === 0 ? (
        <div style={{ padding: "4px 0" }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
            No operational history yet — schedule a meeting or create an action to start the record.
          </p>
          {createActionHref || createMeetingHref ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {createMeetingHref ? (
                <Link href={createMeetingHref} className="button outline small">
                  Schedule meeting
                </Link>
              ) : null}
              {createActionHref ? (
                <Link href={createActionHref} className="button outline small">
                  Create action
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <ol
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            position: "relative",
            borderLeft: "2px solid var(--border, #e5e7eb)",
            marginLeft: 4,
            paddingLeft: 2,
          }}
        >
          {shown.map((event) => (
            <OperationalTimelineItem key={event.id} event={event} />
          ))}
          {remaining > 0 ? (
            <li style={{ paddingLeft: 22, fontSize: 12, color: "var(--text-secondary)" }}>
              + {remaining} earlier event{remaining === 1 ? "" : "s"}
            </li>
          ) : null}
        </ol>
      )}
    </section>
  );
}

export default OperationalTimeline;
