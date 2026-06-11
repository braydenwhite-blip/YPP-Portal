import Link from "next/link";

import { formatMonthDay } from "@/lib/leadership-action-center/dates";
import {
  actionPrefillToQuery,
  buildActionPrefillFromDecision,
  buildActionPrefillFromMeetingFollowUp,
} from "@/lib/people-strategy/action-prefill";
import { primaryEntityTypeForArea } from "@/lib/people-strategy/operational-context";
import type {
  ActionLite,
  AreaHealthRow,
  DecisionLite,
  MeetingFollowUpLite,
  MeetingLite,
  OperationalDigestCounts,
  OperationalEntityLite,
  OperationalReviewItem,
  OperationalReviewSeverity,
  WeeklyOperationalDigest,
} from "@/lib/people-strategy/operational-digest";

import { EntityLink } from "@/components/operations/entity-link";
import { RELATED_TO_ENTITY_360 } from "@/lib/operations/entity-360";

import { ActionCommandBar } from "./action-command-bar";
import { MeetingOutcomeBadge, OperationalHealthBadge } from "./operational-badges";
import { Pill, type PillTone } from "./pills";
import { StatCard, type StatTone } from "./stat-card";

/**
 * Leadership Command Center — the cockpit components for the YPP Execution OS.
 *
 * Pure presentational SERVER components (no "use client", no data loading): the
 * page owns the feature gate + officer guard + digest load and hands these the
 * already-derived, serializable digest. They compose the shared StatCard / Pill /
 * OperationalHealthBadge primitives so the cockpit looks native, and every
 * section ships a clean, motivating empty state. The data here is real digest
 * state — nothing is mocked or invented in the UI.
 */

const SEVERITY_TONE: Record<OperationalReviewSeverity, PillTone> = {
  critical: "overdue",
  warning: "warning",
  watch: "info",
  neutral: "neutral",
};

const SEVERITY_BORDER: Record<OperationalReviewSeverity, string> = {
  critical: "var(--error-color, #991b1b)",
  warning: "var(--warning-color, #854d0e)",
  watch: "var(--ypp-purple, #6b21c8)",
  neutral: "var(--border, #e5e7eb)",
};

const KIND_LABEL: Record<OperationalReviewItem["kind"], string> = {
  action: "Action",
  meeting: "Meeting",
  decision: "Decision",
  class: "Class",
  instructor: "Instructor",
  person: "Person",
  partner: "Partner",
  mentorship: "Mentorship",
  area: "Area",
};

function fmt(iso: string): string {
  return formatMonthDay(new Date(iso));
}

// --- hero --------------------------------------------------------------------

export function CommandCenterHero({
  windowStartISO,
  generatedAtISO,
  consideredCount,
}: {
  windowStartISO: string;
  generatedAtISO: string;
  consideredCount: number;
}) {
  return (
    <ActionCommandBar
      eyebrow="People Strategy · Leadership"
      title="Command Center"
      subtitle="What's urgent, what's stuck, what's due, and what to review this week — across every part of YPP."
      meta={`Week of ${fmt(windowStartISO)} · generated ${fmt(generatedAtISO)} · based on ${consideredCount} ${
        consideredCount === 1 ? "action" : "actions"
      } you can see`}
      actions={
        <>
          <Link href="/operations/weekly-execution" className="button primary small">
            Run weekly execution meeting
          </Link>
          <Link href="/actions/new" className="button outline small">
            + New action
          </Link>
        </>
      }
    />
  );
}

// --- stat strip ("This Week at YPP") ----------------------------------------

export function OperationalDigestStats({ counts }: { counts: OperationalDigestCounts }) {
  const tiles: Array<{
    label: string;
    value: number;
    tone?: StatTone;
    icon: Parameters<typeof StatCard>[0]["icon"];
    href?: string;
  }> = [
    { label: "Open actions", value: counts.openActions, icon: "list", href: "/actions/all" },
    { label: "Overdue actions", value: counts.overdueActions, tone: counts.overdueActions > 0 ? "danger" : "default", icon: "alert", href: "/actions/all?status=OVERDUE" },
    { label: "Due this week", value: counts.dueSoonActions, icon: "calendar", href: "/actions/all?preset=due_soon" },
    { label: "Blocked items", value: counts.blockedActions, tone: counts.blockedActions > 0 ? "warning" : "default", icon: "flag", href: "/actions/all?status=BLOCKED" },
    { label: "Meetings this week", value: counts.meetingsThisWeek, icon: "users", href: "/actions/meetings" },
    {
      label: "Uncaptured outputs",
      value: counts.decisionsNeedingAction + counts.unconvertedFollowUps,
      tone: counts.decisionsNeedingAction + counts.unconvertedFollowUps > 0 ? "warning" : "default",
      icon: "inbox",
    },
  ];
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      {tiles.map((t) => (
        <StatCard key={t.label} label={t.label} value={t.value} tone={t.tone} icon={t.icon} href={t.href} />
      ))}
    </div>
  );
}

// --- needs-attention / review queue -----------------------------------------

export function NeedsAttentionList({
  items,
  emptyHint = "Nothing needs leadership's attention right now. Everything visible is on track.",
}: {
  items: OperationalReviewItem[];
  emptyHint?: string;
}) {
  if (items.length === 0) {
    return <EmptyCard>{emptyHint} 🎉</EmptyCard>;
  }
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
      {items.map((item, i) => (
        <li key={item.id}>
          <Link
            href={item.href}
            className="card ps-action-card cc-focusable"
            style={{
              display: "block",
              padding: "12px 14px",
              textDecoration: "none",
              color: "inherit",
              borderLeft: `3px solid ${SEVERITY_BORDER[item.severity]}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
              <strong style={{ fontSize: 14, minWidth: 0 }}>
                <span style={{ color: "var(--muted)", fontWeight: 700, marginRight: 8, fontVariantNumeric: "tabular-nums" }}>
                  {i + 1}
                </span>
                {item.title}
              </strong>
              <span style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                <Pill tone="neutral">{KIND_LABEL[item.kind]}</Pill>
                <Pill tone={SEVERITY_TONE[item.severity]}>{item.reason}</Pill>
              </span>
            </div>
            {item.reasons.length > 1 ? (
              <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-secondary)" }}>
                {item.reasons.join(" · ")}
              </div>
            ) : null}
          </Link>
        </li>
      ))}
    </ol>
  );
}

// --- leadership rhythm CTAs --------------------------------------------------

export function LeadershipRhythm() {
  const moves: Array<{ href: string; label: string; primary?: boolean }> = [
    { href: "/operations/weekly-execution", label: "Run weekly execution meeting", primary: true },
    { href: "/actions/all?status=OVERDUE", label: "Review overdue actions" },
    { href: "/actions/meetings", label: "Follow up on meetings" },
    { href: "/actions/meetings?new=1", label: "Schedule a meeting" },
    { href: "/actions/new", label: "Create an action" },
  ];
  return (
    <div className="card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)" }}>
        Keep the operating rhythm — one move at a time.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {moves.map((m) => (
          <Link
            key={m.href + m.label}
            href={m.href}
            className={`button ${m.primary ? "primary" : "outline"} small`}
          >
            {m.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

// --- area health grid --------------------------------------------------------

/** The filtered Action Tracker view for an area, or null when it has no entity. */
export function areaDrilldownHref(area: AreaHealthRow["area"]): string | null {
  const primary = primaryEntityTypeForArea(area);
  return primary ? `/actions/all?rel=${primary}` : null;
}

export function AreaHealthGrid({ rows }: { rows: AreaHealthRow[] }) {
  if (rows.length === 0) {
    return <EmptyCard>No area activity yet — meetings and actions will populate this as they come online.</EmptyCard>;
  }
  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
      }}
    >
      {rows.map((row) => {
        const href = areaDrilldownHref(row.area);
        const inner = (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <strong style={{ fontSize: 14 }}>{row.areaLabel}</strong>
              <OperationalHealthBadge health={row.health} />
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)", display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span>{row.openActions} open</span>
              {row.overdueActions > 0 ? (
                <span style={{ color: "var(--error-color, #991b1b)" }}>{row.overdueActions} overdue</span>
              ) : null}
              <span>{row.meetingCount} mtg</span>
              {row.upcomingMeetings > 0 ? <span>{row.upcomingMeetings} upcoming</span> : null}
              {row.unresolvedFollowUps > 0 ? <span>{row.unresolvedFollowUps} follow-up</span> : null}
            </div>
          </>
        );
        return href ? (
          <Link
            key={row.area}
            href={href}
            className="card cc-focusable"
            style={{ padding: "12px 14px", textDecoration: "none", color: "inherit", display: "block" }}
            title={`Open ${row.areaLabel} actions`}
          >
            {inner}
          </Link>
        ) : (
          <div key={row.area} className="card" style={{ padding: "12px 14px" }}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

// --- Action + Meetings 360 workboard ----------------------------------------

function WorkboardLane({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        minWidth: 0,
        border: "1px solid var(--border, #e5e7eb)",
        borderRadius: 8,
        padding: 12,
        background: "var(--surface, #fff)",
      }}
    >
      <h3 style={{ margin: 0, fontSize: 15 }}>{title}</h3>
      <div style={{ marginTop: 10, display: "grid", gap: 12 }}>{children}</div>
    </section>
  );
}

function WorkboardGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0 }}>
        {title}
      </p>
      {children}
    </div>
  );
}

export function ActionMeetings360Workboard({
  digest,
}: {
  digest: WeeklyOperationalDigest;
}) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--text-secondary)" }}>
        Meetings create decisions. Decisions create actions. This page shows what needs follow-up, who owns it,
        when it is due, and what context created it.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 14,
          alignItems: "start",
        }}
      >
        <WorkboardLane title="Needs attention">
          <WorkboardGroup title="Overdue">
            <ActionUrgencyList
              actions={digest.triage.overdue.slice(0, 4)}
              emptyHint="No overdue actions."
            />
          </WorkboardGroup>
          <WorkboardGroup title="Blocked">
            <ActionUrgencyList
              actions={digest.triage.blocked.slice(0, 4)}
              emptyHint="No blocked actions."
            />
          </WorkboardGroup>
          <WorkboardGroup title="No executor">
            <ActionUrgencyList
              actions={digest.triage.unassigned.slice(0, 4)}
              emptyHint="Everything due this week has an owner."
            />
          </WorkboardGroup>
          <WorkboardGroup title="Unresolved meeting follow-ups">
            <UnresolvedMeetingFollowUpsList items={digest.unresolvedMeetingFollowUps.slice(0, 4)} />
          </WorkboardGroup>
        </WorkboardLane>

        <WorkboardLane title="This week">
          <WorkboardGroup title="Due soon">
            <ActionUrgencyList
              actions={digest.triage.dueSoon.slice(0, 5)}
              emptyHint="Nothing else is due this week."
            />
          </WorkboardGroup>
          <WorkboardGroup title="Upcoming meetings">
            <MeetingContextList
              meetings={digest.upcomingMeetings.slice(0, 4)}
              emptyHint="No meetings are scheduled for this week."
            />
          </WorkboardGroup>
          <WorkboardGroup title="Prep needed">
            <NeedsAttentionList
              items={digest.recommendedReviewOrder.filter((i) => i.kind === "meeting").slice(0, 3)}
              emptyHint="No meeting prep is currently flagged."
            />
          </WorkboardGroup>
        </WorkboardLane>

        <WorkboardLane title="Recently decided">
          <WorkboardGroup title="Decisions without action">
            {digest.decisionsNeedingAction.length === 0 ? (
              <EmptyCard>No unresolved meeting decisions.</EmptyCard>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {digest.decisionsNeedingAction.slice(0, 3).map((d) => (
                  <DecisionFollowThroughCard key={d.id} decision={d} compact />
                ))}
              </div>
            )}
          </WorkboardGroup>
          <WorkboardGroup title="Recent meetings">
            <MeetingContextList
              meetings={digest.recentMeetings.slice(0, 3)}
              emptyHint="Recently completed meetings will show here."
            />
          </WorkboardGroup>
          <WorkboardGroup title="Completed actions">
            <RecentlyResolvedList actions={digest.recentlyCompletedActions.slice(0, 4)} />
          </WorkboardGroup>
        </WorkboardLane>
      </div>
    </div>
  );
}

function MeetingContextList({
  meetings,
  emptyHint,
}: {
  meetings: MeetingLite[];
  emptyHint: string;
}) {
  if (meetings.length === 0) return <EmptyCard>{emptyHint}</EmptyCard>;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {meetings.map((meeting) => (
        <MeetingFollowThroughCard key={meeting.id} meeting={meeting} />
      ))}
    </div>
  );
}

export function meetingFollowUpActionHref(followUp: MeetingFollowUpLite): string {
  return actionPrefillToQuery(
    buildActionPrefillFromMeetingFollowUp({
      followUpId: followUp.id,
      title: followUp.title,
      description: followUp.description,
      meetingId: followUp.meetingId,
      meetingTitle: followUp.meetingTitle,
      meetingCategory: followUp.meetingCategory,
      relatedEntityType: followUp.relatedType,
      relatedEntityId: followUp.relatedId,
      suggestedOwnerId: followUp.ownerId,
      dueDate: followUp.dueISO ? followUp.dueISO.slice(0, 10) : null,
    })
  );
}

export function UnresolvedMeetingFollowUpsList({
  items,
}: {
  items: MeetingFollowUpLite[];
}) {
  if (items.length === 0) {
    return <EmptyCard>No unresolved meeting follow-ups.</EmptyCard>;
  }
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
      {items.map((item) => (
        <li key={item.id}>
          <div
            className="card ps-action-card"
            style={{ padding: "10px 12px", borderLeft: `3px solid ${SEVERITY_BORDER.watch}` }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
              <strong style={{ fontSize: 13.5 }}>{item.title}</strong>
              {item.dueISO ? <span style={{ fontSize: 11, color: "var(--muted)" }}>Due {fmt(item.dueISO)}</span> : null}
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-secondary)", display: "grid", gap: 3 }}>
              <span>{item.meetingTitle} · {fmt(item.meetingStartISO)}</span>
              <span>{item.ownerName ?? "No owner suggested"}{item.relatedLabel ? ` · ${item.relatedLabel}` : ""}</span>
              {item.description ? <span>{item.description}</span> : null}
            </div>
            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link href={meetingFollowUpActionHref(item)} className="button primary small">
                Create action
              </Link>
              <Link href={item.href} className="button outline small">
                Open meeting
              </Link>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

// --- meeting follow-through --------------------------------------------------

export function MeetingFollowThroughCard({ meeting }: { meeting: MeetingLite }) {
  const decisionsNoAction = meeting.decisionCount > 0 && meeting.linkedActionCount === 0;
  const meetingHasHappened = meeting.effectiveStatus !== "upcoming";
  const noOutput = meetingHasHappened && meeting.linkedActionCount === 0 && meeting.decisionCount === 0;
  return (
    <Link
      href={meeting.href}
      className="card ps-action-card cc-focusable"
      style={{ display: "block", padding: "12px 14px", textDecoration: "none", color: "inherit", borderLeft: `3px solid ${meeting.overdueFollowUps > 0 ? SEVERITY_BORDER.critical : SEVERITY_BORDER.watch}` }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <strong style={{ fontSize: 14, minWidth: 0 }}>{meeting.title}</strong>
        <span style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0 }}>{fmt(meeting.startISO)}</span>
      </div>
      <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-secondary)", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span>{meeting.categoryLabel}</span>
        {meeting.facilitatorName ? <span>Facilitator: {meeting.facilitatorName}</span> : null}
        {meeting.attendeeCount > 0 ? <span>{meeting.attendeeCount} attendee{meeting.attendeeCount === 1 ? "" : "s"}</span> : null}
        {meeting.relatedLabel ? <span>{meeting.relatedLabel}</span> : null}
        <MeetingOutcomeBadge outcome={meeting.outcome} />
        {meeting.openFollowUps > 0 ? (
          <span>
            {meeting.openFollowUps} open follow-up{meeting.openFollowUps === 1 ? "" : "s"}
            {meeting.overdueFollowUps > 0 ? (
              <span style={{ color: "var(--error-color, #991b1b)" }}> · {meeting.overdueFollowUps} overdue</span>
            ) : null}
          </span>
        ) : null}
        {decisionsNoAction ? (
          <Pill tone="warning">
            {meeting.decisionCount} decision{meeting.decisionCount === 1 ? "" : "s"}, no action
          </Pill>
        ) : null}
        {noOutput ? <Pill tone="neutral">No action came out of this</Pill> : null}
      </div>
      {meeting.keyDecisions.length > 0 ? (
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)" }}>
          <strong style={{ color: "var(--text-primary, inherit)" }}>Decisions:</strong>{" "}
          {meeting.keyDecisions.join(" · ")}
        </div>
      ) : null}
      {meeting.unconvertedFollowUps.length > 0 ? (
        <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-secondary)" }}>
          <strong style={{ color: "var(--text-primary, inherit)" }}>Not captured:</strong>{" "}
          {meeting.unconvertedFollowUps.map((f) => f.title).join(" · ")}
        </div>
      ) : null}
      {meeting.linkedActionTitles.length > 0 ? (
        <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-secondary)" }}>
          <strong style={{ color: "var(--text-primary, inherit)" }}>Actions created:</strong>{" "}
          {meeting.linkedActionTitles.join(" · ")}
        </div>
      ) : null}
    </Link>
  );
}

// --- decision follow-through -------------------------------------------------

/**
 * Where a "Create action from this decision" CTA should land — a fully prefilled
 * `/actions/new` (title, description, source meeting, related entity) via the
 * shared decision prefill builder, so the form opens ready to save.
 */
export function decisionActionHref(decision: DecisionLite): string {
  return actionPrefillToQuery(
    buildActionPrefillFromDecision({
      decision: decision.decision,
      meetingId: decision.meetingId,
      meetingTitle: decision.meetingTitle,
      relatedEntityType: decision.relatedType,
      relatedEntityId: decision.relatedId,
    })
  );
}

export function DecisionFollowThroughCard({
  decision,
  compact = false,
}: {
  decision: DecisionLite;
  compact?: boolean;
}) {
  return (
    <div className="card" style={{ padding: "12px 14px", borderLeft: `3px solid ${SEVERITY_BORDER.watch}` }}>
      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{decision.decision}</div>
      <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-secondary)" }}>
        {decision.areaLabel}
        {decision.decidedByName ? ` · decided by ${decision.decidedByName}` : ""} · {fmt(decision.createdISO)}
      </div>
      <div style={{ marginTop: compact ? 6 : 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link href={decisionActionHref(decision)} className="button primary small">
          Create action from decision
        </Link>
        <Link href={decision.href} className="button outline small">
          Open meeting
        </Link>
      </div>
    </div>
  );
}

// --- action urgency list -----------------------------------------------------

const ACTION_STATUS_TONE: Record<string, PillTone> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "info",
  BLOCKED: "warning",
  OVERDUE: "overdue",
  COMPLETE: "success",
  DROPPED: "neutral",
};

export function ActionUrgencyList({
  actions,
  emptyHint = "No urgent actions — nicely clear.",
}: {
  actions: ActionLite[];
  emptyHint?: string;
}) {
  if (actions.length === 0) return <EmptyCard>{emptyHint}</EmptyCard>;
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
      {actions.map((a) => (
        <li key={a.id}>
          <Link
            href={a.href}
            className="card ps-action-card cc-focusable"
            style={{
              display: "block",
              padding: "10px 14px",
              textDecoration: "none",
              color: "inherit",
              borderLeft: `3px solid ${a.overdue ? SEVERITY_BORDER.critical : a.blocked ? SEVERITY_BORDER.warning : SEVERITY_BORDER.watch}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
              <strong style={{ fontSize: 13.5, minWidth: 0 }}>{a.title}</strong>
              <Pill tone={ACTION_STATUS_TONE[a.status] ?? "neutral"}>
                {a.overdue ? `Overdue ${a.daysOverdue}d` : a.blocked ? "Blocked" : "Due " + fmt(a.dueISO)}
              </Pill>
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-secondary)" }}>
              {a.ownerName ?? "Unassigned"}
              {a.unassigned ? " · no executor" : ""}
              {a.relatedLabel ? ` · ${a.relatedTypeLabel}: ${a.relatedLabel}` : ""}
              {a.sourceMeetingTitle ? ` · from ${a.sourceMeetingTitle}` : ""}
            </div>
            {a.contextSummary ? (
              <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-secondary)" }}>
                {a.contextSummary}
              </div>
            ) : null}
            {a.latestUpdate ? (
              <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-secondary)" }}>
                Latest: {a.latestUpdate}
              </div>
            ) : null}
            {a.nextStep ? (
              <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-secondary)" }}>
                Next: {a.nextStep}
              </div>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

// --- recently resolved (momentum) -------------------------------------------

export function RecentlyResolvedList({ actions }: { actions: ActionLite[] }) {
  if (actions.length === 0) {
    return <EmptyCard>Completed work will show here as the week progresses.</EmptyCard>;
  }
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
      {actions.map((a) => (
        <li key={a.id}>
          <Link
            href={a.href}
            className="card ps-action-card cc-focusable"
            style={{ display: "block", padding: "10px 14px", textDecoration: "none", color: "inherit", borderLeft: "3px solid var(--success-color, #16a34a)" }}
          >
            <div style={{ fontSize: 13, fontWeight: 600 }}>✓ {a.title}</div>
            <div style={{ marginTop: 2, fontSize: 12, color: "var(--text-secondary)" }}>
              {a.ownerName ?? "—"}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// --- critical / stale entity list -------------------------------------------

export function EntityHealthList({
  entities,
  emptyHint,
}: {
  entities: OperationalEntityLite[];
  emptyHint: string;
}) {
  if (entities.length === 0) return <EmptyCard>{emptyHint}</EmptyCard>;
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
      {entities.map((e) => {
        const inner = (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <strong style={{ fontSize: 13.5, minWidth: 0 }}>{e.label}</strong>
              <OperationalHealthBadge health={e.health} />
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-secondary)", display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span>{e.typeLabel}</span>
              {e.overdueActions > 0 ? (
                <span style={{ color: "var(--error-color, #991b1b)" }}>{e.overdueActions} overdue</span>
              ) : null}
              <span>{e.openActions} open</span>
              <span>
                {e.daysSinceLastMeeting == null
                  ? "no meeting on record"
                  : `${e.daysSinceLastMeeting}d since meeting`}
              </span>
            </div>
          </>
        );
        const drawerType = RELATED_TO_ENTITY_360[e.type];
        const cardStyle: React.CSSProperties = {
          display: "block",
          padding: "10px 14px",
          textDecoration: "none",
          color: "inherit",
          borderLeft: `3px solid ${e.health.level === "critical" ? SEVERITY_BORDER.critical : SEVERITY_BORDER.warning}`,
        };
        return (
          <li key={e.refKey}>
            {drawerType ? (
              // Opens the entity's 360 panel in place (falls back to its page).
              <EntityLink
                type={drawerType}
                id={e.id}
                href={e.href ?? undefined}
                className="card ps-action-card cc-focusable"
                style={cardStyle}
              >
                {inner}
              </EntityLink>
            ) : e.href ? (
              <Link
                href={e.href}
                className="card ps-action-card cc-focusable"
                style={cardStyle}
              >
                {inner}
              </Link>
            ) : (
              <div
                className="card"
                style={{ padding: "10px 14px", borderLeft: `3px solid ${e.health.level === "critical" ? SEVERITY_BORDER.critical : SEVERITY_BORDER.warning}` }}
              >
                {inner}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// --- shared bits -------------------------------------------------------------

export function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 16, fontSize: 13, color: "var(--text-secondary)" }}>
      {children}
    </div>
  );
}

export function CommandCenterSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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

/** Shown when the org is calm — motivating, never broken-looking. */
export function CommandCenterAllClear({
  upcomingMeetings,
  recentlyCompleted,
}: {
  upcomingMeetings: MeetingLite[];
  recentlyCompleted: ActionLite[];
}) {
  return (
    <section className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <h2 className="section-title" style={{ margin: 0 }}>
          Everything looks under control ✨
        </h2>
        <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--text-secondary)" }}>
          Nothing is overdue and no part of YPP is in the red. Keep the momentum going.
        </p>
      </div>
      {upcomingMeetings.length > 0 ? (
        <div>
          <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, color: "var(--muted)" }}>
            Coming up
          </p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
            {upcomingMeetings.slice(0, 4).map((m) => (
              <li key={m.id} style={{ fontSize: 13 }}>
                <Link href={m.href} style={{ color: "inherit", fontWeight: 600 }}>
                  {m.title}
                </Link>
                <span style={{ color: "var(--text-secondary)" }}> · {fmt(m.startISO)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {recentlyCompleted.length > 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
          {recentlyCompleted.length} action{recentlyCompleted.length === 1 ? "" : "s"} completed recently — nice work.
        </p>
      ) : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link href="/operations/weekly-execution" className="button primary small">
          Run weekly execution meeting
        </Link>
        <Link href="/actions/new" className="button outline small">
          Create an action
        </Link>
        <Link href="/admin/classes" className="button outline small">
          Review classes
        </Link>
      </div>
    </section>
  );
}
