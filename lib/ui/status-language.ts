/**
 * Status language — the portal's single vocabulary for "what state is this in?"
 *
 * Intuitiveness doctrine (docs/ypp-global-intuitiveness-design-system.md §11):
 * a status label must name a CONCRETE state a user can act on, never a derived
 * mood. "Overdue / Blocked / Needs review / No advisor" — yes. "Health / Pulse
 * / Momentum / Readiness / Risk" — no, unless the exact reason renders right
 * beside it (master plan §19).
 *
 * Use this map so the same state reads the same everywhere, and so every label
 * carries a StatusBadge tone from the one approved set. Render the concrete
 * reason via StatusBadge's `title` (or beside the badge) whenever the state is
 * derived.
 */

/** Mirrors the StatusBadge tone union (components/ui-v2/status-badge.tsx). */
export type StatusLanguageTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "brand";

export type StatusMeaning = {
  /** The human, action-oriented label shown to the user. */
  label: string;
  tone: StatusLanguageTone;
};

/**
 * Canonical states, keyed by a stable slug. Aliases (e.g. `unowned`) point at
 * the same meaning so older code keys still resolve to one approved label.
 */
export const STATUS_LANGUAGE = {
  // Time / urgency
  overdue: { label: "Overdue", tone: "danger" },
  "due-soon": { label: "Due soon", tone: "warning" },
  "no-due-date": { label: "No due date", tone: "neutral" },

  // Ownership
  "missing-owner": { label: "Missing owner", tone: "warning" },
  unowned: { label: "Missing owner", tone: "warning" },
  "no-lead": { label: "No relationship lead", tone: "warning" },

  // Progress
  blocked: { label: "Blocked", tone: "danger" },
  "in-progress": { label: "In progress", tone: "info" },
  "on-track": { label: "On track", tone: "success" },
  done: { label: "Done", tone: "success" },
  complete: { label: "Done", tone: "success" },
  "no-next-step": { label: "No next step", tone: "warning" },

  // Follow-up / review
  "needs-follow-up": { label: "Needs follow-up", tone: "warning" },
  "needs-review": { label: "Needs review", tone: "warning" },
  "feedback-pending": { label: "Feedback pending", tone: "warning" },
  "decision-needed": { label: "Decision needed", tone: "warning" },
  "waiting-decision": { label: "Waiting for decision", tone: "warning" },

  // People / advising
  "no-advisor": { label: "No advisor", tone: "warning" },
  "check-in-overdue": { label: "Check-in overdue", tone: "danger" },
  "open-support-need": { label: "Open support need", tone: "warning" },

  // Hiring / interviews
  "interview-incomplete": { label: "Interview incomplete", tone: "warning" },
  "review-overdue": { label: "Review overdue", tone: "danger" },
  "ready-to-submit": { label: "Ready to submit", tone: "success" },
  scheduled: { label: "Scheduled", tone: "info" },

  // Partners
  "open-request": { label: "Open request", tone: "info" },
  "follow-up-due": { label: "Follow-up due", tone: "warning" },
} as const satisfies Record<string, StatusMeaning>;

export type StatusLanguageKey = keyof typeof STATUS_LANGUAGE;

/**
 * Vague-mood words that are NOT status labels on their own. If one of these is
 * the only thing on a chip, the chip is lying about being concrete — show the
 * reason instead (master plan §19). Kept here as the reviewable source of
 * truth for the "never again" anti-patterns list.
 */
export const BANNED_STATUS_WORDS = [
  "health",
  "pulse",
  "momentum",
  "quality",
  "engagement",
  "risk",
  "readiness",
  "fit",
  "score",
  "grade",
  "vibe",
  "wellness",
] as const;

/**
 * Resolve a canonical status key to its approved label + tone. Unknown keys
 * fall back to a neutral, title-cased rendering of the key so nothing crashes,
 * but new states should be added to STATUS_LANGUAGE so they read consistently.
 */
export function humanStatus(key: string): StatusMeaning {
  const known = (STATUS_LANGUAGE as Record<string, StatusMeaning>)[key];
  if (known) return known;
  const label = key
    .replaceAll(/[_-]+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
  return { label: label || "Unknown", tone: "neutral" };
}

/** True when a label leans on a banned vague-mood word (lint/test helper). */
export function isVagueStatusWord(word: string): boolean {
  return (BANNED_STATUS_WORDS as readonly string[]).includes(word.trim().toLowerCase());
}
