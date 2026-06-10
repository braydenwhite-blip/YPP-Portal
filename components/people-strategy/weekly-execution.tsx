import Link from "next/link";

import { formatMonthDay } from "@/lib/leadership-action-center/dates";
import type {
  CommunicationNeededItem,
  InitiativeAttentionItem,
  MeetingLooseEnd,
  WeeklyExecutionAgendaSection,
  WeeklyExecutionOS,
} from "@/lib/people-strategy/weekly-execution";
import { EmptyCard } from "./command-center-os";
import { WeeklyMeetingCaptureClient } from "./weekly-meeting-capture-client";
import { Pill, type PillTone } from "./pills";
import { StatCard, type StatTone } from "./stat-card";

type PersonOption = { id: string; name: string };

function fmt(iso: string | null): string {
  return iso ? formatMonthDay(new Date(iso)) : "No date";
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h2 className="ps-section-title" style={{ margin: 0 }}>
          {title}
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
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {sections.map((section, idx) => (
        <div key={section.id} style={{ display: "grid", gap: 8 }}>
          <h3 className="ps-section-title" style={{ margin: 0, fontSize: 14 }}>
            {idx + 1}. {section.title}
          </h3>
          {section.items.length > 0 ? (
            <div style={{ display: "grid", gap: 8 }}>
              {section.items.map((item) => (
                <AgendaItemCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <EmptyCard>No items in this section right now.</EmptyCard>
          )}
        </div>
      ))}
    </div>
  );
}

function InitiativeAttentionCard({ item }: { item: InitiativeAttentionItem }) {
  return (
    <Link
      href={item.href}
      className="card ps-action-card cc-focusable"
      style={{ display: "grid", gap: 7, padding: "12px 14px", textDecoration: "none", color: "inherit", borderLeft: "3px solid var(--warning-color, #854d0e)" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <strong style={{ fontSize: 14 }}>{item.title}</strong>
        <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Pill tone="warning">{item.status}</Pill>
          <Pill tone="neutral">{item.priority}</Pill>
        </span>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        Owner: {item.owner ?? "TBD"}
        {item.currentMilestone ? ` - Current milestone: ${item.currentMilestone}` : ""}
      </div>
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.45 }}>{item.why}</p>
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.45 }}>
        <strong style={{ color: "var(--ypp-ink)" }}>Leadership question: </strong>
        {item.suggestedDiscussionQuestion}
      </p>
    </Link>
  );
}

export function InitiativesAttentionSection({ items }: { items: InitiativeAttentionItem[] }) {
  if (items.length === 0) return <EmptyCard>No strategic initiatives need officer discussion right now.</EmptyCard>;
  return (
    <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
      {items.slice(0, 6).map((item) => (
        <InitiativeAttentionCard key={item.id} item={item} />
      ))}
    </div>
  );
}

const LOOSE_TONE: Record<MeetingLooseEnd["kind"], PillTone> = {
  decision: "warning",
  follow_up: "info",
  missing_owner: "overdue",
  missing_due_date: "warning",
  communication: "purple",
};

function LooseEndCard({ item }: { item: MeetingLooseEnd }) {
  return (
    <Link href={item.href} className="card cc-focusable" style={{ display: "block", padding: "11px 13px", color: "inherit", textDecoration: "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <strong style={{ fontSize: 13.5 }}>{item.title}</strong>
        <Pill tone={LOOSE_TONE[item.kind]}>{item.kind.replace(/_/g, " ")}</Pill>
      </div>
      <div style={{ marginTop: 5, fontSize: 12, color: "var(--text-secondary)" }}>
        {item.why} {item.meetingTitle ? `- ${item.meetingTitle}` : ""} - Owner: {item.owner ?? "TBD"}
        {item.dueISO ? ` - Due ${fmt(item.dueISO)}` : ""}
      </div>
    </Link>
  );
}

export function LooseEndsSection({ looseEnds }: { looseEnds: MeetingLooseEnd[] }) {
  if (looseEnds.length === 0) {
    return <EmptyCard>No loose ends are currently surfaced from recent meetings.</EmptyCard>;
  }
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {looseEnds.map((item) => (
        <LooseEndCard key={item.id} item={item} />
      ))}
    </div>
  );
}

function CommunicationCard({ item }: { item: CommunicationNeededItem }) {
  return (
    <Link href={item.href} className="card cc-focusable" style={{ display: "grid", gap: 7, padding: "11px 13px", color: "inherit", textDecoration: "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <strong style={{ fontSize: 13.5 }}>{item.contactLabel} - {item.title}</strong>
        <Pill tone="purple">{item.audience}</Pill>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)" }}>{item.why}</p>
      <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.45 }}>
        <strong style={{ color: "var(--ypp-ink)" }}>Suggested message: </strong>
        {item.suggestedMessage}
      </p>
      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Owner: {item.owner ?? "TBD"}</div>
    </Link>
  );
}

export function CommunicationNeededSection({ items }: { items: CommunicationNeededItem[] }) {
  if (items.length === 0) return <EmptyCard>No communication items are currently surfaced.</EmptyCard>;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {items.map((item) => (
        <CommunicationCard key={item.id} item={item} />
      ))}
    </div>
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
      <Section title="Top snapshot">
        <Snapshot os={os} />
      </Section>

      <Section title="Agenda" hint="Before the meeting">
        <AgendaBuilder sections={os.agendaSections} />
      </Section>

      <Section title="Initiatives Needing Attention" hint={`${os.initiativesNeedingAttention.length}`}>
        <InitiativesAttentionSection items={os.initiativesNeedingAttention} />
      </Section>

      <Section title="Meeting Capture" hint="During the meeting">
        <WeeklyMeetingCaptureClient people={people} currentUserId={currentUserId} />
      </Section>

      <div style={{ display: "grid", gap: 22, gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", alignItems: "start" }} className="command-center-grid">
        <Section title="Loose Ends" hint="Before you leave">
          <LooseEndsSection looseEnds={os.looseEnds} />
        </Section>

        <Section title="Communication Needed" hint={`${os.communications.length}`}>
          <CommunicationNeededSection items={os.communications} />
        </Section>
      </div>

      <Section title="Weekly Recap" hint="Copy into Slack or email">
        <WeeklyRecapPanel os={os} />
      </Section>
    </div>
  );
}
