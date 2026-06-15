import {
  deriveNextAction,
  NEXT_ACTION_RANK,
  type NextActionKind,
  type PerformanceRowFacts,
} from "./people-performance-selectors";

/**
 * People Strategy — the cockpit model (deterministic, testable).
 *
 * One canonical decision model across the whole people system. Every leadership
 * situation — a person who needs a check-in, feedback that is ready to review, an
 * accepted applicant with no class, a meeting that left follow-ups open — is
 * reduced to a single `CockpitItem` and grouped into a decision lane keyed off
 * what needs to HAPPEN next, not what kind of record it is. Pure functions only:
 * no Prisma, no clock, no session — the loader feeds shaped inputs in, this turns
 * them into lanes and the briefing strip. That keeps the "why this appears"
 * logic explainable and unit-testable.
 *
 * Privacy: this layer carries only counts, statuses, and labels — never feedback
 * response bodies or review notes. The loader is responsible for permissioning.
 */

// ── Lanes ────────────────────────────────────────────────────────────────────

export type CockpitLaneId =
  | "decide"
  | "follow-up"
  | "review"
  | "waiting"
  | "pair-class"
  | "onboard"
  | "meeting"
  | "recent";

export type CockpitSeverity = "high" | "medium" | "low";

/** How a card's button behaves. Person drawers vs. plain navigation. */
export type CockpitActionKind =
  | "open-person"
  | "review-feedback"
  | "request-feedback"
  | "navigate";

export type CockpitAction = {
  label: string;
  kind: CockpitActionKind;
  /** Set when kind is "navigate". */
  href?: string;
};

export type CockpitRelatedKind =
  | "action"
  | "meeting"
  | "class"
  | "applicant"
  | "interview"
  | "feedback"
  | "check-in"
  | "review"
  | "person";

export type CockpitRelated = {
  kind: CockpitRelatedKind;
  /** Short label, e.g. "Intro to Robotics" or "Officer sync · Jun 12". */
  label: string;
};

export type CockpitItemType =
  | "reach-out"
  | "feedback-review"
  | "check-in"
  | "feedback-request"
  | "feedback-waiting"
  | "review-due"
  | "develop"
  | "action-overdue"
  | "applicant-decision"
  | "applicant-class-pairing"
  | "class-coverage"
  | "onboarding-training"
  | "meeting-followup"
  | "recently-changed";

export type CockpitItem = {
  /** Stable composite key — also the dedupe key. */
  id: string;
  type: CockpitItemType;
  lane: CockpitLaneId;
  severity: CockpitSeverity;
  /** Plain-English "why this is here", with its real number. */
  reason: string;
  person: {
    /** A real user id when the situation is about a person; null for class/meeting. */
    id: string | null;
    name: string;
    context: string | null;
  };
  primaryAction: CockpitAction;
  secondaryActions: CockpitAction[];
  related: CockpitRelated | null;
  /** "Due Jun 20", "Accepted 4 days ago", or null. */
  dueLabel: string | null;
  /** Lower sorts first within a lane (after severity). */
  rank: number;
  /** ISO of the relevant event — orders the "Recently changed" lane. */
  changedAtISO: string | null;
};

export type CockpitLane = {
  id: CockpitLaneId;
  title: string;
  blurb: string;
  tone: "danger" | "warning" | "info" | "brand" | "success" | "neutral";
  items: CockpitItem[];
};

export type CockpitChip = {
  laneId: CockpitLaneId;
  /** "3 feedback responses ready" — plain English, leads with the count. */
  label: string;
  tone: CockpitLane["tone"];
};

export type PeopleCockpit = {
  lanes: CockpitLane[];
  chips: CockpitChip[];
  /** People with a People-Strategy footprint and nothing pending right now. */
  upToDate: number;
  /** Total surfaced items across every lane. */
  total: number;
};

const SEVERITY_RANK: Record<CockpitSeverity, number> = { high: 3, medium: 2, low: 1 };

const LANE_META: Array<Omit<CockpitLane, "items">> = [
  {
    id: "decide",
    title: "Needs a decision",
    blurb: "A leadership call is waiting — a hiring decision or a review to record.",
    tone: "brand",
  },
  {
    id: "follow-up",
    title: "Needs follow-up",
    blurb: "Open work and check-ins that need a nudge to keep moving.",
    tone: "warning",
  },
  {
    id: "review",
    title: "Ready to review",
    blurb: "Feedback responses are in and waiting to be read.",
    tone: "info",
  },
  {
    id: "waiting",
    title: "Waiting on someone",
    blurb: "Requests are out — replies are still outstanding.",
    tone: "neutral",
  },
  {
    id: "pair-class",
    title: "Missing class pairing",
    blurb: "People and classes that are not fully connected yet.",
    tone: "warning",
  },
  {
    id: "onboard",
    title: "Needs onboarding or training",
    blurb: "New instructors who are not yet ready to teach on their own.",
    tone: "info",
  },
  {
    id: "meeting",
    title: "Meeting follow-ups",
    blurb: "Decisions from recent meetings that left work unresolved.",
    tone: "warning",
  },
  {
    id: "recent",
    title: "Recently changed",
    blurb: "What moved across the people system in the last few days.",
    tone: "neutral",
  },
];

// ── Performance source (people / feedback / check-ins / reviews / actions) ─────

export type CockpitPerformanceRow = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  context: string | null;
  facts: PerformanceRowFacts;
};

/** Where each next-action kind lands, and how loud it is. */
const PERF_KIND_MAP: Record<
  NextActionKind,
  { lane: CockpitLaneId; type: CockpitItemType; severity: CockpitSeverity } | null
> = {
  "support-checkin": { lane: "follow-up", type: "reach-out", severity: "high" },
  "review-feedback": { lane: "review", type: "feedback-review", severity: "high" },
  "compile-check-in": { lane: "follow-up", type: "check-in", severity: "medium" },
  "request-feedback": { lane: "follow-up", type: "feedback-request", severity: "low" },
  "await-feedback": { lane: "waiting", type: "feedback-waiting", severity: "low" },
  "open-review": { lane: "decide", type: "review-due", severity: "medium" },
  "assign-mentor": { lane: "follow-up", type: "develop", severity: "low" },
  "view-overdue": { lane: "follow-up", type: "action-overdue", severity: "high" },
  "recognize-growth": { lane: "follow-up", type: "develop", severity: "low" },
  "view-details": null,
};

/** Map a performance next-action kind to how its card's button behaves. */
function perfActionKind(kind: NextActionKind): CockpitActionKind {
  if (kind === "review-feedback" || kind === "await-feedback") return "review-feedback";
  if (kind === "request-feedback") return "request-feedback";
  return "open-person";
}

export function performanceCockpitItems(
  rows: CockpitPerformanceRow[],
  ctx: { monthLabel: string; quarter: string }
): CockpitItem[] {
  const items: CockpitItem[] = [];
  for (const row of rows) {
    const action = deriveNextAction(row.facts, ctx);
    const map = PERF_KIND_MAP[action.kind];
    if (!map) continue;
    items.push({
      id: `perf:${row.id}`,
      type: map.type,
      lane: map.lane,
      severity: map.severity,
      reason: action.reason,
      person: { id: row.id, name: row.name || row.email, context: row.context },
      primaryAction: {
        label: action.actionLabel,
        kind: perfActionKind(action.kind),
      },
      secondaryActions: [],
      related: null,
      dueLabel: null,
      rank: NEXT_ACTION_RANK[action.kind],
      changedAtISO: null,
    });
  }
  return items;
}

// ── Applicant / class / meeting / onboarding sources ─────────────────────────
//
// Minimal shapes the loader populates from existing loaders. The cockpit owns
// these types so the UI and tests never depend on a specific Prisma query shape.

export type AcceptedApplicantNeedingClass = {
  id: string;
  name: string;
  role: string | null;
  /** "Accepted 4 days ago" — already humanized by the loader. */
  acceptedLabel: string | null;
  /** Applicant 360 / detail route. */
  href: string;
};

export type ApplicantAwaitingDecision = {
  id: string;
  name: string;
  role: string | null;
  /** "Interview complete Jun 10". */
  interviewLabel: string | null;
  href: string;
};

export type ClassNeedingCoverage = {
  id: string;
  title: string;
  /** "Starts Jun 24" or "Starts soon". */
  startLabel: string | null;
  /** True when the class starts within the urgency window. */
  startingSoon: boolean;
  href: string;
};

export type MeetingWithOpenFollowups = {
  id: string;
  title: string;
  unresolvedCount: number;
  /** "Met Jun 12". */
  metLabel: string | null;
  href: string;
};

export type InstructorNeedingOnboarding = {
  id: string;
  name: string;
  role: string | null;
  /** "2 of 5 required modules complete". */
  progressLabel: string;
  href: string;
};

export type RecentPeopleChange = {
  id: string;
  /** "Maya's June check-in was compiled". */
  label: string;
  changedAtISO: string;
  href: string | null;
};

function applicantDecisionItems(rows: ApplicantAwaitingDecision[]): CockpitItem[] {
  return rows.map((r) => ({
    id: `applicant-decision:${r.id}`,
    type: "applicant-decision" as const,
    lane: "decide" as const,
    severity: "high" as const,
    reason: "Interview complete — no hiring decision recorded yet",
    person: { id: null, name: r.name, context: r.role ?? "Instructor applicant" },
    primaryAction: { label: "Open review", kind: "navigate" as const, href: r.href },
    secondaryActions: [],
    related: { kind: "interview" as const, label: r.interviewLabel ?? "Interview complete" },
    dueLabel: r.interviewLabel,
    rank: 0,
    changedAtISO: null,
  }));
}

function applicantClassItems(rows: AcceptedApplicantNeedingClass[]): CockpitItem[] {
  return rows.map((r) => ({
    id: `applicant-class:${r.id}`,
    type: "applicant-class-pairing" as const,
    lane: "pair-class" as const,
    severity: "high" as const,
    reason: "Accepted, but not paired with a class yet",
    person: { id: null, name: r.name, context: r.role ?? "New instructor" },
    primaryAction: { label: "Pair with class", kind: "navigate" as const, href: r.href },
    secondaryActions: [],
    related: { kind: "applicant" as const, label: r.acceptedLabel ?? "Accepted" },
    dueLabel: r.acceptedLabel,
    rank: 1,
    changedAtISO: null,
  }));
}

function classCoverageItems(rows: ClassNeedingCoverage[]): CockpitItem[] {
  return rows.map((r) => ({
    id: `class-coverage:${r.id}`,
    type: "class-coverage" as const,
    lane: "pair-class" as const,
    severity: r.startingSoon ? ("high" as const) : ("medium" as const),
    reason: r.startingSoon
      ? "Starts soon and has no confirmed instructor"
      : "No confirmed instructor yet",
    person: { id: null, name: r.title, context: "Class" },
    primaryAction: { label: "Assign instructor", kind: "navigate" as const, href: r.href },
    secondaryActions: [],
    related: { kind: "class" as const, label: r.startLabel ?? "Class" },
    dueLabel: r.startLabel,
    rank: r.startingSoon ? 0 : 2,
    changedAtISO: null,
  }));
}

function meetingFollowupItems(rows: MeetingWithOpenFollowups[]): CockpitItem[] {
  return rows.map((r) => {
    const n = r.unresolvedCount;
    return {
      id: `meeting:${r.id}`,
      type: "meeting-followup" as const,
      lane: "meeting" as const,
      severity: n >= 3 ? ("high" as const) : ("medium" as const),
      reason: `${n} unresolved follow-up${n === 1 ? "" : "s"} from this meeting`,
      person: { id: null, name: r.title, context: r.metLabel ?? "Meeting" },
      primaryAction: { label: "Open meeting", kind: "navigate" as const, href: r.href },
      secondaryActions: [],
      related: { kind: "meeting" as const, label: r.metLabel ?? "Recent meeting" },
      dueLabel: r.metLabel,
      rank: -n,
      changedAtISO: null,
    };
  });
}

function onboardingItems(rows: InstructorNeedingOnboarding[]): CockpitItem[] {
  return rows.map((r) => ({
    id: `onboard:${r.id}`,
    type: "onboarding-training" as const,
    lane: "onboard" as const,
    severity: "medium" as const,
    reason: r.progressLabel,
    person: { id: r.id, name: r.name, context: r.role ?? "Instructor" },
    primaryAction: { label: "Open training", kind: "navigate" as const, href: r.href },
    secondaryActions: [],
    related: { kind: "person" as const, label: "Training" },
    dueLabel: null,
    rank: 0,
    changedAtISO: null,
  }));
}

function recentlyChangedItems(rows: RecentPeopleChange[]): CockpitItem[] {
  return rows.map((r) => ({
    id: `recent:${r.id}`,
    type: "recently-changed" as const,
    lane: "recent" as const,
    severity: "low" as const,
    reason: r.label,
    person: { id: null, name: r.label, context: null },
    primaryAction: r.href
      ? { label: "View", kind: "navigate" as const, href: r.href }
      : { label: "", kind: "navigate" as const },
    secondaryActions: [],
    related: null,
    dueLabel: null,
    rank: 0,
    changedAtISO: r.changedAtISO,
  }));
}

// ── Assembler ────────────────────────────────────────────────────────────────

export type CockpitInput = {
  performance?: {
    rows: CockpitPerformanceRow[];
    ctx: { monthLabel: string; quarter: string };
  };
  applicantsAwaitingDecision?: ApplicantAwaitingDecision[];
  acceptedApplicantsNeedingClass?: AcceptedApplicantNeedingClass[];
  classesNeedingCoverage?: ClassNeedingCoverage[];
  meetingsWithOpenFollowups?: MeetingWithOpenFollowups[];
  instructorsNeedingOnboarding?: InstructorNeedingOnboarding[];
  recentChanges?: RecentPeopleChange[];
};

/** Cap per lane in the cockpit assembler — keep each lane scannable. */
const RECENT_LANE_CAP = 6;

function orderItems(a: CockpitItem, b: CockpitItem): number {
  return (
    SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
    a.rank - b.rank ||
    a.person.name.localeCompare(b.person.name)
  );
}

function chipLabel(lane: CockpitLane): string {
  const n = lane.items.length;
  switch (lane.id) {
    case "decide":
      return `${n} ${n === 1 ? "decision" : "decisions"} waiting`;
    case "follow-up":
      return `${n} need follow-up`;
    case "review":
      return `${n} feedback ${n === 1 ? "response" : "responses"} ready`;
    case "waiting":
      return `${n} waiting on someone`;
    case "pair-class":
      return `${n} class ${n === 1 ? "pairing" : "pairings"} missing`;
    case "onboard":
      return `${n} in onboarding`;
    case "meeting":
      return `${n} meeting ${n === 1 ? "follow-up" : "follow-ups"}`;
    case "recent":
      return `${n} recently changed`;
    default:
      return `${n}`;
  }
}

/**
 * Assemble every source into ordered, deduped decision lanes plus the briefing
 * strip. Empty lanes are dropped. "Recently changed" never drives a chip (it is
 * context, not a to-do) and is ordered newest-first and capped.
 */
export function buildPeopleCockpit(input: CockpitInput): PeopleCockpit {
  const all: CockpitItem[] = [
    ...(input.performance
      ? performanceCockpitItems(input.performance.rows, input.performance.ctx)
      : []),
    ...applicantDecisionItems(input.applicantsAwaitingDecision ?? []),
    ...applicantClassItems(input.acceptedApplicantsNeedingClass ?? []),
    ...classCoverageItems(input.classesNeedingCoverage ?? []),
    ...meetingFollowupItems(input.meetingsWithOpenFollowups ?? []),
    ...onboardingItems(input.instructorsNeedingOnboarding ?? []),
    ...recentlyChangedItems(input.recentChanges ?? []),
  ];

  // Dedupe by stable id — a situation computed twice surfaces once.
  const seen = new Set<string>();
  const byLane = new Map<CockpitLaneId, CockpitItem[]>();
  for (const item of all) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    const list = byLane.get(item.lane);
    if (list) list.push(item);
    else byLane.set(item.lane, [item]);
  }

  const lanes: CockpitLane[] = [];
  for (const meta of LANE_META) {
    const items = byLane.get(meta.id);
    if (!items || items.length === 0) continue;
    if (meta.id === "recent") {
      items.sort((a, b) => (b.changedAtISO ?? "").localeCompare(a.changedAtISO ?? ""));
      lanes.push({ ...meta, items: items.slice(0, RECENT_LANE_CAP) });
    } else {
      items.sort(orderItems);
      lanes.push({ ...meta, items });
    }
  }

  const chips: CockpitChip[] = lanes
    .filter((lane) => lane.id !== "recent")
    .map((lane) => ({ laneId: lane.id, label: chipLabel(lane), tone: lane.tone }));

  const total = lanes
    .filter((lane) => lane.id !== "recent")
    .reduce((n, lane) => n + lane.items.length, 0);

  return { lanes, chips, upToDate: 0, total };
}
