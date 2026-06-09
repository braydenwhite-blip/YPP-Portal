import Link from "next/link";

import { formatMonthDay } from "@/lib/leadership-action-center/dates";
import type { InitiativeHealth } from "@/lib/people-strategy/strategic-initiative-health";
import type { InitiativeMilestoneSummary } from "@/lib/people-strategy/strategic-milestones";
import {
  PROJECT_CONFIDENCE_META,
  type ProjectBlocker,
  type ProjectConfidence,
} from "@/lib/people-strategy/strategic-project-health";
import type {
  ProjectNextMove,
  ProjectPortfolioStats,
  ProjectSummary,
} from "@/lib/people-strategy/strategic-project-summary";
import type {
  ProjectActionIntelligence,
  ProjectDependencyView,
  ProjectMeetingIntelligence,
} from "@/lib/people-strategy/strategic-project-timeline";
import {
  deriveProjectCta,
  deriveProjectStakes,
  type ProjectAttentionItem,
  type ProjectAttentionSeverity,
} from "@/lib/people-strategy/strategic-project-attention";

import { EmptyCard } from "./command-center-os";
import { Pill, type PillTone } from "./pills";
import { StatCard, type StatTone } from "./stat-card";
import {
  InitiativeHealthBadge,
  MilestoneStatusBadge,
  MomentumBadge,
  OwnershipBadge,
  ProgressBar,
  RiskBadge,
} from "./strategic-initiatives";

/**
 * YPP Execution OS — Strategic PROJECT cockpit components (3.0).
 *
 * Pure presentational SERVER components: the page owns the gate + officer guard +
 * derivation and hands these the already-derived, serializable {@link
 * ProjectSummary} / dossier shapes. Reuses the 2.0 health / momentum / risk /
 * ownership badges (the types are shared) plus StatCard / Pill, so projects read
 * native next to initiatives. Every panel ships a graceful, honest empty state.
 */

function fmt(iso: string | null): string {
  return iso ? formatMonthDay(new Date(iso)) : "—";
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

const MOVE_BORDER: Record<ProjectNextMove["severity"], string> = {
  critical: "var(--error-color, #991b1b)",
  warning: "var(--warning-color, #854d0e)",
  watch: "var(--ypp-purple, #6b21c8)",
  neutral: "var(--border, #e5e7eb)",
};

const MOVE_TONE: Record<ProjectNextMove["severity"], PillTone> = {
  critical: "overdue",
  warning: "warning",
  watch: "info",
  neutral: "neutral",
};

// --- badges ------------------------------------------------------------------

export function ProjectConfidenceBadge({ confidence }: { confidence: ProjectConfidence }) {
  const meta = PROJECT_CONFIDENCE_META[confidence.level];
  return (
    <Pill tone={meta.tone === "neutral" ? "neutral" : meta.tone}>
      {meta.label}
      {confidence.score != null ? ` · ${confidence.score}` : ""}
    </Pill>
  );
}

export function DataStateBadge({ project }: { project: ProjectSummary }) {
  if (project.hasWork) return null;
  return <Pill tone="neutral">No tracked work yet</Pill>;
}

export function BlockerBadge({ blocker }: { blocker: ProjectBlocker }) {
  if (blocker.kind === "declared") {
    return <Pill tone={blocker.severity === "high" ? "warning" : "info"}>Declared dependency</Pill>;
  }
  return <Pill tone={blocker.severity === "critical" ? "overdue" : "warning"}>Observed blocker</Pill>;
}

// --- stat strip --------------------------------------------------------------

export function ProjectStatStrip({ stats }: { stats: ProjectPortfolioStats }) {
  const tiles: Array<{ label: string; value: number; tone?: StatTone; icon: Parameters<typeof StatCard>[0]["icon"] }> = [
    { label: "Projects", value: stats.total, icon: "layers", tone: "accent" },
    { label: "Healthy", value: stats.healthy, icon: "check", tone: "success" },
    { label: "Needs attention", value: stats.needsAttention, icon: "activity", tone: stats.needsAttention > 0 ? "warning" : "default" },
    { label: "Critical", value: stats.critical, icon: "alert", tone: stats.critical > 0 ? "danger" : "default" },
    { label: "Blocked", value: stats.blocked, icon: "alert", tone: stats.blocked > 0 ? "warning" : "default" },
    { label: "Unowned", value: stats.unowned, icon: "users", tone: stats.unowned > 0 ? "warning" : "default" },
    { label: "No work yet", value: stats.noWork, icon: "inbox", tone: "default" },
    { label: "Overdue actions", value: stats.overdueActions, icon: "clock", tone: stats.overdueActions > 0 ? "danger" : "default" },
  ];
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      {tiles.map((t) => (
        <StatCard key={t.label} label={t.label} value={t.value} tone={t.tone} icon={t.icon} />
      ))}
    </div>
  );
}

// --- project card ------------------------------------------------------------

export function ProjectCard({ project }: { project: ProjectSummary }) {
  const p = project;
  const topMove = p.nextMoves[0];
  const observed = p.blockers.find((b) => b.kind === "observed");
  return (
    <Link
      href={p.href}
      className="card ps-action-card cc-focusable"
      style={{
        display: "block",
        padding: 16,
        textDecoration: "none",
        color: "inherit",
        borderLeft: `4px solid ${healthBorder(p.health)}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <strong style={{ fontSize: 15, minWidth: 0 }}>{p.title}</strong>
        <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {p.hasWork ? <InitiativeHealthBadge health={p.health} /> : <DataStateBadge project={p} />}
          <ProjectConfidenceBadge confidence={p.confidence} />
        </span>
      </div>

      <div style={{ margin: "4px 0 8px", fontSize: 12, color: "var(--text-secondary)" }}>
        <span style={{ color: "var(--ypp-purple, #6b21c8)", fontWeight: 600 }}>{p.initiativeTitle}</span>
        {" · "}
        {p.areaLabel}
      </div>

      <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>{p.summary}</p>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <ProgressBar percent={p.progress.percent} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
          {p.progress.percent}%
        </span>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {p.hasWork ? <MomentumBadge momentum={p.momentum} /> : null}
        {observed ? <BlockerBadge blocker={observed} /> : null}
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          {p.owner ? `Owner: ${p.owner}` : "No owner"}
        </span>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)", display: "flex", gap: 10, flexWrap: "wrap" }}>
        <span>{p.counts.openActions} open</span>
        {p.counts.overdueActions > 0 ? (
          <span style={{ color: "var(--error-color, #991b1b)" }}>{p.counts.overdueActions} overdue</span>
        ) : null}
        <span>{p.counts.meetingCount} mtg</span>
        {p.counts.decisionsWithoutAction > 0 ? <span>{p.counts.decisionsWithoutAction} decision gap</span> : null}
        <span>moved {fmt(p.lastMovementISO)}</span>
      </div>

      {topMove ? (
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-secondary)", borderTop: "1px solid var(--border, #eee)", paddingTop: 8 }}>
          <span style={{ fontWeight: 700, color: "var(--ypp-purple, #6b21c8)" }}>Next: </span>
          {topMove.title} — {topMove.detail}
        </div>
      ) : null}
    </Link>
  );
}

export function ProjectCardGrid({
  projects,
  emptyHint = "No projects to show.",
}: {
  projects: ProjectSummary[];
  emptyHint?: string;
}) {
  if (projects.length === 0) return <EmptyCard>{emptyHint}</EmptyCard>;
  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} />
      ))}
    </div>
  );
}

// --- attention queue ---------------------------------------------------------

const ATTENTION_BORDER: Record<ProjectAttentionSeverity, string> = {
  critical: "var(--error-color, #991b1b)",
  warning: "var(--warning-color, #854d0e)",
  watch: "var(--ypp-purple, #6b21c8)",
};

const ATTENTION_TONE: Record<ProjectAttentionSeverity, PillTone> = {
  critical: "overdue",
  warning: "warning",
  watch: "info",
};

/**
 * Priority attention queue — the "look here first" rows at the top of the
 * project board. Each numbered row answers, at a glance: why this needs
 * attention, who owns it, what is blocking it, what the next move is, and a
 * single specific CTA. The queue is derived (selectProjectAttentionQueue); this
 * component only renders it.
 */
export function StrategicAttentionQueue({
  items,
  emptyHint,
}: {
  items: ProjectAttentionItem[];
  emptyHint?: string;
}) {
  if (items.length === 0) {
    return (
      <EmptyCard>
        {emptyHint ??
          "No project needs leadership attention right now — nothing is drifting, at risk, blocked, unowned, or stale. New risks surface here the moment the data shows them."}
      </EmptyCard>
    );
  }
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
      {items.map((item, idx) => {
        const p = item.project;
        return (
          <li
            key={p.id}
            className="card"
            style={{ padding: 14, borderLeft: `4px solid ${ATTENTION_BORDER[item.severity]}` }}
          >
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
              <span
                aria-hidden="true"
                style={{
                  flexShrink: 0,
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 800,
                  color: "#fff",
                  background: ATTENTION_BORDER[item.severity],
                }}
              >
                {idx + 1}
              </span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                  <Link href={p.href} style={{ fontWeight: 700, fontSize: 14.5, color: "inherit", textDecoration: "none" }}>
                    {p.title}
                  </Link>
                  <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    {p.hasWork ? <InitiativeHealthBadge health={p.health} /> : <DataStateBadge project={p} />}
                    <Pill tone={ATTENTION_TONE[item.severity]}>{item.severity}</Pill>
                  </span>
                </div>
                <div style={{ marginTop: 2, fontSize: 12, color: "var(--text-secondary)" }}>
                  <span style={{ color: "var(--ypp-purple, #6b21c8)", fontWeight: 600 }}>{p.initiativeTitle}</span>
                  {" · owner "}
                  {p.owner ?? "unassigned"}
                </div>
                <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.5 }}>{item.reason}</p>
                {item.blocker ? (
                  <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--error-color, #991b1b)", lineHeight: 1.5 }}>
                    <strong>Blocker:</strong> {item.blocker}
                  </p>
                ) : null}
                {item.nextMove ? (
                  <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    <strong style={{ color: "var(--ypp-purple, #6b21c8)" }}>Next move:</strong> {item.nextMove}
                  </p>
                ) : null}
              </div>
              <div style={{ alignSelf: "center", flexShrink: 0 }}>
                <Link href={item.cta.href} className="button primary small">
                  {item.cta.label}
                </Link>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function ProjectMiniRow({ project, note }: { project: ProjectSummary; note?: string }) {
  const p = project;
  return (
    <Link
      href={p.href}
      className="card cc-focusable"
      style={{
        display: "block",
        padding: "10px 14px",
        textDecoration: "none",
        color: "inherit",
        borderLeft: `3px solid ${healthBorder(p.health)}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <strong style={{ fontSize: 13.5, minWidth: 0 }}>{p.title}</strong>
        {p.hasWork ? <InitiativeHealthBadge health={p.health} /> : <DataStateBadge project={p} />}
      </div>
      <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-secondary)" }}>
        {note ?? `${p.initiativeTitle} · ${p.statusExplanation.headline}`}
      </div>
    </Link>
  );
}

// --- header panel ------------------------------------------------------------

export function ProjectHeaderPanel({ project }: { project: ProjectSummary }) {
  const p = project;
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="card" style={{ padding: 16, borderLeft: `4px solid ${healthBorder(p.health)}` }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {p.hasWork ? <InitiativeHealthBadge health={p.health} /> : <DataStateBadge project={p} />}
          <ProjectConfidenceBadge confidence={p.confidence} />
          {p.hasWork ? <MomentumBadge momentum={p.momentum} /> : null}
          {p.hasWork ? <RiskBadge risk={p.risk} /> : null}
          <OwnershipBadge ownership={p.ownership} />
          <Pill tone="purple">{p.priorityLabel}</Pill>
          <Pill tone="neutral">{p.statusLabel}</Pill>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 13.5, lineHeight: 1.5 }}>{p.statusExplanation.headline}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <ProgressBar percent={p.progress.percent} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{p.progress.percent}%</span>
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-secondary)" }}>
          <Link href={p.initiativeHref} style={{ color: "var(--ypp-purple, #6b21c8)", fontWeight: 600 }}>
            {p.initiativeTitle}
          </Link>
          {p.workstreamTitles.length > 0 ? ` · ${p.workstreamTitles.join(", ")}` : ""} · owner {p.owner ?? "unassigned"}
          {p.targetDateISO ? ` · target ${fmt(p.targetDateISO)}` : ""} · moved {fmt(p.lastMovementISO)}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <StatCard label="Open actions" value={p.counts.openActions} icon="layers" tone="accent" />
        <StatCard label="Overdue" value={p.counts.overdueActions} icon="clock" tone={p.counts.overdueActions > 0 ? "danger" : "default"} />
        <StatCard label="Blocked" value={p.counts.blockedActions} icon="alert" tone={p.counts.blockedActions > 0 ? "warning" : "default"} />
        <StatCard label="Meetings" value={p.counts.meetingCount} icon="calendar" />
        <StatCard label="Decision gaps" value={p.counts.decisionsWithoutAction} icon="check" tone={p.counts.decisionsWithoutAction > 0 ? "warning" : "default"} />
      </div>
    </div>
  );
}

// --- what matters now --------------------------------------------------------

function WhatMattersFacet({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          fontWeight: 700,
          color: "var(--text-secondary)",
        }}
      >
        {label}
      </div>
      <div style={{ marginTop: 4, fontSize: 13, lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

/**
 * "What matters now" — the single focal panel directly under the project hero.
 * It answers, in one read: what the project is driving, where it stands, the one
 * thing that needs to happen next (with its specific CTA), who needs to act, and
 * what happens if nothing changes. Everything is derived; nothing is invented.
 */
export function ProjectWhatMattersPanel({ project }: { project: ProjectSummary }) {
  const p = project;
  const cta = deriveProjectCta(p);
  const stakes = deriveProjectStakes(p);
  const topMove = p.nextMoves[0];
  return (
    <div
      className="card"
      style={{ padding: 18, borderLeft: `4px solid ${healthBorder(p.health)}`, display: "grid", gap: 16 }}
    >
      <div>
        <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, lineHeight: 1.5 }}>{p.charter.purpose}</p>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55 }}>
          {p.statusExplanation.headline}
        </p>
      </div>

      <div
        style={{
          padding: "12px 14px",
          borderRadius: "var(--radius-md, 12px)",
          background: "var(--ps-accent-soft, rgba(107, 33, 200, 0.06))",
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              fontWeight: 700,
              color: "var(--ypp-purple, #6b21c8)",
            }}
          >
            What needs to happen next
          </div>
          <div style={{ marginTop: 3, fontSize: 13.5, fontWeight: 600 }}>
            {topMove ? topMove.title : "Keep the operating cadence — nothing is urgent right now."}
          </div>
          {topMove ? (
            <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{topMove.detail}</div>
          ) : null}
        </div>
        <Link href={cta.href} className="button primary small" style={{ flexShrink: 0 }}>
          {cta.label}
        </Link>
      </div>

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <WhatMattersFacet label="Who needs to act">
          {p.owner ? (
            <strong>{p.owner}</strong>
          ) : (
            <span style={{ color: "var(--warning-color, #854d0e)", fontWeight: 600 }}>No owner assigned</span>
          )}
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{p.ownership.reason}</div>
        </WhatMattersFacet>
        <WhatMattersFacet label="If nothing changes">
          <span style={{ color: "var(--text-secondary)" }}>{stakes}</span>
        </WhatMattersFacet>
        <WhatMattersFacet label="What success looks like">
          <span style={{ color: "var(--text-secondary)" }}>{p.charter.targetOutcome}</span>
        </WhatMattersFacet>
      </div>
    </div>
  );
}

// --- brief -------------------------------------------------------------------

function BriefBlock({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return (
      <div>
        <strong style={{ fontSize: 12.5 }}>{title}</strong>
        <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--text-secondary)" }}>Not yet defined.</p>
      </div>
    );
  }
  return (
    <div>
      <strong style={{ fontSize: 12.5 }}>{title}</strong>
      <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>
        {items.map((it, idx) => (
          <li key={idx}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

export function ProjectBriefPanel({ project }: { project: ProjectSummary }) {
  const c = project.charter;
  return (
    <div className="card" style={{ padding: 16, display: "grid", gap: 14 }}>
      <div>
        <strong style={{ fontSize: 13 }}>What this is</strong>
        <p style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.55 }}>{c.purpose}</p>
      </div>
      <div>
        <strong style={{ fontSize: 13 }}>Why it matters</strong>
        <p style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.55, color: "var(--text-secondary)" }}>{c.whyItMatters}</p>
      </div>
      <div>
        <strong style={{ fontSize: 13 }}>What success looks like</strong>
        <p style={{ margin: "4px 0 6px", fontSize: 13, lineHeight: 1.55, color: "var(--text-secondary)" }}>{c.targetOutcome}</p>
      </div>
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <BriefBlock title="Success criteria" items={c.successCriteria} />
        <BriefBlock title="In scope" items={c.inScope} />
        <BriefBlock title="Out of scope" items={c.outOfScope} />
        <BriefBlock title="Assumptions" items={c.assumptions} />
        <BriefBlock title="What could kill it" items={c.risks} />
      </div>
    </div>
  );
}

// --- execution spine ---------------------------------------------------------

function SpineNode({ label, sublabel, tone = "neutral" }: { label: string; sublabel?: string; tone?: PillTone }) {
  return (
    <div className="card" style={{ padding: "8px 12px", minWidth: 140 }}>
      <div style={{ marginBottom: 4 }}>
        <Pill tone={tone}>{label}</Pill>
      </div>
      {sublabel ? <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{sublabel}</div> : null}
    </div>
  );
}

export function ProjectExecutionSpine({
  project,
  milestones,
}: {
  project: ProjectSummary;
  milestones: InitiativeMilestoneSummary[];
}) {
  const p = project;
  const stages: Array<{ label: string; sublabel: string; tone: PillTone }> = [
    { label: "Project", sublabel: p.title, tone: "purple" },
    {
      label: "Workstreams",
      sublabel: p.workstreamTitles.length > 0 ? p.workstreamTitles.join(", ") : "None declared",
      tone: "info",
    },
    {
      label: "Milestones",
      sublabel: `${p.counts.milestonesComplete}/${p.counts.milestonesTotal} complete`,
      tone: "neutral",
    },
    { label: "Actions", sublabel: `${p.counts.openActions} open · ${p.counts.completedActions} done`, tone: "neutral" },
    {
      label: "Outcomes",
      sublabel: `${p.counts.completedActions} completed · ${p.counts.milestonesComplete} milestones reached`,
      tone: "success",
    },
  ];
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "stretch", flexWrap: "wrap" }}>
        {stages.map((s, idx) => (
          <div key={s.label} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <SpineNode label={s.label} sublabel={s.sublabel} tone={s.tone} />
            {idx < stages.length - 1 ? <span style={{ color: "var(--text-secondary)" }}>→</span> : null}
          </div>
        ))}
      </div>
      {milestones.length > 0 ? (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
          {milestones.map((m) => (
            <li key={m.id} className="card" style={{ padding: "8px 12px", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 13 }}>{m.title}</span>
              <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{m.percent}%</span>
                <MilestoneStatusBadge status={m.status} />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyCard>No milestones roll up to this project yet — it tracks at the action level.</EmptyCard>
      )}
    </div>
  );
}

// --- next moves + confidence + blockers --------------------------------------

export function ProjectNextMovesPanel({ moves }: { moves: ProjectNextMove[] }) {
  if (moves.length === 0) return <EmptyCard>Nothing urgent — keep the cadence.</EmptyCard>;
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
      {moves.map((m) => (
        <li key={m.id}>
          <Link
            href={m.href}
            className="card cc-focusable"
            style={{ display: "block", padding: "10px 14px", textDecoration: "none", color: "inherit", borderLeft: `3px solid ${MOVE_BORDER[m.severity]}` }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
              <strong style={{ fontSize: 13 }}>{m.title}</strong>
              <Pill tone={MOVE_TONE[m.severity]}>{m.severity}</Pill>
            </div>
            <div style={{ marginTop: 3, fontSize: 12, color: "var(--text-secondary)" }}>{m.detail}</div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ProjectConfidencePanel({ confidence }: { confidence: ProjectConfidence }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <strong style={{ fontSize: 13 }}>Confidence</strong>
        <ProjectConfidenceBadge confidence={confidence} />
      </div>
      <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>
        {confidence.reasons.map((r, idx) => (
          <li key={idx}>{r}</li>
        ))}
      </ul>
    </div>
  );
}

export function ProjectBlockersPanel({ blockers }: { blockers: ProjectBlocker[] }) {
  if (blockers.length === 0) {
    return <EmptyCard>No blockers — nothing is holding this project back right now.</EmptyCard>;
  }
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
      {blockers.map((b, idx) => (
        <li key={idx} className="card" style={{ padding: "10px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
            <strong style={{ fontSize: 13 }}>{b.label}</strong>
            <BlockerBadge blocker={b} />
          </div>
          <div style={{ marginTop: 3, fontSize: 12, color: "var(--text-secondary)" }}>{b.detail}</div>
        </li>
      ))}
    </ul>
  );
}

// --- action intelligence -----------------------------------------------------

function ActionRow({ a }: { a: ProjectActionIntelligence["open"][number] }) {
  return (
    <Link
      href={a.href}
      className="card cc-focusable"
      style={{
        display: "block",
        padding: "8px 12px",
        textDecoration: "none",
        color: "inherit",
        borderLeft: `3px solid ${a.overdue ? "var(--error-color, #991b1b)" : "var(--ypp-purple, #6b21c8)"}`,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600 }}>{a.title}</div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        {a.ownerName ?? "no owner"} · {a.dueISO ? `due ${fmt(a.dueISO)}` : "no due date"}
        {a.overdue ? " · overdue" : ""}
        {a.fromMeeting ? " · from a meeting" : ""}
      </div>
    </Link>
  );
}

export function ProjectActionIntelligencePanel({ intel }: { intel: ProjectActionIntelligence }) {
  if (intel.counts.total === 0) {
    return <EmptyCard>No actions are linked yet. Create the first one to give this project a next move.</EmptyCard>;
  }
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <StatCard label="Open" value={intel.counts.open} icon="layers" tone="accent" />
        <StatCard label="Overdue" value={intel.counts.overdue} icon="clock" tone={intel.counts.overdue > 0 ? "danger" : "default"} />
        <StatCard label="Done" value={intel.counts.completed} icon="check" tone="success" />
        <StatCard label="No owner" value={intel.counts.unowned} icon="users" tone={intel.counts.unowned > 0 ? "warning" : "default"} />
        <StatCard label="No due date" value={intel.counts.noDueDate} icon="calendar" tone={intel.counts.noDueDate > 0 ? "warning" : "default"} />
        <StatCard label="From meetings" value={intel.counts.fromMeetings} icon="inbox" />
      </div>
      {intel.recommendedNext ? (
        <div className="card" style={{ padding: "10px 14px", borderLeft: "3px solid var(--ypp-purple, #6b21c8)" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ypp-purple, #6b21c8)" }}>Recommended next action: </span>
          <Link href={intel.recommendedNext.href} style={{ fontSize: 13, fontWeight: 600, color: "inherit" }}>
            {intel.recommendedNext.title}
          </Link>
        </div>
      ) : null}
      {intel.overdue.length > 0 ? (
        <div>
          <strong style={{ fontSize: 12.5 }}>Overdue ({intel.overdue.length})</strong>
          <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
            {intel.overdue.slice(0, 5).map((a) => (
              <ActionRow key={a.id} a={a} />
            ))}
          </div>
        </div>
      ) : null}
      {intel.open.length > 0 ? (
        <div>
          <strong style={{ fontSize: 12.5 }}>Open ({intel.open.length})</strong>
          <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
            {intel.open.slice(0, 6).map((a) => (
              <ActionRow key={a.id} a={a} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// --- meeting intelligence ----------------------------------------------------

export function ProjectMeetingIntelligencePanel({ intel }: { intel: ProjectMeetingIntelligence }) {
  if (intel.counts.total === 0) {
    return (
      <EmptyCard>
        No meetings have been connected to this project yet.
        {intel.nextMeetingRecommended ? " Recommended next step: schedule one to move the open work." : ""}
      </EmptyCard>
    );
  }
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <StatCard label="Meetings" value={intel.counts.total} icon="calendar" tone="accent" />
        <StatCard label="Produced actions" value={intel.counts.producedActions} icon="check" tone="success" />
        <StatCard label="Produced decisions" value={intel.counts.producedDecisions} icon="flag" />
        <StatCard label="No follow-up" value={intel.counts.noFollowUp} icon="alert" tone={intel.counts.noFollowUp > 0 ? "warning" : "default"} />
      </div>
      {intel.nextMeetingRecommended ? (
        <div className="card" style={{ padding: "10px 14px", borderLeft: "3px solid var(--warning-color, #854d0e)" }}>
          <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
            There&apos;s open work but no recent meeting — recommend scheduling a working session.
          </span>
        </div>
      ) : null}
      <div style={{ display: "grid", gap: 6 }}>
        {intel.connected.slice(0, 6).map((m) => (
          <Link
            key={m.id}
            href={m.href}
            className="card cc-focusable"
            style={{ display: "block", padding: "8px 12px", textDecoration: "none", color: "inherit" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
              <strong style={{ fontSize: 13 }}>{m.title}</strong>
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{fmt(m.startISO)}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {m.decisionCount} decision{m.decisionCount === 1 ? "" : "s"} · {m.linkedActionCount} action{m.linkedActionCount === 1 ? "" : "s"}
              {m.openFollowUps > 0 ? ` · ${m.openFollowUps} open follow-up${m.openFollowUps === 1 ? "" : "s"}` : ""}
              {!m.producedFollowThrough ? " · no follow-up yet" : ""}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// --- dependencies ------------------------------------------------------------

export function ProjectDependencyPanel({ view }: { view: ProjectDependencyView }) {
  if (!view.hasDeclaredDependencies && view.unlocks.length === 0) {
    return <EmptyCard>No declared dependencies — this project stands on its own.</EmptyCard>;
  }
  return (
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
      <div className="card" style={{ padding: 14 }}>
        <strong style={{ fontSize: 12.5 }}>Blocked by (declared)</strong>
        {view.dependsOn.length === 0 ? (
          <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--text-secondary)" }}>Nothing upstream.</p>
        ) : (
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6 }}>
            {view.dependsOn.map((d, idx) => (
              <li key={idx}>
                {d.label} {d.atRisk ? <Pill tone="overdue">upstream at risk</Pill> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="card" style={{ padding: 14 }}>
        <strong style={{ fontSize: 12.5 }}>Unlocks (downstream)</strong>
        {view.unlocks.length === 0 ? (
          <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--text-secondary)" }}>Nothing waits on this.</p>
        ) : (
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6 }}>
            {view.unlocks.map((u, idx) => (
              <li key={idx}>{u}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// --- review card -------------------------------------------------------------

function ReviewColumn({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div>
      <strong style={{ fontSize: 12.5, color: tone }}>{title}</strong>
      {items.length === 0 ? (
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>None.</p>
      ) : (
        <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          {items.map((it, idx) => (
            <li key={idx}>{it}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ProjectReviewCard({
  project,
  meetingIntel,
}: {
  project: ProjectSummary;
  meetingIntel: ProjectMeetingIntelligence;
}) {
  const p = project;
  const wins = [
    p.counts.completedActions > 0 ? `${p.counts.completedActions} action${p.counts.completedActions === 1 ? "" : "s"} completed` : "",
    p.counts.milestonesComplete > 0 ? `${p.counts.milestonesComplete} milestone${p.counts.milestonesComplete === 1 ? "" : "s"} reached` : "",
    p.momentum.level === "accelerating" ? "Momentum is accelerating" : "",
  ].filter(Boolean);
  const losses = [
    p.counts.overdueActions > 0 ? `${p.counts.overdueActions} overdue action${p.counts.overdueActions === 1 ? "" : "s"}` : "",
    p.momentum.level === "stalled" ? "Momentum has stalled" : "",
  ].filter(Boolean);
  const risks = p.risk.factors.map((f) => f.label);
  const blockers = p.blockers.map((b) => `${b.label} (${b.kind})`);
  const openDecisions =
    p.counts.decisionsWithoutAction > 0
      ? [`${p.counts.decisionsWithoutAction} decision${p.counts.decisionsWithoutAction === 1 ? "" : "s"} without follow-through`]
      : [];
  const nextMoves = p.nextMoves.map((m) => m.title);
  const ownerNotes = [
    p.owner ? `Accountable: ${p.owner}` : "No accountable owner declared",
    p.ownership.reason,
    meetingIntel.nextMeetingRecommended ? "Recommend scheduling a working session" : "",
  ].filter(Boolean);

  return (
    <div className="card" style={{ padding: 16, display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <strong style={{ fontSize: 13.5 }}>Project review</strong>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {p.reviewNeed.needed ? (
            <Pill tone={p.reviewNeed.urgency === "now" ? "overdue" : "warning"}>
              Review {p.reviewNeed.urgency}
            </Pill>
          ) : (
            <Pill tone="success">Routine cadence</Pill>
          )}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-secondary)" }}>{p.reviewNeed.reason}</p>
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <ReviewColumn title="Wins" items={wins} tone="var(--success-color, #16a34a)" />
        <ReviewColumn title="Losses" items={losses} tone="var(--error-color, #991b1b)" />
        <ReviewColumn title="Risks" items={risks} tone="var(--warning-color, #854d0e)" />
        <ReviewColumn title="Blockers" items={blockers} tone="var(--error-color, #991b1b)" />
        <ReviewColumn title="Open decisions" items={openDecisions} tone="var(--warning-color, #854d0e)" />
        <ReviewColumn title="Next moves" items={nextMoves} tone="var(--ypp-purple, #6b21c8)" />
        <ReviewColumn title="Owner & accountability" items={ownerNotes} tone="var(--text-secondary)" />
      </div>
    </div>
  );
}
