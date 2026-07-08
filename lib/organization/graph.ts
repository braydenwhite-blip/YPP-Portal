// The pure Organization Graph builder.
//
// `buildOrganizationGraph` takes already-loaded, chapter-scoped record shapes
// (the same data the chapter operating system loads) and assembles a normalized,
// deduplicated node + edge graph. Edges point in the ENABLES direction:
// `from` is an input/prerequisite, `to` is the output/beneficiary. So a node's
// PARENTS are what it depends on and its CHILDREN are what it makes possible.
//
// Everything is pure + deterministic: nodes are deduped by id, edges by
// (from,to,kind), and every collection is sorted by a stable key so the same
// input always yields identical output.

import {
  nodeId,
  type ChapterInput,
  type ClassInput,
  type CurriculumInput,
  type EdgeKind,
  type EnrollmentInput,
  type FamilyInput,
  type GraphBlocker,
  type NodeDependency,
  type NodeKind,
  type NodeMetric,
  type OrganizationGraph,
  type OrganizationGraphInput,
  type OrgEdge,
  type OrgEvent,
  type OrgNode,
  type PartnerInput,
  type PersonInput,
} from "@/lib/organization/types";
import {
  chapterNodeHealth,
  classNodeHealth,
  curriculumNodeHealth,
  partnerNodeHealth,
  personNodeHealth,
  rollupHealth,
} from "@/lib/organization/health";
import {
  classDependencies,
  curriculumDependencies,
  instructorDependencies,
  partnerDependencies,
  studentDependencies,
} from "@/lib/organization/dependencies";
import { ancestorsOf, childrenOf, parentsOf } from "@/lib/organization/query";

const EDGE_LABELS: Record<EdgeKind, string> = {
  HOSTS: "hosts",
  OPERATES: "operates at",
  POWERS: "is powered by",
  TEACHES: "is taught by",
  ENROLLS: "serves",
  GUARDIAN_OF: "supports",
};

// --- Node builders ----------------------------------------------------------

function metric(label: string, value: string | number, tone?: NodeMetric["tone"]): NodeMetric {
  return tone ? { label, value, tone } : { label, value };
}

function chapterNode(c: ChapterInput): OrgNode {
  return {
    id: nodeId("chapter", c.id),
    kind: "chapter",
    entityId: c.id,
    label: c.name,
    sublabel: c.location ?? undefined,
    href: "/chapter",
    status: c.lifecycleLabel,
    health: c.health ?? chapterNodeHealth(c.lifecycleStatus),
    purpose:
      "The chapter — the root of everything its partners, classes, instructors, and students make possible.",
    metrics: [],
  };
}

function partnerNode(p: PartnerInput): OrgNode {
  return {
    id: nodeId("partner", p.id),
    kind: "partner",
    entityId: p.id,
    label: p.name,
    sublabel: p.type ?? undefined,
    href: `/admin/partners/${p.id}`,
    status: p.stageLabel,
    health: partnerNodeHealth(p),
    purpose: "A partner — the venue and relationship that lets classes operate and reach students.",
    metrics: [metric("Open issues", p.openIssues, p.openIssues > 0 ? "warning" : "neutral")],
  };
}

function curriculumNode(c: CurriculumInput): OrgNode {
  return {
    id: nodeId("curriculum", c.id),
    kind: "curriculum",
    entityId: c.id,
    label: c.title,
    sublabel: c.subject ?? undefined,
    href: "/admin/curricula",
    status: c.statusLabel,
    health: curriculumNodeHealth(c),
    purpose: "A curriculum — the content that powers classes and improves as feedback comes back.",
    metrics: [],
  };
}

function instructorNode(p: PersonInput): OrgNode {
  return {
    id: nodeId("instructor", p.id),
    kind: "instructor",
    entityId: p.id,
    label: p.name,
    sublabel: p.subtitle ?? "Instructor",
    href: `/admin/instructors/${p.id}`,
    // Health/metrics are rolled up from the classes they teach after build.
    health: { label: "No Classes Yet", tone: "neutral", score: 100, reasons: ["No classes assigned yet"] },
    purpose: "An instructor — turns curriculum into taught classes and the students who learn from them.",
    metrics: [],
  };
}

function studentNode(p: PersonInput): OrgNode {
  return {
    id: nodeId("student", p.id),
    kind: "student",
    entityId: p.id,
    label: p.name,
    sublabel: p.subtitle ?? "Student",
    href: `/admin/students/${p.id}`,
    health: { label: "Not Enrolled", tone: "neutral", score: 100, reasons: ["No active enrollment yet"] },
    purpose: "A student — the reason the chapter exists; their attendance and feedback feed everything upstream.",
    metrics: [],
  };
}

function familyNode(f: FamilyInput): OrgNode {
  return {
    id: nodeId("family", f.id),
    kind: "family",
    entityId: f.id,
    label: f.label,
    sublabel: f.studentIds.length === 1 ? "1 student" : `${f.studentIds.length} students`,
    href: "/chapter/students",
    health: { label: "Connected", tone: "success", score: 100, reasons: ["Linked to the chapter's students"] },
    purpose: "A family — supports a student's participation and receives the chapter's reports.",
    metrics: [],
  };
}

function classNode(c: ClassInput): OrgNode {
  const fill = c.capacity && c.capacity > 0 ? Math.round((c.enrolledCount / c.capacity) * 100) : null;
  const metrics: NodeMetric[] = [metric("Enrolled", c.capacity ? `${c.enrolledCount}/${c.capacity}` : c.enrolledCount)];
  if (fill != null)
    metrics.push(metric("Fill", `${fill}%`, fill >= 60 ? "success" : fill >= 30 ? "warning" : "danger"));
  if (c.attendancePercent != null)
    metrics.push(
      metric(
        "Attendance",
        `${c.attendancePercent}%`,
        c.attendancePercent >= 80 ? "success" : c.attendancePercent >= 60 ? "warning" : "danger"
      )
    );
  if (c.averageRating != null)
    metrics.push(
      metric("Rating", `${c.averageRating.toFixed(1)}★`, c.averageRating >= 4 ? "success" : c.averageRating >= 3 ? "warning" : "danger")
    );
  return {
    id: nodeId("class", c.id),
    kind: "class",
    entityId: c.id,
    label: c.title,
    sublabel: c.stageLabel,
    href: `/admin/classes/${c.id}`,
    status: c.statusLabel,
    health: classNodeHealth(c),
    purpose: "A class — where a partner, a curriculum, and an instructor come together to serve students.",
    metrics,
  };
}

// --- Build helpers ----------------------------------------------------------

function addNode(index: Map<string, OrgNode>, node: OrgNode): void {
  if (!index.has(node.id)) index.set(node.id, node); // first write wins; inputs are pre-deduped
}

function addEdge(
  edges: Map<string, OrgEdge>,
  index: Map<string, OrgNode>,
  from: string,
  to: string,
  kind: EdgeKind
): void {
  if (!index.has(from) || !index.has(to)) return; // only connect existing nodes
  const id = `${from}->${to}:${kind}`;
  if (edges.has(id)) return; // never duplicate an edge
  edges.set(id, { id, from, to, kind, label: EDGE_LABELS[kind] });
}

function connectedClasses(
  graph: OrganizationGraph,
  classById: Map<string, ClassInput>,
  nodes: OrgNode[]
): ClassInput[] {
  return nodes
    .filter((n) => n.kind === "class")
    .map((n) => classById.get(n.entityId))
    .filter((c): c is ClassInput => !!c);
}

const DEP_SEVERITY_RANK = { critical: 0, warning: 1, info: 2 } as const;
export function sortDependencies(list: NodeDependency[]): NodeDependency[] {
  const stateRank = (d: NodeDependency) => (d.blocking && d.state === "blocked" ? 0 : d.state === "in_progress" ? 1 : 2);
  return [...list].sort(
    (a, b) =>
      stateRank(a) - stateRank(b) ||
      DEP_SEVERITY_RANK[a.severity] - DEP_SEVERITY_RANK[b.severity] ||
      a.key.localeCompare(b.key)
  );
}

const BLOCKER_ENTITY_TO_KIND: Record<NonNullable<GraphBlocker["entityType"]>, NodeKind | null> = {
  PARTNER: "partner",
  CLASS_OFFERING: "class",
  INSTRUCTOR_APPLICATION: null,
};

function foldBlockers(graph: OrganizationGraph, blockers: GraphBlocker[]): void {
  for (const b of blockers) {
    const kind = b.entityType ? BLOCKER_ENTITY_TO_KIND[b.entityType] : null;
    const targetId =
      kind && b.entityId && graph.nodeIndex.has(nodeId(kind, b.entityId))
        ? nodeId(kind, b.entityId)
        : nodeId("chapter", graph.chapterId);
    const dep: NodeDependency = {
      key: `blocker:${b.key}`,
      label: b.title,
      state: "blocked",
      blocking: true,
      severity: b.severity,
      detail: b.detail,
      href: b.href,
    };
    const list = graph.dependencies.get(targetId) ?? [];
    if (!list.some((d) => d.key === dep.key)) list.push(dep);
    graph.dependencies.set(targetId, list);
  }
  for (const [id, list] of graph.dependencies) graph.dependencies.set(id, sortDependencies(list));
}

function rollUpHealthAndMetrics(
  graph: OrganizationGraph,
  classById: Map<string, ClassInput>,
  enrollments: EnrollmentInput[]
): void {
  for (const node of graph.nodes) {
    if (node.kind === "instructor" || node.kind === "partner") {
      const classes = connectedClasses(graph, classById, childrenOf(graph, node.id));
      const classIds = new Set(classes.map((c) => c.id));
      const students = new Set(
        enrollments.filter((e) => classIds.has(e.classId) && e.status !== "DROPPED").map((e) => e.studentId)
      );
      const counts: NodeMetric[] = [metric("Classes", classes.length), metric("Students", students.size)];
      node.metrics = node.kind === "instructor" ? counts : [...counts, ...node.metrics];
      if (classes.length > 0) node.health = rollupHealth(node.kind, classes, graph.dependencies.get(node.id) ?? []);
    } else if (node.kind === "student") {
      const classes = connectedClasses(graph, classById, parentsOf(graph, node.id));
      node.metrics = [metric("Classes", classes.length)];
      node.health = personNodeHealth(classes);
    }
  }
}

/** Expand each event onto its structural ancestors, then sort newest-first. */
function expandAndSortEvents(graph: OrganizationGraph, events: OrgEvent[]): OrgEvent[] {
  return events
    .map((ev) => {
      const ids = new Set(ev.nodeIds.filter((id) => graph.nodeIndex.has(id)));
      for (const seed of [...ids]) for (const anc of ancestorsOf(graph, seed)) ids.add(anc.id);
      return { ...ev, nodeIds: [...ids].sort() };
    })
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime() || a.id.localeCompare(b.id));
}

function sortNodes(nodes: OrgNode[]): OrgNode[] {
  const kindRank: Record<NodeKind, number> = {
    chapter: 0,
    partner: 1,
    curriculum: 2,
    instructor: 3,
    class: 4,
    student: 5,
    family: 6,
  };
  return [...nodes].sort((a, b) =>
    kindRank[a.kind] !== kindRank[b.kind] ? kindRank[a.kind] - kindRank[b.kind] : a.id.localeCompare(b.id)
  );
}

// --- Build ------------------------------------------------------------------

/** Build the full organization graph from chapter-scoped records. Pure. */
export function buildOrganizationGraph(input: OrganizationGraphInput): OrganizationGraph {
  // 1. Nodes (deduped).
  const index = new Map<string, OrgNode>();
  addNode(index, chapterNode(input.chapter));
  for (const p of input.partners) addNode(index, partnerNode(p));
  for (const c of input.curricula) addNode(index, curriculumNode(c));
  for (const i of input.instructors) addNode(index, instructorNode(i));
  for (const s of input.students) addNode(index, studentNode(s));
  for (const f of input.families) addNode(index, familyNode(f));
  for (const c of input.classes) addNode(index, classNode(c));

  // 2. Edges (deduped; only between existing nodes).
  const edges = new Map<string, OrgEdge>();
  const chId = nodeId("chapter", input.chapter.id);
  for (const p of input.partners) addEdge(edges, index, chId, nodeId("partner", p.id), "HOSTS");
  for (const c of input.curricula) addEdge(edges, index, chId, nodeId("curriculum", c.id), "HOSTS");
  for (const i of input.instructors) addEdge(edges, index, chId, nodeId("instructor", i.id), "HOSTS");
  for (const s of input.students) addEdge(edges, index, chId, nodeId("student", s.id), "HOSTS");
  for (const c of input.classes) {
    const target = nodeId("class", c.id);
    if (c.partnerId) addEdge(edges, index, nodeId("partner", c.partnerId), target, "OPERATES");
    if (c.curriculumId) addEdge(edges, index, nodeId("curriculum", c.curriculumId), target, "POWERS");
    if (c.instructorId) addEdge(edges, index, nodeId("instructor", c.instructorId), target, "TEACHES");
  }
  for (const e of input.enrollments) {
    if (e.status === "DROPPED") continue; // a dropped student is no longer served
    addEdge(edges, index, nodeId("class", e.classId), nodeId("student", e.studentId), "ENROLLS");
  }
  for (const f of input.families) {
    for (const sid of f.studentIds) addEdge(edges, index, nodeId("family", f.id), nodeId("student", sid), "GUARDIAN_OF");
  }

  const graph: OrganizationGraph = {
    chapterId: input.chapterId,
    generatedAt: input.now,
    nodes: sortNodes([...index.values()]),
    edges: [...edges.values()].sort((a, b) => a.id.localeCompare(b.id)),
    nodeIndex: index,
    dependencies: new Map(),
    events: [],
  };

  // 3. Dependencies — class deps come from the class's own signals;
  //    partner/curriculum/instructor/student deps come from their own state and
  //    the classes they touch.
  const classById = new Map(input.classes.map((c) => [c.id, c]));
  for (const c of input.classes) graph.dependencies.set(nodeId("class", c.id), classDependencies(c));
  for (const p of input.partners) {
    const deps = partnerDependencies(p);
    if (deps.length) graph.dependencies.set(nodeId("partner", p.id), deps);
  }
  for (const c of input.curricula) {
    const deps = curriculumDependencies(c);
    if (deps.length) graph.dependencies.set(nodeId("curriculum", c.id), deps);
  }
  for (const i of input.instructors) {
    const id = nodeId("instructor", i.id);
    const deps = instructorDependencies(connectedClasses(graph, classById, childrenOf(graph, id)));
    if (deps.length) graph.dependencies.set(id, deps);
  }
  for (const s of input.students) {
    const id = nodeId("student", s.id);
    const classes = connectedClasses(graph, classById, parentsOf(graph, id));
    const statuses = input.enrollments.filter((e) => e.studentId === s.id).map((e) => e.status);
    const deps = studentDependencies({ statuses, classes });
    if (deps.length) graph.dependencies.set(id, deps);
  }

  // 4. Fold attributed blockers into the matching node (or the chapter).
  foldBlockers(graph, input.blockers);

  // 5. Roll node health + connected-count metrics up the structural tree.
  rollUpHealthAndMetrics(graph, classById, input.enrollments);

  // 6. Project the one activity feed onto every entity it affects.
  graph.events = expandAndSortEvents(graph, input.events);

  return graph;
}
