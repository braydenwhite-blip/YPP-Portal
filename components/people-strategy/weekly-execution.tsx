import Link from "next/link";

import { formatMonthDay } from "@/lib/leadership-action-center/dates";
import type {
  WeeklyExecutionAgendaSection,
  WeeklyExecutionOS,
} from "@/lib/people-strategy/weekly-execution";
import {
  communicationToOperationsItem,
  looseEndToOperationsItem,
} from "@/lib/people-strategy/operations-summary";
import {
  OperationsEmptyState,
  OperationsItemList,
} from "./operations-item-card";
import { WeeklyMeetingCaptureClient } from "./weekly-meeting-capture-client";
import { StatCard, type StatTone } from "./stat-card";

/**
 * Weekly Execution — the officer meeting workflow, in four stages:
 *
 *   1. Build agenda      (before the meeting)
 *   2. Capture meeting   (during the meeting)
 *   3. Resolve loose ends (before you leave)
 *   4. Draft recap       (after the meeting)
 *
 * Loose ends and communications render with the shared OperationsItemCard so
 * they read exactly like the same items on the Command Center — one system,
 * one vocabulary, one card language.
 */

type PersonOption = { id: string; name: string };

function fmt(iso: string | null): string {
  return iso ? formatMonthDay(new Date(iso)) : "No date";
}

function Stage({
  number,
  title,
  hint,
  children,
}: {
  number: number;
  title: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h2 className="ps-section-title" style={{ margin: 0 }}>
          {number}. {title}
        </h2>
        {hint ? <span style={{ fontSize: 12, color: "var(--muted)" }}>{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Snapshot({ os }: { os: WeeklyExecutionOS }) {
  const tiles: Array<{
    label: string;
    value: number;
    icon: Parameters<typeof StatCard>[0]["icon"];
    tone?: StatTone;
    href?: string;
  }> = [
    { label: "Urgent", value: os.snapshot.urgent, icon: "alert", tone: os.snapshot.urgent > 0 ? "danger" : "default", href: "/actions/all?status=OVERDUE" },
    { label: "Blocked", value: os.snapshot.blocked, icon: "flag", tone: os.snapshot.blocked > 0 ? "warning" : "default", href: "/actions/all?status=BLOCKED" },
    { label: "Due this week", value: os.snapshot.dueThisWeek, icon: "calendar", href: "/actions/all?preset=due_soon" },
    { label: "Meetings this week", value: os.snapshot.meetingsThisWeek, icon: "users", href: "/actions/meetings" },
    { label: "Decisions needed", value: os.snapshot.decisionsNeeded, icon: "check", tone: os.snapshot.decisionsNeeded > 0 ? "warning" : "default" },
    { label: "Communications", value: os.snapshot.communicationsNeeded, icon: "inbox", tone: os.snapshot.communicationsNeeded > 0 ? "warning" : "default" },
    { label: "Initiatives", value: os.snapshot.initiativesNeedingAttention, icon: "target", tone: os.snapshot.initiativesNeedingAttention > 0 ? "warning" : "default", href: "/operations/initiatives" },
  ];
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      {tiles.map((tile) => (
        <StatCard key={tile.label} {...tile} />
      ))}
    </div>
  );
}

function AgendaItemCard({
  item,
}: {
  item: WeeklyExecutionAgendaSection["items"][number];
}) {
  return (
    <Link
      href={item.href}
      className="card ps-action-card cc-focusable"
      style={{
        display: "grid",
        gap: 8,
        padding: "12px 14px",
        color: "inherit",
        textDecoration: "none",
        borderLeft: "3px solid var(--ypp-purple, #6b21c8)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <strong style={{ fontSize: 14, minWidth: 0 }}>{item.title}</strong>
        {item.dueISO ? <span style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0 }}>{fmt(item.dueISO)}</span> : null}
      </div>
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.45 }}>
        <strong style={{ color: "var(--ypp-ink)" }}>Why: </strong>
        {item.why}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12, color: "var(--text-secondary)" }}>
        <span>Owner: {item.owner ?? "TBD"}</span>
        {item.relatedMeetingTitle ? <span>Meeting: {item.relatedMeetingTitle}</span> : null}
        {item.initiativeTitle ? <span>Initiative: {item.initiativeTitle}</span> : null}
        {item.relatedEntityLabel ? <span>{item.relatedEntityLabel}</span> : null}
      </div>
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.45 }}>
        <strong style={{ color: "var(--ypp-ink)" }}>Question: </strong>
        {item.suggestedDiscussionQuestion}
      </p>
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.45 }}>
        <strong style={{ color: "var(--ypp-ink)" }}>Next: </strong>
        {item.suggestedNextAction}
      </p>
    </Link>
  );
}

export function AgendaBuilder({ sections }: { sections: WeeklyExecutionAgendaSection[] }) {
  const populated = sections.filter((section) => section.items.length > 0);
  if (populated.length === 0) {
    return (
      <OperationsEmptyState title="No urgent agenda items.">
        Nothing is overdue, blocked, or unresolved. Review active initiatives or create a new
        discussion topic for the meeting.
      </OperationsEmptyState>
    );
  }
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {populated.map((section, idx) => (
        <div key={section.id} style={{ display: "grid", gap: 8 }}>
          <h3 className="ps-section-title" style={{ margin: 0, fontSize: 14 }}>
            {idx + 1}. {section.title}
            <span style={{ marginLeft: 8, fontSize: 12, color: "var(--muted)", fontWeight: 400 }}>
              {section.items.length}
            </span>
          </h3>
          <div style={{ display: "grid", gap: 8 }}>
            {section.items.map((item) => (
              <AgendaItemCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function LooseEndsSection({ looseEnds }: { looseEnds: WeeklyExecutionOS["looseEnds"] }) {
  return (
    <OperationsItemList
      items={looseEnds.map(looseEndToOperationsItem)}
      empty={
        <OperationsEmptyState title="No loose ends.">
          Every meeting output has either been resolved or converted into an action.
        </OperationsEmptyState>
      }
    />
  );
}

export function CommunicationNeededSection({
  items,
}: {
  items: WeeklyExecutionOS["communications"];
}) {
  return (
    <OperationsItemList
      items={items.map(communicationToOperationsItem)}
      empty={
        <OperationsEmptyState title="No communications needed.">
          No communications are waiting to be sent.
        </OperationsEmptyState>
      }
    />
  );
}

export function WeeklyRecapPanel({ os }: { os: WeeklyExecutionOS }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <div className="card" style={{ padding: 12 }}>
          <strong style={{ fontSize: 18 }}>{os.recap.completed.length}</strong>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Completed</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <strong style={{ fontSize: 18 }}>{os.recap.newActions.length}</strong>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>New actions</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <strong style={{ fontSize: 18 }}>{os.recap.initiatives.length}</strong>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Initiative updates</div>
        </div>
      </div>
      <textarea
        readOnly
        aria-label="Weekly recap draft"
        value={os.recap.draft}
        rows={18}
        style={{
          width: "100%",
          border: "1px solid var(--border)",
          borderRadius: 8,
          background: "var(--surface)",
          color: "var(--ypp-ink)",
          font: "inherit",
          fontSize: 13,
          lineHeight: 1.55,
          padding: 14,
          resize: "vertical",
        }}
      />
    </div>
  );
}

export function WeeklyExecutionOSView({
  os,
  people,
  currentUserId,
}: {
  os: WeeklyExecutionOS;
  people: PersonOption[];
  currentUserId: string;
}) {
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <section style={{ display: "grid", gap: 10 }}>
        <h2 className="ps-section-title" style={{ margin: 0 }}>
          Top snapshot
        </h2>
        <Snapshot os={os} />
      </section>

      <Stage number={1} title="Build agenda" hint="Before the meeting">
        <AgendaBuilder sections={os.agendaSections} />
      </Stage>

      <Stage number={2} title="Capture meeting" hint="During the meeting">
        <WeeklyMeetingCaptureClient people={people} currentUserId={currentUserId} />
      </Stage>

      <Stage number={3} title="Resolve loose ends" hint="Before you leave the meeting">
        <div style={{ display: "grid", gap: 22, gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", alignItems: "start" }} className="command-center-grid">
          <div style={{ display: "grid", gap: 8 }}>
            <h3 className="ps-section-title" style={{ margin: 0, fontSize: 14 }}>
              Loose ends
            </h3>
            <LooseEndsSection looseEnds={os.looseEnds} />
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <h3 className="ps-section-title" style={{ margin: 0, fontSize: 14 }}>
              Communications needed
            </h3>
            <CommunicationNeededSection items={os.communications} />
          </div>
        </div>
      </Stage>

      <Stage number={4} title="Draft recap" hint="Copy into Slack or email — nothing is sent">
        <WeeklyRecapPanel os={os} />
      </Stage>
    </div>
  );
}
