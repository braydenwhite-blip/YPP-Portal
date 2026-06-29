// The Organization Graph — shared types.
//
// This is a DERIVED relationship overlay: a normalized node + edge model that
// unifies the chapter's already-computed operating data (partners, classes,
// curricula, instructors, students, families) into one connected graph. Nothing
// here owns state — every field is computed from existing sources of truth
// (class runtime, chapter blockers, the activity feed, KPI snapshots). Pure +
// serializable so the loader can build it server-side and the UI can render it.

/** The kinds of entity a graph node can represent. */
export const NODE_KINDS = [
  "chapter",
  "partner",
  "class",
  "curriculum",
  "instructor",
  "student",
  "family",
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

/** A directed structural relationship: `from` ENABLES `to` (from is the input). */
export const EDGE_KINDS = [
  "HOSTS", // chapter -> partner / instructor / student (contains)
  "OPERATES", // partner -> class (the class operates at this partner)
  "POWERS", // curriculum -> class (the class is powered by this curriculum)
  "TEACHES", // instructor -> class (the instructor teaches this class)
  "ENROLLS", // class -> student (the class enrolls / serves this student)
  "GUARDIAN_OF", // family -> student
] as const;
export type EdgeKind = (typeof EDGE_KINDS)[number];

export type HealthTone = "success" | "warning" | "danger" | "neutral";

/**
 * A transparent health read for any node. Mirrors the chapter-health shape
 * (label + tone + 0–100 score + concrete reasons) so health means the same
 * thing everywhere and is never a black box.
 */
export type NodeHealth = {
  label: string;
  tone: HealthTone;
  /** 0–100, higher = healthier. Display-only. */
  score: number;
  /** Concrete signals that drove the label, so a human can verify it. */
  reasons: string[];
};

/** A small labelled stat shown on a node ("67 students", "92% attendance"). */
export type NodeMetric = {
  label: string;
  value: string | number;
  tone?: HealthTone;
};

/** One node in the organization graph. `id` is `${kind}:${entityId}`. */
export type OrgNode = {
  id: string;
  kind: NodeKind;
  /** Raw database id of the underlying entity. */
  entityId: string;
  label: string;
  sublabel?: string;
  /** Deep link to the entity's full record / detail page. */
  href: string;
  /** Domain status label (e.g. "Live", "Enrolling", "Confirmed"). */
  status?: string;
  health: NodeHealth;
  /** Why this node exists — its role in the organization, in one sentence. */
  purpose: string;
  metrics: NodeMetric[];
};

export type OrgEdge = {
  id: string;
  from: string; // node id (the enabler / input)
  to: string; // node id (the output / beneficiary)
  kind: EdgeKind;
  label: string;
};

export type DependencyState = "satisfied" | "blocked" | "in_progress" | "unknown";
export type DependencySeverity = "critical" | "warning" | "info";

/**
 * A single thing a node needs in order to function. Dependencies are richer
 * than raw edges: they carry a satisfaction state, so the graph can answer
 * "what is blocked because of this?" and "what becomes possible once this is
 * resolved?".
 */
export type NodeDependency = {
  /** Stable per (node, rule). */
  key: string;
  label: string;
  state: DependencyState;
  /** True when an unsatisfied dependency actually blocks the node. */
  blocking: boolean;
  severity: DependencySeverity;
  detail?: string;
  /** The graph node this dependency points at, when it is another entity. */
  nodeId?: string;
  href?: string;
};

/**
 * A timeline event. The organization graph reuses the existing activity model
 * (id/title/occurredAt/href/actorName) and adds the set of node ids the event
 * touches, so one feed can be projected onto every entity that it affects.
 */
export type OrgEventKind =
  | "partner"
  | "curriculum"
  | "class"
  | "instructor"
  | "enrollment"
  | "attendance"
  | "feedback"
  | "reflection"
  | "snapshot"
  | "launch"
  | "other";

export type OrgEvent = {
  id: string;
  kind: OrgEventKind;
  title: string;
  detail?: string;
  occurredAt: Date;
  href?: string;
  actorName?: string | null;
  /** Node ids this event belongs to (primary entity + everything affected). */
  nodeIds: string[];
};

export type RecommendationKind =
  | "assignment"
  | "expansion"
  | "intervention"
  | "retention"
  | "recognition"
  | "next_step";

export type RecommendationConfidence = "high" | "medium" | "low";

/** A deterministic, always-evidence-backed suggestion for a node. */
export type Recommendation = {
  key: string;
  kind: RecommendationKind;
  title: string;
  detail: string;
  /** The concrete signals behind the suggestion. Never empty. */
  evidence: string[];
  confidence: RecommendationConfidence;
  href?: string;
  /** Another node the recommendation relates to (e.g. the suggested instructor). */
  relatedNodeId?: string;
};

/** The assembled graph: deduped nodes + edges, indexed for O(1) lookup. */
export type OrganizationGraph = {
  chapterId: string;
  generatedAt: Date;
  nodes: OrgNode[];
  edges: OrgEdge[];
  /** node id -> node. */
  nodeIndex: Map<string, OrgNode>;
  /** node id -> its dependencies. */
  dependencies: Map<string, NodeDependency[]>;
  /** All timeline events, newest-first. */
  events: OrgEvent[];
};

/**
 * The full Graph Inspector payload for one entity: everything that node knows
 * about itself and its place in the organization. This is what makes an Entity
 * 360 "extraordinary" — it answers where am I, what depends on this, what does
 * this affect, what changed, and what should happen next.
 */
export type EntitySummary = {
  node: OrgNode;
  purpose: string;
  /** Incoming structural relationships (what this came from). */
  parents: OrgNode[];
  /** Outgoing structural relationships — what becomes possible because of it. */
  enables: OrgNode[];
  /** Required upstream entities this node depends on. */
  dependsOn: OrgNode[];
  dependencies: NodeDependency[];
  /** Unsatisfied, blocking dependencies — why this node is held up. */
  blockedBy: NodeDependency[];
  /** Downstream nodes currently blocked because THIS node is unresolved. */
  unblocks: OrgNode[];
  health: NodeHealth;
  metrics: NodeMetric[];
  /** Roll-up counts across the connected sub-graph (e.g. students served). */
  rollup: NodeMetric[];
  /** Recent changes that touch this node, newest-first. */
  timeline: OrgEvent[];
  recommendations: Recommendation[];
};

/** Compose a canonical node id from a kind + raw entity id. */
export function nodeId(kind: NodeKind, entityId: string): string {
  return `${kind}:${entityId}`;
}

// --- Loader-facing input record shapes --------------------------------------
//
// These are the compact, already-derived records the (impure) graph loader
// produces from Prisma rows and hands to the pure builder — mirroring how the
// chapter operating system maps DB rows to pure record shapes before computing.

export type ChapterInput = {
  id: string;
  name: string;
  location: string | null;
  lifecycleStatus: string;
  lifecycleLabel: string;
  health: NodeHealth | null;
};

export type PartnerInput = {
  id: string;
  name: string;
  type: string | null;
  /** Pipeline stage label, e.g. "Confirmed", "Contacted". */
  stageLabel: string;
  confirmed: boolean;
  openIssues: number;
};

export type CurriculumInput = {
  id: string;
  title: string;
  subject: string | null;
  /** Plain-language status, e.g. "Fully approved", "In review". */
  statusLabel: string;
  approved: boolean;
  submitted: boolean;
};

export type PersonInput = {
  id: string;
  name: string;
  /** Role/title line. */
  subtitle?: string | null;
};

export type FamilyInput = {
  id: string;
  label: string;
  studentIds: string[];
};

/** The boolean readiness signals a class derives its dependencies from. */
export type ClassDependencySignals = {
  curriculumApproved: boolean;
  curriculumSubmitted: boolean;
  hasInstructor: boolean;
  scheduleConfirmed: boolean;
  partnerConfirmed: boolean;
  publiclyVisible: boolean;
  isLive: boolean;
  isCompleted: boolean;
};

export type ClassInput = ClassDependencySignals & {
  id: string;
  title: string;
  /** Offering status label. */
  statusLabel: string;
  /** Runtime stage label, e.g. "Live", "Enrolling". */
  stageLabel: string;
  /** Runtime health bucket. */
  health: "healthy" | "watch" | "at_risk" | "critical" | "unknown";
  partnerId: string | null;
  curriculumId: string | null;
  instructorId: string | null;
  enrolledCount: number;
  capacity: number | null;
  attendancePercent: number | null;
  averageRating: number | null;
  feedbackCount: number;
  interventionNeeded: boolean;
};

export type EnrollmentInput = {
  id: string;
  studentId: string;
  classId: string;
  /** ENROLLED | WAITLISTED | DROPPED | COMPLETED */
  status: string;
};

/** A blocker attributed to an entity (mirrors the chapter ChapterBlocker shape). */
export type GraphBlocker = {
  key: string;
  severity: DependencySeverity;
  title: string;
  detail?: string;
  href: string;
  entityType?: "PARTNER" | "INSTRUCTOR_APPLICATION" | "CLASS_OFFERING";
  entityId?: string;
};

export type OrganizationGraphInput = {
  chapterId: string;
  now: Date;
  chapter: ChapterInput;
  partners: PartnerInput[];
  curricula: CurriculumInput[];
  instructors: PersonInput[];
  students: PersonInput[];
  families: FamilyInput[];
  classes: ClassInput[];
  enrollments: EnrollmentInput[];
  blockers: GraphBlocker[];
  events: OrgEvent[];
};
