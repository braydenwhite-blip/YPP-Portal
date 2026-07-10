import { z } from "zod";

/**
 * Pure validation + composition for a Mentorship conversation record. Kept out
 * of the `"use server"` action file so it is unit-testable and importable from
 * the client composer's type. No IO.
 */

export const CHECK_IN_KINDS = ["CHECK_IN", "MEETING", "CONVERSATION"] as const;
export type CheckInKind = (typeof CHECK_IN_KINDS)[number];

/** Trim a free-text field to a bounded string or null (empty → null). */
const structuredText = z.preprocess(
  (value) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  },
  z.string().max(8000).nullable()
);

export const RecordCheckInSchema = z.object({
  subjectId: z.string().min(1),
  mentorshipId: z.string().min(1),
  selfReflectionId: z.string().min(1).optional(),
  kind: z.enum(CHECK_IN_KINDS).default("CHECK_IN"),
  occurredAt: z.coerce.date().optional(),
  participantIds: z.array(z.string().min(1)).default([]),
  wins: structuredText.optional(),
  challenges: structuredText.optional(),
  discussion: structuredText.optional(),
  decisions: structuredText.optional(),
  commitments: structuredText.optional(),
  followUpDate: z.coerce.date().nullable().optional(),
  rating: z.coerce.number().int().min(1).max(5).nullable().optional(),
});

export type ParsedCheckIn = z.infer<typeof RecordCheckInSchema>;

/**
 * The client-facing input shape. Dates arrive as `YYYY-MM-DD` strings and the
 * rating as a number; the zod schema coerces + validates them server-side.
 */
export interface RecordCheckInInput {
  subjectId: string;
  mentorshipId: string;
  selfReflectionId?: string;
  kind?: CheckInKind;
  occurredAt?: string;
  participantIds?: string[];
  wins?: string;
  challenges?: string;
  discussion?: string;
  decisions?: string;
  commitments?: string;
  followUpDate?: string;
  rating?: number;
}

export function kindLabel(kind: CheckInKind): string {
  if (kind === "MEETING") return "Meeting";
  if (kind === "CONVERSATION") return "Conversation";
  return "Check-in";
}

/**
 * One-line summary written to `notes` so every existing reader
 * (`getMentorshipCheckIns`, notification links) keeps rendering.
 */
export function composeNotesSummary(data: ParsedCheckIn): string {
  const parts: string[] = [];
  if (data.discussion) {
    parts.push(data.discussion);
  } else {
    if (data.wins) parts.push(`Wins: ${data.wins}`);
    if (data.challenges) parts.push(`Challenges: ${data.challenges}`);
  }
  if (data.decisions) parts.push(`Decisions: ${data.decisions}`);
  if (data.commitments) parts.push(`Commitments: ${data.commitments}`);
  const text = parts.join(" · ").replace(/\s+/g, " ").trim();
  return text.length > 0 ? text.slice(0, 500) : `${kindLabel(data.kind)} logged.`;
}
