"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  TIMELINE_EVENT_LABELS,
  TIMELINE_FILTERS,
  TIMELINE_FILTER_LABELS,
  filterTimeline,
  groupTimelineByDay,
  type TimelineEvent,
  type TimelineFilter,
} from "@/lib/operations/timeline";

import { RELATED_TO_ENTITY_360 } from "@/lib/operations/entity-360";

import { EntityLink } from "./entity-link";

/**
 * Data 360 — the unified timeline. One chronological story across meetings,
 * decisions, and actions, grouped by day with filter chips. Entity mentions
 * open their 360 panel in place.
 */

export function UnifiedTimeline({ events }: { events: TimelineEvent[] }) {
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const days = useMemo(
    () => groupTimelineByDay(filterTimeline(events, filter)),
    [events, filter]
  );

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="ps-tabs" role="tablist" aria-label="Timeline filter">
        {TIMELINE_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            aria-current={filter === f ? "page" : undefined}
            className="ps-tab"
            style={{ cursor: "pointer", border: "none", font: "inherit" }}
            onClick={() => setFilter(f)}
          >
            {TIMELINE_FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {days.length === 0 ? (
        <div className="card" style={{ padding: 16, fontSize: 13, color: "var(--text-secondary)" }}>
          Nothing recorded in this window yet — meetings, decisions, and actions
          will build the story here as work happens.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {days.map((day) => (
            <section key={day.dayISO}>
              <h3
                style={{
                  margin: "0 0 8px",
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  color: "var(--muted)",
                }}
              >
                {day.dayLabel}
              </h3>
              <ol className="e360-timeline">
                {day.events.map((event) => (
                  <TimelineRow key={event.id} event={event} />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function TimelineRow({ event }: { event: TimelineEvent }) {
  const relatedDrawerType = event.relatedType
    ? RELATED_TO_ENTITY_360[event.relatedType]
    : undefined;
  return (
    <li className="e360-timeline-event" data-kind={event.kind}>
      <span className="e360-timeline-dot" aria-hidden="true" />
      <div className="e360-timeline-date">{TIMELINE_EVENT_LABELS[event.kind]}</div>
      <p className="e360-timeline-title">
        {event.href ? (
          <Link href={event.href} style={{ color: "inherit", textDecoration: "none" }}>
            {event.title}
          </Link>
        ) : (
          event.title
        )}
      </p>
      {event.detail || event.actorName || event.relatedLabel ? (
        <p className="e360-timeline-detail">
          {[event.actorName, event.detail].filter(Boolean).join(" · ")}
          {event.relatedLabel && relatedDrawerType && event.relatedId ? (
            <>
              {event.actorName || event.detail ? " · " : ""}
              <EntityLink
                type={relatedDrawerType}
                id={event.relatedId}
                style={{ color: "var(--ypp-purple-600, #6b21c8)", fontWeight: 600 }}
              >
                {event.relatedLabel}
              </EntityLink>
            </>
          ) : null}
        </p>
      ) : null}
    </li>
  );
}
