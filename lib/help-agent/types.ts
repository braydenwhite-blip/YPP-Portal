import type { Entity360Type } from "@/lib/operations/entity-360";

/**
 * YPP Help Agent — shared result shapes (pure; safe for client and server).
 *
 * The Help Agent is deterministic-first: indexed/live entity search, saved
 * queries, and command shortcuts. No model calls anywhere in this path.
 */

export type HelpAgentResult = {
  /** Entity 360 type — selecting a result opens its 360 preview drawer. */
  type: Entity360Type;
  id: string;
  title: string;
  /** Concrete context line ("Instructor · Math Track", "Partner · School"). */
  subtitle: string | null;
  /** Full-page fallback (modifier click / no drawer provider). */
  href: string | null;
};

export type HelpAgentGroup = {
  type: Entity360Type;
  label: string;
  items: HelpAgentResult[];
};

export type HelpAgentSearchResponse = {
  query: string;
  groups: HelpAgentGroup[];
  /** Recently viewed entities — returned when the query is empty. */
  recents: HelpAgentResult[];
};

/** A curated suggestion or command shortcut rendered when the input is empty. */
export type HelpAgentSuggestion = {
  label: string;
  /** What the user will actually see there — concrete, never vague. */
  description: string;
  href: string;
  icon: string;
  /** Minimum tier that should see this suggestion. */
  tier: "MEMBER" | "OFFICER";
  /** Hide from non-admin officers when the target route is admin-only. */
  adminOnly?: boolean;
  kind: "query" | "shortcut";
};

/* ---------------------------------------------------------------------------
 * Chief of Staff — structured answers (client + server safe; pure data).
 *
 * The Help Agent answers operational questions with structured ANSWER BLOCKS,
 * not paragraphs. Every block is built deterministically from the portal's
 * existing derivation engine (no AI required). When the optional AI layer is
 * configured AND requested, a grounded `narrative` is added on top — the blocks
 * never change. So the same shape serializes whether AI ran or not.
 * ------------------------------------------------------------------------- */

export type CoSTone = "danger" | "warning" | "info" | "success" | "neutral";

/** One line inside an answer block — always links back to a real record. */
export type CoSAnswerItem = {
  /** Primary line (the thing). */
  label: string;
  /** Why it matters / supporting context. */
  detail?: string | null;
  /** The operational signal chip — exactly why this matters now
   *  ("Overdue 3d", "No owner", "Decision needs an action"). Never "priority". */
  signal?: string | null;
  tone?: CoSTone;
  /** Link back to the record this line is about. */
  href?: string | null;
  /** Provenance — where this came from ("From: Instructor Onboarding · Jun 9"). */
  source?: string | null;
  /** Entity 360 drawer target, when the line is an entity. */
  entityType?: Entity360Type | null;
  entityId?: string | null;
};

export type CoSBlockKind =
  | "needs_attention"
  | "recent_decisions"
  | "decisions_needing_action"
  | "unresolved_followups"
  | "meetings_need_followthrough"
  | "open_actions"
  | "completed_work"
  | "weekly_summary"
  | "entity_summary"
  | "suggested_next_steps"
  | "missing_context"
  | "upcoming_meetings"
  | "partners_need_followup"
  | "classes_need_setup"
  | "initiatives_attention";

/** A titled group of answer lines (e.g. "Unresolved follow-ups"). */
export type CoSAnswerBlock = {
  kind: CoSBlockKind;
  title: string;
  /** One-line framing under the title. */
  subtitle?: string | null;
  items: CoSAnswerItem[];
  /** Action-oriented copy shown when there are no items (strong empty state). */
  emptyState?: string | null;
  /** Deep link to the full list behind this block. */
  moreHref?: string | null;
  moreLabel?: string | null;
};

export type CoSAnswer = {
  question: string;
  /** A deterministic one-line headline summarizing the answer. */
  headline: string;
  blocks: CoSAnswerBlock[];
  /** Optional AI-written narrative — present only when the AI layer ran. */
  narrative?: string | null;
  /** True when AI produced the narrative this time. */
  aiUsed: boolean;
  /** True when the AI enhancement is available to request at all. */
  aiAvailable: boolean;
  generatedAtISO: string;
};

/** A proactive one-liner the Chief of Staff surfaces without being asked. */
export type CoSInsight = {
  text: string;
  tone: CoSTone;
  /** The operational signal, when there is one. */
  signal?: string | null;
  href: string;
  ctaLabel?: string | null;
};

/** A page-aware suggested question. */
export type CoSPrompt = { label: string; question: string };
