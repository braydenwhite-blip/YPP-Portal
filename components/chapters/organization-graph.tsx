"use client";

// The Organization Graph inspector. A calm, navigable model of the whole
// chapter: pick any entity and see why it exists, what it came from, what it
// makes possible, what's blocking it, what it would unblock, its health, recent
// changes, and the recommended next move. Selecting any connected entity
// re-centers the inspector — so the chapter feels like one connected graph
// rather than a set of pages. Purely presentational over a serializable model.

import { useMemo, useState } from "react";
import { CardV2, StatusBadge, ButtonLink, type StatusTone } from "@/components/ui-v2";
import {
  NODE_KIND_LABELS,
  type DependencyVM,
  type EventVM,
  type MetricVM,
  type NodeRefVM,
  type OrgGraphViewModel,
  type RecommendationVM,
  type SummaryVM,
} from "@/lib/organization/view-model";
import type { NodeKind } from "@/lib/organization/types";

const KIND_ORDER: NodeKind[] = ["chapter", "partner", "curriculum", "instructor", "class", "student", "family"];

// Distinct per-kind accent dots (Tailwind default palette — always present).
const KIND_DOT: Record<NodeKind, string> = {
  chapter: "bg-brand-500",
  partner: "bg-blue-500",
  curriculum: "bg-amber-500",
  instructor: "bg-sky-500",
  class: "bg-violet-500",
  student: "bg-emerald-500",
  family: "bg-rose-400",
};

const REC_KIND_LABEL: Record<RecommendationVM["kind"], string> = {
  intervention: "Intervene",
  retention: "Retention",
  next_step: "Next step",
  assignment: "Assignment",
  expansion: "Expansion",
  recognition: "Recognition",
};

const REC_TONE: Record<RecommendationVM["kind"], StatusTone> = {
  intervention: "danger",
  retention: "warning",
  next_step: "brand",
  assignment: "info",
  expansion: "success",
  recognition: "success",
};

function Dot({ kind }: { kind: NodeKind }) {
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${KIND_DOT[kind]}`} aria-hidden />;
}

export function OrganizationGraphInspector({ model }: { model: OrgGraphViewModel }) {
  const [focusId, setFocusId] = useState(model.focusId || model.nodes[0]?.id);
  const [kindFilter, setKindFilter] = useState<NodeKind | "all">("all");
  const [query, setQuery] = useState("");

  const summary = focusId ? model.summaries[focusId] : undefined;

  const visibleNodes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return model.nodes.filter(
      (n) => (kindFilter === "all" || n.kind === kindFilter) && (!q || n.label.toLowerCase().includes(q))
    );
  }, [model.nodes, kindFilter, query]);

  const navigate = (id: string) => {
    if (model.summaries[id]) setFocusId(id);
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      {/* Left rail — the directory of every entity in the chapter. */}
      <aside className="flex flex-col gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the organization…"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
        <div className="flex flex-wrap gap-1.5">
          <KindChip active={kindFilter === "all"} onClick={() => setKindFilter("all")} label={`All ${model.nodes.length}`} />
          {KIND_ORDER.filter((k) => model.counts[k] > 0).map((k) => (
            <KindChip
              key={k}
              active={kindFilter === k}
              onClick={() => setKindFilter(k)}
              label={`${NODE_KIND_LABELS[k]} ${model.counts[k]}`}
            />
          ))}
        </div>
        <div className="max-h-[640px] overflow-y-auto rounded-xl border border-slate-200 bg-white">
          {visibleNodes.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">No entities match.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {visibleNodes.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => navigate(n.id)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-slate-50 ${
                      n.id === focusId ? "bg-brand-50" : ""
                    }`}
                  >
                    <Dot kind={n.kind} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">{n.label}</span>
                      <span className="block truncate text-[11px] text-slate-500">
                        {NODE_KIND_LABELS[n.kind]}
                        {n.status ? ` · ${n.status}` : ""}
                      </span>
                    </span>
                    <span className={`h-2 w-2 shrink-0 rounded-full ${toneBg(n.tone)}`} title={n.healthLabel} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Right — the focal entity's full graph context. */}
      <div className="min-w-0">{summary ? <Inspector summary={summary} onNavigate={navigate} /> : <Empty />}</div>
    </div>
  );
}

function Inspector({ summary, onNavigate }: { summary: SummaryVM; onNavigate: (id: string) => void }) {
  const { node } = summary;
  return (
    <div className="flex flex-col gap-5">
      <CardV2 className="border border-slate-200">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <Dot kind={node.kind} />
              {NODE_KIND_LABELS[node.kind]}
            </div>
            <h2 className="mt-1 truncate text-xl font-semibold text-slate-900">{node.label}</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">{summary.purpose}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              {node.status ? <StatusBadge tone="neutral">{node.status}</StatusBadge> : null}
              <StatusBadge tone={node.tone}>{node.healthLabel}</StatusBadge>
            </div>
            <ButtonLink href={node.href} variant="secondary" size="sm">
              Open record →
            </ButtonLink>
          </div>
        </div>

        {/* Health, transparently explained. */}
        <div className="mt-4">
          <HealthBar score={summary.healthScore} tone={node.tone} />
          {summary.healthReasons.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-slate-600">
              {summary.healthReasons.map((r, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-slate-400" aria-hidden />
                  {r}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* Connected reach. */}
        {summary.rollup.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {summary.rollup.map((m) => (
              <Stat key={m.label} metric={m} emphasis />
            ))}
          </div>
        ) : null}
        {summary.metrics.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {summary.metrics.map((m) => (
              <Stat key={m.label} metric={m} />
            ))}
          </div>
        ) : null}
      </CardV2>

      {/* Recommendations — deterministic, evidence-backed. */}
      {summary.recommendations.length > 0 ? (
        <Section title="Recommended next" subtitle="Evidence-backed, no guesswork">
          <div className="flex flex-col gap-2.5">
            {summary.recommendations.map((r) => (
              <Recommendation key={r.key} rec={r} onNavigate={onNavigate} />
            ))}
          </div>
        </Section>
      ) : null}

      {/* Blocked by + unblocks — the dependency cascade. */}
      {(summary.blockedBy.length > 0 || summary.unblocks.length > 0) && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {summary.blockedBy.length > 0 ? (
            <Section title="Blocked because" subtitle={`${summary.blockedBy.length} unresolved`}>
              <div className="flex flex-col gap-2">
                {summary.blockedBy.map((d) => (
                  <DependencyRow key={d.key} dep={d} onNavigate={onNavigate} />
                ))}
              </div>
            </Section>
          ) : null}
          {summary.unblocks.length > 0 ? (
            <Section title="Resolving this unblocks" subtitle={`${summary.unblocks.length} downstream`}>
              <NodeList nodes={summary.unblocks} onNavigate={onNavigate} />
            </Section>
          ) : null}
        </div>
      )}

      {/* Structural relationships. */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Section title="Depends on" subtitle="What this came from">
          {summary.dependsOn.length > 0 ? (
            <NodeList nodes={summary.dependsOn} onNavigate={onNavigate} />
          ) : (
            <Muted>Nothing upstream — this is a root.</Muted>
          )}
        </Section>
        <Section title="Enables" subtitle="What this makes possible">
          {summary.enables.length > 0 ? (
            <NodeList nodes={summary.enables} onNavigate={onNavigate} />
          ) : (
            <Muted>Nothing downstream yet.</Muted>
          )}
        </Section>
      </div>

      {/* Full dependency checklist. */}
      {summary.dependencies.length > 0 ? (
        <Section title="Dependencies" subtitle="Everything this needs to function">
          <div className="flex flex-col gap-2">
            {summary.dependencies.map((d) => (
              <DependencyRow key={d.key} dep={d} onNavigate={onNavigate} />
            ))}
          </div>
        </Section>
      ) : null}

      {/* Timeline. */}
      <Section title="Recent changes" subtitle="Everything that touches this entity">
        {summary.timeline.length > 0 ? (
          <ol className="flex flex-col gap-2.5">
            {summary.timeline.map((e) => (
              <TimelineRow key={e.id} event={e} />
            ))}
          </ol>
        ) : (
          <Muted>No recent activity.</Muted>
        )}
      </Section>
    </div>
  );
}

// --- Small presentational pieces -------------------------------------------

function KindChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
        active ? "border-brand-300 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {subtitle ? <span className="text-[11px] text-slate-500">{subtitle}</span> : null}
      </div>
      {children}
    </section>
  );
}

function NodeList({ nodes, onNavigate }: { nodes: NodeRefVM[]; onNavigate: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {nodes.map((n) => (
        <button
          key={n.id}
          type="button"
          onClick={() => onNavigate(n.id)}
          className="group flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left transition-colors hover:border-brand-300 hover:bg-brand-50"
        >
          <Dot kind={n.kind} />
          <span className="min-w-0">
            <span className="block max-w-[200px] truncate text-[13px] font-medium text-slate-900">{n.label}</span>
            <span className="block text-[11px] text-slate-500">{NODE_KIND_LABELS[n.kind]}</span>
          </span>
          <span className={`ml-1 h-1.5 w-1.5 rounded-full ${toneBg(n.tone)}`} title={n.healthLabel} aria-hidden />
        </button>
      ))}
    </div>
  );
}

function DependencyRow({ dep, onNavigate }: { dep: DependencyVM; onNavigate: (id: string) => void }) {
  const tone: StatusTone =
    dep.state === "satisfied" ? "success" : dep.state === "in_progress" ? "info" : dep.severity === "critical" ? "danger" : "warning";
  const stateLabel =
    dep.state === "satisfied" ? "Done" : dep.state === "in_progress" ? "In progress" : dep.state === "blocked" ? "Blocked" : "Unknown";
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-slate-900">{dep.label}</p>
        {dep.detail ? <p className="mt-0.5 text-[12px] text-slate-500">{dep.detail}</p> : null}
        {dep.nodeId ? (
          <button
            type="button"
            onClick={() => onNavigate(dep.nodeId!)}
            className="mt-1 text-[11.5px] font-medium text-brand-600 hover:underline"
          >
            View the dependency →
          </button>
        ) : null}
      </div>
      <StatusBadge tone={tone}>{stateLabel}</StatusBadge>
    </div>
  );
}

function Recommendation({ rec, onNavigate }: { rec: RecommendationVM; onNavigate: (id: string) => void }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusBadge tone={REC_TONE[rec.kind]}>{REC_KIND_LABEL[rec.kind]}</StatusBadge>
          <p className="text-[13.5px] font-semibold text-slate-900">{rec.title}</p>
        </div>
        <span className="text-[11px] uppercase tracking-wide text-slate-400">{rec.confidence} confidence</span>
      </div>
      <p className="mt-1 text-[12.5px] text-slate-600">{rec.detail}</p>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {rec.evidence.map((e, i) => (
          <li key={i} className="rounded bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-600">
            {e}
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-3">
        {rec.relatedNodeId ? (
          <button
            type="button"
            onClick={() => onNavigate(rec.relatedNodeId!)}
            className="text-[11.5px] font-medium text-brand-600 hover:underline"
          >
            View related →
          </button>
        ) : null}
        {rec.href ? (
          <a href={rec.href} className="text-[11.5px] font-medium text-brand-600 hover:underline">
            Take action →
          </a>
        ) : null}
      </div>
    </div>
  );
}

function TimelineRow({ event }: { event: EventVM }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-300" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-slate-800">{event.title}</p>
        {event.detail ? <p className="text-[12px] text-slate-500">{event.detail}</p> : null}
      </div>
      <span className="shrink-0 text-[11px] text-slate-400">{event.when}</span>
    </li>
  );
}

function Stat({ metric, emphasis }: { metric: MetricVM; emphasis?: boolean }) {
  return (
    <div
      className={`rounded-lg px-3 py-1.5 ${
        emphasis ? "bg-brand-50 text-brand-800" : "border border-slate-200 bg-white text-slate-800"
      }`}
    >
      <span className="text-base font-semibold">{metric.value}</span>
      <span className="ml-1.5 text-[11.5px] text-slate-500">{metric.label}</span>
    </div>
  );
}

function HealthBar({ score, tone }: { score: number; tone: StatusTone }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${toneBg(tone)}`} style={{ width: `${Math.max(4, Math.min(100, score))}%` }} />
      </div>
      <span className="text-[11px] font-medium text-slate-500">{score}/100</span>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-[12.5px] text-slate-400">{children}</p>;
}

function Empty() {
  return (
    <CardV2 className="border border-slate-200">
      <p className="text-sm text-slate-500">Select an entity to inspect its place in the organization.</p>
    </CardV2>
  );
}

// Solid fills for health dots and the health bar (Tailwind default palette).
function toneBg(tone: StatusTone): string {
  switch (tone) {
    case "success":
      return "bg-emerald-500";
    case "warning":
      return "bg-amber-500";
    case "danger":
      return "bg-red-500";
    case "info":
      return "bg-blue-500";
    case "brand":
      return "bg-brand-500";
    default:
      return "bg-slate-300";
  }
}
