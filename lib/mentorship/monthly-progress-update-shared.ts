import type { GoalRatingColor } from "@prisma/client";

import { RATING_LABELS, RATING_POINTS } from "@/lib/people-strategy/check-in-rating";

/**
 * Client-safe Monthly Progress Update helpers — no Prisma / server-only.
 * The loader lives in `monthly-progress-update.ts` (server-only).
 */

export const MONTHLY_UPDATE_RATINGS: GoalRatingColor[] = [
  "BEHIND_SCHEDULE",
  "GETTING_STARTED",
  "ACHIEVED",
  "ABOVE_AND_BEYOND",
];

const STRENGTHS_MARKER = "\n\n---\nStrengths:\n";
const AREAS_MARKER = "\nAreas for Development:\n";

/** Pack Strengths / Areas into overallComments until dedicated columns exist. */
export function packProgressNarrative(parts: {
  overallComments: string;
  strengths: string;
  areasForDevelopment: string;
}): string {
  const base = parts.overallComments.trim();
  const strengths = parts.strengths.trim();
  const areas = parts.areasForDevelopment.trim();
  if (!strengths && !areas) return base;
  return `${base}${STRENGTHS_MARKER}${strengths || "—"}${AREAS_MARKER}${areas || "—"}`;
}

export function unpackProgressNarrative(raw: string | null | undefined): {
  overallComments: string | null;
  strengths: string | null;
  areasForDevelopment: string | null;
} {
  const text = (raw ?? "").trim();
  if (!text) {
    return { overallComments: null, strengths: null, areasForDevelopment: null };
  }
  const strengthsIdx = text.indexOf(STRENGTHS_MARKER);
  if (strengthsIdx < 0) {
    return { overallComments: text, strengths: null, areasForDevelopment: null };
  }
  const overallComments = text.slice(0, strengthsIdx).trim() || null;
  const rest = text.slice(strengthsIdx + STRENGTHS_MARKER.length);
  const areasIdx = rest.indexOf(AREAS_MARKER);
  if (areasIdx < 0) {
    return {
      overallComments,
      strengths: rest.trim() || null,
      areasForDevelopment: null,
    };
  }
  return {
    overallComments,
    strengths: rest.slice(0, areasIdx).trim() || null,
    areasForDevelopment: rest.slice(areasIdx + AREAS_MARKER.length).trim() || null,
  };
}

/** Pack collaborate-with + objective into a goal comment / description blob. */
export function packGoalProgressText(parts: {
  collaborateWith?: string | null;
  objective: string;
}): string {
  const objective = parts.objective.trim();
  const collaborateWith = parts.collaborateWith?.trim();
  if (collaborateWith) {
    return `Collaborate with: ${collaborateWith}${objective ? `\n${objective}` : ""}`;
  }
  return objective;
}

/** Pull "Collaborate with: X" lines out of goal description text when present. */
export function parseCollaborateWith(description: string | null | undefined): {
  collaborateWith: string | null;
  objective: string;
} {
  const text = (description ?? "").trim();
  if (!text) return { collaborateWith: null, objective: "" };
  const match = text.match(
    /(?:collaborate\s*with|collaborators?)\s*[:\-–]\s*(.+?)(?:\n|$)/i
  );
  if (!match) return { collaborateWith: null, objective: text };
  const collaborateWith = match[1].trim() || null;
  const objective = text.replace(match[0], "").trim();
  return { collaborateWith, objective };
}

export function ratingLabel(rating: GoalRatingColor | null | undefined): string {
  if (!rating) return "—";
  return RATING_LABELS[rating] ?? rating;
}

export function ratingPoints(rating: GoalRatingColor | null | undefined): number | null {
  if (!rating) return null;
  return RATING_POINTS[rating] ?? null;
}
