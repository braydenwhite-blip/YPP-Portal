/**
 * Growth Pathway — unified configuration powering the redesigned
 * Leadership Pathway dashboard. It models BOTH YPP growth tracks in one
 * normalized shape so a single dashboard component can render either:
 *
 *   1. Instructor Pathway  — Instructor → Senior Instructor → Lead Instructor
 *   2. Leadership Pathway   — Manager → Director → Chapter President → Officer
 *
 * The instructor competency copy is reused verbatim from the existing
 * G&R source of truth in `leadership-pathway.ts` so the two never drift.
 * The leadership competency copy is transcribed verbatim from the official
 * Leadership Goals & Rubric.
 */

import {
  LEADERSHIP_GOALS,
  LeadershipGoal,
} from "@/lib/leadership-pathway";
import {
  LEADERSHIP_RATING_SCALE,
  LEADERSHIP_RUBRIC_COMPETENCIES,
} from "@/lib/leadership-goals-rubric";

/* ------------------------------------------------------------------ *
 * Status levels (shared across both tracks)
 * ------------------------------------------------------------------ */

export type StatusLevelId =
  | "ABOVE_AND_BEYOND"
  | "ON_TRACK"
  | "NEEDS_ATTENTION"
  | "AT_RISK";

export interface StatusLevel {
  id: StatusLevelId;
  label: string;
  description: string;
  /** A token used to drive the pill / accent color in the UI. */
  tone: "above" | "ontrack" | "attention" | "risk";
  /** 0–1 fill used by the competency progress meter. */
  fill: number;
}

const STATUS_FILLS: Record<StatusLevelId, number> = {
  ABOVE_AND_BEYOND: 1,
  ON_TRACK: 0.82,
  NEEDS_ATTENTION: 0.5,
  AT_RISK: 0.22,
};

const STATUS_TONES: Record<
  StatusLevelId,
  StatusLevel["tone"]
> = {
  ABOVE_AND_BEYOND: "above",
  ON_TRACK: "ontrack",
  NEEDS_ATTENTION: "attention",
  AT_RISK: "risk",
};

export const STATUS_LEVELS: Record<StatusLevelId, StatusLevel> =
  Object.fromEntries(
    LEADERSHIP_RATING_SCALE.map((row) => [
      row.id,
      {
        id: row.id,
        label: row.label,
        description: `${row.description}.`,
        tone: STATUS_TONES[row.id],
        fill: STATUS_FILLS[row.id],
      },
    ]),
  ) as Record<StatusLevelId, StatusLevel>;

export const STATUS_LEVEL_ORDER: StatusLevelId[] = [
  "ABOVE_AND_BEYOND",
  "ON_TRACK",
  "NEEDS_ATTENTION",
  "AT_RISK",
];

/* ------------------------------------------------------------------ *
 * Normalized track shape
 * ------------------------------------------------------------------ */

export type TrackId = "INSTRUCTOR" | "LEADERSHIP";

export interface PathwayRole {
  id: string;
  /** Short, prestigious label used on badges and the ladder. */
  label: string;
  /** Optional grouping subtitle (e.g. "Director / Senior Director / Executive Director"). */
  subtitle?: string;
  /** One-line role framing used on the role cards. */
  tagline: string;
  /** Mission framing used in the current-role card. */
  mission: string;
  /** Promotion framing toward the next rung (null for the top rung). */
  promotionWindow: string | null;
  /** Ordering in the ladder, starting at 0. */
  order: number;
  /** Which competency expectation band this role reads from. */
  bandKey: string;
  /**
   * Set on roles that sit *beside* the main ladder rather than on it
   * (e.g. Chapter President / Regional Director runs parallel to Director).
   * Value is the `order` of the ladder rung it runs alongside.
   */
  parallelToOrder?: number;
}

export interface PathwayCompetency {
  id: string;
  number: number;
  title: string;
  shortTitle: string;
  oneLiner: string;
  /** Per-band expectation bullets, mirroring the official rubric. */
  expectations: Record<string, string[]>;
}

export interface TrackConfig {
  id: TrackId;
  label: string;
  tagline: string;
  /** Short word used in toggles / chips ("Teaching", "Leadership"). */
  chip: string;
  /** The overarching mission statement for everyone on this track. */
  mission: string;
  /** The main, sequential ladder rungs. */
  roles: PathwayRole[];
  /** Roles that run alongside the ladder rather than on it. */
  parallelRoles: PathwayRole[];
  competencies: PathwayCompetency[];
}

/* ------------------------------------------------------------------ *
 * Instructor track — reuses the existing G&R instructor content
 * ------------------------------------------------------------------ */

const INSTRUCTOR_ROLES: PathwayRole[] = [
  {
    id: "INSTRUCTOR",
    label: "Instructor",
    tagline: "Developing teaching consistency and classroom leadership.",
    mission:
      "Deliver strong classroom experiences, build positive student relationships, and contribute reliably to the YPP community.",
    promotionWindow:
      "Promotion to Senior Instructor typically happens after 2–4 strong months as an Instructor.",
    order: 0,
    bandKey: "INSTRUCTOR",
  },
  {
    id: "SENIOR_INSTRUCTOR",
    label: "Senior Instructor",
    tagline: "Helping shape instructor culture and mentoring others.",
    mission:
      "Demonstrate exceptional teaching and mentorship, contribute beyond the classroom, and help support and develop other instructors.",
    promotionWindow:
      "Promotion to Lead Instructor typically happens after 2–4 strong months as a Senior Instructor.",
    order: 1,
    bandKey: "SENIOR_INSTRUCTOR",
  },
  {
    id: "LEAD_INSTRUCTOR",
    label: "Lead Instructor",
    tagline: "Driving organization-wide instructional excellence.",
    mission:
      "Provide organization-wide leadership through training, curriculum development, mentorship, program quality oversight, and community-building.",
    promotionWindow:
      "Lead Instructors who shape culture and outcomes are invited toward the leadership pathway.",
    order: 2,
    bandKey: "LEAD_INSTRUCTOR",
  },
];

const INSTRUCTOR_COMPETENCIES: PathwayCompetency[] = LEADERSHIP_GOALS.map(
  (goal: LeadershipGoal): PathwayCompetency => ({
    id: goal.id,
    number: goal.number,
    title: goal.title,
    shortTitle: goal.shortTitle,
    oneLiner: goal.oneLiner,
    expectations: {
      INSTRUCTOR: goal.expectations.INSTRUCTOR,
      SENIOR_INSTRUCTOR: goal.expectations.SENIOR_INSTRUCTOR,
      LEAD_INSTRUCTOR: goal.expectations.LEAD_INSTRUCTOR,
    },
  })
);

/* ------------------------------------------------------------------ *
 * Leadership track — transcribed verbatim from the Leadership G&R
 * ------------------------------------------------------------------ */

const LEADERSHIP_ROLES: PathwayRole[] = [
  {
    id: "MANAGER",
    label: "Manager",
    subtitle: "Manager / Senior Manager",
    tagline: "Owning your area and delivering reliable, high-quality work.",
    mission:
      "Deliver high-quality work consistently, take ownership of your area, and proactively improve the systems and people around you.",
    promotionWindow:
      "Strong Managers who own outcomes across a program advance toward Director.",
    order: 0,
    bandKey: "MANAGER",
  },
  {
    id: "DIRECTOR",
    label: "Director",
    subtitle: "Director / Senior Director / Executive Director",
    tagline: "Owning outcomes and sustained impact across a function.",
    mission:
      "Own outcomes across an entire program or functional area, develop the staff around you, and lift the performance of every team you touch.",
    promotionWindow:
      "Directors who steward people and build lasting systems grow toward officer-level leadership.",
    order: 1,
    bandKey: "DIRECTOR",
  },
  {
    id: "OFFICER",
    label: "Officer",
    subtitle: "Officer",
    tagline: "Setting organization-wide direction and sustainability.",
    mission:
      "Define and drive organization-wide priorities, build structures that outlast any role, and steward the long-term direction of YPP.",
    promotionWindow: null,
    order: 2,
    bandKey: "OFFICER",
  },
];

const LEADERSHIP_PARALLEL_ROLES: PathwayRole[] = [
  {
    id: "CHAPTER_PRESIDENT",
    label: "Chapter President",
    subtitle: "Chapter President / Regional Director / Senior Regional Director",
    tagline: "Leading a chapter or region and the people within it.",
    mission:
      "Lead a chapter or region end to end — driving outcomes, developing leaders, and cultivating the relationships that sustain YPP locally.",
    promotionWindow:
      "Regional leaders who shape strategy beyond their territory step into officer-level stewardship.",
    order: 1,
    bandKey: "CHAPTER_PRESIDENT",
    parallelToOrder: 1,
  },
];

const LEADERSHIP_COMPETENCIES: PathwayCompetency[] =
  LEADERSHIP_RUBRIC_COMPETENCIES.map((c) => ({
    id: c.id,
    number: c.number,
    title: c.title,
    shortTitle: c.shortTitle,
    oneLiner: c.oneLiner,
    expectations: { ...c.expectations },
  }));

/* ------------------------------------------------------------------ *
 * Track registry + helpers
 * ------------------------------------------------------------------ */

export const TRACKS: Record<TrackId, TrackConfig> = {
  INSTRUCTOR: {
    id: "INSTRUCTOR",
    label: "Instructor Pathway",
    tagline:
      "How instructors grow at YPP — from the classroom to organization-wide teaching leadership.",
    chip: "Teaching",
    mission:
      "YPP Instructors create engaging, meaningful, high-quality learning experiences that help students explore and develop their passions. They shape the YPP experience through excellent teaching and family relationships, professionalism, and active contribution to the broader community — growing over time as leaders, collaborators, and ambassadors for YPP's mission and culture.",
    roles: INSTRUCTOR_ROLES,
    parallelRoles: [],
    competencies: INSTRUCTOR_COMPETENCIES,
  },
  LEADERSHIP: {
    id: "LEADERSHIP",
    label: "Leadership Pathway",
    tagline:
      "How leaders grow at YPP — from owning your area to stewarding the whole organization.",
    chip: "Leadership",
    mission:
      "YPP leaders own outcomes and deliver sustained impact — producing measurable results, driving new ideas, communicating reliably, developing the people around them, and building the systems and relationships that carry YPP's mission well beyond any single program cycle.",
    roles: LEADERSHIP_ROLES,
    parallelRoles: LEADERSHIP_PARALLEL_ROLES,
    competencies: LEADERSHIP_COMPETENCIES,
  },
};

export const TRACK_ORDER: TrackId[] = ["INSTRUCTOR", "LEADERSHIP"];

export function getRole(track: TrackConfig, roleId: string): PathwayRole | null {
  return (
    track.roles.find((r) => r.id === roleId) ??
    track.parallelRoles.find((r) => r.id === roleId) ??
    null
  );
}

export function isParallelRole(role: PathwayRole): boolean {
  return role.parallelToOrder !== undefined;
}

export function getNextRole(
  track: TrackConfig,
  roleId: string
): PathwayRole | null {
  const role = getRole(track, roleId);
  if (!role) return null;
  // Parallel roles promote to the rung above the one they sit beside.
  const fromOrder = role.parallelToOrder ?? role.order;
  return track.roles.find((r) => r.order === fromOrder + 1) ?? null;
}

/** Expectations for a single competency at a given role's band. */
export function expectationsFor(
  competency: PathwayCompetency,
  role: PathwayRole
): string[] {
  return competency.expectations[role.bandKey] ?? [];
}

/**
 * Resolve the user's default track + current role from their inferred
 * leadership stage, primary role, and org title. Title wins when it maps to a
 * canonical pathway rung (Manager / Director / Officer / CP / Instructor…).
 */
export function resolveStartingPosition(input: {
  stageId: string | null;
  primaryRole: string | null;
  /** Free-text or canonical org title (e.g. "Senior Director", "Chapter President"). */
  title?: string | null;
}): { trackId: TrackId; roleId: string } {
  const { stageId, primaryRole, title } = input;

  const fromTitle = pathwayRoleFromTitle(title);
  if (fromTitle) return fromTitle;

  // Explicit org-leadership signals → Leadership track.
  if (primaryRole === "CHAPTER_PRESIDENT") {
    return { trackId: "LEADERSHIP", roleId: "CHAPTER_PRESIDENT" };
  }
  if (stageId === "ORGANIZATIONAL_LEADERSHIP" || primaryRole === "ADMIN") {
    return { trackId: "LEADERSHIP", roleId: "OFFICER" };
  }
  if (primaryRole === "STAFF" || primaryRole === "HIRING_CHAIR") {
    return { trackId: "LEADERSHIP", roleId: "MANAGER" };
  }

  // Otherwise map the instructor stage onto the instructor ladder.
  if (stageId === "SENIOR_INSTRUCTOR") {
    return { trackId: "INSTRUCTOR", roleId: "SENIOR_INSTRUCTOR" };
  }
  if (stageId === "LEAD_INSTRUCTOR") {
    return { trackId: "INSTRUCTOR", roleId: "LEAD_INSTRUCTOR" };
  }
  // INSTRUCTOR, WORKSHOP_INSTRUCTOR, or unknown → Instructor rung.
  return { trackId: "INSTRUCTOR", roleId: "INSTRUCTOR" };
}

/** Map a stored org title onto a pathway track + role id. */
function pathwayRoleFromTitle(
  title: string | null | undefined,
): { trackId: TrackId; roleId: string } | null {
  if (!title?.trim()) return null;
  const key = title.trim().toLowerCase();

  // Instruction ladder
  if (key === "instructor") return { trackId: "INSTRUCTOR", roleId: "INSTRUCTOR" };
  if (key === "senior instructor") {
    return { trackId: "INSTRUCTOR", roleId: "SENIOR_INSTRUCTOR" };
  }
  if (key === "lead instructor") {
    return { trackId: "INSTRUCTOR", roleId: "LEAD_INSTRUCTOR" };
  }

  // Leadership ladder (+ parallel CP track)
  if (
    key === "chapter president" ||
    key === "president" ||
    key === "regional director" ||
    key === "senior regional director"
  ) {
    return { trackId: "LEADERSHIP", roleId: "CHAPTER_PRESIDENT" };
  }
  if (key === "manager" || key === "senior manager") {
    return { trackId: "LEADERSHIP", roleId: "MANAGER" };
  }
  if (
    key === "director" ||
    key === "senior director" ||
    key === "executive director"
  ) {
    return { trackId: "LEADERSHIP", roleId: "DIRECTOR" };
  }
  if (
    key === "officer" ||
    key === "senior officer" ||
    key === "board member" ||
    key === "board"
  ) {
    return { trackId: "LEADERSHIP", roleId: "OFFICER" };
  }

  return null;
}
