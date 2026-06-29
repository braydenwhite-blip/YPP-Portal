// The Graph Inspector payload. For any node, assemble everything it knows about
// itself and its place in the organization: why it exists, what it came from,
// what it makes possible, what it depends on, what's blocking it, what it would
// unblock, its health, rolled-up reach, recent changes, and the recommended
// next move. Pure — a projection of the built graph.

import type {
  EntitySummary,
  NodeDependency,
  NodeMetric,
  OrganizationGraph,
  OrgNode,
} from "@/lib/organization/types";
import { childrenOf, descendantsOf, parentsOf } from "@/lib/organization/query";
import { blockedByOf } from "@/lib/organization/dependencies";
import { recentChanges } from "@/lib/organization/timeline";
import { recommendForNode } from "@/lib/organization/recommendations";

/**
 * Downstream nodes currently blocked because THIS node is an unresolved,
 * blocking dependency of theirs. This is the cascade: resolve this node and
 * everything in this list becomes possible.
 */
export function unblocksOf(graph: OrganizationGraph, id: string): OrgNode[] {
  const out: OrgNode[] = [];
  for (const desc of descendantsOf(graph, id)) {
    const deps = graph.dependencies.get(desc.id) ?? [];
    if (deps.some((d) => d.nodeId === id && d.blocking && d.state === "blocked")) out.push(desc);
  }
  return out;
}

function countMetric(label: string, nodes: OrgNode[]): NodeMetric {
  return { label, value: nodes.length };
}

function uniqueById(nodes: OrgNode[]): OrgNode[] {
  const seen = new Set<string>();
  const out: OrgNode[] = [];
  for (const n of nodes) {
    if (seen.has(n.id)) continue;
    seen.add(n.id);
    out.push(n);
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/** The connected-reach roll-up shown at the top of an Entity 360. */
function rollupFor(graph: OrganizationGraph, node: OrgNode): NodeMetric[] {
  const descendants = descendantsOf(graph, node.id);
  const byKind = (k: OrgNode["kind"], list = descendants) => list.filter((n) => n.kind === k);
  switch (node.kind) {
    case "partner": {
      const classes = childrenOf(graph, node.id).filter((n) => n.kind === "class");
      const instructors = uniqueById(classes.flatMap((c) => parentsOf(graph, c.id).filter((n) => n.kind === "instructor")));
      return [
        countMetric("Classes", classes),
        countMetric("Students", byKind("student")),
        countMetric("Instructors", instructors),
      ];
    }
    case "instructor":
      return [
        countMetric("Classes", childrenOf(graph, node.id).filter((n) => n.kind === "class")),
        countMetric("Students", byKind("student")),
      ];
    case "curriculum":
      return [
        countMetric("Classes", childrenOf(graph, node.id).filter((n) => n.kind === "class")),
        countMetric("Students", byKind("student")),
      ];
    case "class":
      return [countMetric("Students", childrenOf(graph, node.id).filter((n) => n.kind === "student"))];
    case "chapter":
      return [
        countMetric("Partners", graph.nodes.filter((n) => n.kind === "partner")),
        countMetric("Curricula", graph.nodes.filter((n) => n.kind === "curriculum")),
        countMetric("Instructors", graph.nodes.filter((n) => n.kind === "instructor")),
        countMetric("Classes", graph.nodes.filter((n) => n.kind === "class")),
        countMetric("Students", graph.nodes.filter((n) => n.kind === "student")),
      ];
    case "student":
      return [countMetric("Classes", parentsOf(graph, node.id).filter((n) => n.kind === "class"))];
    case "family":
      return [countMetric("Students", childrenOf(graph, node.id).filter((n) => n.kind === "student"))];
  }
}

/** Build the full Entity 360 / Graph Inspector summary for one node. */
export function summarizeEntity(graph: OrganizationGraph, id: string): EntitySummary | null {
  const node = graph.nodeIndex.get(id);
  if (!node) return null;
  const dependencies: NodeDependency[] = graph.dependencies.get(id) ?? [];
  const parents = parentsOf(graph, id);
  const children = childrenOf(graph, id);
  return {
    node,
    purpose: node.purpose,
    parents,
    enables: children,
    dependsOn: parents,
    dependencies,
    blockedBy: blockedByOf(dependencies),
    unblocks: unblocksOf(graph, id),
    health: node.health,
    metrics: node.metrics,
    rollup: rollupFor(graph, node),
    timeline: recentChanges(graph, id, 8),
    recommendations: recommendForNode(graph, id),
  };
}

/** Summaries for every node, in the graph's canonical node order. */
export function summarizeAll(graph: OrganizationGraph): EntitySummary[] {
  return graph.nodes.map((n) => summarizeEntity(graph, n.id)).filter((s): s is EntitySummary => s != null);
}
