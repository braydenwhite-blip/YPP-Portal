import Link from "next/link";

import { formatMonthDay } from "@/lib/leadership-action-center/dates";
import {
  INITIATIVE_HEALTH_META,
  INITIATIVE_MOMENTUM_META,
  INITIATIVE_OWNERSHIP_META,
  INITIATIVE_RISK_META,
  type InitiativeHealth,
  type InitiativeMomentum,
  type InitiativeOwnership,
  type InitiativeRisk,
} from "@/lib/people-strategy/strategic-initiative-health";
import {
  MILESTONE_STATUS_META,
  type InitiativeMilestoneSummary,
} from "@/lib/people-strategy/strategic-milestones";
import {
  recommendationKindLabel,
  type InitiativeRecommendation,
  type RecommendationSeverity,
} from "@/lib/people-strategy/strategic-recommendations";
import type {
  StrategicTimeline,
  StrategicTimelineEvent,
  StrategicTimelineSeverity,
} from "@/lib/people-strategy/strategic-timeline";
import type {
  InitiativeSummary,
  PortfolioStats,
  RecentMilestone,
  StrategicRisk,
  UpcomingMilestone,
} from "@/lib/people-strategy/strategic-initiative-summary";
import type {
  StrategicMap,
  StrategicMapAreaNode,
  StrategicMapInitiativeNode,
} from "@/lib/people-strategy/strategic-map";

import { EmptyCard } from "./command-center-os";
import { Pill, type PillTone } from "./pills";
import { StatCard, type StatTone } from "./stat-card";

/**
 * YPP Execution OS — Strategic Initiatives cockpit components (Phase II).
 *
 * Pure presentational SERVER components (no "use client", no data loading): the
 * page owns the feature gate + officer guard + derivation and hands these the
 * already-derived, serializable summaries. Everything rendered is real, derived
 * state — health/momentum/risk/progress/ownership, milestone rollups, the
 * strategic timeline, and recommended next moves — composed from the shared
 * StatCard / Pill primitives so the cockpit looks native. Every section ships a
 * clean empty state, and the layouts wrap for mobile.
 */

function fmt(iso: string): string {
  return formatMonthDay(new Date(iso));
}

// --- badges ------------------------------------------------------------------

const TIMELINE_SEVERITY_BORDER: Record<StrategicTimelineSeverity, string> = {
  critical: "var(--error-color, #991b1b)",
  positive: "var(--success-color, #16a34a)",
  watch: "var(--warning-color, #854d0e)",
  neutral: "var(--border, #e5e7eb)",
};

const TIMELINE_SEVERITY_TONE: Record<StrategicTimelineSeverity, PillTone> = {
  critical: "overdue",
  positive: "success",
  watch: "warning",
  neutral: "neutral",
};

const REC_SEVERITY_TONE: Record<RecommendationSeverity, PillTone> = {
  critical: "overdue",
  warning: "warning",
  watch: "info",
  neutral: "neutral",
};

const REC_SEVERITY_BORDER: Record<RecommendationSeverity, string> = {
  critical: "var(--error-color, #991b1b)",
  warning: "var(--warning-color, #854d0e)",
  watch: "var(--ypp-purple, #6b21c8)",
  neutral: "var(--border, #e5e7eb)",
};

export function InitiativeHealthBadge({ health }: { health: InitiativeHealth }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <Pill tone={health.tone === "neutral" ? "neutral" : health.tone}>{health.label}</Pill>
    </span>
  );
}

export function MomentumBadge({ momentum }: { momentum: InitiativeMomentum }) {
  const meta = INITIATIVE_MOMENTUM_META[momentum.level];
  return <Pill tone={meta.tone}>{meta.label}</Pill>;
}

export function RiskBadge({ risk }: { risk: InitiativeRisk }) {
  const meta = INITIATIVE_RISK_META[risk.level];
  return <Pill tone={meta.tone}>{meta.label}</Pill>;
}

export function OwnershipBadge({ ownership }: { ownership: InitiativeOwnership }) {
  const meta = INITIATIVE_OWNERSHIP_META[ownership.clarity];
  return <Pill tone={meta.tone}>{meta.label}</Pill>;
}

export function MilestoneStatusBadge({ status }: { status: InitiativeMilestoneSummary["status"] }) {
  const meta = MILESTONE_STATUS_META[status];
  return <Pill tone={meta.tone === "neutral" ? "neutral" : meta.tone}>{meta.label}</Pill>;
}

export function ProgressBar({ percent, tone = "var(--ypp-purple, #6b21c8)" }: { percent: number; tone?: string }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{ height: 8, borderRadius: 999, background: "var(--border, #e5e7eb)", overflow: "hidden" }}
    >
      <div style={{ width: `${clamped}%`, height: "100%", background: tone, borderRadius: 999 }} />
    </div>
  );
}

// --- portfolio stat strip ----------------------------------------------------

export function PortfolioStatStrip({ stats }: { stats: PortfolioStats }) {
  const tiles: Array<{ label: string; value: number; tone?: StatTone; icon: Parameters<typeof StatCard>[0]["icon"] }> = [
    { label: "Initiatives", value: stats.total, icon: "target", tone: "accent" },
    { label: "Healthy", value: stats.healthy, icon: "check", tone: "success" },
    { label: "Drifting", value: stats.needsAttention, icon: "activity", tone: stats.needsAttention > 0 ? "warning" : "default" },
    { label: "At risk", value: stats.atRisk, icon: "alert", tone: stats.atRisk > 0 ? "warning" : "default" },
    { label: "Critical", value: stats.critical, icon: "alert", tone: stats.critical > 0 ? "danger" : "default" },
    { label: "Overdue actions", value: stats.overdueActions, icon: "clock", tone: stats.overdueActions > 0 ? "danger" : "default" },
    { label: "Milestones done", value: stats.milestonesComplete, icon: "flag", tone: "success" },
  ];
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      {tiles.map((t) => (
        <StatCard key={t.label} label={t.label} value={t.value} tone={t.tone} icon={t.icon} />
      ))}
    </div>
  );
}

// --- initiative card (index + dashboard lists) ------------------------------

export function InitiativeCard({ initiative }: { initiative: InitiativeSummary }) {
  const i = initiative;
  const topRec = i.recommendations[0];
  return (
    <Link
      href={i.href}
      className="card ps-action-card cc-focusable"
      style={{
        display: "block",
        padding: 16,
        textDecoration: "none",
        color: "inherit",
        borderLeft: `4px solid ${healthBorder(i.health)}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <strong style={{ fontSize: 15, minWidth: 0 }}>{i.title}</strong>
        <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <InitiativeHealthBadge health={i.health} />
          <Pill tone="neutral">{i.areaLabel}</Pill>
        </span>
      </div>
      <p style={{ margin: "6px 0 10px", fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
        {i.description}
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <ProgressBar percent={i.progress.percent} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
          {i.progress.percent}%
        </span>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <MomentumBadge momentum={i.momentum} />
        <RiskBadge risk={i.risk} />
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          {i.owner ? `Owner: ${i.owner}` : "No owner"}
        </span>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)", display: "flex", gap: 10, flexWrap: "wrap" }}>
        <span>{i.counts.openActions} open</span>
        {i.counts.overdueActions > 0 ? (
          <span style={{ color: "var(--error-color, #991b1b)" }}>{i.counts.overdueActions} overdue</span>
        ) : null}
        <span>{i.counts.milestonesComplete}/{i.counts.milestonesTotal} milestones</span>
        {i.counts.upcomingMeetings > 0 ? <span>{i.counts.upcomingMeetings} upcoming mtg</span> : null}
      </div>

      {topRec ? (
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-secondary)", borderTop: "1px solid var(--border, #eee)", paddingTop: 8 }}>
          <span style={{ fontWeight: 700, color: "var(--ypp-purple, #6b21c8)" }}>Next: </span>
          {topRec.title} — {topRec.detail}
        </div>
      ) : null}
    </Link>
  );
}

function healthBorder(health: InitiativeHealth): string {
  switch (health.level) {
    case "critical":
      return "var(--error-color, #991b1b)";
    case "at_risk":
      return "var(--warning-color, #854d0e)";
    case "drifting":
      return "var(--ypp-purple, #6b21c8)";
    case "completed":
      return "var(--success-color, #16a34a)";
    case "archived":
      return "var(--border, #9ca3af)";
    default:
      return "var(--success-color, #16a34a)";
  }
}

export function InitiativeCardGrid({
  initiatives,
  emptyHint = "No initiatives to show.",
}: {
  initiatives: InitiativeSummary[];
  emptyHint?: string;
}) {
  if (initiatives.length === 0) return <EmptyCard>{emptyHint}</EmptyCard>;
  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
      {initiatives.map((i) => (
        <InitiativeCard key={i.id} initiative={i} />
      ))}
    </div>
  );
}

// --- compact initiative row (dashboard sections) ----------------------------

export function InitiativeMiniRow({ initiative, note }: { initiative: InitiativeSummary; note?: string }) {
  const i = initiative;
  return (
    <Link
      href={i.href}
      className="card cc-focusable"
      style={{
        display: "block",
        padding: "10px 14px",
        textDecoration: "none",
        color: "inherit",
        borderLeft: `3px solid ${healthBorder(i.health)}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <strong style={{ fontSize: 13.5, minWidth: 0 }}>{i.title}</strong>
        <InitiativeHealthBadge health={i.health} />
      </div>
      <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-secondary)" }}>
        {note ?? i.healthExplanation.headline}
      </div>
    </Link>
  );
}

// --- summary panel (detail top) ---------------------------------------------

export function InitiativeSummaryPanel({ initiative }: { initiative: InitiativeSummary }) {
  const i = initiative;
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="card" style={{ padding: 16, borderLeft: `4px solid ${healthBorder(i.health)}` }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <InitiativeHealthBadge health={i.health} />
          <MomentumBadge momentum={i.momentum} />
          <RiskBadge risk={i.risk} />
          <OwnershipBadge ownership={i.ownership} />
          <Pill tone="purple">{i.priorityLabel}</Pill>
          <Pill tone="neutral">{i.statusLabel}</Pill>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 13.5, lineHeight: 1.5 }}>{i.healthExplanation.headline}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <ProgressBar percent={i.progress.percent} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{i.progress.percent}%</span>
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-secondary)" }}>
          {i.progress.completedActions}/{i.progress.totalTracked} actions complete · {i.counts.milestonesComplete}/
          {i.counts.milestonesTotal} milestones · owner {i.owner ?? "unassigned"}
          {i.targetDateISO ? ` · target ${fmt(i.targetDateISO)}` : ""}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <StatCard label="Open actions" value={i.counts.openActions} icon="layers" tone="accent" />
        <StatCard label="Overdue" value={i.counts.overdueActions} icon="clock" tone={i.counts.overdueActions > 0 ? "danger" : "default"} />
        <StatCard label="Blocked" value={i.counts.blockedActions} icon="alert" tone={i.counts.blockedActions > 0 ? "warning" : "default"} />
        <StatCard label="Meetings" value={i.counts.meetingCount} icon="calendar" />
        <StatCard label="Open follow-ups" value={i.counts.openFollowUps} icon="flag" tone={i.counts.openFollowUps > 0 ? "warning" : "default"} />
        <StatCard label="Decisions to convert" value={i.counts.decisionsWithoutAction} icon="check" tone={i.counts.decisionsWithoutAction > 0 ? "warning" : "default"} />
      </div>
    </div>
  );
}

export function InitiativeWeeklyOperatingView({ initiative }: { initiative: InitiativeSummary }) {
  const currentMilestone = initiative.milestones.find((m) => m.status !== "complete");
  const topRecommendation = initiative.recommendations[0];
  const blockers = [
    initiative.counts.blockedActions > 0
      ? `${initiative.counts.blockedActions} blocked action${initiative.counts.blockedActions === 1 ? "" : "s"}`
      : null,
    initiative.counts.overdueActions > 0
      ? `${initiative.counts.overdueActions} overdue action${initiative.counts.overdueActions === 1 ? "" : "s"}`
      : null,
    ...initiative.risk.factors.slice(0, 2).map((factor) => factor.label),
  ].filter(Boolean) as string[];
  const communicationNeeded =
    /partner|instructor|parent|applicant|mentor|communication|curriculum/i.test(
      `${initiative.title} ${initiative.description} ${initiative.healthExplanation.headline}`
    ) || initiative.counts.openFollowUps > 0;

  return (
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
      <OperatingTile title="Current Focus">
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          {currentMilestone ? currentMilestone.title : "Define the next milestone."}
        </p>
        <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.45 }}>
          {topRecommendation ? topRecommendation.detail : initiative.healthExplanation.suggestedNextSteps[0] ?? "Confirm the next owner and next step."}
        </p>
      </OperatingTile>

      <OperatingTile title="Open Actions">
        <MetricLine label="Open" value={initiative.counts.openActions} />
        <MetricLine label="Overdue" value={initiative.counts.overdueActions} danger />
        <MetricLine label="Blocked" value={initiative.counts.blockedActions} warning />
        <MetricLine label="No owner" value={initiative.counts.unassignedActions} warning />
      </OperatingTile>

      <OperatingTile title="Meetings & Decisions">
        <MetricLine label="Recent meetings" value={initiative.counts.meetingCount} />
        <MetricLine label="Upcoming" value={initiative.counts.upcomingMeetings} />
        <MetricLine label="Open follow-ups" value={initiative.counts.openFollowUps} warning />
        <MetricLine label="Decisions to convert" value={initiative.counts.decisionsWithoutAction} warning />
      </OperatingTile>

      <OperatingTile title="Risks / Blockers">
        {blockers.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text-secondary)", fontSize: 12.5, lineHeight: 1.5 }}>
            {blockers.slice(0, 4).map((blocker, index) => (
              <li key={`${blocker}-${index}`}>{blocker}</li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
            No blockers are currently surfaced.
          </p>
        )}
      </OperatingTile>

      <OperatingTile title="Communication Needed">
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          {communicationNeeded
            ? `Send a status update about ${initiative.title} and confirm the next owner.`
            : "No communication item is currently surfaced."}
        </p>
      </OperatingTile>

      <OperatingTile title="Timeline">
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          {initiative.timeline.events.length} timeline event{initiative.timeline.events.length === 1 ? "" : "s"} captured from meetings, decisions, actions, and milestones.
        </p>
        <Link href="#timeline" style={{ marginTop: 8, display: "inline-flex", fontSize: 12, fontWeight: 700, color: "var(--ypp-purple, #6b21c8)" }}>
          Review timeline
        </Link>
      </OperatingTile>
    </div>
  );
}

function OperatingTile({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 14, display: "grid", gap: 8, alignContent: "start" }}>
      <h3 style={{ margin: 0, fontSize: 13.5 }}>{title}</h3>
      {children}
    </div>
  );
}

function MetricLine({
  label,
  value,
  danger,
  warning,
}: {
  label: string;
  value: number;
  danger?: boolean;
  warning?: boolean;
}) {
  const color = danger
    ? "var(--error-color, #991b1b)"
    : warning
      ? "var(--warning-color, #854d0e)"
      : "var(--text-secondary)";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, color }}>
      <span>{label}</span>
      <strong style={{ fontVariantNumeric: "tabular-nums" }}>{value}</strong>
    </div>
  );
}

// --- milestones (Phase D view) ----------------------------------------------

export function MilestoneList({ milestones }: { milestones: InitiativeMilestoneSummary[] }) {
  if (milestones.length === 0) {
    return <EmptyCard>No milestones defined for this initiative yet.</EmptyCard>;
  }
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
      {milestones.map((m, idx) => (
        <li key={m.id} id={`milestone-${m.id}`}>
          <div className="card" style={{ padding: 14, borderLeft: `3px solid ${milestoneBorder(m)}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <strong style={{ fontSize: 14 }}>
                <span style={{ color: "var(--muted)", fontWeight: 700, marginRight: 8, fontVariantNumeric: "tabular-nums" }}>
                  {idx + 1}
                </span>
                {m.title}
              </strong>
              <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <MilestoneStatusBadge status={m.status} />
                {m.behindSchedule ? <Pill tone="overdue">Behind schedule</Pill> : null}
              </span>
            </div>
            {m.description ? (
              <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--text-secondary)" }}>{m.description}</p>
            ) : null}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <div style={{ flex: 1 }}>
                <ProgressBar percent={m.percent} tone={milestoneBorder(m)} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                {m.percent}%
              </span>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)", display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span>{m.completedActions}/{m.totalActions} actions</span>
              {m.openActions > 0 ? <span>{m.openActions} open</span> : null}
              {m.overdueActions > 0 ? (
                <span style={{ color: "var(--error-color, #991b1b)" }}>{m.overdueActions} overdue</span>
              ) : null}
              {m.blockedActions > 0 ? <span>{m.blockedActions} blocked</span> : null}
              {m.ownerName ? <span>owner {m.ownerName}</span> : null}
              {m.targetDateISO ? <span>target {fmt(m.targetDateISO)}</span> : null}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function milestoneBorder(m: InitiativeMilestoneSummary): string {
  switch (m.status) {
    case "complete":
      return "var(--success-color, #16a34a)";
    case "blocked":
      return "var(--error-color, #991b1b)";
    case "at_risk":
      return "var(--warning-color, #854d0e)";
    case "in_progress":
      return "var(--ypp-purple, #6b21c8)";
    default:
      return "var(--border, #9ca3af)";
  }
}

// --- strategic timeline (Phase C view) --------------------------------------

const TIMELINE_KIND_LABEL: Record<StrategicTimelineEvent["type"], string> = {
  initiative_created: "Created",
  meeting: "Meeting",
  decision: "Decision",
  action_created: "Action",
  action_completed: "Completed",
  milestone_reached: "Milestone",
  follow_up: "Follow-up",
  target: "Target",
};

function TimelineRow({ event }: { event: StrategicTimelineEvent }) {
  return (
    <li>
      <Link
        href={event.href}
        className="cc-focusable"
        style={{
          display: "block",
          textDecoration: "none",
          color: "inherit",
          padding: "8px 12px",
          borderLeft: `3px solid ${TIMELINE_SEVERITY_BORDER[event.severity]}`,
          background: "var(--surface, #fff)",
          borderRadius: 8,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
          <span style={{ display: "flex", gap: 8, alignItems: "baseline", minWidth: 0 }}>
            <Pill tone={TIMELINE_SEVERITY_TONE[event.severity]}>{TIMELINE_KIND_LABEL[event.type]}</Pill>
            <strong style={{ fontSize: 13, minWidth: 0 }}>{event.title}</strong>
          </span>
          <span style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0 }}>{fmt(event.occurredAtISO)}</span>
        </div>
        <div style={{ marginTop: 3, fontSize: 12, color: "var(--text-secondary)" }}>
          {event.explanation}
          {event.entity ? ` · ${event.entity.label}` : ""}
        </div>
      </Link>
    </li>
  );
}

export function StrategicTimelineView({
  timeline,
  showUpcoming = true,
}: {
  timeline: StrategicTimeline;
  showUpcoming?: boolean;
}) {
  if (timeline.events.length === 0 && timeline.upcoming.length === 0) {
    return <EmptyCard>No timeline events yet — meetings, decisions, and completed work will appear here.</EmptyCard>;
  }
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {showUpcoming && timeline.upcoming.length > 0 ? (
        <div>
          <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, color: "var(--muted)" }}>
            Coming up
          </p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
            {timeline.upcoming.map((e) => (
              <TimelineRow key={e.id} event={e} />
            ))}
          </ul>
        </div>
      ) : null}
      <div>
        {showUpcoming && timeline.upcoming.length > 0 ? (
          <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, color: "var(--muted)" }}>
            History
          </p>
        ) : null}
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
          {timeline.events.map((e) => (
            <TimelineRow key={e.id} event={e} />
          ))}
        </ul>
      </div>
    </div>
  );
}

// --- recommendations (Phase I view) -----------------------------------------

export function RecommendationsList({ recommendations }: { recommendations: InitiativeRecommendation[] }) {
  if (recommendations.length === 0) {
    return <EmptyCard>No recommended moves right now — this initiative is on track. 🎉</EmptyCard>;
  }
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
      {recommendations.map((r) => (
        <li key={r.id}>
          <Link
            href={r.href}
            className="card ps-action-card cc-focusable"
            style={{
              display: "block",
              padding: "12px 14px",
              textDecoration: "none",
              color: "inherit",
              borderLeft: `3px solid ${REC_SEVERITY_BORDER[r.severity]}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
              <strong style={{ fontSize: 13.5, minWidth: 0 }}>{r.title}</strong>
              <span style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                <Pill tone="neutral">{recommendationKindLabel(r.kind)}</Pill>
                <Pill tone={REC_SEVERITY_TONE[r.severity]}>Do next</Pill>
              </span>
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-secondary)" }}>{r.detail}</div>
          </Link>
        </li>
      ))}
    </ol>
  );
}

// --- risk + ownership panels -------------------------------------------------

export function RiskPanel({ risk }: { risk: InitiativeRisk }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <strong style={{ fontSize: 13.5 }}>Risk</strong>
        <RiskBadge risk={risk} />
      </div>
      {risk.factors.length === 0 ? (
        <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--text-secondary)" }}>
          No active risk factors — nothing is threatening delivery.
        </p>
      ) : (
        <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12.5, color: "var(--text-secondary)", display: "grid", gap: 4 }}>
          {risk.factors.slice(0, 6).map((f) => (
            <li key={f.key}>{f.label}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function OwnershipPanel({ ownership }: { ownership: InitiativeOwnership }) {
  return (
    <div className="card" style={{ padding: 14 }} id="ownership">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <strong style={{ fontSize: 13.5 }}>Ownership</strong>
        <OwnershipBadge ownership={ownership} />
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--text-secondary)" }}>{ownership.reason}</p>
      {ownership.topLeads.length > 0 ? (
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)" }}>
          {ownership.topLeads.map((l) => `${l.name} (${l.openActions})`).join(" · ")}
        </div>
      ) : null}
    </div>
  );
}

export function NextStepsPanel({ steps }: { steps: string[] }) {
  if (steps.length === 0) return null;
  return (
    <div className="card" style={{ padding: 14 }}>
      <strong style={{ fontSize: 13.5 }}>Recommended next steps</strong>
      <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12.5, display: "grid", gap: 4 }}>
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  );
}

// --- executive dashboard section (Phase F) ----------------------------------

function MiniList({
  title,
  hint,
  items,
  empty,
}: {
  title: string;
  hint?: string;
  items: React.ReactNode;
  empty: string;
  children?: React.ReactNode;
}) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <h3 className="ps-section-title" style={{ margin: 0, fontSize: 14 }}>
          {title}
        </h3>
        {hint ? <span style={{ fontSize: 11, color: "var(--muted)" }}>{hint}</span> : null}
      </div>
      {items ?? <EmptyCard>{empty}</EmptyCard>}
    </section>
  );
}

export function StrategicInitiativesSection({
  needingAttention,
  fastestMoving,
  recentMilestones,
  upcomingMilestones,
  strategicRisks,
  leadershipPriorities,
}: {
  needingAttention: InitiativeSummary[];
  fastestMoving: InitiativeSummary[];
  recentMilestones: RecentMilestone[];
  upcomingMilestones: UpcomingMilestone[];
  strategicRisks: StrategicRisk[];
  leadershipPriorities: InitiativeSummary[];
}) {
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <MiniList
          title="Initiatives needing attention"
          hint={`${needingAttention.length}`}
          empty="Every initiative is healthy. 🎉"
          items={
            needingAttention.length > 0 ? (
              <div style={{ display: "grid", gap: 8 }}>
                {needingAttention.slice(0, 5).map((i) => (
                  <InitiativeMiniRow key={i.id} initiative={i} />
                ))}
              </div>
            ) : null
          }
        />
        <MiniList
          title="Fastest moving"
          hint="Momentum"
          empty="Completions will show here as initiatives gain momentum."
          items={
            fastestMoving.length > 0 ? (
              <div style={{ display: "grid", gap: 8 }}>
                {fastestMoving.slice(0, 5).map((i) => (
                  <InitiativeMiniRow
                    key={i.id}
                    initiative={i}
                    note={`${i.momentum.recentlyCompleted} recent win${i.momentum.recentlyCompleted === 1 ? "" : "s"} · ${i.momentum.level}`}
                  />
                ))}
              </div>
            ) : null
          }
        />
      </div>

      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <MiniList
          title="Recently completed milestones"
          empty="Milestones reached will appear here."
          items={
            recentMilestones.length > 0 ? (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
                {recentMilestones.slice(0, 6).map((m) => (
                  <li key={`${m.initiativeId}:${m.title}:${m.occurredAtISO}`} style={{ fontSize: 12.5 }}>
                    <Link href={m.href} style={{ color: "inherit", fontWeight: 600 }}>
                      ✓ {m.title}
                    </Link>
                    <span style={{ color: "var(--text-secondary)" }}> · {m.initiativeTitle} · {fmt(m.occurredAtISO)}</span>
                  </li>
                ))}
              </ul>
            ) : null
          }
        />
        <MiniList
          title="Upcoming major milestones"
          empty="No milestone target dates on the horizon."
          items={
            upcomingMilestones.length > 0 ? (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
                {upcomingMilestones.slice(0, 6).map((m) => (
                  <li key={`${m.initiativeId}:${m.title}`} style={{ fontSize: 12.5 }}>
                    <Link href={m.href} style={{ color: "inherit", fontWeight: 600 }}>
                      {m.title}
                    </Link>
                    <span style={{ color: m.behindSchedule ? "var(--error-color, #991b1b)" : "var(--text-secondary)" }}>
                      {" "}· {m.initiativeTitle} · {m.behindSchedule ? "overdue " : ""}
                      {fmt(m.targetDateISO)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null
          }
        />
      </div>

      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <MiniList
          title="Strategic risks"
          empty="No elevated strategic risks right now."
          items={
            strategicRisks.length > 0 ? (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
                {strategicRisks.slice(0, 6).map((r) => (
                  <li key={r.initiativeId} style={{ fontSize: 12.5 }}>
                    <Link href={r.href} style={{ color: "inherit", fontWeight: 600 }}>
                      {r.initiativeTitle}
                    </Link>
                    <span style={{ color: "var(--text-secondary)" }}> · {r.topFactor}</span>
                  </li>
                ))}
              </ul>
            ) : null
          }
        />
        <MiniList
          title="Leadership priorities"
          empty="No active priorities."
          items={
            leadershipPriorities.length > 0 ? (
              <div style={{ display: "grid", gap: 8 }}>
                {leadershipPriorities.slice(0, 5).map((i) => (
                  <InitiativeMiniRow
                    key={i.id}
                    initiative={i}
                    note={`${i.priorityLabel} · ${i.health.label} · ${i.progress.percent}% complete`}
                  />
                ))}
              </div>
            ) : null
          }
        />
      </div>
    </div>
  );
}

// --- strategic map (Phase G) -------------------------------------------------

const HEALTH_DOT: Record<string, string> = {
  critical: "var(--error-color, #991b1b)",
  at_risk: "var(--warning-color, #854d0e)",
  drifting: "var(--ypp-purple, #6b21c8)",
  healthy: "var(--success-color, #16a34a)",
  completed: "var(--success-color, #16a34a)",
  archived: "var(--border, #9ca3af)",
};

function MapMilestoneRow({ node }: { node: StrategicMapInitiativeNode["milestones"][number] }) {
  return (
    <li style={{ fontSize: 12 }}>
      <Link href={node.href} style={{ color: "inherit" }}>
        <span style={{ color: "var(--text-secondary)" }}>{node.percent}% · </span>
        {node.title}
      </Link>
      <span style={{ color: "var(--text-secondary)" }}> · {node.statusLabel}</span>
    </li>
  );
}

function MapInitiativeNode({ node }: { node: StrategicMapInitiativeNode }) {
  return (
    <details style={{ borderLeft: `3px solid ${HEALTH_DOT[node.healthLevel] ?? "#ccc"}`, paddingLeft: 10 }}>
      <summary style={{ cursor: "pointer", listStyle: "revert" }}>
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Link href={node.href} style={{ fontWeight: 600, color: "inherit", fontSize: 13.5 }}>
            {node.title}
          </Link>
          <Pill tone="neutral">{node.healthLabel}</Pill>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {node.progressPercent}% · {node.milestonesComplete}/{node.milestonesTotal} milestones
            {node.overdueActions > 0 ? ` · ${node.overdueActions} overdue` : ""}
            {node.ownerName ? ` · ${node.ownerName}` : ""}
          </span>
        </span>
      </summary>
      {node.milestones.length > 0 ? (
        <ul style={{ margin: "6px 0 8px", paddingLeft: 18, display: "grid", gap: 3 }}>
          {node.milestones.map((m) => (
            <MapMilestoneRow key={m.id} node={m} />
          ))}
        </ul>
      ) : (
        <p style={{ margin: "6px 0 8px", paddingLeft: 18, fontSize: 12, color: "var(--text-secondary)" }}>
          No milestones defined.
        </p>
      )}
    </details>
  );
}

function MapAreaNode({ node }: { node: StrategicMapAreaNode }) {
  return (
    <details open style={{ borderLeft: `4px solid ${HEALTH_DOT[node.healthLevel] ?? "#ccc"}`, paddingLeft: 12 }} className="card">
      <summary style={{ cursor: "pointer", padding: "10px 0" }}>
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <strong style={{ fontSize: 15 }}>{node.label}</strong>
          <Pill tone="neutral">{node.healthLabel}</Pill>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {node.initiativeCount} initiative{node.initiativeCount === 1 ? "" : "s"} · {node.progressPercent}% avg
            {node.criticalCount > 0 ? ` · ${node.criticalCount} critical` : ""}
            {node.atRiskCount > 0 ? ` · ${node.atRiskCount} at risk` : ""}
          </span>
        </span>
      </summary>
      <div style={{ display: "grid", gap: 8, padding: "4px 0 12px" }}>
        {node.initiatives.map((i) => (
          <MapInitiativeNode key={i.id} node={i} />
        ))}
      </div>
    </details>
  );
}

export function StrategicMapView({ map }: { map: StrategicMap }) {
  if (map.areas.length === 0) {
    return <EmptyCard>No initiatives are populated yet — they will appear here as work comes online.</EmptyCard>;
  }
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="card" style={{ padding: 14 }}>
        <strong style={{ fontSize: 15 }}>YPP</strong>
        <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-secondary)" }}>
          {map.totalInitiatives} initiative{map.totalInitiatives === 1 ? "" : "s"} across {map.areas.length} area
          {map.areas.length === 1 ? "" : "s"}
        </span>
      </div>
      {map.areas.map((a) => (
        <MapAreaNode key={a.area} node={a} />
      ))}
    </div>
  );
}
