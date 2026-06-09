import { getInitiativeProfile, type InitiativeDependencyDef } from "./strategic-initiative-profile";
import type { InitiativeHealthLevel, InitiativeHealthTone } from "./strategic-initiative-health";
import { initiativeHref } from "./strategic-timeline";

/**
 * YPP Execution OS — DEPENDENCY ENGINE (Phase G).
 *
 * Initiatives don't execute in isolation: Camp Expansion depends on Camp
 * Partnerships, Instructor Recruitment depends on Instructor Training. This engine
 * reads the DECLARED dependencies (config, Phase G) across the portfolio and
 * derives the graph leadership actually needs — blocked-by, unlocks, the critical
 * path, and (crucially) which dependencies are a LIVE risk because the upstream
 * prerequisite is itself unhealthy. It answers "what is actually holding us back?".
 *
 * Edges are normalized to a single canonical direction: `from` ENABLES `to`
 * (from must progress before to can finish). A declared `depends_on B` on A
 * becomes B → A; a declared `blocks B` on A becomes A → B; `relates_to` is an
 * undirected relation kept separate from the enabling DAG. Pure.
 */

export type DependencyRelationType = "depends_on" | "blocks" | "relates_to";

/** The minimal projection of an initiative the graph needs (built from a summary). */
export type DependencyInitiativeInput = {
  id: string;
  title: string;
  healthLevel: InitiativeHealthLevel;
  healthLabel: string;
  healthTone: InitiativeHealthTone;
  progressPercent: number;
  status: string;
};

export type DependencyEdge = {
  id: string;
  fromId: string;
  toId: string;
  fromTitle: string;
  toTitle: string;
  relation: DependencyRelationType;
  reason: string | null;
  viaWorkstreamId: string | null;
  /** The upstream (`from`) node is unhealthy → this dependency is a live bottleneck. */
  blocking: boolean;
};

export type DependencyNode = {
  id: string;
  title: string;
  healthLevel: InitiativeHealthLevel;
  healthLabel: string;
  healthTone: InitiativeHealthTone;
  progressPercent: number;
  status: string;
  href: string;
  /** True for an external prerequisite that is not a tracked initiative. */
  external: boolean;
  /** Upstream prerequisites (this node is blocked by these). */
  blockedByIds: string[];
  /** Downstream initiatives this node unlocks. */
  unlocksIds: string[];
  /** Any upstream prerequisite is unhealthy. */
  atRisk: boolean;
  onCriticalPath: boolean;
};

export type DependencyGraph = {
  nodes: DependencyNode[];
  /** Directed enabling edges (the DAG). */
  edges: DependencyEdge[];
  /** Undirected relates_to links. */
  relations: DependencyEdge[];
  /** The longest enabling chain, as node ids (the critical path). */
  criticalPath: string[];
  /** Edges that are a live risk because the upstream node is unhealthy. */
  blockedByRisk: DependencyEdge[];
  stats: { nodes: number; edges: number; blocked: number; atRisk: number };
};

function isUnhealthy(level: InitiativeHealthLevel): boolean {
  return level === "at_risk" || level === "critical";
}

type RawEdge = {
  fromId: string;
  toId: string;
  relation: DependencyRelationType;
  reason: string | null;
  viaWorkstreamId: string | null;
};

/** Normalize one declared dependency on `ownerId` to a canonical raw edge. */
function normalizeDependency(ownerId: string, dep: InitiativeDependencyDef): RawEdge | null {
  const target = dep.targetInitiativeId ?? (dep.targetLabel ? `external:${dep.targetLabel}` : null);
  if (!target) return null;
  const reason = dep.reason ?? null;
  const via = dep.workstreamId ?? null;
  if (dep.type === "depends_on") {
    // owner depends on target → target enables owner.
    return { fromId: target, toId: ownerId, relation: "depends_on", reason, viaWorkstreamId: via };
  }
  if (dep.type === "blocks") {
    // owner blocks target → owner enables (must clear before) target.
    return { fromId: ownerId, toId: target, relation: "blocks", reason, viaWorkstreamId: via };
  }
  return { fromId: ownerId, toId: target, relation: "relates_to", reason, viaWorkstreamId: via };
}

export type DeriveDependencyGraphInput = {
  initiatives: DependencyInitiativeInput[];
  /** Resolve an initiative's declared dependencies; defaults to the config profile. */
  getDependencies?: (initiativeId: string) => InitiativeDependencyDef[];
};

/** Build the portfolio dependency graph. Pure. */
export function deriveDependencyGraph(input: DeriveDependencyGraphInput): DependencyGraph {
  const resolve = input.getDependencies ?? ((id: string) => getInitiativeProfile(id).dependencies);

  const nodeMap = new Map<string, DependencyNode>();
  for (const i of input.initiatives) {
    nodeMap.set(i.id, {
      id: i.id,
      title: i.title,
      healthLevel: i.healthLevel,
      healthLabel: i.healthLabel,
      healthTone: i.healthTone,
      progressPercent: i.progressPercent,
      status: i.status,
      href: initiativeHref(i.id),
      external: false,
      blockedByIds: [],
      unlocksIds: [],
      atRisk: false,
      onCriticalPath: false,
    });
  }

  const ensureExternal = (id: string): DependencyNode => {
    let node = nodeMap.get(id);
    if (!node) {
      const label = id.startsWith("external:") ? id.slice("external:".length) : id;
      node = {
        id,
        title: label,
        healthLevel: "healthy",
        healthLabel: "External",
        healthTone: "neutral",
        progressPercent: 0,
        status: "external",
        href: "#",
        external: true,
        blockedByIds: [],
        unlocksIds: [],
        atRisk: false,
        onCriticalPath: false,
      };
      nodeMap.set(id, node);
    }
    return node;
  };

  // Collect + dedupe raw edges across all initiatives.
  const seen = new Set<string>();
  const enabling: DependencyEdge[] = [];
  const relations: DependencyEdge[] = [];
  for (const i of input.initiatives) {
    for (const dep of resolve(i.id)) {
      const raw = normalizeDependency(i.id, dep);
      if (!raw) continue;
      const key = `${raw.relation}:${raw.fromId}->${raw.toId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const from = ensureExternal(raw.fromId);
      const to = ensureExternal(raw.toId);
      const edge: DependencyEdge = {
        id: key,
        fromId: raw.fromId,
        toId: raw.toId,
        fromTitle: from.title,
        toTitle: to.title,
        relation: raw.relation,
        reason: raw.reason,
        viaWorkstreamId: raw.viaWorkstreamId,
        blocking: raw.relation !== "relates_to" && isUnhealthy(from.healthLevel) && from.status !== "completed",
      };
      if (raw.relation === "relates_to") {
        relations.push(edge);
      } else {
        enabling.push(edge);
        to.blockedByIds.push(from.id);
        from.unlocksIds.push(to.id);
        if (isUnhealthy(from.healthLevel) && from.status !== "completed") to.atRisk = true;
      }
    }
  }

  // Critical path = the longest enabling chain (memoized DFS on the DAG; cycles
  // are guarded so a malformed config can never hang).
  const adj = new Map<string, string[]>();
  for (const e of enabling) {
    const list = adj.get(e.fromId) ?? [];
    list.push(e.toId);
    adj.set(e.fromId, list);
  }
  const longestFrom = new Map<string, string[]>();
  const visiting = new Set<string>();
  const longest = (id: string): string[] => {
    const cached = longestFrom.get(id);
    if (cached) return cached;
    if (visiting.has(id)) return [id]; // cycle guard
    visiting.add(id);
    let best: string[] = [];
    for (const next of adj.get(id) ?? []) {
      const chain = longest(next);
      if (chain.length > best.length) best = chain;
    }
    visiting.delete(id);
    const path = [id, ...best];
    longestFrom.set(id, path);
    return path;
  };

  let criticalPath: string[] = [];
  for (const node of nodeMap.values()) {
    const path = longest(node.id);
    if (path.length > criticalPath.length) criticalPath = path;
  }
  const onPath = new Set(criticalPath);
  for (const node of nodeMap.values()) {
    if (onPath.has(node.id)) node.onCriticalPath = true;
  }

  const blockedByRisk = enabling.filter((e) => e.blocking);

  const nodes = [...nodeMap.values()].sort(
    (a, b) =>
      Number(a.external) - Number(b.external) ||
      b.blockedByIds.length - a.blockedByIds.length ||
      a.title.localeCompare(b.title)
  );

  return {
    nodes,
    edges: enabling,
    relations,
    criticalPath: criticalPath.length > 1 ? criticalPath : [],
    blockedByRisk,
    stats: {
      nodes: nodes.length,
      edges: enabling.length,
      blocked: blockedByRisk.length,
      atRisk: nodes.filter((n) => n.atRisk).length,
    },
  };
}

/** The dependency view for ONE initiative (its slice of the portfolio graph). Pure. */
export type InitiativeDependencyView = {
  blockedBy: DependencyEdge[];
  unlocks: DependencyEdge[];
  relatedTo: DependencyEdge[];
  onCriticalPath: boolean;
  atRisk: boolean;
};

export function selectInitiativeDependencies(
  graph: DependencyGraph,
  initiativeId: string
): InitiativeDependencyView {
  const node = graph.nodes.find((n) => n.id === initiativeId);
  return {
    blockedBy: graph.edges.filter((e) => e.toId === initiativeId),
    unlocks: graph.edges.filter((e) => e.fromId === initiativeId),
    relatedTo: graph.relations.filter((e) => e.fromId === initiativeId || e.toId === initiativeId),
    onCriticalPath: node?.onCriticalPath ?? false,
    atRisk: node?.atRisk ?? false,
  };
}
