import Anthropic from "@anthropic-ai/sdk";

import type { SuggestedAction, SuggestPerson } from "./notes-to-actions";

/**
 * Smart notes → actions — OPTIONAL AI extractor.
 *
 * Produces the SAME `SuggestedAction[]` shape as the deterministic parser, but
 * uses Claude to read the notes when (and only when) `ANTHROPIC_API_KEY` is set
 * and the officer opted in. Any failure returns null so the caller falls back to
 * the heuristic parser — the feature never depends on AI being present.
 */

export function isNotesAIConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const SYSTEM_PROMPT = `You extract concrete ACTION ITEMS from raw meeting notes for the Youth Passion Project (YPP) portal.

Return ONLY a JSON array (no prose, no markdown). Each element:
{
  "title": "short imperative action title (e.g. 'Confirm interviews happened')",
  "ownerName": "<exactly one of the provided attendee names, or null if unclear>",
  "dueDateISO": "<ISO 8601 date if the notes state or clearly imply one, else null>",
  "sourceLine": "the note text this came from",
  "confidence": "high" | "medium" | "low"
}

Rules:
- Only include real action items — things someone must DO. Skip pure discussion, FYIs, and open questions.
- NEVER invent owners. Use ownerName only when the notes name a person who is in the attendee list; otherwise null.
- Resolve relative dates ("by Sunday", "next week", "tomorrow") against the meeting date provided. If no date is implied, use null.
- Keep titles short and action-first. Max 12 items.`;

export async function extractSuggestedActionsWithAI(input: {
  notes: string;
  people: SuggestPerson[];
  meetingDateISO?: string | null;
}): Promise<SuggestedAction[] | null> {
  if (!isNotesAIConfigured()) return null;
  const notes = input.notes.trim();
  if (!notes) return [];

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const attendeeNames = input.people.map((p) => p.name).filter(Boolean);

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1200,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: `Meeting date: ${input.meetingDateISO ?? new Date().toISOString()}
Attendees (valid owners): ${attendeeNames.length ? attendeeNames.join(", ") : "(none listed)"}

NOTES:
${notes}

Return the JSON array now.`,
        },
      ],
    });

    const first = response.content[0];
    const raw = first && first.type === "text" ? first.text : "";
    const json = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();

    const parsed = JSON.parse(json) as Array<{
      title?: unknown;
      ownerName?: unknown;
      dueDateISO?: unknown;
      sourceLine?: unknown;
      confidence?: unknown;
    }>;
    if (!Array.isArray(parsed)) return null;

    const byName = new Map(input.people.map((p) => [p.name.trim().toLowerCase(), p]));
    const out: SuggestedAction[] = [];
    parsed.forEach((row, i) => {
      if (typeof row.title !== "string" || row.title.trim().length < 3) return;
      const ownerName = typeof row.ownerName === "string" ? row.ownerName.trim() : "";
      const owner = ownerName ? byName.get(ownerName.toLowerCase()) ?? null : null;
      let dueISO: string | null = null;
      let dueLabel: string | null = null;
      if (typeof row.dueDateISO === "string" && row.dueDateISO.trim()) {
        const d = new Date(row.dueDateISO);
        if (!Number.isNaN(d.getTime())) {
          dueISO = d.toISOString();
          dueLabel = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        }
      }
      const confidence =
        row.confidence === "high" || row.confidence === "medium" || row.confidence === "low"
          ? row.confidence
          : "medium";
      out.push({
        id: `ai-${i}`,
        title: row.title.trim().slice(0, 160),
        ownerId: owner?.id ?? null,
        ownerName: owner?.name ?? (ownerName || null),
        dueDateISO: dueISO,
        dueLabel,
        sourceLine: typeof row.sourceLine === "string" ? row.sourceLine.slice(0, 240) : "",
        confidence,
      });
    });
    return out.slice(0, 12);
  } catch (err) {
    console.error("[notes-to-actions] AI extraction failed; using heuristic parser:", err);
    return null;
  }
}
