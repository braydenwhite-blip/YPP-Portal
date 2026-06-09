import Link from "next/link";

import { formatMonthDay } from "@/lib/leadership-action-center/dates";
import type {
  ActionLite,
  AreaHealthRow,
  DecisionLite,
  MeetingLite,
  OperationalDigestCounts,
  OperationalEntityLite,
  OperationalReviewItem,
  OperationalReviewSeverity,
} from "@/lib/people-strategy/operational-digest";

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
          <Link href="/operations/weekly-review" className="button primary small">
            Open weekly review
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
    { label: "Overdue actions", value: counts.overdueActions, tone: counts.overdueActions > 0 ? "danger" : "default", icon: "alert", href: "/actions/all?status=OVERDUE" },
    { label: "Due soon", value: counts.dueSoonActions, icon: "calendar", href: "/actions/all?preset=due_soon" },
    { label: "Upcoming meetings", value: counts.upcomingMeetings, icon: "calendar", href: "/actions/meetings" },
    { label: "Open follow-ups", value: counts.unresolvedFollowUps, tone: counts.unresolvedFollowUps > 0 ? "warning" : "default", icon: "flag" },
    { label: "Critical areas", value: counts.criticalEntities, tone: counts.criticalEntities > 0 ? "danger" : "default", icon: "target" },
    { label: "Decisions to convert", value: counts.decisionsNeedingAction, tone: counts.decisionsNeedingAction > 0 ? "warning" : "default", icon: "check" },
    { label: "Done this week", value: counts.recentlyCompletedActions, tone: "success", icon: "check", href: "/actions/completion-report" },
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
    { href: "/operations/weekly-review", label: "Open weekly review", primary: true },
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
      {rows.map((row) => (
        <div key={row.area} className="card" style={{ padding: "12px 14px" }}>
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
        </div>
      ))}
    </div>
  );
}

// --- meeting follow-through --------------------------------------------------

export function MeetingFollowThroughCard({ meeting }: { meeting: MeetingLite }) {
  const decisionsNoAction = meeting.decisionCount > 0 && meeting.linkedActionCount === 0;
  const noOutput = meeting.linkedActionCount === 0 && meeting.decisionCount === 0;
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
    </Link>
  );
}

// --- decision follow-through -------------------------------------------------

/** Where a "Create action from this decision" CTA should land (prefilled). */
export function decisionActionHref(decision: DecisionLite): string {
  const params = new URLSearchParams();
  if (decision.relatedType && decision.relatedId) {
    params.set("relatedType", decision.relatedType);
    params.set("relatedId", decision.relatedId);
  }
  params.set("fromMeeting", decision.meetingId);
  params.set("fromDecision", decision.id);
  return `/actions/new?${params.toString()}`;
}

export function DecisionFollowThroughCard({ decision }: { decision: DecisionLite }) {
  return (
    <div className="card" style={{ padding: "12px 14px", borderLeft: `3px solid ${SEVERITY_BORDER.watch}` }}>
      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{decision.decision}</div>
      <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-secondary)" }}>
        {decision.areaLabel}
        {decision.decidedByName ? ` · decided by ${decision.decidedByName}` : ""} · {fmt(decision.createdISO)}
      </div>
      <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
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
              {a.unassigned ? " · no owner" : ""}
            </div>
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
        return (
          <li key={e.refKey}>
            {e.href ? (
              <Link
                href={e.href}
                className="card ps-action-card cc-focusable"
                style={{ display: "block", padding: "10px 14px", textDecoration: "none", color: "inherit", borderLeft: `3px solid ${e.health.level === "critical" ? SEVERITY_BORDER.critical : SEVERITY_BORDER.warning}` }}
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
  hint?: string;
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
        <Link href="/operations/weekly-review" className="button primary small">
          Run a weekly leadership review
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
