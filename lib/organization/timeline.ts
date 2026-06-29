// The timeline engine. There is ONE event model (OrgEvent). Because the graph
// builder expands every event onto its structural ancestors, a single feed
// projects onto every entity it affects: an attendance event on a class also
// appears on that class's instructor, partner, curriculum, and the chapter.
// Pure + deterministic.

import type { OrganizationGraph, OrgEvent, OrgEventKind } from "@/lib/organization/types";

/** Recent events that touch `nodeId`, newest-first, capped. */
export function timelineForNode(
  graph: OrganizationGraph,
  nodeId: string,
  opts: { limit?: number } = {}
): OrgEvent[] {
  const out = graph.events.filter((e) => e.nodeIds.includes(nodeId));
  return opts.limit != null ? out.slice(0, opts.limit) : out;
}

/** Merge any number of event lists into one feed, newest-first, deduped by id. */
export function mergeEvents(...lists: OrgEvent[][]): OrgEvent[] {
  const seen = new Set<string>();
  const out: OrgEvent[] = [];
  for (const list of lists)
    for (const e of list) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      out.push(e);
    }
  return out.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime() || a.id.localeCompare(b.id));
}

/** Group an event feed by kind, preserving each group's order. */
export function groupByKind(events: OrgEvent[]): Partial<Record<OrgEventKind, OrgEvent[]>> {
  const out: Partial<Record<OrgEventKind, OrgEvent[]>> = {};
  for (const e of events) (out[e.kind] ??= []).push(e);
  return out;
}

/** A short "what changed recently" digest for a node. */
export function recentChanges(graph: OrganizationGraph, nodeId: string, limit = 6): OrgEvent[] {
  return timelineForNode(graph, nodeId, { limit });
}
