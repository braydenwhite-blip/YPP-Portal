// A serializable view model for the Organization Graph inspector UI. Pure: it
// projects the built graph (which holds Maps + Dates) into plain objects safe to
// pass from a server component to a client component. Keeping it here (not in the
// page) means it is unit-testable and the page stays a thin load-and-render shell.

import type {
  NodeDependency,
  NodeHealth,
  NodeKind,
  NodeMetric,
  OrganizationGraph,
  OrgEvent,
  OrgNode,
  Recommendation,
} from "@/lib/organization/types";
import { summarizeEntity } from "@/lib/organization/entity-summary";

export type NodeRefVM = {
  id: string;
  kind: NodeKind;
  label: string;
  sublabel?: string;
  tone: NodeHealth["tone"];
  healthLabel: string;
  status?: string;
  href: string;
};

export type DependencyVM = {
  key: string;
  label: string;
  state: NodeDependency["state"];
  severity: NodeDependency["severity"];
  blocking: boolean;
  detail?: string;
  href?: string;
  nodeId?: string;
};

export type EventVM = { id: string; kind: OrgEvent["kind"]; title: string; detail?: string; when: string; href?: string };

export type MetricVM = { label: string; value: string | number; tone?: NodeMetric["tone"] };

export type RecommendationVM = {
  key: string;
  kind: Recommendation["kind"];
  title: string;
  detail: string;
  evidence: string[];
  confidence: Recommendation["confidence"];
  href?: string;
  relatedNodeId?: string;
};

export type SummaryVM = {
  node: NodeRefVM;
  purpose: string;
  healthReasons: string[];
  healthScore: number;
  parents: NodeRefVM[];
  enables: NodeRefVM[];
  dependsOn: NodeRefVM[];
  dependencies: DependencyVM[];
  blockedBy: DependencyVM[];
  unblocks: NodeRefVM[];
  metrics: MetricVM[];
  rollup: MetricVM[];
  timeline: EventVM[];
  recommendations: RecommendationVM[];
};

export const NODE_KIND_LABELS: Record<NodeKind, string> = {
  chapter: "Chapter",
  partner: "Partner",
  curriculum: "Curriculum",
  instructor: "Instructor",
  class: "Class",
  student: "Student",
  family: "Family",
};

export type OrgGraphViewModel = {
  chapter: { id: string; name: string; location: string | null; health: NodeHealth };
  generatedWhen: string;
  /** Picker entries, in the graph's canonical order. */
  nodes: NodeRefVM[];
  counts: Record<NodeKind, number>;
  /** node id -> full inspector payload. */
  summaries: Record<string, SummaryVM>;
  /** The single most useful focal node to open first (worst-health, highest reach). */
  focusId: string;
};

function nodeRef(n: OrgNode): NodeRefVM {
  return {
    id: n.id,
    kind: n.kind,
    label: n.label,
    sublabel: n.sublabel,
    tone: n.health.tone,
    healthLabel: n.health.label,
    status: n.status,
    href: n.href,
  };
}

function depVM(d: NodeDependency): DependencyVM {
  return {
    key: d.key,
    label: d.label,
    state: d.state,
    severity: d.severity,
    blocking: d.blocking,
    detail: d.detail,
    href: d.href,
    nodeId: d.nodeId,
  };
}

function metricVM(m: NodeMetric): MetricVM {
  return { label: m.label, value: m.value, tone: m.tone };
}

const DAY_MS = 86_400_000;
function formatWhen(date: Date, now: Date): string {
  const diff = now.getTime() - date.getTime();
  if (diff < 0) return "soon";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return mins <= 1 ? "just now" : `${mins}m ago`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(diff / DAY_MS);
  if (days < 30) return days === 1 ? "yesterday" : `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function eventVM(e: OrgEvent, now: Date): EventVM {
  return { id: e.id, kind: e.kind, title: e.title, detail: e.detail, when: formatWhen(e.occurredAt, now), href: e.href };
}

function recVM(r: Recommendation): RecommendationVM {
  return {
    key: r.key,
    kind: r.kind,
    title: r.title,
    detail: r.detail,
    evidence: r.evidence,
    confidence: r.confidence,
    href: r.href,
    relatedNodeId: r.relatedNodeId,
  };
}

/** Pick the most useful node to open first: worst health, then widest reach. */
function pickFocus(graph: OrganizationGraph): string {
  const toneRank: Record<NodeHealth["tone"], number> = { danger: 0, warning: 1, neutral: 2, success: 3 };
  const ranked = [...graph.nodes].sort((a, b) => {
    if (a.kind === "chapter") return 1; // chapter is the fallback, not the focus
    if (b.kind === "chapter") return -1;
    const t = toneRank[a.health.tone] - toneRank[b.health.tone];
    if (t !== 0) return t;
    return a.id.localeCompare(b.id);
  });
  return ranked[0]?.id ?? graph.nodes[0]?.id ?? "";
}

/** Project the built graph into a serializable inspector view model. */
export function toGraphViewModel(graph: OrganizationGraph, now: Date = new Date()): OrgGraphViewModel {
  const counts = { chapter: 0, partner: 0, curriculum: 0, instructor: 0, class: 0, student: 0, family: 0 } as Record<NodeKind, number>;
  for (const n of graph.nodes) counts[n.kind] += 1;

  const summaries: Record<string, SummaryVM> = {};
  for (const node of graph.nodes) {
    const s = summarizeEntity(graph, node.id);
    if (!s) continue;
    summaries[node.id] = {
      node: nodeRef(s.node),
      purpose: s.purpose,
      healthReasons: s.health.reasons,
      healthScore: s.health.score,
      parents: s.parents.map(nodeRef),
      enables: s.enables.map(nodeRef),
      dependsOn: s.dependsOn.map(nodeRef),
      dependencies: s.dependencies.map(depVM),
      blockedBy: s.blockedBy.map(depVM),
      unblocks: s.unblocks.map(nodeRef),
      metrics: s.metrics.map(metricVM),
      rollup: s.rollup.map(metricVM),
      timeline: s.timeline.map((e) => eventVM(e, now)),
      recommendations: s.recommendations.map(recVM),
    };
  }

  const chapterNode = graph.nodes.find((n) => n.kind === "chapter");
  return {
    chapter: {
      id: graph.chapterId,
      name: chapterNode?.label ?? "Chapter",
      location: chapterNode?.sublabel ?? null,
      health: chapterNode?.health ?? { label: "Unknown", tone: "neutral", score: 0, reasons: [] },
    },
    generatedWhen: formatWhen(graph.generatedAt, now),
    nodes: graph.nodes.map(nodeRef),
    counts,
    summaries,
    focusId: pickFocus(graph),
  };
}
