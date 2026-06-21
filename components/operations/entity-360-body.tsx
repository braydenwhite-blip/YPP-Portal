"use client";

import Link from "next/link";

import type {
  Entity360,
  Entity360MeetingRef,
  Entity360MentorshipPanel,
  Entity360Person,
} from "@/lib/operations/entity-360";
import type { TimelineEvent } from "@/lib/operations/timeline";
import { TIMELINE_EVENT_LABELS } from "@/lib/operations/timeline";
import type { WorkItem } from "@/lib/operations/work-items";
import { Pill, type PillTone } from "@/components/people-strategy/pills";

import { AskAboutThis } from "@/components/help-agent/ask-about-this";

import { EntityLink } from "./entity-link";

/**
 * Entity 360 — the universal drawer body. ONE component renders every entity
 * type from the same serializable payload: the derived signal (readiness /
 * health / momentum), the at-a-glance stats, contact facts, connected people
 * (each opening their own panel in place via EntityLink), connected work,
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

const TONE_PILL: Record<string, PillTone> = {
  neutral: "neutral",
  info: "info",
  success: "success",
  warning: "warning",
  overdue: "overdue",
  purple: "purple",
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
  return (
    <EntityLink type="person" id={person.id} className="e360-person-row">
      {inner}
    </EntityLink>
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

// --- mentorship ----------------------------------------------------------------

function MentorshipSection({ panel }: { panel: Entity360MentorshipPanel }) {
  return (
    <Section title={`Mentorship (${panel.pairings.length})`}>
      <div className="e360-item-list">
        {panel.pairings.map((p) => {
          const openLabel =
            p.openNextSteps > 0
              ? `${p.openNextSteps} open next step${p.openNextSteps === 1 ? "" : "s"}${
                  p.overdueNextSteps > 0 ? ` (${p.overdueNextSteps} overdue)` : ""
                }${p.blocked ? " · blocked" : ""}`
              : null;
          const meta = [
            p.role === "mentee" ? `Mentor: ${p.partnerName}` : `Mentee: ${p.partnerName}`,
            p.attentionReason,
            openLabel,
            p.nextSessionISO
              ? `Next check-in ${fmtDay(p.nextSessionISO)}`
              : p.lastCheckInISO
                ? `Last check-in ${fmtDay(p.lastCheckInISO)}`
                : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <EntityLink key={p.id} type="mentorship" id={p.id} className="e360-item">
              <div className="e360-item-top">
                <span className="e360-item-title">
                  {p.role === "mentee" ? "Being mentored" : "Mentoring"} {p.partnerName}
                </span>
                <Pill tone="neutral">{p.cycleLabel}</Pill>
              </div>
              {meta ? <div className="e360-item-meta">{meta}</div> : null}
            </EntityLink>
          );
        })}
      </div>
    </Section>
  );
}

// --- connected items -----------------------------------------------------------

function WorkItemRow({ item }: { item: WorkItem }) {
  // Actions stack their own 360 panel; an unconverted follow-up opens its
  // source meeting's panel (its href is the meeting page).
  const drawerType = item.kind === "action" ? ("action" as const) : ("meeting" as const);
  const drawerId =
    item.kind === "action"
      ? item.id.replace(/^action:/, "")
      : (item.href.split("/").pop() ?? null);
  const inner = (
    <>
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
    </>
  );
  return (
    <EntityLink type={drawerType} id={drawerId} href={item.href} className="e360-item">
      {inner}
    </EntityLink>
  );
}

function ClassRow({
  cls,
}: {
  cls: Entity360["classes"][number];
}) {
  return (
    <EntityLink type="class" id={cls.id} className="e360-item">
      <div className="e360-item-top">
        <span className="e360-item-title">{cls.title}</span>
        {cls.status ? <Pill tone="neutral">{cls.status}</Pill> : null}
      </div>
      {cls.context ? <div className="e360-item-meta">{cls.context}</div> : null}
    </EntityLink>
  );
}

function MeetingRow({ meeting }: { meeting: Entity360MeetingRef }) {
  return (
    <EntityLink type="meeting" id={meeting.id} className="e360-item">
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
    </EntityLink>
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
      <div className="flex justify-end">
        <AskAboutThis entityType={entity.type} entityId={entity.id} align="right" />
      </div>

      {entity.signal ? (
        <div className="e360-signal" data-tone={entity.signal.tone}>
          <Pill tone={TONE_PILL[entity.signal.tone] ?? "neutral"}>
            {entity.signal.label}
          </Pill>
          {entity.signal.detail ? (
            <span className="e360-signal-detail">{entity.signal.detail}</span>
          ) : null}
        </div>
      ) : null}

      {entity.glance && entity.glance.length > 0 ? (
        <div className="e360-glance" aria-label="At a glance">
          {entity.glance.map((stat) => (
            <div key={stat.label} className="e360-glance-stat" data-tone={stat.tone}>
              <span className="e360-glance-value">{stat.value}</span>
              <span className="e360-glance-label">{stat.label}</span>
            </div>
          ))}
        </div>
      ) : null}

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

      {entity.mentorship && entity.mentorship.pairings.length > 0 ? (
        <MentorshipSection panel={entity.mentorship} />
      ) : null}

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
