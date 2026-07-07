/**
 * Single source of truth for how the YPP growth system fits together, so every
 * mentorship / pathway surface reinforces the SAME mental model instead of
 * re-explaining five separate systems.
 *
 *   Leadership Pathway = the long-term growth journey.
 *   Mentorship          = the active coaching relationship / support.
 *   Goals & Resources   = the current month's plan.
 *   Monthly review      = the progress checkpoint.
 *   Status colors       = the current health signal (not a grade).
 *   Recognition / awards = recognition for growth and consistency.
 *   Chair approval      = quality control before feedback/points are finalized.
 *
 * Pure data + helpers — no IO, safe to import anywhere (server or client).
 */

export type GrowthModelKey =
  | "pathway"
  | "mentorship"
  | "goals"
  | "reviews"
  | "ratings"
  | "awards"
  | "approval";

export interface GrowthModelPiece {
  key: GrowthModelKey;
  label: string;
  /** One concise, mentee-friendly sentence describing this piece's role. */
  meaning: string;
  /** Where this piece lives for a mentee, when it has a home page. */
  href?: string;
}

export const GROWTH_MODEL: Record<GrowthModelKey, GrowthModelPiece> = {
  pathway: {
    key: "pathway",
    label: "Leadership Pathway",
    meaning: "The long-term journey — where you're growing over time.",
    href: "/leadership-pathway",
  },
  mentorship: {
    key: "mentorship",
    label: "Mentorship",
    meaning: "The support helping you move through your pathway.",
    href: "/mentorship?view=me",
  },
  goals: {
    key: "goals",
    label: "Goals & Resources",
    meaning: "What you're working on right now.",
    href: "/mentorship?view=me&section=goals",
  },
  reviews: {
    key: "reviews",
    label: "Monthly review",
    meaning: "The checkpoint that shows how this month went.",
    href: "/mentorship?view=me&section=reviews",
  },
  ratings: {
    key: "ratings",
    label: "Status colors",
    meaning: "A current health signal about where to focus next — not a grade.",
  },
  awards: {
    key: "awards",
    label: "Recognition",
    meaning: "Recognition that celebrates consistent growth.",
    href: "/mentorship?view=me&section=recognition",
  },
  approval: {
    key: "approval",
    label: "Chair approval",
    meaning: "A quality check before feedback and points are finalized.",
  },
};

/**
 * The order the model is shown in when rendering the connected "how this fits
 * together" strip: journey → support → this month's work → checkpoint → recognition.
 */
export const GROWTH_MODEL_ORDER: GrowthModelKey[] = [
  "pathway",
  "mentorship",
  "goals",
  "reviews",
  "awards",
];

/**
 * Surfaces that show a one-line "how this connects to your growth" note. Keyed
 * so the copy lives in exactly one place rather than being duplicated per page.
 */
export type GrowthConnectSurface =
  | "my-mentor"
  | "pathway"
  | "goals"
  | "progress"
  | "awards"
  | "reflection";

export const GROWTH_CONNECT_LINE: Record<GrowthConnectSurface, string> = {
  "my-mentor":
    "Mentorship is the support that helps you move through your Leadership Pathway.",
  pathway:
    "Your pathway is the big picture; mentorship is the support that moves you through it.",
  goals: "These goals are this month's step on your bigger Leadership Pathway.",
  progress:
    "Your progress is one checkpoint in the longer journey of your Leadership Pathway.",
  awards:
    "Awards recognize growth along your pathway — they don't replace your goals or your mentor's feedback.",
  reflection:
    "Your reflection starts the monthly checkpoint that keeps your pathway moving.",
};

export function getGrowthConnectLine(surface: GrowthConnectSurface): string {
  return GROWTH_CONNECT_LINE[surface];
}
