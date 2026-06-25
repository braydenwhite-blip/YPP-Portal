import type { TimelineEvent } from "./timeline";
import type { WorkItem } from "./work-items";

export type { TimelineEvent } from "./timeline";
export type { WorkItem } from "./work-items";

/**
 * Data 360 — the universal Entity 360 shape.
 *
 * ONE serializable payload renders every 360 drawer — person, class, partner,
 * initiative, meeting, action — so the UI is a single component, the API is a
 * single route, and adding a new entity type means writing one loader, not one
 * drawer. Sections the loader leaves empty simply do not render.
 *
 * Pure helpers here (initials, tenure, footnotes) are unit-tested; the
 * per-type loaders live in `entity-360-queries.ts`.
 */

export const ENTITY_360_TYPES = [
  "person",
  "class",
  "partner",
  "initiative",
  "meeting",
  "action",
  "mentorship",
  "applicant",
  "chapter",
] as const;
export type Entity360Type = (typeof ENTITY_360_TYPES)[number];

export function isEntity360Type(value: unknown): value is Entity360Type {
  return (
    typeof value === "string" &&
    (ENTITY_360_TYPES as readonly string[]).includes(value)
  );
}

export const ENTITY_360_TYPE_LABELS: Record<Entity360Type, string> = {
  person: "Person",
  class: "Class",
  partner: "Partner",
  initiative: "Initiative",
  meeting: "Meeting",
  action: "Action",
  mentorship: "Mentorship",
  applicant: "Applicant",
  chapter: "Chapter",
};

/**
 * The polymorphic related-entity types (`ActionItem.relatedEntityType`) that
 * map onto a drawer entity type — so a "Linked to" chip can open the 360 panel.
 * All five shipped link types are covered.
 */
export const RELATED_TO_ENTITY_360: Partial<Record<string, Entity360Type>> = {
  CLASS_OFFERING: "class",
  PARTNER: "partner",
  USER: "person",
  MENTORSHIP: "mentorship",
  INSTRUCTOR_APPLICATION: "applicant",
  CHAPTER: "chapter",
};

export type Entity360Tone = "neutral" | "info" | "success" | "warning" | "overdue" | "purple";

export type Entity360Status = { label: string; tone: Entity360Tone };

/** One identity/contact row ("Email · maya@…", "Chapter · Scarsdale"). */
export type Entity360Fact = {
  label: string;
  value: string;
  href?: string | null;
};

/** A connected person, clickable into their own 360 panel. */
export type Entity360Person = {
  /** Null when no portal account backs the name (e.g. a declared initiative owner). */
  id: string | null;
  name: string;
  title: string | null;
  /** How they connect ("Mentor", "Mentee", "Lead Instructor", "Facilitator", …). */
  relationship: string;
};

/** A connected class, clickable into the class 360 panel. */
export type Entity360ClassRef = {
  id: string;
  title: string;
  /** Context line: chapter/partner · semester · student count. */
  context: string | null;
  status: string | null;
};

/** A connected meeting, clickable into the meeting 360 panel. */
export type Entity360MeetingRef = {
  id: string;
  title: string;
  dateISO: string;
  categoryLabel: string | null;
  /** "2 decisions · 1 open follow-up" — what the meeting produced. */
  outcome: string | null;
  upcoming: boolean;
};

/** One compact stat in the "At a glance" row under the header. */
export type Entity360Glance = {
  label: string;
  value: string;
  tone?: Entity360Tone;
};

/**
 * A derived readiness/health/momentum read (from `signals.ts` or the
 * initiative engine), rendered as a prominent chip with its reasons.
 */
export type Entity360Signal = {
  label: string;
  tone: Entity360Tone;
  /** What's behind the read — missing setup items, health reasons. */
  detail: string | null;
};

/**
 * One of this person's active mentorship pairings, as the 360 drawer shows it:
 * which side they're on, who their partner is, where the cycle stands, the one
 * next focus, open commitments, and the next session. (Calm Mentorship Phase 10.)
 */
export type Entity360MentorshipPairing = {
  /** The Mentorship id (opens the mentorship 360 / relationship record). */
  id: string;
  /** This person's side of the pairing. */
  role: "mentor" | "mentee";
  partnerName: string;
  partnerId: string | null;
  /** Plain-language cycle state ("Review due", "Up to date", "Kickoff pending"). */
  cycleLabel: string;
  /** The single next move for this pairing, when one is known. */
  nextFocus: string | null;
  /** Canonical open next-step count (ActionItem + unlinked legacy, no double-count). */
  openNextSteps: number;
  /** Canonical overdue next-step count. */
  overdueNextSteps: number;
  /** True when a canonical next step is blocked. */
  blocked: boolean;
  /** Canonical attention headline ("Check-in overdue", "Next step overdue", …). */
  attentionReason: string;
  /** Last completed check-in (`MentorshipSession`), ISO. */
  lastCheckInISO: string | null;
  nextSessionISO: string | null;
  href: string;
};

export type Entity360MentorshipPanel = {
  pairings: Entity360MentorshipPairing[];
};

export type Entity360 = {
  type: Entity360Type;
  id: string;
  /** The big name in the header. */
  title: string;
  /** Role / context line under the name. */
  subtitle: string | null;
  typeLabel: string;
  status: Entity360Status | null;
  /** Tertiary header line ("Active · 8 months", "Spring 2025 · 14 students"). */
  meta: string | null;
  /** Avatar initials (people) or a type glyph fallback. */
  initials: string;
  avatarUrl: string | null;
  /** "Open full page" target, when a stable page exists. */
  pageHref: string | null;
  /** Derived readiness/health read, shown prominently under the header. */
  signal?: Entity360Signal | null;
  /** Compact "At a glance" stats row. */
  glance?: Entity360Glance[];
  facts: Entity360Fact[];
  people: Entity360Person[];
  classes: Entity360ClassRef[];
  workItems: WorkItem[];
  meetings: Entity360MeetingRef[];
  timeline: TimelineEvent[];
  /** The single most useful next move, when one is known. */
  nextStep: string | null;
  risks: string[];
  /** Data-visibility note rendered as the panel footer. */
  footnote: string | null;
  /** Active mentorship pairings (officer-gated, like the rest of the panel). */
  mentorship?: Entity360MentorshipPanel | null;
};

// --- pure helpers ---------------------------------------------------------------

/** "Brayden Kim" → "BK"; falls back through email/title to a glyph. */
export function entityInitials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "•";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** "Active · 8 months" / "Active · 2 years+" tenure label. */
export function tenureLabel(monthsActive: number): string {
  if (monthsActive <= 0) return "Active · new";
  if (monthsActive < 12) {
    return `Active · ${monthsActive} month${monthsActive === 1 ? "" : "s"}`;
  }
  const years = Math.floor(monthsActive / 12);
  return `Active · ${years} year${years === 1 ? "" : "s"}+`;
}

/**
 * The standard person-panel footnote: contact info is public by design;
 * leadership-only assessments are called out so members know what peers see.
 */
export function personFootnote(viewerIsOfficer: boolean): string {
  return viewerIsOfficer
    ? "Leadership view · includes growth signals not visible to members"
    : "Public view · performance data visible to leadership only";
}

/** "2 decisions · 3 actions · 1 open follow-up" meeting outcome line. */
export function meetingOutcomeLine(input: {
  decisionCount: number;
  linkedActionCount: number;
  openFollowUps: number;
}): string | null {
  const parts: string[] = [];
  if (input.decisionCount > 0) {
    parts.push(`${input.decisionCount} decision${input.decisionCount === 1 ? "" : "s"}`);
  }
  if (input.linkedActionCount > 0) {
    parts.push(`${input.linkedActionCount} action${input.linkedActionCount === 1 ? "" : "s"}`);
  }
  if (input.openFollowUps > 0) {
    parts.push(`${input.openFollowUps} open follow-up${input.openFollowUps === 1 ? "" : "s"}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

// --- person story timeline --------------------------------------------------------

export type PersonTimelineInputs = {
  joinedAt: Date | string;
  /** Active pairings where this person mentors someone. */
  mentees: Array<{ id: string; name: string; startedAt: Date | string }>;
  /** Active pairings where this person is mentored. */
  mentors: Array<{ id: string; name: string; startedAt: Date | string }>;
  classesTaught: Array<{ id: string; title: string; startedAt: Date | string }>;
  completedActions: Array<{
    id: string;
    title: string;
    completedAt: Date | string;
    href: string;
  }>;
  /** Leadership roles/contributions (officer viewers only — pass [] otherwise). */
  roles: Array<{ id: string; title: string; startedAt: Date | string }>;
};

function toISO(value: Date | string): string {
  return typeof value === "string" ? value : value.toISOString();
}

/**
 * The story of one person's YPP involvement — joined, paired up, assigned
 * classes, took on roles, shipped work — as one newest-first event stream.
 * Pure; the loader supplies only what the viewer may see.
 */
export function buildPersonTimeline(
  inputs: PersonTimelineInputs,
  options: { limit?: number } = {}
): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      id: "person:joined",
      kind: "joined",
      occurredAtISO: toISO(inputs.joinedAt),
      title: "Joined YPP",
      detail: null,
      actorName: null,
      relatedType: null,
      relatedId: null,
      relatedLabel: null,
      href: null,
    },
  ];
  for (const m of inputs.mentors) {
    events.push({
      id: `person:mentor:${m.id}`,
      kind: "mentorship",
      occurredAtISO: toISO(m.startedAt),
      title: `Paired with mentor ${m.name}`,
      detail: null,
      actorName: m.name,
      relatedType: null,
      relatedId: null,
      relatedLabel: null,
      href: null,
    });
  }
  for (const m of inputs.mentees) {
    events.push({
      id: `person:mentee:${m.id}`,
      kind: "mentorship",
      occurredAtISO: toISO(m.startedAt),
      title: `Became mentor to ${m.name}`,
      detail: null,
      actorName: m.name,
      relatedType: null,
      relatedId: null,
      relatedLabel: null,
      href: null,
    });
  }
  for (const c of inputs.classesTaught) {
    events.push({
      id: `person:class:${c.id}`,
      kind: "class_assigned",
      occurredAtISO: toISO(c.startedAt),
      title: `Started teaching ${c.title}`,
      detail: null,
      actorName: null,
      relatedType: "CLASS_OFFERING",
      relatedId: c.id,
      relatedLabel: c.title,
      href: null,
    });
  }
  for (const r of inputs.roles) {
    events.push({
      id: `person:role:${r.id}`,
      kind: "role",
      occurredAtISO: toISO(r.startedAt),
      title: r.title,
      detail: null,
      actorName: null,
      relatedType: null,
      relatedId: null,
      relatedLabel: null,
      href: null,
    });
  }
  for (const a of inputs.completedActions) {
    events.push({
      id: `person:action:${a.id}`,
      kind: "action_completed",
      occurredAtISO: toISO(a.completedAt),
      title: a.title,
      detail: null,
      actorName: null,
      relatedType: null,
      relatedId: null,
      relatedLabel: null,
      href: a.href,
    });
  }
  events.sort(
    (a, b) =>
      new Date(b.occurredAtISO).getTime() - new Date(a.occurredAtISO).getTime() ||
      a.id.localeCompare(b.id)
  );
  return typeof options.limit === "number" ? events.slice(0, options.limit) : events;
}

// --- mentorship panel (Calm Mentorship Phase 10) -----------------------------

/** Plain-language cycle labels for the 360 mentorship panel. */
const E360_CYCLE_LABEL: Record<string, string> = {
  KICKOFF_PENDING: "Kickoff pending",
  REFLECTION_DUE: "Reflection due",
  REFLECTION_SUBMITTED: "Review due",
  REVIEW_SUBMITTED: "With the chair",
  CHANGES_REQUESTED: "Changes requested",
  APPROVED: "Up to date",
  PAUSED: "Paused",
  COMPLETE: "Cycle complete",
};

/** The raw pairing facts the loader feeds the pure builder. */
export type MentorshipPairingInput = {
  id: string;
  role: "mentor" | "mentee";
  partnerName: string;
  partnerId: string | null;
  cycleStage: string;
  kickoffCompleted: boolean;
  /** Canonical open next-step count (the loader runs the canonical merge). */
  openNextSteps: number;
  overdueNextSteps: number;
  blocked: boolean;
  /** Canonical attention headline from `deriveMentorshipAttention`. */
  attentionReason: string;
  lastCheckInISO: string | null;
  nextSessionISO: string | null;
};

/**
 * The one next focus for a pairing, from the cycle stage and the viewer's side.
 * Mentee-side stages frame the mentee's move; mentor-side frame the mentor's.
 */
export function mentorshipPairingFocus(
  role: "mentor" | "mentee",
  cycleStage: string,
  kickoffCompleted: boolean
): string | null {
  if (!kickoffCompleted || cycleStage === "KICKOFF_PENDING") {
    return role === "mentor" ? "Hold the kickoff" : "Get ready for kickoff";
  }
  switch (cycleStage) {
    case "REFLECTION_DUE":
      return role === "mentor" ? "Waiting on their reflection" : "Submit this month's reflection";
    case "REFLECTION_SUBMITTED":
      return role === "mentor" ? "Write the review" : "Review in progress";
    case "REVIEW_SUBMITTED":
      return "Waiting on chair approval";
    case "CHANGES_REQUESTED":
      return role === "mentor" ? "Revise the review" : "Review being revised";
    case "APPROVED":
      return "On track";
    default:
      return null;
  }
}

/**
 * Build the 360 mentorship panel from a person's active pairings. Pure (no I/O):
 * the loader supplies only pairings the viewer may see. Returns null when there
 * are none, so the section simply doesn't render.
 */
export function buildMentorshipPanel(
  pairings: MentorshipPairingInput[]
): Entity360MentorshipPanel | null {
  if (pairings.length === 0) return null;
  return {
    pairings: pairings.map((p) => ({
      id: p.id,
      role: p.role,
      partnerName: p.partnerName,
      partnerId: p.partnerId,
      cycleLabel: E360_CYCLE_LABEL[p.cycleStage] ?? "Active",
      nextFocus: mentorshipPairingFocus(p.role, p.cycleStage, p.kickoffCompleted),
      openNextSteps: p.openNextSteps,
      overdueNextSteps: p.overdueNextSteps,
      blocked: p.blocked,
      attentionReason: p.attentionReason,
      lastCheckInISO: p.lastCheckInISO,
      nextSessionISO: p.nextSessionISO,
      href: `/admin/mentorship/relationships/${p.id}`,
    })),
  };
}

/** Earliest-due open work item's title — the default "next step" for an entity. */
export function nextStepFromWork(workItems: WorkItem[]): string | null {
  const open = workItems
    .filter((w) => !w.completedISO && w.status !== "Completed")
    .sort((a, b) => {
      const aDue = a.dueISO ? new Date(a.dueISO).getTime() : Number.POSITIVE_INFINITY;
      const bDue = b.dueISO ? new Date(b.dueISO).getTime() : Number.POSITIVE_INFINITY;
      return aDue - bDue;
    });
  return open[0]?.title ?? null;
}
