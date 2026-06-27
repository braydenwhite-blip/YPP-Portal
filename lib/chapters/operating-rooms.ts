// THE Organizational Operating System — six permanent operating domains.
//
// This is the pure, deterministic foundation (no Prisma, no `server-only`): the
// domain catalog, the shared "room" DTO every domain renders, and the
// derivations (health-with-reasons, insights) that turn raw signals into a calm,
// evidence-backed room. The DB loader (`operating-rooms-loader.ts`) gathers real
// rows and composes these; the UI (`components/chapters/operating-room.tsx`)
// renders the DTO. Keeping the logic here makes it fully unit-testable.
//
// A "room" is NOT a dashboard. Each answers one question with: a mission, an
// evidence-backed health read, the 3–5 things that need the CP, recent activity,
// a compact evidence table, derived insights, and exactly one next action.

import type { ChapterBlocker } from "@/lib/chapters/needs-attention-rules";
import type { PartnerEvidenceRow, InstructorEvidenceRow } from "@/lib/chapters/pipeline";
import type { CurriculumEvidenceRow } from "@/lib/chapters/curriculum-review";
import type { ClassEvidenceRow } from "@/lib/chapters/launch-readiness";
import type { StudentEvidenceRow } from "@/lib/chapters/student-community";
import type { GrowthEvidenceRow } from "@/lib/chapters/chapter-growth";

// ---------------------------------------------------------------------------
// Domain catalog
// ---------------------------------------------------------------------------

export const OPERATING_DOMAINS = [
  "partner-network",
  "teaching",
  "learning",
  "classes",
  "students",
  "growth",
] as const;
export type OperatingDomainSlug = (typeof OPERATING_DOMAINS)[number];

export function isOperatingDomain(slug: string): slug is OperatingDomainSlug {
  return (OPERATING_DOMAINS as readonly string[]).includes(slug);
}

export type DomainMeta = {
  slug: OperatingDomainSlug;
  /** Room title, e.g. "Partner Network". */
  title: string;
  /** Short label for in-room navigation, e.g. "Partners". */
  short: string;
  /** One sentence: why this domain exists. */
  mission: string;
  /** The single question the room answers. */
  question: string;
  /** Calm room glyph. */
  icon: string;
};

export const DOMAIN_META: Record<OperatingDomainSlug, DomainMeta> = {
  "partner-network": {
    slug: "partner-network",
    title: "Partner Network",
    short: "Partners",
    mission: "Build and maintain the relationships that make every class possible.",
    question: "How healthy is our partner network?",
    icon: "🤝",
  },
  teaching: {
    slug: "teaching",
    title: "Teaching Organization",
    short: "Teaching",
    mission: "Recruit, hire, and develop the instructors who deliver great classes.",
    question: "Do we have the people needed to deliver great classes?",
    icon: "🧑‍🏫",
  },
  learning: {
    slug: "learning",
    title: "Learning Program",
    short: "Learning",
    mission: "Make sure every class is backed by approved, high-quality curriculum.",
    question: "Are we ready to teach?",
    icon: "📚",
  },
  classes: {
    slug: "classes",
    title: "Live Classes",
    short: "Classes",
    mission: "Launch healthy classes and step in fast when one needs help.",
    question: "Which classes are healthy and which need intervention?",
    icon: "🎓",
  },
  students: {
    slug: "students",
    title: "Student Community",
    short: "Students",
    mission: "Give every enrolled student and family a great experience.",
    question: "Are students having a great experience?",
    icon: "🌱",
  },
  growth: {
    slug: "growth",
    title: "Chapter Growth",
    short: "Growth",
    mission: "Make the chapter stronger every week.",
    question: "Is the chapter becoming stronger?",
    icon: "📈",
  },
};

/** The six domains in their canonical operating order. */
export const DOMAIN_LIST: DomainMeta[] = OPERATING_DOMAINS.map((s) => DOMAIN_META[s]);

// ---------------------------------------------------------------------------
// Shared room sections
// ---------------------------------------------------------------------------

/** Evidence-backed health — never an opaque score. */
export type RoomHealthStatus = "strong" | "needs_attention" | "critical";
export type RoomHealth = {
  status: RoomHealthStatus;
  /** Plain headline, e.g. "2 items need attention". */
  headline: string;
  /** The concrete reasons behind the status (the evidence). */
  reasons: string[];
};

/** Badge tone + label per health status — single-sourced for server and client. */
export const ROOM_HEALTH_TONE: Record<RoomHealthStatus, "success" | "warning" | "danger"> = {
  strong: "success",
  needs_attention: "warning",
  critical: "danger",
};
export const ROOM_HEALTH_LABEL: Record<RoomHealthStatus, string> = {
  strong: "Strong",
  needs_attention: "Needs Attention",
  critical: "Critical",
};

export type NeedsYouSeverity = "critical" | "warning" | "info";
/** Entity behind a "Needs You" item, for opening the right Entity 360. */
export type NeedsYouEntityType =
  | "PARTNER"
  | "INSTRUCTOR_APPLICATION"
  | "CLASS_OFFERING"
  | "STUDENT"
  | "MEETING"
  | null;

/** One item in a room's "Needs You" list — the Action-Tracker-style triage. */
export type NeedsYouItem = {
  key: string;
  severity: NeedsYouSeverity;
  title: string;
  detail: string | null;
  /** Where the CP goes to resolve it. */
  href: string | null;
  /** Entity to open in place (Entity 360), if any. */
  entityType: NeedsYouEntityType;
  entityId: string | null;
  /** Title to use if the CP tracks this as a real ActionItem. */
  suggestedAction: string;
};

export type ActivityTone = "neutral" | "good" | "warn";
/** A recent change in the domain — the room's pulse. */
export type ActivityEvent = {
  key: string;
  /** What happened, e.g. "Curriculum approved". */
  label: string;
  /** The subject, e.g. "Python Fundamentals · M. Patel". */
  detail: string;
  /** Pre-formatted "2 days ago". */
  when: string;
  tone: ActivityTone;
};

export type InsightTone = "neutral" | "good" | "warn" | "danger";
/** A derived (never AI) observation about the domain. */
export type RoomInsight = { key: string; text: string; tone: InsightTone };

/** Exactly one recommended next action. */
export type RoomNextAction = { text: string; cta: string; href: string } | null;

/** A small contextual metric shown inside the room (not a dashboard card). */
export type RoomMetric = { label: string; value: string; hint?: string };

/** The compact evidence table, typed per domain so rows open the right 360. */
export type EvidencePayload =
  | { kind: "partner"; rows: PartnerEvidenceRow[]; totalRows: number }
  | { kind: "instructor"; rows: InstructorEvidenceRow[]; totalRows: number }
  | { kind: "curriculum"; rows: CurriculumEvidenceRow[]; totalRows: number }
  | { kind: "class"; rows: ClassEvidenceRow[]; totalRows: number }
  | { kind: "student"; rows: StudentEvidenceRow[]; totalRows: number }
  | { kind: "growth"; rows: GrowthEvidenceRow[]; totalRows: number };

/** Everything a single room renders. */
export type OperatingRoomCore = {
  slug: OperatingDomainSlug;
  title: string;
  mission: string;
  question: string;
  icon: string;
  health: RoomHealth;
  metrics: RoomMetric[];
  needsYou: NeedsYouItem[];
  recentActivity: ActivityEvent[];
  insights: RoomInsight[];
  nextAction: RoomNextAction;
};

export type OperatingRoom = OperatingRoomCore & { evidence: EvidencePayload };

/** A room's one-glance summary for the hub (the "building" view). */
export type RoomSummary = {
  slug: OperatingDomainSlug;
  title: string;
  short: string;
  mission: string;
  question: string;
  icon: string;
  health: RoomHealth;
  needsYouCount: number;
  /** The single most urgent thing, if any, as a teaser. */
  topNeedsYou: string | null;
  nextAction: string | null;
};

// ---------------------------------------------------------------------------
// Pure derivations
// ---------------------------------------------------------------------------

function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many;
}

/** Map a needs-attention `ChapterBlocker` onto the uniform NeedsYou item. */
export function blockerToNeedsYou(b: ChapterBlocker): NeedsYouItem {
  return {
    key: b.key,
    severity: b.severity,
    title: b.title,
    detail: b.detail ?? null,
    href: b.href,
    entityType: b.entityType ?? null,
    entityId: b.entityId ?? null,
    suggestedAction: b.suggestedAction,
  };
}

/**
 * Derive a room's health from its open items — evidence-backed, with the actual
 * problem statements as the reasons. A critical item makes the room critical; a
 * warning makes it need attention; otherwise it's strong (with a positive
 * headline). Ranked items in, top reasons out.
 */
export function deriveRoomHealth(items: NeedsYouItem[], strongHeadline: string): RoomHealth {
  const critical = items.filter((i) => i.severity === "critical");
  const warning = items.filter((i) => i.severity === "warning");
  if (critical.length > 0) {
    return {
      status: "critical",
      headline: `${critical.length} critical ${plural(critical.length, "issue")}`,
      reasons: critical.slice(0, 3).map((i) => i.title),
    };
  }
  if (warning.length > 0) {
    return {
      status: "needs_attention",
      headline: `${warning.length} ${plural(warning.length, "item")} need attention`,
      reasons: warning.slice(0, 3).map((i) => i.title),
    };
  }
  return { status: "strong", headline: strongHeadline, reasons: [] };
}

/** Rank needs-you items most-urgent-first (critical → warning → info), stable. */
const NEEDS_YOU_RANK: Record<NeedsYouSeverity, number> = { critical: 0, warning: 1, info: 2 };
export function rankNeedsYou(items: NeedsYouItem[]): NeedsYouItem[] {
  return [...items].sort((a, b) => NEEDS_YOU_RANK[a.severity] - NEEDS_YOU_RANK[b.severity]);
}

/** Collapse a room's full detail into the hub summary. */
export function toRoomSummary(room: OperatingRoomCore): RoomSummary {
  const meta = DOMAIN_META[room.slug];
  return {
    slug: room.slug,
    title: room.title,
    short: meta.short,
    mission: room.mission,
    question: room.question,
    icon: room.icon,
    health: room.health,
    needsYouCount: room.needsYou.length,
    topNeedsYou: room.needsYou[0]?.title ?? null,
    nextAction: room.nextAction?.text ?? null,
  };
}

/** Roll the six rooms' health into the building-level read. */
export function summarizeBuildingHealth(rooms: RoomSummary[]): {
  status: RoomHealthStatus;
  critical: number;
  needsAttention: number;
  strong: number;
} {
  const critical = rooms.filter((r) => r.health.status === "critical").length;
  const needsAttention = rooms.filter((r) => r.health.status === "needs_attention").length;
  const strong = rooms.filter((r) => r.health.status === "strong").length;
  const status: RoomHealthStatus =
    critical > 0 ? "critical" : needsAttention > 0 ? "needs_attention" : "strong";
  return { status, critical, needsAttention, strong };
}
