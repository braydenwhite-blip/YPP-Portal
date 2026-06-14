/**
 * People Strategy — Smart notes → actions (PURE, deterministic).
 *
 * Turns free-text meeting notes into reviewable suggested actions WITHOUT any
 * model call: it reads each line for assignment language ("Milo will handle
 * class pairing"), imperative verbs ("Follow up with Beth El"), and commitment
 * phrasing ("Ian needs to confirm interviews"), extracts an owner (matched
 * against meeting attendees) and an inferred due date ("by Sunday", "next
 * week"), and proposes a clean action title. The user always confirms/edits/
 * ignores — nothing is auto-created.
 *
 * Pure + `now`-injected so it unit-tests with plain strings. The optional AI
 * extractor (notes-to-actions-ai.ts) produces the SAME shape and only runs when
 * configured and requested; this heuristic is the always-on fallback.
 */

export type SuggestionConfidence = "high" | "medium" | "low";

export type SuggestedAction = {
  /** Stable within one parse (line index based) — for React keys / dedupe. */
  id: string;
  title: string;
  ownerId: string | null;
  ownerName: string | null;
  dueDateISO: string | null;
  dueLabel: string | null;
  /** The original note line this came from — shown as provenance. */
  sourceLine: string;
  confidence: SuggestionConfidence;
};

export type SuggestPerson = { id: string; name: string };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Verbs that, at the start of a phrase, make it an action. */
const ACTION_VERBS = [
  "follow up",
  "follow-up",
  "reach out",
  "set up",
  "set-up",
  "send",
  "confirm",
  "schedule",
  "train",
  "email",
  "draft",
  "review",
  "prepare",
  "create",
  "finalize",
  "finalise",
  "book",
  "order",
  "ping",
  "ask",
  "share",
  "write",
  "update",
  "call",
  "contact",
  "organize",
  "organise",
  "plan",
  "build",
  "fix",
  "add",
  "assign",
  "check",
  "coordinate",
  "recruit",
  "onboard",
  "submit",
  "publish",
  "post",
  "collect",
  "compile",
  "research",
  "design",
];

const MODALS = ["will", "'ll", "to", "should", "needs to", "need to", "is going to", "gonna", "has to", "have to", "must"];

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function capitalize(s: string): string {
  const t = s.trim();
  return t.length === 0 ? t : t[0].toUpperCase() + t.slice(1);
}

function toLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** Next occurrence (today counts) of a weekday index 0..6 from `from`. */
function nextWeekday(from: Date, target: number): Date {
  const base = startOfDay(from);
  const diff = (target - base.getDay() + 7) % 7;
  return new Date(base.getTime() + diff * DAY_MS);
}

/**
 * Pull a due date out of a line. Returns the date plus the text span matched
 * (so the caller can strip it from the title). `base` anchors relative phrases
 * (the meeting date, or now).
 */
function extractDueDate(
  line: string,
  base: Date
): { dueISO: string; label: string; matched: string } | null {
  const lower = line.toLowerCase();

  // "tomorrow" / "today" / "tonight"
  if (/\btomorrow\b/.test(lower)) {
    const d = new Date(startOfDay(base).getTime() + DAY_MS);
    return { dueISO: d.toISOString(), label: "tomorrow", matched: "tomorrow" };
  }
  if (/\b(today|tonight|eod|end of day)\b/.test(lower)) {
    const d = startOfDay(base);
    return { dueISO: d.toISOString(), label: "today", matched: "today" };
  }
  // "in N days"
  const inDays = lower.match(/\bin (\d{1,2}) days?\b/);
  if (inDays) {
    const n = parseInt(inDays[1], 10);
    const d = new Date(startOfDay(base).getTime() + n * DAY_MS);
    return { dueISO: d.toISOString(), label: `in ${n} days`, matched: inDays[0] };
  }
  // "end of week" / "this week" / "EOW" → upcoming Friday
  if (/\b(end of (the )?week|eow|by friday eow|this week)\b/.test(lower)) {
    const d = nextWeekday(base, 5);
    return { dueISO: d.toISOString(), label: "this week", matched: lower.match(/\b(end of (the )?week|eow|this week)\b/)?.[0] ?? "this week" };
  }
  // "next week" → +7 days
  if (/\bnext week\b/.test(lower)) {
    const d = new Date(startOfDay(base).getTime() + 7 * DAY_MS);
    return { dueISO: d.toISOString(), label: "next week", matched: "next week" };
  }
  // "by <Month> <day>"
  const monthDay = lower.match(
    /\b(?:by |before |on )?(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\b/
  );
  if (monthDay) {
    const month = MONTHS.indexOf(monthDay[1]);
    const day = parseInt(monthDay[2], 10);
    let year = base.getFullYear();
    let d = new Date(year, month, day);
    if (d.getTime() < startOfDay(base).getTime() - DAY_MS) {
      year += 1;
      d = new Date(year, month, day);
    }
    return { dueISO: d.toISOString(), label: toLabel(d), matched: monthDay[0] };
  }
  // "by <weekday>" / "on <weekday>" / bare weekday
  const weekday = lower.match(
    /\b(?:by |before |on |this )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/
  );
  if (weekday) {
    const d = nextWeekday(base, WEEKDAYS.indexOf(weekday[1]));
    return { dueISO: d.toISOString(), label: capitalize(weekday[1]), matched: weekday[0] };
  }
  return null;
}

/** Match a known person at/near the start of a line; return {id,name,matched}. */
function extractOwner(
  line: string,
  people: SuggestPerson[]
): { id: string; name: string; matched: string } | null {
  const lower = line.toLowerCase();
  // Prefer the longest name match that appears in the first ~40 chars (subject).
  let best: { id: string; name: string; matched: string } | null = null;
  for (const p of people) {
    const full = p.name.trim().toLowerCase();
    if (!full) continue;
    const first = full.split(/\s+/)[0];
    for (const candidate of [full, first]) {
      if (candidate.length < 2) continue;
      const idx = lower.indexOf(candidate);
      // Owner should be the subject — appear early, before a modal/verb.
      if (idx >= 0 && idx <= 24) {
        if (!best || candidate.length > best.matched.length) {
          best = { id: p.id, name: p.name, matched: candidate };
        }
      }
    }
  }
  return best;
}

function normalizeTitle(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase().replace(/[.!,;:]+$/, "");
}

/** Strip a leading subject+modal ("Milo will ", "Ian needs to ") for a clean title. */
function stripSubjectModal(line: string, ownerMatched: string | null): string {
  let s = line.trim();
  if (ownerMatched) {
    const re = new RegExp(`^${escapeRegExp(ownerMatched)}\\b[\\s,]*`, "i");
    s = s.replace(re, "");
  }
  // Strip a leading modal phrase.
  for (const m of MODALS) {
    const re = new RegExp(`^${escapeRegExp(m)}\\b[\\s,]*`, "i");
    if (re.test(s)) {
      s = s.replace(re, "");
      break;
    }
  }
  return s.trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function looksActionable(line: string): { ok: boolean; confidence: SuggestionConfidence } {
  const lower = line.toLowerCase();
  if (lower.length < 6) return { ok: false, confidence: "low" };
  // Pure questions are usually open questions, not action items.
  if (lower.endsWith("?")) return { ok: false, confidence: "low" };
  // Skip obvious non-actions.
  if (/^(fyi\b|note:|noted\b|update:|discussed\b|recap:|present:|attendees:|agenda:)/i.test(lower)) {
    return { ok: false, confidence: "low" };
  }

  const hasAssignment = new RegExp(
    `\\b(${MODALS.map(escapeRegExp).join("|")})\\b`,
    "i"
  ).test(lower) && /\b(will|to|should|needs? to|has to|have to|must|going to|'ll)\b/i.test(lower);

  const startsWithVerb = ACTION_VERBS.some((v) =>
    new RegExp(`(^|[-*•\\d.)\\s])${escapeRegExp(v)}\\b`, "i").test(lower.slice(0, 28))
  );
  const hasFollowUp = /\b(follow[- ]?up|action item|to-?do|todo|next step)\b/i.test(lower);
  const hasNeedTo = /\b(need(s)? to|have to|must|should)\b/i.test(lower);

  if ((hasAssignment && startsWithVerb) || (startsWithVerb && /\b(by|tomorrow|today|next week|this week)\b/i.test(lower))) {
    return { ok: true, confidence: "high" };
  }
  if (hasAssignment || startsWithVerb || hasFollowUp) {
    return { ok: true, confidence: "medium" };
  }
  if (hasNeedTo) {
    return { ok: true, confidence: "low" };
  }
  return { ok: false, confidence: "low" };
}

/** Split notes into candidate lines (newlines and strong sentence breaks). */
function splitSegments(notes: string): string[] {
  return notes
    .split(/\r?\n/)
    .flatMap((line) => line.split(/(?<=[.!])\s+(?=[A-Z])/))
    .map((s) => s.replace(/^\s*[-*•–—]\s*/, "").replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter((s) => s.length > 0);
}

/**
 * Parse meeting notes into suggested actions. Deterministic; `now` injected.
 * `existingTitles` (this meeting's already-tracked actions) are skipped so the
 * panel never re-suggests work that exists.
 */
export function parseSuggestedActions(
  input: {
    notes: string | null | undefined;
    people?: SuggestPerson[];
    meetingDateISO?: string | null;
    existingTitles?: string[];
  },
  now: Date = new Date()
): SuggestedAction[] {
  const notes = (input.notes ?? "").trim();
  if (!notes) return [];
  const people = input.people ?? [];
  const base = input.meetingDateISO ? new Date(input.meetingDateISO) : now;
  const anchor = Number.isNaN(base.getTime()) ? now : base;
  const existing = new Set((input.existingTitles ?? []).map(normalizeTitle));

  const out: SuggestedAction[] = [];
  const seen = new Set<string>();
  const segments = splitSegments(notes);

  segments.forEach((line, i) => {
    const verdict = looksActionable(line);
    if (!verdict.ok) return;

    const owner = extractOwner(line, people);
    const due = extractDueDate(line, anchor);

    let title = stripSubjectModal(line, owner?.matched ?? null);
    if (due) {
      // Remove the matched due phrase from the title for cleanliness.
      title = title.replace(new RegExp(`\\b${escapeRegExp(due.matched)}\\b`, "i"), "").replace(/\s{2,}/g, " ").trim();
      title = title.replace(/\b(by|before|on)\s*$/i, "").trim();
    }
    title = capitalize(title).slice(0, 160).replace(/[\s,;:]+$/, "");
    if (title.length < 3) return;

    const key = normalizeTitle(title);
    if (seen.has(key) || existing.has(key)) return;
    seen.add(key);

    // Upgrade confidence when we resolved both an owner and a due date.
    let confidence = verdict.confidence;
    if (owner && due && confidence !== "high") confidence = "high";

    out.push({
      id: `sug-${i}`,
      title,
      ownerId: owner?.id ?? null,
      ownerName: owner?.name ?? null,
      dueDateISO: due?.dueISO ?? null,
      dueLabel: due?.label ?? null,
      sourceLine: line.slice(0, 240),
      confidence,
    });
  });

  // Most confident first, then preserve order.
  const rank: Record<SuggestionConfidence, number> = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => rank[a.confidence] - rank[b.confidence]).slice(0, 8);
}
