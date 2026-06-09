import { MILESTONE_STATUS_META } from "./strategic-milestones";
import type { WorkstreamSummary } from "./strategic-workstreams";
import type { StrategicTimelineEvent } from "./strategic-timeline";
import type { DecisionCenter } from "./strategic-decision-center";
import { initiativeHref } from "./strategic-timeline";

/**
 * YPP Execution OS — EXECUTION GRAPH (Phase J), the crown jewel.
 *
 * The whole chain, made transparent:
 *   Initiative → Workstream → Milestone → Decision → Meeting → Action → Outcome
 *
 * The graph is built ONLY from real, provable links:
 *   - containment is structural and true (initiative ⊃ workstream ⊃ milestone, and
 *     a milestone ⊃ the actions whose ids it rolled up);
 *   - flow edges are real too (a decision was recorded at a meeting; an action,
 *     when completed, produced an outcome).
 * We never invent "this decision caused that action" links we cannot prove —
 * decisions/meetings attach where the data actually connects them. Pure.
 */

export type GraphLayer =
  | "initiative"
  | "workstream"
  | "milestone"
  | "decision"
  | "meeting"
  | "action"
  | "outcome";

export const GRAPH_LAYER_ORDER: GraphLayer[] = [
  "initiative",
  "workstream",
  "milestone",
  "decision",
  "meeting",
  "action",
  "outcome",
];

export const GRAPH_LAYER_LABEL: Record<GraphLayer, string> = {
  initiative: "Initiative",
  workstream: "Workstreams",
  milestone: "Milestones",
  decision: "Decisions",
  meeting: "Meetings",
  action: "Actions",
  outcome: "Outcomes",
};

export type GraphTone = "success" | "info" | "warning" | "overdue" | "neutral" | "purple";

export type GraphNode = {
  id: string;
  layer: GraphLayer;
  label: string;
  sublabel: string | null;
  tone: GraphTone;
  href: string | null;
};

export type GraphEdgeKind = "contains" | "leads_to";
export type GraphEdge = { id: string; fromId: string; toId: string; kind: GraphEdgeKind };

export type ExecutionGraphLayer = { layer: GraphLayer; label: string; nodes: GraphNode[] };

export type ExecutionGraph = {
  layers: ExecutionGraphLayer[];
  edges: GraphEdge[];
  stats: {
    workstreams: number;
    milestones: number;
    decisions: number;
    meetings: number;
    actions: number;
    outcomes: number;
  };
};

const MILESTONE_TONE: Record<string, GraphTone> = {
  complete: "success",
  in_progress: "info",
  not_started: "neutral",
  at_risk: "warning",
  blocked: "overdue",
};

const HEALTH_TONE: Record<string, GraphTone> = {
  healthy: "success",
  drifting: "info",
  at_risk: "warning",
  critical: "overdue",
  completed: "success",
  archived: "neutral",
};

export type DeriveExecutionGraphInput = {
  initiativeId: string;
  initiativeTitle: string;
  initiativeHealthLevel: string;
  workstreams: WorkstreamSummary[];
  /** Past timeline events (action/meeting/decision/outcome flow). */
  timelineEvents: StrategicTimelineEvent[];
  decisionCenter: DecisionCenter;
  limits?: { decisions?: number; meetings?: number; actions?: number; outcomes?: number };
};

/** Build the execution graph for one initiative. Pure. */
export function deriveExecutionGraph(input: DeriveExecutionGraphInput): ExecutionGraph {
  const limits = input.limits ?? {};
  const href = initiativeHref(input.initiativeId);
  const nodes: Record<GraphLayer, GraphNode[]> = {
    initiative: [],
    workstream: [],
    milestone: [],
    decision: [],
    meeting: [],
    action: [],
    outcome: [],
  };
  const edges: GraphEdge[] = [];
  const nodeIds = new Set<string>();
  const addEdge = (fromId: string, toId: string, kind: GraphEdgeKind) => {
    edges.push({ id: `${kind}:${fromId}->${toId}`, fromId, toId, kind });
  };

  // Layer 1 — the initiative root.
  const rootId = `initiative:${input.initiativeId}`;
  nodes.initiative.push({
    id: rootId,
    layer: "initiative",
    label: input.initiativeTitle,
    sublabel: null,
    tone: HEALTH_TONE[input.initiativeHealthLevel] ?? "neutral",
    href,
  });
  nodeIds.add(rootId);

  // Layers 2 + 3 — workstreams ⊃ milestones ⊃ (their actions).
  const actionToMilestone = new Map<string, string>();
  for (const ws of input.workstreams) {
    const wsId = `workstream:${ws.id}`;
    nodes.workstream.push({
      id: wsId,
      layer: "workstream",
      label: ws.title,
      sublabel: `${ws.openActions} open · ${ws.progress.percent}%`,
      tone: HEALTH_TONE[ws.health.level] ?? "neutral",
      href: ws.href,
    });
    nodeIds.add(wsId);
    addEdge(rootId, wsId, "contains");

    for (const ms of ws.milestones) {
      const msId = `milestone:${ms.id}`;
      if (!nodeIds.has(msId)) {
        nodes.milestone.push({
          id: msId,
          layer: "milestone",
          label: ms.title,
          sublabel: `${ms.statusLabel} · ${ms.percent}%`,
          tone: MILESTONE_TONE[ms.status] ?? "neutral",
          href: `${href}#milestone-${ms.id}`,
        });
        nodeIds.add(msId);
      }
      addEdge(wsId, msId, "contains");
      for (const aid of ms.actionIds) actionToMilestone.set(aid, msId);
    }
  }

  // Layer 4 + 5 — decisions, and the meetings they were recorded at.
  const meetingNodeIds = new Set<string>();
  const decisions = input.decisionCenter.history.slice(0, limits.decisions ?? 8);
  for (const d of decisions) {
    const dId = `decision:${d.id}`;
    nodes.decision.push({
      id: dId,
      layer: "decision",
      label: d.decision,
      sublabel: d.areaLabel,
      tone: d.critical ? "warning" : d.hasLinkedAction ? "success" : "neutral",
      href: d.href,
    });
    nodeIds.add(dId);
    addEdge(rootId, dId, "leads_to");
    const mId = `meeting:${d.meetingId}`;
    if (!meetingNodeIds.has(mId)) {
      nodes.meeting.push({
        id: mId,
        layer: "meeting",
        label: d.meetingTitle,
        sublabel: d.areaLabel,
        tone: "neutral",
        href: d.href,
      });
      meetingNodeIds.add(mId);
      nodeIds.add(mId);
    }
    addEdge(dId, mId, "leads_to");
  }

  // Add a few more recent meetings from the timeline (even with no decision).
  const meetingLimit = limits.meetings ?? 8;
  for (const e of input.timelineEvents) {
    if (e.type !== "meeting") continue;
    const mId = `meeting:${e.id.replace(/^meeting:/, "")}`;
    if (meetingNodeIds.has(mId)) continue;
    if (nodes.meeting.length >= meetingLimit) break;
    nodes.meeting.push({
      id: mId,
      layer: "meeting",
      label: e.title,
      sublabel: e.entity?.label ?? null,
      tone: e.severity === "watch" ? "warning" : "neutral",
      href: e.href,
    });
    meetingNodeIds.add(mId);
    nodeIds.add(mId);
    addEdge(rootId, mId, "leads_to");
  }

  // Layer 6 + 7 — actions, and the outcomes completed ones produced.
  const actionLimit = limits.actions ?? 14;
  const outcomeLimit = limits.outcomes ?? 14;
  const completedActionIds = new Set<string>();
  for (const e of input.timelineEvents) {
    if (e.type === "action_completed") {
      completedActionIds.add(e.id.replace(/^action_completed:/, ""));
    }
  }

  const seenAction = new Set<string>();
  for (const e of input.timelineEvents) {
    if (e.type !== "action_created") continue;
    const actionId = e.id.replace(/^action_created:/, "");
    if (seenAction.has(actionId)) continue;
    seenAction.add(actionId);
    if (nodes.action.length >= actionLimit) break;
    const aId = `action:${actionId}`;
    const completed = completedActionIds.has(actionId);
    nodes.action.push({
      id: aId,
      layer: "action",
      label: e.title,
      sublabel: completed ? "completed" : e.ownerName ?? null,
      tone: completed ? "success" : "info",
      href: e.href,
    });
    nodeIds.add(aId);
    // Connect to its milestone when known, else straight to the initiative.
    const parent = actionToMilestone.get(actionId);
    addEdge(parent && nodeIds.has(parent) ? parent : rootId, aId, "contains");

    if (completed) {
      const oId = `outcome:${actionId}`;
      if (nodes.outcome.length < outcomeLimit) {
        nodes.outcome.push({
          id: oId,
          layer: "outcome",
          label: e.title,
          sublabel: "delivered",
          tone: "success",
          href: e.href,
        });
        nodeIds.add(oId);
        addEdge(aId, oId, "leads_to");
      }
    }
  }

  const layers: ExecutionGraphLayer[] = GRAPH_LAYER_ORDER.map((layer) => ({
    layer,
    label: GRAPH_LAYER_LABEL[layer],
    nodes: nodes[layer],
  })).filter((l) => l.nodes.length > 0);

  return {
    layers,
    edges,
    stats: {
      workstreams: nodes.workstream.length,
      milestones: nodes.milestone.length,
      decisions: nodes.decision.length,
      meetings: nodes.meeting.length,
      actions: nodes.action.length,
      outcomes: nodes.outcome.length,
    },
  };
}
