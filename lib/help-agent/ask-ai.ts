import Anthropic from "@anthropic-ai/sdk";

import type { CoSAnswer } from "./types";

/**
 * YPP Help Agent — OPTIONAL AI narration layer.
 *
 * This is purely additive. The Chief of Staff is fully functional with zero AI:
 * `buildChiefOfStaffAnswer` produces the structured answer blocks
 * deterministically. When (and only when) `ANTHROPIC_API_KEY` is configured and
 * the officer opts in, this module asks Claude to write a short, grounded
 * narrative ON TOP of those blocks — it never changes the data, never invents
 * facts, and any failure falls back silently to the deterministic answer.
 *
 * Follows the established `lib/ai/generate-review-draft.ts` integration pattern
 * (Anthropic SDK, cached system prompt, defensive parsing).
 */

/** True when the optional AI enhancement can run at all (key present). */
export function isChiefOfStaffAIConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const SYSTEM_PROMPT = `You are the Chief of Staff for the Youth Passion Project (YPP) — a youth-led nonprofit. You help officers understand the state of the organization at a glance.

You will be given an officer's question AND a structured, factual answer that has ALREADY been computed deterministically from the portal's data (the "evidence"). Your ONLY job is to write a short, plain-language narrative that ties the evidence together and tells the officer what to do.

Hard rules:
1. Use ONLY facts present in the evidence. NEVER invent names, numbers, dates, decisions, or items. If the evidence is empty, say plainly that nothing needs attention.
2. Be concrete and operational. Reference the specific signals already given ("overdue", "no owner", "decision needs an action") — never use vague words like "priority", "synergy", or "health score".
3. Lead with what matters most, then the single most useful next step.
4. Keep it to 2–4 short sentences. No headings, no bullet lists, no preamble, no markdown. Just the narrative paragraph.
5. Write like a sharp, calm operator briefing a colleague — not a chatbot.`;

/** Serialize the deterministic answer into compact grounding evidence. */
function buildEvidence(answer: CoSAnswer): string {
  const lines: string[] = [`HEADLINE: ${answer.headline}`];
  for (const block of answer.blocks) {
    if (block.items.length === 0) {
      lines.push(`\n## ${block.title} — (none)`);
      continue;
    }
    lines.push(`\n## ${block.title}`);
    for (const item of block.items.slice(0, 6)) {
      const bits = [item.label];
      if (item.signal) bits.push(`[${item.signal}]`);
      if (item.detail) bits.push(`— ${item.detail}`);
      if (item.source) bits.push(`(${item.source})`);
      lines.push(`- ${bits.join(" ")}`);
    }
  }
  return lines.join("\n");
}

/**
 * Ask Claude for a grounded narrative over the deterministic answer. Returns the
 * narrative string, or null if AI is unavailable or the call fails (the caller
 * then just renders the deterministic blocks). Never throws.
 */
export async function narrateChiefOfStaffAnswer(answer: CoSAnswer): Promise<string | null> {
  if (!isChiefOfStaffAIConfigured()) return null;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const evidence = buildEvidence(answer);

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Officer's question: "${answer.question}"

Evidence (already computed — do not add to it):
${evidence}

Write the briefing narrative now.`,
        },
      ],
    });

    const first = response.content[0];
    const text = first && first.type === "text" ? first.text.trim() : "";
    return text.length > 0 ? text : null;
  } catch (err) {
    console.error("[chief-of-staff] AI narration failed; using deterministic answer:", err);
    return null;
  }
}
