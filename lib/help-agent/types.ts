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
  kind: "query" | "shortcut";
};
