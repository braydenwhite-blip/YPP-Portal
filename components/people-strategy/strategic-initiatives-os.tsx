import Link from "next/link";

import { formatMonthDay } from "@/lib/leadership-action-center/dates";
import type {
  InitiativeCharter,
  InitiativeKnowledgeBase,
  KeyMetricDef,
  KnowledgeLink,
  StakeholderDef,
} from "@/lib/people-strategy/strategic-initiative-profile";
import { charterHasContent, knowledgeHasContent } from "@/lib/people-strategy/strategic-initiative-profile";
import type { WorkstreamSummary } from "@/lib/people-strategy/strategic-workstreams";
import {
  DECISION_CATEGORY_META,
  type DecisionCenter,
  type DecisionCenterItem,
} from "@/lib/people-strategy/strategic-decision-center";
import {
  ROADMAP_HORIZON_META,
  ROADMAP_PHASE_META,
  type InitiativeRoadmap,
  type RoadmapItem,
  type RoadmapPhase,
} from "@/lib/people-strategy/strategic-roadmap";
import {
  SCENARIO_READINESS_META,
  type ScenarioBoard,
  type ScenarioView,
} from "@/lib/people-strategy/strategic-scenarios";
import type {
  DependencyEdge,
  DependencyGraph,
  InitiativeDependencyView,
} from "@/lib/people-strategy/strategic-dependencies";
import type { OperatingReview } from "@/lib/people-strategy/strategic-operating-reviews";
import {
  GRAPH_LAYER_LABEL,
  type ExecutionGraph,
  type GraphNode,
  type GraphTone,
} from "@/lib/people-strategy/strategic-execution-graph";
import type { StrategicPortfolio, StrategicOpportunity, FocusArea } from "@/lib/people-strategy/strategic-portfolio";
import type { InitiativeSummary } from "@/lib/people-strategy/strategic-initiative-summary";

import { EmptyCard } from "./command-center-os";
import { Pill, type PillTone } from "./pills";
import { StatCard } from "./stat-card";
import {
  InitiativeHealthBadge,
  InitiativeMiniRow,
  MilestoneList,
  MomentumBadge,
  OwnershipBadge,
  ProgressBar,
  RecommendationsList,
  RiskBadge,
} from "./strategic-initiatives";

/**
 * YPP Execution OS — Strategic Initiatives 2.0 cockpit components.
 *
 * Pure presentational SERVER components for the "program operating system" layer:
 * the initiative charter (Phase A), workstreams (B), the decision center (C), the
 * knowledge base (D), the roadmap (E), scenarios (F), the dependency engine (G),
 * operating reviews (H), the portfolio board (I), and the execution graph (J).
 * Each takes already-derived, serializable data and composes the shared StatCard /
 * Pill / ProgressBar primitives, with a clean empty state for every section.
 */

function fmt(iso: string): string {
  return formatMonthDay(new Date(iso));
}

function Prose({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--text-secondary)" }}>{children}</p>;
}

function FieldBlock({ label, children }: { label: string; children: React.ReactNode }) {
  if (children == null) return null;
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, color: "var(--muted)", marginBottom: 4 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function Bullets({ items, empty }: { items: string[]; empty?: string }) {
  if (items.length === 0) return empty ? <Prose>{empty}</Prose> : null;
  return (
    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.5, color: "var(--text-secondary)", display: "grid", gap: 3 }}>
      {items.map((s, i) => (
        <li key={i}>{s}</li>
      ))}
    </ul>
  );
}

function ChipRow({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {items.map((s, i) => (
        <Pill key={i} tone="neutral">{s}</Pill>
      ))}
    </div>
  );
}

// --- Phase A: charter --------------------------------------------------------

function StakeholderList({ people }: { people: StakeholderDef[] }) {
  if (people.length === 0) return null;
  return (
    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "var(--text-secondary)", display: "grid", gap: 3 }}>
      {people.map((p, i) => (
        <li key={i}>
          <strong style={{ color: "var(--text-primary, inherit)" }}>{p.name}</strong>
          {p.role ? <span> — {p.role}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function KeyMetricList({ metrics }: { metrics: KeyMetricDef[] }) {
  if (metrics.length === 0) return null;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {metrics.map((m, i) => (
        <div key={i} style={{ fontSize: 12.5 }}>
          <strong>{m.label}</strong>
          {m.target ? <span style={{ color: "var(--text-secondary)" }}> · target {m.target}</span> : null}
          {m.cadence ? <span style={{ color: "var(--muted)" }}> · {m.cadence}</span> : null}
          {m.source ? <span style={{ color: "var(--muted)" }}> · from {m.source}</span> : null}
        </div>
      ))}
    </div>
  );
}

export function InitiativeCharterPanel({ charter }: { charter: InitiativeCharter }) {
  if (!charterHasContent(charter)) {
    return <EmptyCard>No charter authored yet — mission, purpose, success definition, and outcomes will appear here.</EmptyCard>;
  }
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 12 }}>
        {charter.mission ? <FieldBlock label="Mission"><Prose>{charter.mission}</Prose></FieldBlock> : null}
        {charter.purpose ? <FieldBlock label="Purpose"><Prose>{charter.purpose}</Prose></FieldBlock> : null}
        {charter.successDefinition ? <FieldBlock label="Definition of success"><Prose>{charter.successDefinition}</Prose></FieldBlock> : null}
        {charter.strategicImportance ? <FieldBlock label="Strategic importance"><Prose>{charter.strategicImportance}</Prose></FieldBlock> : null}
      </div>

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        {charter.targetOutcomes.length > 0 ? <div className="card" style={{ padding: 14 }}><FieldBlock label="Target outcomes"><Bullets items={charter.targetOutcomes} /></FieldBlock></div> : null}
        {charter.keyMetrics.length > 0 ? <div className="card" style={{ padding: 14 }}><FieldBlock label="Key metrics"><KeyMetricList metrics={charter.keyMetrics} /></FieldBlock></div> : null}
        {charter.risks.length > 0 ? <div className="card" style={{ padding: 14 }}><FieldBlock label="Known risks"><Bullets items={charter.risks} /></FieldBlock></div> : null}
        {charter.assumptions.length > 0 ? <div className="card" style={{ padding: 14 }}><FieldBlock label="Assumptions"><Bullets items={charter.assumptions} /></FieldBlock></div> : null}
        {charter.constraints.length > 0 ? <div className="card" style={{ padding: 14 }}><FieldBlock label="Constraints"><Bullets items={charter.constraints} /></FieldBlock></div> : null}
        {charter.leadershipOwners.length > 0 ? <div className="card" style={{ padding: 14 }}><FieldBlock label="Leadership owners"><StakeholderList people={charter.leadershipOwners} /></FieldBlock></div> : null}
        {charter.stakeholders.length > 0 ? <div className="card" style={{ padding: 14 }}><FieldBlock label="Stakeholders"><StakeholderList people={charter.stakeholders} /></FieldBlock></div> : null}
        {charter.lessonsLearned.length > 0 ? <div className="card" style={{ padding: 14 }}><FieldBlock label="Lessons learned"><Bullets items={charter.lessonsLearned} /></FieldBlock></div> : null}
        {charter.futureOpportunities.length > 0 ? <div className="card" style={{ padding: 14 }}><FieldBlock label="Future opportunities"><Bullets items={charter.futureOpportunities} /></FieldBlock></div> : null}
      </div>

      {charter.historicalContext ? (
        <div className="card" style={{ padding: 14 }}>
          <FieldBlock label="Historical context"><Prose>{charter.historicalContext}</Prose></FieldBlock>
        </div>
      ) : null}
    </div>
  );
}

// --- Phase B: workstreams ----------------------------------------------------

export function WorkstreamCard({ ws }: { ws: WorkstreamSummary }) {
  return (
    <div id={`workstream-${ws.id}`} className="card" style={{ padding: 16, borderLeft: `4px solid ${toneColor(ws.health.tone)}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <strong style={{ fontSize: 15, minWidth: 0 }}>{ws.title}</strong>
        <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <InitiativeHealthBadge health={ws.health} />
          <MomentumBadge momentum={ws.momentum} />
          <RiskBadge risk={ws.risk} />
        </span>
      </div>
      {ws.description ? (
        <p style={{ margin: "6px 0 8px", fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>{ws.description}</p>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0" }}>
        <div style={{ flex: 1 }}>
          <ProgressBar percent={ws.progress.percent} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{ws.progress.percent}%</span>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, color: "var(--text-secondary)" }}>
        <span>{ws.openActions} open</span>
        {ws.overdueActions > 0 ? <span style={{ color: "var(--error-color, #991b1b)" }}>{ws.overdueActions} overdue</span> : null}
        {ws.blockedActions > 0 ? <span>{ws.blockedActions} blocked</span> : null}
        <span>{ws.milestonesComplete}/{ws.milestonesTotal} milestones</span>
        <span>{ws.meetingCount} mtgs</span>
        <span>Owner: {ws.owner ?? "unassigned"}</span>
        {ws.dependencyCount > 0 ? <span>{ws.dependencyCount} dependency{ws.dependencyCount === 1 ? "" : "ies"}</span> : null}
      </div>

      <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--text-secondary)" }}>{ws.healthHeadline}</p>

      {ws.milestones.length > 0 ? (
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>
            {ws.milestones.length} milestone{ws.milestones.length === 1 ? "" : "s"}
          </summary>
          <ul style={{ margin: "8px 0 0", paddingLeft: 16, display: "grid", gap: 3, fontSize: 12.5, color: "var(--text-secondary)" }}>
            {ws.milestones.map((m) => (
              <li key={m.id}>
                <Link href={`#milestone-${m.id}`} style={{ color: "inherit" }}>{m.title}</Link>
                <span> · {m.statusLabel} · {m.percent}%</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {ws.recommendations.length > 0 ? (
        <div style={{ marginTop: 10, borderTop: "1px solid var(--border, #eee)", paddingTop: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 12, color: "var(--ypp-purple, #6b21c8)" }}>Next: </span>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{ws.recommendations[0].title} — {ws.recommendations[0].detail}</span>
        </div>
      ) : null}
    </div>
  );
}

export function WorkstreamBoard({ workstreams }: { workstreams: WorkstreamSummary[] }) {
  if (workstreams.length === 0) {
    return <EmptyCard>No workstreams defined for this initiative yet — add them in the initiative config to manage its parallel programs.</EmptyCard>;
  }
  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" }}>
      {workstreams.map((ws) => (
        <WorkstreamCard key={ws.id} ws={ws} />
      ))}
    </div>
  );
}

// --- Phase C: decision center ------------------------------------------------

function DecisionRow({ d }: { d: DecisionCenterItem }) {
  const meta = DECISION_CATEGORY_META[d.category];
  return (
    <li>
      <Link href={d.href} className="cc-focusable" style={{ display: "block", textDecoration: "none", color: "inherit", padding: "8px 12px", borderLeft: `3px solid ${toneColor(meta.tone)}`, borderRadius: 8, background: "var(--surface, #fff)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
          <strong style={{ fontSize: 13, minWidth: 0 }}>{d.decision}</strong>
          <span style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
            {d.critical ? <Pill tone="overdue">Act now</Pill> : null}
            <Pill tone={meta.tone}>{meta.label}</Pill>
          </span>
        </div>
        <div style={{ marginTop: 3, fontSize: 12, color: "var(--text-secondary)" }}>
          {d.areaLabel} · {d.meetingTitle}
          {d.decidedByName ? ` · ${d.decidedByName}` : ""} · {fmt(d.createdISO)}
        </div>
      </Link>
    </li>
  );
}

export function DecisionCenterPanel({ center }: { center: DecisionCenter }) {
  if (center.stats.total === 0) {
    return <EmptyCard>No decisions recorded for this initiative yet — decisions made in its meetings will appear here.</EmptyCard>;
  }
  const s = center.stats;
  const sections: Array<{ title: string; items: DecisionCenterItem[]; hint?: string }> = [
    { title: "Critical — act now", items: center.critical, hint: "Recent, not yet actioned" },
    { title: "Needs follow-through", items: center.needsFollowThrough },
    { title: "In motion", items: center.inMotion },
    { title: "Followed through", items: center.followedThrough },
  ];
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <StatCard label="Decisions" value={s.total} icon="check" tone="accent" />
        <StatCard label="Follow-through" value={`${s.followThroughRate}%`} icon="activity" tone={s.followThroughRate >= 60 ? "success" : "warning"} />
        <StatCard label="Needs action" value={s.needsFollowThrough} icon="alert" tone={s.needsFollowThrough > 0 ? "warning" : "default"} />
        <StatCard label="Critical" value={s.critical} icon="clock" tone={s.critical > 0 ? "danger" : "default"} />
        <StatCard label="In motion" value={s.inMotion} icon="layers" />
      </div>
      {sections
        .filter((sec) => sec.items.length > 0)
        .map((sec) => (
          <div key={sec.title}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <strong style={{ fontSize: 13.5 }}>{sec.title}</strong>
              {sec.hint ? <span style={{ fontSize: 11, color: "var(--muted)" }}>{sec.hint}</span> : null}
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
              {sec.items.slice(0, 6).map((d) => (
                <DecisionRow key={d.id} d={d} />
              ))}
            </ul>
          </div>
        ))}
    </div>
  );
}

// --- Phase D: knowledge base -------------------------------------------------

function LinkChips({ label, links }: { label: string; links: KnowledgeLink[] }) {
  if (links.length === 0) return null;
  return (
    <div className="card" style={{ padding: 14 }}>
      <FieldBlock label={label}>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "var(--text-secondary)", display: "grid", gap: 3 }}>
          {links.map((l, i) => (
            <li key={i}>
              {l.href ? (
                <Link href={l.href} style={{ color: "var(--ypp-purple, #6b21c8)", fontWeight: 600 }}>{l.label}</Link>
              ) : (
                <strong>{l.label}</strong>
              )}
              {l.note ? <span> — {l.note}</span> : null}
            </li>
          ))}
        </ul>
      </FieldBlock>
    </div>
  );
}

export function KnowledgeBasePanel({ kb }: { kb: InitiativeKnowledgeBase }) {
  if (!knowledgeHasContent(kb)) {
    return <EmptyCard>No knowledge base authored yet — overview, strategy, playbooks, FAQs, and retrospectives will live here so institutional memory outlasts leadership turnover.</EmptyCard>;
  }
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 12 }}>
        {kb.overview ? <FieldBlock label="Overview"><Prose>{kb.overview}</Prose></FieldBlock> : null}
        {kb.background ? <FieldBlock label="Background"><Prose>{kb.background}</Prose></FieldBlock> : null}
        {kb.strategy ? <FieldBlock label="Strategy"><Prose>{kb.strategy}</Prose></FieldBlock> : null}
      </div>
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <LinkChips label="Playbooks" links={kb.playbooks} />
        <LinkChips label="Resources" links={kb.resources} />
        <LinkChips label="Important documents" links={kb.documents} />
        <LinkChips label="Templates" links={kb.templates} />
        {kb.historicalNotes.length > 0 ? <div className="card" style={{ padding: 14 }}><FieldBlock label="Historical notes"><Bullets items={kb.historicalNotes} /></FieldBlock></div> : null}
        {kb.futureIdeas.length > 0 ? <div className="card" style={{ padding: 14 }}><FieldBlock label="Future ideas"><Bullets items={kb.futureIdeas} /></FieldBlock></div> : null}
      </div>
      {kb.faqs.length > 0 ? (
        <div className="card" style={{ padding: 14 }}>
          <FieldBlock label="FAQs">
            <div style={{ display: "grid", gap: 8 }}>
              {kb.faqs.map((f, i) => (
                <div key={i} style={{ fontSize: 12.5 }}>
                  <strong>{f.question}</strong>
                  <p style={{ margin: "2px 0 0", color: "var(--text-secondary)" }}>{f.answer}</p>
                </div>
              ))}
            </div>
          </FieldBlock>
        </div>
      ) : null}
      {kb.retrospectives.length > 0 ? (
        <div className="card" style={{ padding: 14 }}>
          <FieldBlock label="Retrospectives">
            <div style={{ display: "grid", gap: 10 }}>
              {kb.retrospectives.map((r, i) => (
                <div key={i}>
                  <strong style={{ fontSize: 13 }}>{r.title}{r.dateISO ? ` · ${fmt(r.dateISO)}` : ""}</strong>
                  {r.whatWorked.length > 0 ? <div style={{ marginTop: 4 }}><FieldBlock label="What worked"><Bullets items={r.whatWorked} /></FieldBlock></div> : null}
                  {r.whatDidnt.length > 0 ? <div style={{ marginTop: 4 }}><FieldBlock label="What didn't"><Bullets items={r.whatDidnt} /></FieldBlock></div> : null}
                  {r.nextTime.length > 0 ? <div style={{ marginTop: 4 }}><FieldBlock label="Next time"><Bullets items={r.nextTime} /></FieldBlock></div> : null}
                </div>
              ))}
            </div>
          </FieldBlock>
        </div>
      ) : null}
    </div>
  );
}

// --- Phase E: roadmap --------------------------------------------------------

function RoadmapItemRow({ item }: { item: RoadmapItem }) {
  const meta = ROADMAP_PHASE_META[item.phase];
  return (
    <li style={{ fontSize: 12.5 }}>
      <Link href={item.href} style={{ color: "inherit", fontWeight: 600 }}>{item.title}</Link>
      <span style={{ color: "var(--text-secondary)" }}>
        {" "}· {meta.label}
        {item.targetDateISO ? ` · ${item.behindSchedule ? "overdue " : ""}${fmt(item.targetDateISO)}` : ""}
        {item.kind === "milestone" ? ` · ${item.percent}%` : ""}
      </span>
    </li>
  );
}

export function RoadmapView({ roadmap }: { roadmap: InitiativeRoadmap }) {
  if (roadmap.items.length === 0) {
    return <EmptyCard>No milestones or target dates to sequence yet.</EmptyCard>;
  }
  const phases: RoadmapPhase[] = ["completed", "in_progress", "upcoming", "at_risk", "blocked"];
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <StatCard label="Completed" value={roadmap.counts.completed} icon="check" tone="success" />
        <StatCard label="Current" value={roadmap.counts.inProgress} icon="activity" tone="accent" />
        <StatCard label="Upcoming" value={roadmap.counts.upcoming} icon="calendar" />
        <StatCard label="At risk" value={roadmap.counts.atRisk} icon="alert" tone={roadmap.counts.atRisk > 0 ? "warning" : "default"} />
        <StatCard label="Blocked" value={roadmap.counts.blocked} icon="alert" tone={roadmap.counts.blocked > 0 ? "danger" : "default"} />
        <StatCard label="Overdue" value={roadmap.counts.overdue} icon="clock" tone={roadmap.counts.overdue > 0 ? "danger" : "default"} />
      </div>

      <div>
        <strong style={{ fontSize: 13.5 }}>By horizon</strong>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: 8 }}>
          {(Object.keys(ROADMAP_HORIZON_META) as Array<keyof typeof ROADMAP_HORIZON_META>)
            .filter((h) => roadmap.byHorizon[h].length > 0)
            .map((h) => (
              <div key={h} className="card" style={{ padding: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{ROADMAP_HORIZON_META[h].label}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>{ROADMAP_HORIZON_META[h].description}</div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
                  {roadmap.byHorizon[h].map((i) => (
                    <RoadmapItemRow key={i.id} item={i} />
                  ))}
                </ul>
              </div>
            ))}
        </div>
      </div>

      <div>
        <strong style={{ fontSize: 13.5 }}>By phase</strong>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginTop: 8 }}>
          {phases
            .filter((p) => roadmap.byPhase[p].length > 0)
            .map((p) => (
              <div key={p} className="card" style={{ padding: 12, borderTop: `3px solid ${toneColor(ROADMAP_PHASE_META[p].tone)}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{ROADMAP_PHASE_META[p].label}</div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
                  {roadmap.byPhase[p].map((i) => (
                    <RoadmapItemRow key={i.id} item={i} />
                  ))}
                </ul>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// --- Phase F: scenarios ------------------------------------------------------

function ScenarioCard({ scenario }: { scenario: ScenarioView }) {
  const readiness = SCENARIO_READINESS_META[scenario.readiness];
  return (
    <div className="card" style={{ padding: 14, borderTop: `3px solid ${toneColor(scenario.meta.tone)}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
        <span style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
          <Pill tone={scenario.meta.tone}>{scenario.meta.label}</Pill>
          <strong style={{ fontSize: 16 }}>{scenario.headline}</strong>
        </span>
        <Pill tone={readiness.tone}>{readiness.label}</Pill>
      </div>
      {scenario.description ? <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--text-secondary)" }}>{scenario.description}</p> : null}
      <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--muted)" }}>{scenario.readinessReason}</p>
      {scenario.requirements.length > 0 ? <div style={{ marginTop: 8 }}><FieldBlock label="What must happen"><Bullets items={scenario.requirements} /></FieldBlock></div> : null}
      {scenario.blockers.length > 0 ? <div style={{ marginTop: 8 }}><FieldBlock label="Blocking"><Bullets items={scenario.blockers} /></FieldBlock></div> : null}
      {scenario.unlockingDecisions.length > 0 ? <div style={{ marginTop: 8 }}><FieldBlock label="Unlocking decisions"><Bullets items={scenario.unlockingDecisions} /></FieldBlock></div> : null}
    </div>
  );
}

export function ScenariosPanel({ board }: { board: ScenarioBoard }) {
  if (!board.hasScenarios) {
    return <EmptyCard>No scenarios planned yet — best / expected / risk / stretch cases will appear here once authored.</EmptyCard>;
  }
  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
      {board.scenarios.map((s) => (
        <ScenarioCard key={s.kind} scenario={s} />
      ))}
    </div>
  );
}

// --- Phase G: dependencies (per-initiative view) -----------------------------

function DepEdgeRow({ edge, direction }: { edge: DependencyEdge; direction: "up" | "down" }) {
  const label = direction === "up" ? edge.fromTitle : edge.toTitle;
  return (
    <li style={{ fontSize: 12.5 }}>
      {edge.blocking ? <Pill tone="overdue">Blocking</Pill> : null}{" "}
      <strong>{label}</strong>
      {edge.reason ? <span style={{ color: "var(--text-secondary)" }}> — {edge.reason}</span> : null}
    </li>
  );
}

export function DependencyPanel({ view }: { view: InitiativeDependencyView }) {
  const nothing =
    view.blockedBy.length === 0 && view.unlocks.length === 0 && view.relatedTo.length === 0;
  if (nothing) {
    return <EmptyCard>No declared dependencies — this initiative neither waits on nor unblocks another right now.</EmptyCard>;
  }
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {view.onCriticalPath ? <Pill tone="purple">On the portfolio critical path</Pill> : null}
      {view.blockedBy.length > 0 ? (
        <div className="card" style={{ padding: 14 }}>
          <FieldBlock label="Blocked by / depends on">
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
              {view.blockedBy.map((e) => (
                <DepEdgeRow key={e.id} edge={e} direction="up" />
              ))}
            </ul>
          </FieldBlock>
        </div>
      ) : null}
      {view.unlocks.length > 0 ? (
        <div className="card" style={{ padding: 14 }}>
          <FieldBlock label="Unlocks">
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
              {view.unlocks.map((e) => (
                <DepEdgeRow key={e.id} edge={e} direction="down" />
              ))}
            </ul>
          </FieldBlock>
        </div>
      ) : null}
      {view.relatedTo.length > 0 ? (
        <div className="card" style={{ padding: 14 }}>
          <FieldBlock label="Related initiatives">
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
              {view.relatedTo.map((e) => (
                <li key={e.id} style={{ fontSize: 12.5 }}>
                  <strong>{e.fromTitle}</strong> ↔ <strong>{e.toTitle}</strong>
                  {e.reason ? <span style={{ color: "var(--text-secondary)" }}> — {e.reason}</span> : null}
                </li>
              ))}
            </ul>
          </FieldBlock>
        </div>
      ) : null}
    </div>
  );
}

// --- Phase H: operating review -----------------------------------------------

function ReviewBlock({ label, items, empty }: { label: string; items: string[]; empty: string }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <FieldBlock label={label}>{items.length > 0 ? <Bullets items={items} /> : <Prose>{empty}</Prose>}</FieldBlock>
    </div>
  );
}

export function OperatingReviewPanel({ review }: { review: OperatingReview }) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{review.headline}</p>
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <ReviewBlock label="Wins" items={review.wins} empty="No completions in this window." />
        <ReviewBlock label="Losses & struggles" items={review.losses} empty="Nothing stuck or slipping." />
        <ReviewBlock label="Risks" items={review.risks} empty="No active risk factors." />
        <ReviewBlock label="Decisions" items={review.decisions} empty="No recent decisions to track." />
        <ReviewBlock label="Open questions" items={review.openQuestions} empty="No open questions." />
        <ReviewBlock label="Capacity" items={review.capacityReview} empty="No capacity notes." />
        <ReviewBlock label="Dependencies" items={review.dependencyReview} empty="No dependencies to review." />
        <div className="card" style={{ padding: 14 }}>
          <FieldBlock label={`Milestone progress (${review.milestoneProgress.complete}/${review.milestoneProgress.total})`}>
            {review.milestoneProgress.lines.length > 0 ? <Bullets items={review.milestoneProgress.lines} /> : <Prose>No milestones.</Prose>}
          </FieldBlock>
        </div>
      </div>
      {review.recommendedPriorities.length > 0 ? (
        <div className="card" style={{ padding: 14 }}>
          <FieldBlock label="Recommended priorities">
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, display: "grid", gap: 4 }}>
              {review.recommendedPriorities.map((p, i) => (
                <li key={i}>
                  <Link href={p.href} style={{ color: "inherit", fontWeight: 600 }}>{p.title}</Link>
                  <span style={{ color: "var(--text-secondary)" }}> — {p.detail}</span>
                </li>
              ))}
            </ol>
          </FieldBlock>
        </div>
      ) : null}
    </div>
  );
}

export function OperatingReviewTabs({ reviews }: { reviews: Record<"weekly" | "monthly" | "quarterly", OperatingReview> }) {
  const order: Array<"weekly" | "monthly" | "quarterly"> = ["weekly", "monthly", "quarterly"];
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {order.map((cadence, idx) => (
        <details key={cadence} open={idx === 0} className="card" style={{ padding: 14 }}>
          <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 14 }}>{reviews[cadence].label}</summary>
          <div style={{ marginTop: 12 }}>
            <OperatingReviewPanel review={reviews[cadence]} />
          </div>
        </details>
      ))}
    </div>
  );
}

// --- Phase J: execution graph ------------------------------------------------

function GraphNodeChip({ node }: { node: GraphNode }) {
  const body = (
    <div style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid var(--border, #e5e7eb)`, borderLeft: `3px solid ${toneColor(node.tone)}`, background: "var(--surface, #fff)", fontSize: 12 }}>
      <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{node.label}</div>
      {node.sublabel ? <div style={{ color: "var(--muted)", fontSize: 11 }}>{node.sublabel}</div> : null}
    </div>
  );
  return node.href && node.href !== "#" ? (
    <Link href={node.href} style={{ textDecoration: "none", color: "inherit" }}>{body}</Link>
  ) : (
    body
  );
}

export function ExecutionGraphView({ graph }: { graph: ExecutionGraph }) {
  if (graph.layers.length === 0) {
    return <EmptyCard>No execution chain to graph yet — workstreams, milestones, decisions, and actions will appear as work comes online.</EmptyCard>;
  }
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        {graph.stats.workstreams} workstreams · {graph.stats.milestones} milestones · {graph.stats.decisions} decisions · {graph.stats.meetings} meetings · {graph.stats.actions} actions · {graph.stats.outcomes} outcomes
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {graph.layers.map((layer) => (
          <div key={layer.layer} style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 10, alignItems: "start" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, color: "var(--muted)", paddingTop: 6 }}>
              {GRAPH_LAYER_LABEL[layer.layer]}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {layer.nodes.map((n) => (
                <GraphNodeChip key={n.id} node={n} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Phase I: portfolio board ------------------------------------------------

function PortfolioColumn({ title, hint, initiatives, note }: { title: string; hint?: string; initiatives: InitiativeSummary[]; note?: (i: InitiativeSummary) => string }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <h3 className="ps-section-title" style={{ margin: 0, fontSize: 14 }}>{title}</h3>
        {hint ? <span style={{ fontSize: 11, color: "var(--muted)" }}>{hint}</span> : null}
      </div>
      {initiatives.length === 0 ? (
        <EmptyCard>Nothing here right now.</EmptyCard>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {initiatives.slice(0, 5).map((i) => (
            <InitiativeMiniRow key={i.id} initiative={i} note={note ? note(i) : undefined} />
          ))}
        </div>
      )}
    </section>
  );
}

function FocusAreaList({ areas }: { areas: FocusArea[] }) {
  if (areas.length === 0) return <EmptyCard>No active areas need focus.</EmptyCard>;
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
      {areas.map((a) => (
        <li key={a.area} style={{ fontSize: 12.5 }}>
          <strong>{a.label}</strong>
          <span style={{ color: "var(--text-secondary)" }}> · {a.initiativeCount} initiative{a.initiativeCount === 1 ? "" : "s"} · {a.reason}</span>
        </li>
      ))}
    </ul>
  );
}

function OpportunityList({ opportunities }: { opportunities: StrategicOpportunity[] }) {
  if (opportunities.length === 0) return <EmptyCard>No strategic opportunities logged yet.</EmptyCard>;
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
      {opportunities.slice(0, 8).map((o, i) => (
        <li key={`${o.initiativeId}:${i}`} style={{ fontSize: 12.5 }}>
          <Link href={o.href} style={{ color: "inherit", fontWeight: 600 }}>{o.initiativeTitle}</Link>
          <span style={{ color: "var(--text-secondary)" }}> · {o.opportunity}</span>
        </li>
      ))}
    </ul>
  );
}

export function PortfolioBoard({ portfolio }: { portfolio: StrategicPortfolio }) {
  return (
    <div style={{ display: "grid", gap: 22 }}>
      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <PortfolioColumn title="Most important" hint="Priority" initiatives={portfolio.mostImportant} note={(i) => `${i.priorityLabel} · ${i.health.label}`} />
        <PortfolioColumn title="Highest impact" initiatives={portfolio.highestImpact} note={(i) => `${i.progress.percent}% · ${i.counts.milestonesComplete}/${i.counts.milestonesTotal} milestones`} />
        <PortfolioColumn title="Fastest growing" hint="Momentum" initiatives={portfolio.fastestGrowing} note={(i) => `${i.momentum.recentlyCompleted} recent win${i.momentum.recentlyCompleted === 1 ? "" : "s"}`} />
      </div>
      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <PortfolioColumn title="Highest risk" initiatives={portfolio.highestRisk} note={(i) => `${i.risk.factors[0]?.label ?? "elevated risk"}`} />
        <PortfolioColumn title="Most resource intensive" initiatives={portfolio.mostResourceIntensive} note={(i) => `${i.counts.openActions} open · ${i.counts.meetingCount} mtgs`} />
        <PortfolioColumn title="Understaffed" initiatives={portfolio.understaffed} note={(i) => `${i.counts.unassignedActions} unowned · ${i.ownership.clarity}`} />
      </div>
      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <PortfolioColumn title="Blocked" initiatives={portfolio.blocked} note={(i) => `${i.counts.blockedActions} blocked · ${i.momentum.level}`} />
        <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h3 className="ps-section-title" style={{ margin: 0, fontSize: 14 }}>Leadership focus areas</h3>
          <FocusAreaList areas={portfolio.focusAreas} />
        </section>
        <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h3 className="ps-section-title" style={{ margin: 0, fontSize: 14 }}>Strategic opportunities</h3>
          <OpportunityList opportunities={portfolio.strategicOpportunities} />
        </section>
      </div>
    </div>
  );
}

// --- portfolio dependency graph (Phase G, executive view) --------------------

export function DependencyGraphBoard({ graph }: { graph: DependencyGraph }) {
  if (graph.edges.length === 0 && graph.relations.length === 0) {
    return <EmptyCard>No cross-initiative dependencies declared yet.</EmptyCard>;
  }
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <StatCard label="Dependencies" value={graph.stats.edges} icon="layers" tone="accent" />
        <StatCard label="Live bottlenecks" value={graph.stats.blocked} icon="alert" tone={graph.stats.blocked > 0 ? "danger" : "default"} />
        <StatCard label="At risk" value={graph.stats.atRisk} icon="alert" tone={graph.stats.atRisk > 0 ? "warning" : "default"} />
      </div>

      {graph.criticalPath.length > 1 ? (
        <div className="card" style={{ padding: 14 }}>
          <FieldBlock label="Critical path">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", fontSize: 12.5 }}>
              {graph.criticalPath.map((id, idx) => {
                const node = graph.nodes.find((n) => n.id === id);
                return (
                  <span key={id} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                    {idx > 0 ? <span style={{ color: "var(--muted)" }}>→</span> : null}
                    {node?.href && node.href !== "#" ? (
                      <Link href={node.href} style={{ fontWeight: 600, color: "inherit" }}>{node?.title ?? id}</Link>
                    ) : (
                      <strong>{node?.title ?? id}</strong>
                    )}
                  </span>
                );
              })}
            </div>
          </FieldBlock>
        </div>
      ) : null}

      {graph.blockedByRisk.length > 0 ? (
        <div className="card" style={{ padding: 14 }}>
          <FieldBlock label="What's actually holding us back">
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, display: "grid", gap: 4 }}>
              {graph.blockedByRisk.map((e) => (
                <li key={e.id}>
                  <strong>{e.toTitle}</strong> is blocked by <strong>{e.fromTitle}</strong>
                  {e.reason ? <span style={{ color: "var(--text-secondary)" }}> — {e.reason}</span> : null}
                </li>
              ))}
            </ul>
          </FieldBlock>
        </div>
      ) : null}

      <div className="card" style={{ padding: 14 }}>
        <FieldBlock label="All dependencies">
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, display: "grid", gap: 4 }}>
            {graph.edges.map((e) => (
              <li key={e.id}>
                {e.blocking ? <Pill tone="overdue">Blocking</Pill> : null}{" "}
                <strong>{e.fromTitle}</strong> → <strong>{e.toTitle}</strong>
                {e.reason ? <span style={{ color: "var(--text-secondary)" }}> — {e.reason}</span> : null}
              </li>
            ))}
          </ul>
        </FieldBlock>
      </div>
    </div>
  );
}

// --- shared tone → color -----------------------------------------------------

function toneColor(tone: PillTone | GraphTone): string {
  switch (tone) {
    case "success":
      return "var(--success-color, #16a34a)";
    case "overdue":
      return "var(--error-color, #991b1b)";
    case "warning":
      return "var(--warning-color, #854d0e)";
    case "purple":
      return "var(--ypp-purple, #6b21c8)";
    case "info":
      return "var(--info-color, #1d4ed8)";
    default:
      return "var(--border, #9ca3af)";
  }
}
