import type { HelpAgentSuggestion } from "./types";

/**
 * YPP Help Agent — curated suggested searches and command shortcuts.
 *
 * Static and deterministic (master plan §8): each entry is a deep link to the
 * surface that answers the question today. Phase 2A pointed the people and
 * partner queries at the new master databases' filtered views (/people,
 * /partners) — the palette's shape didn't change, the destinations got
 * better. Descriptions state exactly what the destination shows — no vague
 * labels.
 */
export const HELP_AGENT_SUGGESTIONS: HelpAgentSuggestion[] = [
  {
    label: "Students without advisors",
    description: "People database filtered to students with no active advisor",
    href: "/people?flag=no-advisor",
    icon: "🎓",
    tier: "OFFICER",
    kind: "query",
  },
  {
    label: "Advisor check-ins overdue",
    description: "Students whose next advisor check-in date has passed",
    href: "/people?flag=checkin-overdue",
    icon: "🧭",
    tier: "OFFICER",
    kind: "query",
  },
  {
    label: "Applicants waiting for decision",
    description: "Instructor applicant pipeline, grouped by stage",
    href: "/admin/instructor-applicants",
    icon: "📋",
    tier: "OFFICER",
    kind: "query",
  },
  {
    label: "Overdue actions",
    description: "Open action items past their due date",
    href: "/actions",
    icon: "⏰",
    tier: "OFFICER",
    kind: "query",
  },
  {
    label: "Upcoming meetings",
    description: "Officer meetings on the calendar, soonest first",
    href: "/actions/meetings",
    icon: "📅",
    tier: "OFFICER",
    kind: "query",
  },
  {
    label: "Overdue instructor reviews",
    description: "Instructor database — filter status to Attention",
    href: "/admin/instructors",
    icon: "🧑‍🏫",
    tier: "OFFICER",
    kind: "query",
  },
  {
    label: "Partner follow-ups",
    description: "Partners with an overdue follow-up, no next step, or no owner",
    href: "/partners?view=follow-up",
    icon: "🤝",
    tier: "OFFICER",
    kind: "query",
  },
  {
    label: "Open partner requests",
    description: "Partners with asks still open or in negotiation",
    href: "/partners?flag=open-requests",
    icon: "📨",
    tier: "OFFICER",
    kind: "query",
  },
  {
    label: "Partners without relationship leads",
    description: "Partner database filtered to unowned relationships",
    href: "/partners?flag=no-lead",
    icon: "🫥",
    tier: "OFFICER",
    kind: "query",
  },
  {
    label: "Partners with upcoming meetings",
    description: "Partners that have an officer meeting on the calendar",
    href: "/partners?view=meetings",
    icon: "📅",
    tier: "OFFICER",
    kind: "query",
  },
  {
    label: "Classes with no lead instructor",
    description: "Class operations — review queue and logistics gaps",
    href: "/admin/classes",
    icon: "📚",
    tier: "OFFICER",
    kind: "query",
  },
  {
    label: "Mentorships missing check-ins",
    description: "Mentorship ops — needs-action and check-ins tabs",
    href: "/admin/mentorship",
    icon: "🔄",
    tier: "OFFICER",
    kind: "query",
  },
  {
    label: "At-risk initiatives",
    description: "Initiative portfolio, worst first, with the reasons",
    href: "/operations/initiatives",
    icon: "🚩",
    tier: "OFFICER",
    kind: "query",
  },
  {
    label: "Actions assigned to me",
    description: "Your open action items, bucketed by deadline",
    href: "/actions",
    icon: "✅",
    tier: "MEMBER",
    kind: "query",
  },
  // --- Command shortcuts ---
  {
    label: "Open People database",
    description: "Every person connected to YPP, with advisor and role flags",
    href: "/people",
    icon: "👥",
    tier: "OFFICER",
    kind: "shortcut",
  },
  {
    label: "Open Partner database",
    description: "Every partner relationship: owner, contacts, requests, next step",
    href: "/partners",
    icon: "🤝",
    tier: "OFFICER",
    kind: "shortcut",
  },
  {
    label: "New action",
    description: "Create an action item",
    href: "/actions/new",
    icon: "＋",
    tier: "OFFICER",
    kind: "shortcut",
  },
  {
    label: "New meeting",
    description: "Log or schedule an officer meeting",
    href: "/actions/meetings?new=1",
    icon: "＋",
    tier: "OFFICER",
    kind: "shortcut",
  },
  {
    label: "Add partner",
    description: "Add an organization to the partner database",
    href: "/admin/partners",
    icon: "＋",
    tier: "OFFICER",
    kind: "shortcut",
  },
];

export function suggestionsForTier(
  tier: "MEMBER" | "OFFICER"
): HelpAgentSuggestion[] {
  if (tier === "OFFICER") return HELP_AGENT_SUGGESTIONS;
  return HELP_AGENT_SUGGESTIONS.filter((s) => s.tier === "MEMBER");
}
