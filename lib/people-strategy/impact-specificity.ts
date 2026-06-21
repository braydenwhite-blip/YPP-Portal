/**
 * Weekly Impact — specificity guard.
 *
 * The YPP Weekly Impact template contrasts good ✓ entries ("Cold-contacted 8
 * schools, booked 3 meetings") with bad ✗ entries ("Worked on it", "Making
 * progress"). This pure module encodes that contrast so a vague weekly form can
 * be *blocked on submit* (never silently rejected): it returns a per-field list
 * of exactly what to fix, which the submit server action surfaces inline.
 *
 * Pure value module — no Prisma, no "use server" — so it is unit-tested directly
 * and reused on both the team-submit and the per-person submit paths.
 */

export type SpecificityField =
  | "personalObjective"
  | "personalDeliverable"
  | "workCompleted"
  | "currentResult"
  | "nextAction"
  | "inputNeeded";

export type SpecificityIssueCode =
  | "empty"
  | "too_short"
  | "vague_phrase"
  | "missing_outcome";

export type SpecificityIssue = {
  field: SpecificityField;
  code: SpecificityIssueCode;
  message: string;
  /** The blocklisted phrase that tripped the check, when code is "vague_phrase". */
  phrase?: string;
};

export type ImpactEntryInput = {
  personalObjective?: string | null;
  personalDeliverable?: string | null;
  workCompleted?: string | null;
  currentResult?: string | null;
  nextAction?: string | null;
  inputNeeded?: string | null;
};

/** Minimum trimmed length and word count before an answer counts as specific. */
export const MIN_SPECIFIC_LENGTH = 12;
export const MIN_SPECIFIC_WORDS = 3;

/**
 * Phrases that signal a non-answer. Matched case-insensitively on word
 * boundaries so "stuff" does not trip "stuffed". Ordered roughly by how often
 * they show up in the ✗ examples.
 */
export const VAGUE_PHRASES: readonly string[] = [
  "worked on it",
  "worked on",
  "working on",
  "work on",
  "making progress",
  "made progress",
  "more progress",
  "in progress",
  "ongoing",
  "as usual",
  "did some",
  "kept going",
  "various",
  "some stuff",
  "stuff",
  "things",
  "a lot",
  "tbd",
  "n/a",
  "etc",
  "misc",
];

const FIELD_LABELS: Record<SpecificityField, string> = {
  personalObjective: "Objective",
  personalDeliverable: "Deliverable (what done looks like)",
  workCompleted: "What you did this week",
  currentResult: "Outcome / impact",
  nextAction: "Next step",
  inputNeeded: "Input needed",
};

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** First blocklisted phrase found in `value` (word-boundary, case-insensitive). */
export function findVaguePhrase(value: string | null | undefined): string | null {
  const text = normalize(value).toLowerCase();
  if (!text) return null;
  for (const phrase of VAGUE_PHRASES) {
    const re = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "i");
    if (re.test(text)) return phrase;
  }
  return null;
}

function wordCount(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

/**
 * Validate a single weekly-impact entry. Only fields that are *present* (non-empty
 * after trim) are checked for vagueness/length; a couple of cross-field rules
 * enforce the template's structure (an objective needs a concrete deliverable;
 * "what you did" needs an outcome). Returns an empty array when the entry is
 * specific enough to submit.
 */
export function validateImpactEntry(input: ImpactEntryInput): SpecificityIssue[] {
  const issues: SpecificityIssue[] = [];
  const fields: SpecificityField[] = [
    "personalObjective",
    "personalDeliverable",
    "workCompleted",
    "currentResult",
    "nextAction",
    "inputNeeded",
  ];

  for (const field of fields) {
    const value = normalize(input[field]);
    if (!value) continue;

    const phrase = findVaguePhrase(value);
    if (phrase) {
      issues.push({
        field,
        code: "vague_phrase",
        phrase,
        message: `"${FIELD_LABELS[field]}" reads as vague ("${phrase}"). Say specifically what was done and what it produced — like the ✓ examples in the template.`,
      });
      continue; // one issue per field is enough to act on
    }

    if (value.length < MIN_SPECIFIC_LENGTH || wordCount(value) < MIN_SPECIFIC_WORDS) {
      issues.push({
        field,
        code: "too_short",
        message: `"${FIELD_LABELS[field]}" is too short to be a real answer. Add the concrete detail (a number, a name, a link, an outcome).`,
      });
    }
  }

  // Cross-field: an objective must come with a concrete deliverable.
  if (normalize(input.personalObjective) && !normalize(input.personalDeliverable)) {
    issues.push({
      field: "personalDeliverable",
      code: "empty",
      message:
        'You set an objective but no deliverable. Describe what it looks like when done — a doc, a system, a list, a number — not a process.',
    });
  }

  // Cross-field: work done must come with its outcome/impact (the template's
  // most common ✗: a "what I did" with no result to show).
  if (normalize(input.workCompleted) && !normalize(input.currentResult)) {
    issues.push({
      field: "currentResult",
      code: "missing_outcome",
      message:
        'You described what you did but not the outcome. State the impact — what changed or what can now be shown.',
    });
  }

  return issues;
}

export function isImpactEntrySubmittable(issues: SpecificityIssue[]): boolean {
  return issues.length === 0;
}

/** A task entry tagged so the caller can map blocking issues back to a row. */
export type TaggedImpactIssue = SpecificityIssue & { taskUpdateId?: string };

/**
 * Validate a whole per-person submission: the member's Section 1/4 header plus
 * each of their owned task rows (Section 2/3). Task issues carry the originating
 * `taskUpdateId` so the form can highlight the right row. Returns a flat list;
 * empty means the person may submit.
 */
export function validateMemberSubmission(input: {
  member: ImpactEntryInput;
  tasks?: Array<{
    taskUpdateId: string;
    workCompleted?: string | null;
    currentResult?: string | null;
    nextAction?: string | null;
  }>;
}): TaggedImpactIssue[] {
  const issues: TaggedImpactIssue[] = validateImpactEntry(input.member);
  for (const task of input.tasks ?? []) {
    for (const issue of validateImpactEntry(task)) {
      issues.push({ ...issue, taskUpdateId: task.taskUpdateId });
    }
  }
  return issues;
}
