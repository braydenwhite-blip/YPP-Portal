import type { Data360Payload } from "@/lib/operations/data-360-queries";
import type { Entity360 } from "@/lib/operations/entity-360";
import type {
  ActionLite,
  DecisionLite,
  MeetingFollowUpLite,
  MeetingLite,
} from "@/lib/people-strategy/operational-digest";

import type {
  CoSAnswer,
  CoSAnswerBlock,
  CoSAnswerItem,
  CoSBlockKind,
  CoSInsight,
  CoSPrompt,
  CoSTone,
} from "./types";

/**
 * YPP Help Agent — the Chief of Staff engine (PURE, deterministic).
 *
 * This is NOT a second intelligence system. It is a thin composition layer that
 * reshapes the portal's existing derivation output (`loadData360` →
 * `Data360Payload`, and `loadEntity360` → `Entity360`) into structured answer
 * blocks and proactive insights. No DB, no React, no model calls live here — the
 * route does the single `loadData360` read and (optionally) the AI narration;
 * everything in this file is a deterministic transform that unit-tests with
 * plain objects. `now` is injected.
 *
 * Doctrine: every line carries the *concrete* operational signal that makes it
 * matter ("Overdue 3d", "No owner", "Decision needs an action") — never a vague
 * "priority" label — and always links back to the record it is about.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function fmtDay(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function daysBetween(fromISO: string, now: Date): number {
  const t = new Date(fromISO).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor((now.getTime() - t) / DAY_MS);
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

// ---------------------------------------------------------------------------
// Per-record → answer item mappers (the "why it matters" signal lives here)
// ---------------------------------------------------------------------------

/** The operational signal for an action — overdue/blocked/no-owner/due, never priority. */
function actionSignal(a: ActionLite): { signal: string; tone: CoSTone } {
  if (a.overdue) return { signal: `Overdue ${a.daysOverdue}d`, tone: "danger" };
  if (a.blocked) return { signal: "Blocked", tone: "danger" };
  if (a.unassigned) return { signal: "No owner", tone: "warning" };
  if (a.dueISO) return { signal: `Due ${fmtDay(a.dueISO)}`, tone: "info" };
  return { signal: "Open", tone: "neutral" };
}

function actionItem(a: ActionLite): CoSAnswerItem {
  const { signal, tone } = actionSignal(a);
  const source = a.sourceMeetingTitle ? `From: ${a.sourceMeetingTitle}` : a.contextSummary ?? null;
  return {
    label: a.title,
    detail: a.ownerName ? `Owner: ${a.ownerName}` : "Unowned",
    signal,
    tone,
    href: a.href,
    source,
    entityType: a.relatedType ? relatedToEntity(a.relatedType) : null,
    entityId: a.relatedId,
  };
}

function completedActionItem(a: ActionLite): CoSAnswerItem {
  return {
    label: a.title,
    detail: a.ownerName ? `Completed by ${a.ownerName}` : "Completed",
    signal: a.completedISO ? `Done ${fmtDay(a.completedISO)}` : "Done",
    tone: "success",
    href: a.href,
    source: a.sourceMeetingTitle ? `From: ${a.sourceMeetingTitle}` : a.relatedLabel ?? null,
  };
}

/** The most pressing gap on an unconverted follow-up — and that it isn't an action yet. */
function followUpItem(f: MeetingFollowUpLite, now: Date): CoSAnswerItem {
  const overdue = f.dueISO ? new Date(f.dueISO).getTime() < now.getTime() : false;
  let signal: string;
  let tone: CoSTone;
  if (overdue) {
    signal = "Overdue · not yet an action";
    tone = "danger";
  } else if (!f.ownerName) {
    signal = "No owner · not yet an action";
    tone = "warning";
  } else if (!f.dueISO) {
    signal = "No due date · not yet an action";
    tone = "warning";
  } else {
    signal = "Not yet an action";
    tone = "info";
  }
  return {
    label: f.title,
    detail: f.ownerName ? `Owner: ${f.ownerName}` : "Convert it into an action so it doesn't get lost",
    signal,
    tone,
    href: f.href,
    source: `From: ${f.meetingTitle} · ${fmtDay(f.meetingStartISO)}`,
  };
}

function decisionItem(d: DecisionLite): CoSAnswerItem {
  return {
    label: d.decision,
    detail: d.decidedByName ? `Decided by ${d.decidedByName}` : null,
    signal: d.hasLinkedAction ? "Tracked" : "Decision needs an action",
    tone: d.hasLinkedAction ? "success" : "warning",
    href: d.href,
    source: `From: ${d.meetingTitle}`,
    entityType: d.relatedType ? relatedToEntity(d.relatedType) : null,
    entityId: d.relatedId,
  };
}

function meetingFollowThroughItem(m: MeetingLite): CoSAnswerItem {
  const gaps: string[] = [];
  if (m.decisionCount === 0) gaps.push("no decisions recorded");
  if (m.linkedActionCount === 0) gaps.push("no actions created");
  if (m.openFollowUps > 0) gaps.push(`${plural(m.openFollowUps, "open follow-up")}`);
  const signal =
    m.overdueFollowUps > 0
      ? `${plural(m.overdueFollowUps, "overdue follow-up")}`
      : m.linkedActionCount === 0
        ? "No next actions"
        : "Needs follow-through";
  return {
    label: m.title,
    detail: gaps.length ? `This meeting has ${gaps.join(", ")}.` : "Review and convert outstanding items.",
    signal,
    tone: m.overdueFollowUps > 0 ? "danger" : "warning",
    href: m.href,
    source: `${m.categoryLabel} · ${fmtDay(m.startISO)}`,
    entityType: "meeting",
    entityId: m.id,
  };
}

function upcomingMeetingItem(m: MeetingLite): CoSAnswerItem {
  return {
    label: m.title,
    detail: m.facilitatorName ? `Facilitator: ${m.facilitatorName}` : null,
    signal: fmtDay(m.startISO),
    tone: "info",
    href: m.href,
    source: m.categoryLabel,
    entityType: "meeting",
    entityId: m.id,
  };
}

const RELATED_TO_ENTITY: Record<string, CoSAnswerItem["entityType"]> = {
  CLASS_OFFERING: "class",
  PARTNER: "partner",
  USER: "person",
  MENTORSHIP: "mentorship",
  INSTRUCTOR_APPLICATION: "applicant",
};
function relatedToEntity(type: string): CoSAnswerItem["entityType"] {
  return RELATED_TO_ENTITY[type] ?? null;
}

const SEVERITY_TONE: Record<string, CoSTone> = {
  high: "danger",
  medium: "warning",
  low: "info",
};

// ---------------------------------------------------------------------------
// Block builders — each reshapes one slice of Data360Payload
// ---------------------------------------------------------------------------

const BLOCK_LIMIT = 6;

function needsAttentionBlock(data: Data360Payload): CoSAnswerBlock {
  return {
    kind: "needs_attention",
    title: "Needs attention",
    subtitle: "Worst first — each with the reason and the next move.",
    items: data.attention.slice(0, BLOCK_LIMIT).map((a) => ({
      label: a.relatedLabel ?? a.title,
      detail: a.suggestedStep ? `${a.why} ${a.suggestedStep}` : a.why,
      signal: a.ageLabel ?? a.category.replaceAll("_", " "),
      tone: SEVERITY_TONE[a.severity] ?? "info",
      href: a.href,
      source: a.relatedLabel && a.relatedLabel !== a.title ? a.title : null,
      entityType: a.entityType ?? null,
      entityId: a.entityId ?? null,
    })),
    emptyState: "Nothing is flagged right now — the queues are clear.",
    moreHref: "/work?view=needs-attention",
    moreLabel: "Full queue",
  };
}

function unresolvedFollowUpsBlock(data: Data360Payload, now: Date): CoSAnswerBlock {
  return {
    kind: "unresolved_followups",
    title: "Unresolved follow-ups",
    subtitle: "Commitments from meetings that still need to become tracked actions.",
    items: data.digest.unresolvedMeetingFollowUps.slice(0, BLOCK_LIMIT).map((f) => followUpItem(f, now)),
    emptyState: "Every meeting follow-up has been converted or resolved. Nothing is hanging.",
    moreHref: "/work?view=meetings",
    moreLabel: "Meetings view",
  };
}

function decisionsNeedingActionBlock(data: Data360Payload): CoSAnswerBlock {
  return {
    kind: "decisions_needing_action",
    title: "Decisions waiting on an owner",
    subtitle: "Decisions that were made but never became tracked work.",
    items: data.digest.decisionsNeedingAction.slice(0, BLOCK_LIMIT).map(decisionItem),
    emptyState: "Every recorded decision has an action carrying it forward.",
    moreHref: "/work?view=meetings",
    moreLabel: "Meetings view",
  };
}

function meetingsNeedFollowThroughBlock(data: Data360Payload): CoSAnswerBlock {
  return {
    kind: "meetings_need_followthrough",
    title: "Meetings that ended without follow-through",
    subtitle: "Notes captured, but decisions or next actions are missing.",
    items: data.digest.meetingsNeedingFollowThrough.slice(0, BLOCK_LIMIT).map(meetingFollowThroughItem),
    emptyState: "Every recent meeting produced decisions and next actions.",
    moreHref: "/work?view=meetings",
    moreLabel: "Meetings view",
  };
}

function openActionsBlock(data: Data360Payload): CoSAnswerBlock {
  return {
    kind: "open_actions",
    title: "Open actions that need a push",
    subtitle: "Overdue, blocked, or unowned work — most pressing first.",
    items: data.digest.urgentActions.slice(0, BLOCK_LIMIT).map(actionItem),
    emptyState: "No actions are overdue, blocked, or unowned right now.",
    moreHref: "/work",
    moreLabel: "Work hub",
  };
}

function completedWorkBlock(data: Data360Payload): CoSAnswerBlock {
  return {
    kind: "completed_work",
    title: "Completed this week",
    subtitle: "Finished work — useful context for feedback, reviews, and mentorship.",
    items: data.digest.recentlyCompletedActions.slice(0, BLOCK_LIMIT).map(completedActionItem),
    emptyState: "No actions have been completed in the current week yet.",
    moreHref: "/work?view=needs-attention",
    moreLabel: "Work hub",
  };
}

function upcomingMeetingsBlock(data: Data360Payload): CoSAnswerBlock {
  return {
    kind: "upcoming_meetings",
    title: "Upcoming meetings",
    subtitle: "The next officer meetings on the calendar.",
    items: data.digest.upcomingMeetings.slice(0, BLOCK_LIMIT).map(upcomingMeetingItem),
    emptyState: "Nothing on the calendar in the next two weeks.",
    moreHref: "/work?view=meetings",
    moreLabel: "All meetings",
  };
}

function partnersNeedFollowUpBlock(data: Data360Payload): CoSAnswerBlock {
  const items = data.explorer
    .filter((e) => e.entityType === "partner" && e.healthLevel !== "healthy")
    .slice(0, BLOCK_LIMIT)
    .map<CoSAnswerItem>((e) => ({
      label: e.label,
      detail: e.nextStep ?? e.risk ?? "No next outreach is scheduled.",
      signal: e.healthLabel,
      tone: e.healthLevel === "critical" ? "danger" : "warning",
      href: e.href,
      source: e.owner ? `Lead: ${e.owner}` : "No relationship lead",
      entityType: "partner",
      entityId: e.id,
    }));
  return {
    kind: "partners_need_followup",
    title: "Partners needing follow-up",
    subtitle: "Relationships with an overdue follow-up, no next step, or no owner.",
    items,
    emptyState: "Every active partner has a scheduled next step.",
    moreHref: "/partners?view=follow-up",
    moreLabel: "Partner follow-ups",
  };
}

function classesNeedSetupBlock(data: Data360Payload): CoSAnswerBlock {
  const items = data.explorer
    .filter((e) => e.entityType === "class" && e.healthLevel !== "healthy")
    .slice(0, BLOCK_LIMIT)
    .map<CoSAnswerItem>((e) => ({
      label: e.label,
      detail: e.nextStep ?? e.risk ?? "Add a next action so setup keeps moving.",
      signal: e.overdueActions > 0 ? `${plural(e.overdueActions, "overdue action")}` : e.healthLabel,
      tone: e.healthLevel === "critical" ? "danger" : "warning",
      href: e.href,
      source: e.owner ? `Instructor: ${e.owner}` : "No lead instructor",
      entityType: "class",
      entityId: e.id,
    }));
  return {
    kind: "classes_need_setup",
    title: "Classes needing attention",
    subtitle: "Offerings with missing setup, overdue work, or no owner.",
    items,
    emptyState: "Every active class has its setup on track.",
    moreHref: "/people/classes",
    moreLabel: "Class operations",
  };
}

function initiativesAttentionBlock(data: Data360Payload): CoSAnswerBlock {
  const items = data.initiatives
    .filter((s) => s.healthTone === "warning" || s.healthTone === "overdue" || s.risk)
    .slice(0, BLOCK_LIMIT)
    .map<CoSAnswerItem>((s) => ({
      label: s.title,
      detail: s.nextStep ?? s.risk ?? "No open next action.",
      signal: `${s.progressPercent}% done`,
      tone: s.healthTone === "overdue" ? "danger" : "warning",
      href: s.href,
      source: s.owner ? `Owner: ${s.owner}` : s.areaLabel,
      entityType: "initiative",
      entityId: s.id,
    }));
  return {
    kind: "initiatives_attention",
    title: "Initiatives needing attention",
    subtitle: "Strategic initiatives that are drifting or blocked.",
    items,
    emptyState: "Every active initiative is healthy and moving.",
    moreHref: "/work?view=initiatives",
    moreLabel: "Initiatives",
  };
}

function weeklySummaryBlock(data: Data360Payload): CoSAnswerBlock {
  const c = data.digest.counts;
  const created = c.newActionsThisWeek ?? data.digest.newActionsThisWeek?.length ?? 0;
  const items: CoSAnswerItem[] = [
    {
      label: `${plural(c.recentlyCompletedActions, "action")} completed this week`,
      detail: "Finished work that can inform reviews and recognition.",
      signal: "Done",
      tone: "success",
      href: "/work",
    },
    {
      label: `${plural(created, "action")} created this week`,
      detail: "New work added to the tracker.",
      signal: "New",
      tone: "info",
      href: "/work",
    },
    {
      label: `${plural(c.recentDecisions, "decision")} recorded`,
      detail:
        c.decisionsNeedingAction > 0
          ? `${plural(c.decisionsNeedingAction, "decision")} still need an owner.`
          : "All carried into actions.",
      signal: c.decisionsNeedingAction > 0 ? "Needs action" : "Tracked",
      tone: c.decisionsNeedingAction > 0 ? "warning" : "success",
      href: "/work?view=meetings",
    },
    {
      label: `${plural(c.unresolvedFollowUps, "follow-up")} still unresolved`,
      detail: "Commitments that should become actions.",
      signal: c.unresolvedFollowUps > 0 ? "Open" : "Clear",
      tone: c.unresolvedFollowUps > 0 ? "warning" : "success",
      href: "/work?view=meetings",
    },
    {
      label: `${plural(c.overdueActions, "action")} overdue · ${plural(c.blockedActions, "blocked")} · ${plural(c.unassignedActions, "unowned")}`,
      detail: "Open work that needs a push.",
      signal: c.overdueActions > 0 ? "Attention" : "Healthy",
      tone: c.overdueActions > 0 ? "danger" : "success",
      href: "/work?flag=overdue",
    },
  ];
  return {
    kind: "weekly_summary",
    title: "This week at a glance",
    subtitle: "What changed, what got done, and what's still open.",
    items,
  };
}

/** A short, ranked list of the single best next moves across the org. */
function suggestedNextStepsBlock(data: Data360Payload, now: Date): CoSAnswerBlock {
  const items: CoSAnswerItem[] = [];
  for (const d of data.digest.decisionsNeedingAction.slice(0, 2)) {
    items.push({
      label: `Turn "${truncate(d.decision, 60)}" into a tracked action`,
      detail: `Decided in ${d.meetingTitle} — assign an owner so it moves.`,
      signal: "Convert decision",
      tone: "warning",
      href: d.href,
    });
  }
  for (const f of data.digest.unresolvedMeetingFollowUps.slice(0, 2)) {
    items.push({
      label: `Convert follow-up: ${truncate(f.title, 60)}`,
      detail: `From ${f.meetingTitle}${f.ownerName ? ` · ${f.ownerName}` : " · needs an owner"}.`,
      signal: "Convert follow-up",
      tone: "warning",
      href: f.href,
    });
  }
  for (const a of data.digest.urgentActions.filter((x) => x.overdue || x.blocked || x.unassigned).slice(0, 2)) {
    const { signal } = actionSignal(a);
    items.push({
      label: a.nextStep ? a.nextStep : `Move "${truncate(a.title, 60)}" forward`,
      detail: a.ownerName ? `Owner: ${a.ownerName}` : "Assign an owner.",
      signal,
      tone: a.overdue || a.blocked ? "danger" : "warning",
      href: a.href,
    });
  }
  void now;
  return {
    kind: "suggested_next_steps",
    title: "Suggested next steps",
    subtitle: "The highest-leverage moves you can make right now.",
    items: items.slice(0, BLOCK_LIMIT),
    emptyState: "Nothing is waiting on you — the operating picture is clean.",
  };
}

/** Records missing the context that keeps them in the right memory views. */
function missingContextBlock(data: Data360Payload): CoSAnswerBlock {
  const c = data.digest.counts;
  const items: CoSAnswerItem[] = [];
  if (c.unassignedActions > 0) {
    items.push({
      label: `${plural(c.unassignedActions, "action")} have no owner`,
      detail: "Unowned work quietly disappears — assign an executor.",
      signal: "No owner",
      tone: "warning",
      href: "/work?flag=unowned",
    });
  }
  if (c.decisionsNeedingAction > 0) {
    items.push({
      label: `${plural(c.decisionsNeedingAction, "decision")} have no action`,
      detail: "A decision with no action teaches nothing and changes nothing.",
      signal: "Needs action",
      tone: "warning",
      href: "/work?view=meetings",
    });
  }
  if (c.meetingsWithoutActions > 0) {
    items.push({
      label: `${plural(c.meetingsWithoutActions, "meeting")} produced no actions`,
      detail: "Review the notes and convert what needs to happen next.",
      signal: "No next actions",
      tone: "warning",
      href: "/work?view=meetings",
    });
  }
  if (c.unresolvedFollowUps > 0) {
    items.push({
      label: `${plural(c.unresolvedFollowUps, "follow-up")} are still unresolved`,
      detail: "Convert them into actions so they don't get lost.",
      signal: "Open",
      tone: "warning",
      href: "/work?view=meetings",
    });
  }
  return {
    kind: "missing_context",
    title: "Missing context",
    subtitle: "Records that need filling in so they show up where they belong.",
    items,
    emptyState: "Every record has its owner, decision, and source context.",
  };
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

// ---------------------------------------------------------------------------
// Intent routing — deterministic keyword → block selection
// ---------------------------------------------------------------------------

type Intent = { kinds: CoSBlockKind[]; focused: boolean; headline?: string };

const DEFAULT_KINDS: CoSBlockKind[] = [
  "needs_attention",
  "unresolved_followups",
  "decisions_needing_action",
  "suggested_next_steps",
];

/** Map a natural-language question to the answer blocks that resolve it. */
export function routeIntent(question: string): Intent {
  const q = question.toLowerCase();
  const has = (...terms: string[]) => terms.some((t) => q.includes(t));

  // Weekly / change summary
  if (has("this week", "weekly", "recap", "summary of the week", "happened", "changed since", "what changed")) {
    return {
      kinds: ["weekly_summary", "completed_work", "decisions_needing_action", "needs_attention"],
      focused: true,
    };
  }
  // Decisions
  if (has("decide", "decision", "decided")) {
    return { kinds: ["decisions_needing_action", "recent_decisions"], focused: true };
  }
  // Follow-ups
  if (has("follow-up", "follow up", "followup")) {
    return { kinds: ["unresolved_followups", "meetings_need_followthrough"], focused: true };
  }
  // Meetings without next actions
  if (has("without next action", "ended without", "no next action", "no action", "meetings need", "meeting need")) {
    return { kinds: ["meetings_need_followthrough", "decisions_needing_action"], focused: true };
  }
  // Completed / contributions / reviews
  if (has("completed", "finished", "done this", "contribut", "for review", "reviews")) {
    return { kinds: ["completed_work"], focused: true };
  }
  // Waiting on / blocked / leadership waiting
  if (has("waiting", "blocked", "stuck", "leadership waiting", "escalat")) {
    return { kinds: ["needs_attention", "open_actions"], focused: true };
  }
  // Partners
  if (has("partner")) {
    return { kinds: ["partners_need_followup"], focused: true };
  }
  // Classes
  if (has("class", "session", "setup")) {
    return { kinds: ["classes_need_setup"], focused: true };
  }
  // Initiatives
  if (has("initiative", "milestone", "strategic")) {
    return { kinds: ["initiatives_attention"], focused: true };
  }
  // Upcoming meetings
  if (has("upcoming", "calendar", "next meeting")) {
    return { kinds: ["upcoming_meetings"], focused: true };
  }
  // What's missing
  if (has("missing", "incomplete", "no owner", "unowned", "without owner")) {
    return { kinds: ["missing_context", "needs_attention"], focused: true };
  }
  // Open actions
  if (has("open action", "overdue", "what should i do", "my work", "what do i", "to do", "todo")) {
    return { kinds: ["open_actions", "needs_attention", "suggested_next_steps"], focused: true };
  }
  // Needs attention / what to do next / catch-all "what" questions
  if (has("attention", "needs", "next", "should we", "should officers", "review next", "priorit")) {
    return { kinds: ["needs_attention", "suggested_next_steps", "unresolved_followups"], focused: true };
  }

  // Default brief.
  return { kinds: DEFAULT_KINDS, focused: false };
}

const BLOCK_BUILDERS: Record<
  Exclude<CoSBlockKind, "entity_summary" | "recent_decisions">,
  (data: Data360Payload, now: Date) => CoSAnswerBlock
> = {
  needs_attention: (d) => needsAttentionBlock(d),
  unresolved_followups: (d, n) => unresolvedFollowUpsBlock(d, n),
  decisions_needing_action: (d) => decisionsNeedingActionBlock(d),
  meetings_need_followthrough: (d) => meetingsNeedFollowThroughBlock(d),
  open_actions: (d) => openActionsBlock(d),
  completed_work: (d) => completedWorkBlock(d),
  weekly_summary: (d) => weeklySummaryBlock(d),
  suggested_next_steps: (d, n) => suggestedNextStepsBlock(d, n),
  missing_context: (d) => missingContextBlock(d),
  upcoming_meetings: (d) => upcomingMeetingsBlock(d),
  partners_need_followup: (d) => partnersNeedFollowUpBlock(d),
  classes_need_setup: (d) => classesNeedSetupBlock(d),
  initiatives_attention: (d) => initiativesAttentionBlock(d),
};

/** "recent_decisions" reuses the decisions-needing-action data but shows all. */
function buildBlock(kind: CoSBlockKind, data: Data360Payload, now: Date): CoSAnswerBlock | null {
  if (kind === "entity_summary") return null;
  if (kind === "recent_decisions") {
    const block = decisionsNeedingActionBlock(data);
    return {
      ...block,
      kind: "recent_decisions",
      title: "Recent decisions",
      subtitle: "What leadership has decided recently — and whether it's being acted on.",
    };
  }
  return BLOCK_BUILDERS[kind](data, now);
}

// Blocks that always render even when empty (their empty state is the message).
const ALWAYS_SHOW: ReadonlySet<CoSBlockKind> = new Set<CoSBlockKind>([
  "weekly_summary",
  "suggested_next_steps",
]);

function buildHeadline(data: Data360Payload): string {
  const c = data.digest.counts;
  const parts: string[] = [];
  if (c.overdueActions > 0) parts.push(`${plural(c.overdueActions, "overdue action")}`);
  if (data.digest.decisionsNeedingAction.length > 0)
    parts.push(`${plural(data.digest.decisionsNeedingAction.length, "decision")} needing an owner`);
  if (data.digest.unresolvedMeetingFollowUps.length > 0)
    parts.push(`${plural(data.digest.unresolvedMeetingFollowUps.length, "unresolved follow-up")}`);
  if (c.blockedActions > 0) parts.push(`${plural(c.blockedActions, "blocked item")}`);
  if (parts.length === 0) {
    return "Everything's clear — no overdue work, unresolved follow-ups, or decisions waiting.";
  }
  return `Across YPP: ${parts.slice(0, 3).join(", ")}.`;
}

/**
 * Build a complete deterministic answer for a question. The route supplies the
 * single `loadData360` read; this is the pure transform. `aiAvailable` only
 * tells the UI whether to offer the optional AI narration toggle.
 */
export function buildChiefOfStaffAnswer(
  question: string,
  data: Data360Payload,
  options: { now?: Date; aiAvailable?: boolean } = {}
): CoSAnswer {
  const now = options.now ?? new Date();
  const intent = routeIntent(question);

  const blocks: CoSAnswerBlock[] = [];
  for (const kind of intent.kinds) {
    const block = buildBlock(kind, data, now);
    if (!block) continue;
    const keep = intent.focused || ALWAYS_SHOW.has(kind) || block.items.length > 0;
    if (keep) blocks.push(block);
  }
  // The default brief always closes with the highest-leverage next steps.
  if (!intent.focused && !blocks.some((b) => b.kind === "suggested_next_steps")) {
    blocks.push(suggestedNextStepsBlock(data, now));
  }

  return {
    question,
    headline: intent.headline ?? buildHeadline(data),
    blocks,
    narrative: null,
    aiUsed: false,
    aiAvailable: options.aiAvailable ?? false,
    generatedAtISO: now.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Entity summaries — reshape an Entity360 into answer blocks
// ---------------------------------------------------------------------------

const WORK_TONE: Record<string, CoSTone> = {
  danger: "danger",
  warning: "warning",
  info: "info",
  success: "success",
  neutral: "neutral",
};

/**
 * Should a question asked WITH entity context (the "Ask about this record"
 * flow) be answered about that entity, rather than falling back to the global
 * brief? Yes when it reads entity-shaped ("this…", "what's blocking…",
 * "status", "workflow", …) or names the record's own title. Pure and
 * conservative — a clearly global question ("what needs attention this week")
 * from an entity page still gets the global answer.
 */
const ENTITY_SCOPE_HINT =
  /\b(this|it|summar|contribut|blocking|blocked|stuck|status|workflow|risk|owner|why|next outreach|promised|happen next|next step)\b/i;

export function shouldScopeAnswerToEntity(
  question: string,
  entityTitle?: string | null
): boolean {
  if (ENTITY_SCOPE_HINT.test(question)) return true;
  if (
    entityTitle &&
    entityTitle.trim().length >= 3 &&
    question.toLowerCase().includes(entityTitle.trim().toLowerCase())
  ) {
    return true;
  }
  return false;
}

/** Summarize a single entity (person / class / partner / initiative / meeting). */
export function buildEntitySummaryAnswer(
  question: string,
  entity: Entity360,
  options: { now?: Date; aiAvailable?: boolean } = {}
): CoSAnswer {
  const now = options.now ?? new Date();
  const blocks: CoSAnswerBlock[] = [];

  // Overview block: signal + glance + key facts + connected people.
  const overview: CoSAnswerItem[] = [];
  if (entity.signal) {
    overview.push({
      label: entity.signal.label,
      detail: entity.signal.detail,
      signal: "Status",
      tone: entityToneToCoS(entity.signal.tone),
    });
  }
  for (const g of (entity.glance ?? []).slice(0, 4)) {
    overview.push({ label: g.label, detail: g.value, tone: entityToneToCoS(g.tone) });
  }
  for (const p of entity.people.slice(0, 4)) {
    overview.push({
      label: p.name,
      detail: p.relationship + (p.title ? ` · ${p.title}` : ""),
      tone: "neutral",
      entityType: p.id ? "person" : null,
      entityId: p.id,
    });
  }
  blocks.push({
    kind: "entity_summary",
    title: `${entity.title}`,
    subtitle: entity.subtitle ?? entity.typeLabel,
    items: overview,
    emptyState: "No summary details on record yet.",
    moreHref: entity.pageHref,
    moreLabel: "Open full record",
  });

  // Open work on this entity.
  const open = entity.workItems.filter((w) => !w.completedISO);
  if (open.length > 0) {
    blocks.push({
      kind: "open_actions",
      title: "Open work",
      subtitle: "Actions and follow-ups still in flight on this record.",
      items: open.slice(0, BLOCK_LIMIT).map((w) => ({
        label: w.title,
        detail: w.ownerName ? `Owner: ${w.ownerName}` : "Unowned",
        signal: w.status,
        tone: WORK_TONE[w.tone] ?? "neutral",
        href: w.href,
        source: w.meetingTitle ? `From: ${w.meetingTitle}` : w.sourceLabel,
      })),
      emptyState: "No open work on this record.",
    });
  }

  // Workflows in flight on this record (Universal Workflow Engine), worst first.
  // The loader already sorted worst-health-first and attached concrete reasons.
  const workflows = entity.workflows ?? [];
  if (workflows.length > 0) {
    blocks.push({
      kind: "workflows_in_flight",
      title: "Workflows in flight",
      subtitle: "Multi-step processes running on this record, worst health first.",
      items: workflows.slice(0, BLOCK_LIMIT).map((w) => ({
        label: w.title,
        detail:
          w.reasons[0] ??
          (w.nextStepTitle ? `Next: ${w.nextStepTitle}` : null) ??
          [w.stageName, w.progressLabel].filter(Boolean).join(" · "),
        signal: w.healthLabel,
        tone: entityToneToCoS(w.tone),
        href: w.href,
        source: w.templateName,
      })),
      emptyState: "No workflows running on this record.",
    });
  }

  // Completed history (collapsed into memory).
  const done = entity.workItems.filter((w) => w.completedISO);
  if (done.length > 0) {
    blocks.push({
      kind: "completed_work",
      title: "Completed work history",
      subtitle: "Finished work — part of this record's contribution history.",
      items: done.slice(0, BLOCK_LIMIT).map((w) => ({
        label: w.title,
        detail: w.ownerName ? `By ${w.ownerName}` : null,
        signal: w.completedISO ? `Done ${fmtDay(w.completedISO)}` : "Done",
        tone: "success",
        href: w.href,
      })),
    });
  }

  // Suggested next step + risks.
  const next: CoSAnswerItem[] = [];
  if (entity.nextStep) {
    next.push({ label: entity.nextStep, signal: "Next step", tone: "info" });
  }
  for (const r of entity.risks.slice(0, 4)) {
    next.push({ label: r, signal: "Risk", tone: "warning" });
  }
  if (next.length > 0) {
    blocks.push({
      kind: "suggested_next_steps",
      title: "What should happen next",
      items: next,
    });
  }

  const headline =
    entity.signal?.label ??
    entity.nextStep ??
    (entity.risks[0] ?? `${entity.typeLabel} · ${entity.subtitle ?? ""}`.trim());

  return {
    question,
    headline,
    blocks,
    narrative: null,
    aiUsed: false,
    aiAvailable: options.aiAvailable ?? false,
    generatedAtISO: now.toISOString(),
  };
}

function entityToneToCoS(tone: string | undefined): CoSTone {
  switch (tone) {
    case "overdue":
      return "danger";
    case "warning":
      return "warning";
    case "success":
      return "success";
    case "info":
    case "purple":
      return "info";
    default:
      return "neutral";
  }
}

// ---------------------------------------------------------------------------
// Proactive insights — the high-signal lines surfaced without being asked
// ---------------------------------------------------------------------------

/**
 * The Leadership Home / page-level proactive feed. Returns the highest-signal
 * facts only (worst first), already capped — keep it simple, no dashboards.
 */
export function buildChiefOfStaffInsights(
  data: Data360Payload,
  options: { now?: Date; limit?: number } = {}
): CoSInsight[] {
  const now = options.now ?? new Date();
  const limit = options.limit ?? 5;
  const insights: CoSInsight[] = [];
  const c = data.digest.counts;

  const meetingsFollow = data.digest.meetingsNeedingFollowThrough.length;
  if (meetingsFollow > 0) {
    insights.push({
      text: `${plural(meetingsFollow, "meeting")} have follow-ups or decisions not yet converted to actions.`,
      tone: "warning",
      signal: "Convert to actions",
      href: "/work?view=meetings",
      ctaLabel: "Review meetings",
    });
  }
  const decisionsOpen = data.digest.decisionsNeedingAction.length;
  if (decisionsOpen > 0) {
    insights.push({
      text: `${plural(decisionsOpen, "decision")} still need an owner to carry them out.`,
      tone: "warning",
      signal: "Decision needs an action",
      href: "/work?view=meetings",
      ctaLabel: "Assign owners",
    });
  }
  const ownerlessFollowUps = data.digest.unresolvedMeetingFollowUps.filter((f) => !f.ownerName).length;
  if (ownerlessFollowUps > 0) {
    insights.push({
      text: `${plural(ownerlessFollowUps, "meeting follow-up")} still need owners.`,
      tone: "warning",
      signal: "No owner",
      href: "/work?view=meetings",
      ctaLabel: "Assign owners",
    });
  }
  const partnersFollow = data.explorer.filter(
    (e) => e.entityType === "partner" && e.healthLevel !== "healthy"
  ).length;
  if (partnersFollow > 0) {
    insights.push({
      text: `${plural(partnersFollow, "partner")} need follow-up — overdue, stalled, or with no next step.`,
      tone: "warning",
      signal: "Needs follow-up",
      href: "/partners?view=follow-up",
      ctaLabel: "Partner follow-ups",
    });
  }
  const initiativesStuck = data.initiatives.filter(
    (s) => s.healthTone === "warning" || s.healthTone === "overdue"
  ).length;
  if (initiativesStuck > 0) {
    insights.push({
      text: `${plural(initiativesStuck, "initiative")} are drifting or blocked.`,
      tone: "warning",
      signal: "No next action",
      href: "/work?view=initiatives",
      ctaLabel: "Review initiatives",
    });
  }
  if (c.recentlyCompletedActions > 0) {
    insights.push({
      text: `${plural(c.recentlyCompletedActions, "action")} completed this week — ready to inform reviews and recognition.`,
      tone: "success",
      signal: "Completed",
      href: "/work",
      ctaLabel: "Review completed work",
    });
  }

  // Sort danger → warning → success/info, then trim.
  const order: Record<CoSTone, number> = { danger: 0, warning: 1, info: 2, success: 3, neutral: 4 };
  insights.sort((a, b) => order[a.tone] - order[b.tone]);
  void now;
  return insights.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Page-aware prompts
// ---------------------------------------------------------------------------

const GLOBAL_PROMPTS: CoSPrompt[] = [
  { label: "What needs attention today?", question: "What needs attention today?" },
  { label: "What changed this week?", question: "What changed this week?" },
  {
    label: "Which follow-ups still need to become actions?",
    question: "Which follow-ups still need to become actions?",
  },
  {
    label: "Which meetings ended without next actions?",
    question: "Which meetings ended without next actions?",
  },
  { label: "What did we decide recently?", question: "What did we decide recently?" },
  { label: "What is leadership waiting on?", question: "What is leadership waiting on?" },
  {
    label: "What completed work should inform reviews?",
    question: "What completed work should be considered for feedback and reviews?",
  },
];

/** Suggested questions tuned to the page the officer is on. */
export function pageAwarePrompts(pathname: string | null | undefined): CoSPrompt[] {
  const p = pathname ?? "";
  if (/\/actions\/meetings\/[^/]+/.test(p)) {
    return [
      { label: "Summarize this meeting", question: "Summarize this meeting." },
      {
        label: "What actions came from this meeting?",
        question: "What actions came from this meeting?",
      },
      {
        label: "Which follow-ups still need to become actions?",
        question: "Which follow-ups from this meeting still need to become actions?",
      },
    ];
  }
  if (/\/(people|admin\/(students|instructors))\/[^/]+/.test(p)) {
    return [
      { label: "Summarize this person", question: "Summarize this person." },
      {
        label: "What has this person contributed recently?",
        question: "What has this person contributed recently?",
      },
      { label: "What should happen next?", question: "What should happen next with this person?" },
    ];
  }
  if (/\/(partners|admin\/partners)\/[^/]+/.test(p)) {
    return [
      { label: "Summarize this partner", question: "Summarize this partner relationship." },
      { label: "What is the next outreach?", question: "What is the next outreach for this partner?" },
      { label: "What have we promised them?", question: "What have we promised this partner?" },
    ];
  }
  if (/\/(classes|admin\/classes)\/[^/]+/.test(p)) {
    return [
      { label: "Summarize this class", question: "Summarize this class." },
      { label: "What is blocking this class?", question: "What is blocking this class?" },
      {
        label: "What needs to happen before it runs?",
        question: "What needs to happen before this class runs?",
      },
    ];
  }
  return GLOBAL_PROMPTS;
}

export function defaultPrompts(): CoSPrompt[] {
  return GLOBAL_PROMPTS;
}

/**
 * Entity-type-aware suggested prompts for the "Ask about this" surfaces embedded
 * across the portal (person/class/partner/initiative/meeting pages and drawers).
 * Keyed by Entity360Type so the same set drives the button menu and the
 * /help-agent page when entity context arrives via ?entityType=…&entityId=….
 */
export function entityPrompts(entityType: string | null | undefined): CoSPrompt[] {
  switch (entityType) {
    case "person":
      return [
        { label: "Summarize this person", question: "Summarize this person." },
        { label: "Recent contributions", question: "Show this person's recent contributions." },
        { label: "Open responsibilities", question: "Show this person's open responsibilities." },
        { label: "Feedback themes", question: "Show feedback themes for this person." },
        { label: "Prepare review evidence", question: "Prepare review evidence for this person." },
        { label: "Suggest next growth action", question: "Suggest the next growth action for this person." },
      ];
    case "class":
      return [
        { label: "Summarize this class", question: "Summarize this class." },
        { label: "Show setup gaps", question: "Show setup gaps for this class." },
        { label: "Unresolved follow-ups", question: "Show unresolved follow-ups for this class." },
        { label: "Related meetings & actions", question: "Show related meetings and actions for this class." },
        { label: "What needs to happen before launch?", question: "What needs to happen before this class launches?" },
      ];
    case "partner":
      return [
        { label: "Summarize relationship history", question: "Summarize this partner relationship history." },
        { label: "Last meeting & follow-up", question: "Show the last meeting and follow-up for this partner." },
        { label: "Open commitments", question: "Show open commitments for this partner." },
        { label: "What should the next outreach be?", question: "What should the next outreach be for this partner?" },
      ];
    case "initiative":
      return [
        { label: "Summarize progress", question: "Summarize progress on this initiative." },
        { label: "Show blockers", question: "Show blockers for this initiative." },
        { label: "Next milestone", question: "Show the next milestone for this initiative." },
        { label: "Meetings & decisions", question: "Show meetings and decisions for this initiative." },
        { label: "What is the next action?", question: "What is the next action for this initiative?" },
      ];
    case "meeting":
      return [
        { label: "Summarize this meeting", question: "Summarize this meeting." },
        { label: "Show decisions", question: "Show the decisions from this meeting." },
        { label: "Unresolved follow-ups", question: "Show unresolved follow-ups from this meeting." },
        { label: "Review suggested actions", question: "Review the suggested actions from this meeting." },
        { label: "What still needs to become an action?", question: "What from this meeting still needs to become an action?" },
      ];
    case "applicant":
      return [
        { label: "Summarize this applicant", question: "Summarize this applicant." },
        { label: "What is the next step?", question: "What is the next step for this applicant?" },
        { label: "Unresolved follow-ups", question: "Show unresolved follow-ups for this applicant." },
      ];
    case "action":
      return [
        { label: "Summarize this action", question: "Summarize this action." },
        { label: "What is blocking it?", question: "What is blocking this action?" },
        { label: "What should happen next?", question: "What should happen next on this action?" },
      ];
    case "mentorship":
      return [
        { label: "Summarize this mentorship", question: "Summarize this mentorship." },
        { label: "Where does the cycle stand?", question: "Where does the review cycle stand for this mentorship?" },
        { label: "Open next steps", question: "Show the open next steps for this mentorship." },
        { label: "What should happen next?", question: "What should happen next on this mentorship?" },
      ];
    case "chapter":
      return [
        { label: "Summarize this chapter", question: "Summarize this chapter." },
        { label: "What needs attention?", question: "What needs attention in this chapter?" },
        { label: "Open work", question: "Show the open work for this chapter." },
        { label: "Meetings & follow-ups", question: "Show recent meetings and follow-ups for this chapter." },
        { label: "What should happen next?", question: "What should happen next for this chapter?" },
      ];
    default:
      return GLOBAL_PROMPTS;
  }
}
