// Pure query primitives over a built OrganizationGraph. Kept separate from the
// builder so dependency/timeline/recommendation modules can traverse the graph
// without importing the builder (which would create an import cycle).
//
// Edge direction is ENABLES (`from` enables `to`), so:
//   parents(node)  = incoming edges = upstream enablers / what it depends on
//   children(node) = outgoing edges = downstream beneficiaries / what it enables

import type { OrganizationGraph, OrgEdge, OrgNode } from "@/lib/organization/types";

export function getNode(graph: OrganizationGraph, id: string): OrgNode | undefined {
  return graph.nodeIndex.get(id);
}

/** Outgoing edges from `id` (what this node enables). */
export function outgoingEdges(graph: OrganizationGraph, id: string): OrgEdge[] {
  return graph.edges.filter((e) => e.from === id);
}

/** Incoming edges to `id` (what this node depends on / came from). */
export function incomingEdges(graph: OrganizationGraph, id: string): OrgEdge[] {
  return graph.edges.filter((e) => e.to === id);
}

/** Parents = upstream enablers (incoming edges). */
export function parentsOf(graph: OrganizationGraph, id: string): OrgNode[] {
  return dedupeNodes(incomingEdges(graph, id).map((e) => graph.nodeIndex.get(e.from)));
}

/** Children = downstream beneficiaries (outgoing edges) — what this enables. */
export function childrenOf(graph: OrganizationGraph, id: string): OrgNode[] {
  return dedupeNodes(outgoingEdges(graph, id).map((e) => graph.nodeIndex.get(e.to)));
}

/** All ancestors (transitive parents) — used to cascade a timeline upward. */
export function ancestorsOf(graph: OrganizationGraph, id: string): OrgNode[] {
  return traverse(graph, id, "up");
}

/** All descendants (transitive children). */
export function descendantsOf(graph: OrganizationGraph, id: string): OrgNode[] {
  return traverse(graph, id, "down");
}

function traverse(graph: OrganizationGraph, id: string, dir: "up" | "down"): OrgNode[] {
  const seen = new Set<string>([id]);
  const out: OrgNode[] = [];
  const next = (cur: string) =>
    dir === "up" ? incomingEdges(graph, cur).map((e) => e.from) : outgoingEdges(graph, cur).map((e) => e.to);
  const stack = [...next(id)];
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    const node = graph.nodeIndex.get(cur);
    if (node) out.push(node);
    for (const n of next(cur)) stack.push(n);
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

export function dedupeNodes(nodes: (OrgNode | undefined)[]): OrgNode[] {
  const seen = new Set<string>();
  const out: OrgNode[] = [];
  for (const n of nodes) {
    if (!n || seen.has(n.id)) continue;
    seen.add(n.id);
    out.push(n);
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}
