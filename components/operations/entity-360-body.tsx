"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";

import type {
  Entity360,
  Entity360MeetingRef,
  Entity360Person,
} from "@/lib/operations/entity-360";
import type { TimelineEvent } from "@/lib/operations/timeline";
import { TIMELINE_EVENT_LABELS } from "@/lib/operations/timeline";
import type { WorkItem } from "@/lib/operations/work-items";
import { Pill, type PillTone } from "@/components/people-strategy/pills";

import { useEntity360 } from "./entity-360-context";

/**
 * Entity 360 — the universal drawer body. ONE component renders every entity
 * type from the same serializable payload: header identity, contact facts,
 * connected people (each opening their own panel in place), connected work,
 * classes, meetings, the story timeline, risks, and the next step. Sections
 * with no data simply don't render, so a sparse entity still reads clean.
 */

const WORK_TONE: Record<WorkItem["tone"], PillTone> = {
  danger: "overdue",
  warning: "warning",
  info: "info",
  success: "success",
  neutral: "neutral",
};

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="e360-section-title">{title}</h3>
      {children}
    </section>
  );
}

// --- people -------------------------------------------------------------------

function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "•";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function PersonRow({ person }: { person: Entity360Person }) {
  const drawer = useEntity360();
  const inner = (
    <>
      <span className="e360-person-avatar">{initialsOf(person.name)}</span>
      <span style={{ minWidth: 0 }}>
        <span className="e360-person-name" style={{ display: "block" }}>
          {person.name}
        </span>
        {person.title ? <span className="e360-person-title">{person.title}</span> : null}
      </span>
    </>
  );
  if (!person.id) {
    return <div className="e360-person-row">{inner}</div>;
  }
  const id = person.id;
  return (
    <Link
      href={`/people/${id}`}
      className="e360-person-row"
      onClick={(e) => {
        if (drawer && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
          e.preventDefault();
          drawer.openEntity("person", id);
        }
      }}
    >
      {inner}
    </Link>
  );
}

function PeopleSection({ people }: { people: Entity360Person[] }) {
  // Group by relationship so "Mentor" / "Mentees" / "Attendees" read as labeled
  // clusters, in first-seen order.
  const groups = new Map<string, Entity360Person[]>();
  for (const person of people) {
    const list = groups.get(person.relationship) ?? [];
    list.push(person);
    groups.set(person.relationship, list);
  }
  return (
    <Section title="People">
      {[...groups.entries()].map(([relationship, members]) => (
        <div key={relationship}>
          <span className="e360-rel-group">
            {relationship}
            {members.length > 1 ? `s (${members.length})` : ""}
          </span>
          {members.map((person, i) => (
            <PersonRow key={`${person.id ?? person.name}-${i}`} person={person} />
          ))}
        </div>
      ))}
    </Section>
  );
}

// --- connected items -----------------------------------------------------------

function WorkItemRow({ item }: { item: WorkItem }) {
  return (
    <Link href={item.href} className="e360-item">
      <div className="e360-item-top">
        <span className="e360-item-title">{item.title}</span>
        <Pill tone={WORK_TONE[item.tone]}>{item.status}</Pill>
      </div>
      <div className="e360-item-meta">
        {[
          item.ownerName ?? "No owner",
          item.relatedLabel,
          item.meetingTitle ? `from ${item.meetingTitle}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </div>
    </Link>
  );
}

function ClassRow({
  cls,
}: {
  cls: Entity360["classes"][number];
}) {
  const drawer = useEntity360();
  return (
    <Link
      href={`/admin/classes/${cls.id}`}
      className="e360-item"
      onClick={(e) => {
        if (drawer && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
          e.preventDefault();
          drawer.openEntity("class", cls.id);
        }
      }}
    >
      <div className="e360-item-top">
        <span className="e360-item-title">{cls.title}</span>
        {cls.status ? <Pill tone="neutral">{cls.status}</Pill> : null}
      </div>
      {cls.context ? <div className="e360-item-meta">{cls.context}</div> : null}
    </Link>
  );
}

function MeetingRow({ meeting }: { meeting: Entity360MeetingRef }) {
  const drawer = useEntity360();
  return (
    <Link
      href={`/actions/meetings/${meeting.id}`}
      className="e360-item"
      onClick={(e) => {
        if (drawer && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
          e.preventDefault();
          drawer.openEntity("meeting", meeting.id);
        }
      }}
    >
      <div className="e360-item-top">
        <span className="e360-item-title">{meeting.title}</span>
        <Pill tone={meeting.upcoming ? "info" : "neutral"}>
          {meeting.upcoming ? "Upcoming" : fmtDay(meeting.dateISO)}
        </Pill>
      </div>
      <div className="e360-item-meta">
        {[
          meeting.upcoming ? fmtDay(meeting.dateISO) : null,
          meeting.categoryLabel,
          meeting.outcome,
        ]
          .filter(Boolean)
          .join(" · ")}
      </div>
    </Link>
  );
}

// --- timeline -------------------------------------------------------------------

function TimelineEventRow({ event }: { event: TimelineEvent }) {
  const body = (
    <>
      <div className="e360-timeline-date">
        {fmtDay(event.occurredAtISO)} · {TIMELINE_EVENT_LABELS[event.kind]}
      </div>
      <p className="e360-timeline-title">{event.title}</p>
      {event.detail || event.actorName ? (
        <p className="e360-timeline-detail">
          {[event.actorName, event.detail].filter(Boolean).join(" · ")}
        </p>
      ) : null}
    </>
  );
  return (
    <li className="e360-timeline-event" data-kind={event.kind}>
      <span className="e360-timeline-dot" aria-hidden="true" />
      {event.href ? (
        <Link href={event.href} style={{ textDecoration: "none", color: "inherit" }}>
          {body}
        </Link>
      ) : (
        body
      )}
    </li>
  );
}

// --- the body --------------------------------------------------------------------

export function Entity360Body({ entity }: { entity: Entity360 }) {
  return (
    <div className="e360-body">
      {entity.nextStep ? (
        <div className="e360-next-step">
          <strong>Next step: </strong>
          {entity.nextStep}
        </div>
      ) : null}

      {entity.risks.length > 0 ? (
        <div style={{ display: "grid", gap: 6 }}>
          {entity.risks.map((risk, i) => (
            <div key={i} className="e360-risk">
              <span aria-hidden="true">⚠</span>
              <span>{risk}</span>
            </div>
          ))}
        </div>
      ) : null}

      {entity.facts.length > 0 ? (
        <div className="e360-facts">
          {entity.facts.map((fact) => (
            <div key={fact.label + fact.value} className="e360-fact">
              <span className="e360-fact-label">{fact.label}</span>
              <span className="e360-fact-value">
                {fact.href ? <a href={fact.href}>{fact.value}</a> : fact.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {entity.people.length > 0 ? <PeopleSection people={entity.people} /> : null}

      {entity.workItems.length > 0 ? (
        <Section title={`Projects & Actions (${entity.workItems.length})`}>
          <div className="e360-item-list">
            {entity.workItems.map((item) => (
              <WorkItemRow key={item.id} item={item} />
            ))}
          </div>
        </Section>
      ) : null}

      {entity.classes.length > 0 ? (
        <Section title={`Classes (${entity.classes.length})`}>
          <div className="e360-item-list">
            {entity.classes.map((cls) => (
              <ClassRow key={cls.id} cls={cls} />
            ))}
          </div>
        </Section>
      ) : null}

      {entity.meetings.length > 0 ? (
        <Section title={`Meetings (${entity.meetings.length})`}>
          <div className="e360-item-list">
            {entity.meetings.map((meeting) => (
              <MeetingRow key={meeting.id} meeting={meeting} />
            ))}
          </div>
        </Section>
      ) : null}

      {entity.timeline.length > 0 ? (
        <Section title="Timeline">
          <ol className="e360-timeline">
            {entity.timeline.map((event) => (
              <TimelineEventRow key={event.id} event={event} />
            ))}
          </ol>
        </Section>
      ) : null}
    </div>
  );
}
