/**
 * Weekly Impact — flags.
 *
 * The table-based Weekly Impact form surfaces "flags": small, concrete prompts that
 * tell a person what to tighten before they submit ("Draft · 2 flags", "2 flags need
 * attention before submitting"). This is a pure value module — no Prisma, no
 * "use server" — so the exact same rules run live in the browser as the user types
 * AND on the server as the authoritative submit gate.
 *
 * It builds on the specificity guard in `impact-specificity.ts` (vague phrases +
 * length) and adds the structural rules the spec calls for:
 *   - missing link/file when an update claims something showable
 *   - next steps with no due date
 *   - input requests that don't say who they need it from
 */

import { findVaguePhrase, MIN_SPECIFIC_LENGTH, MIN_SPECIFIC_WORDS } from "./impact-specificity";

export type ImpactFlagSection = "objective" | "progress" | "nextStep" | "input";

export type ImpactFlag = {
  section: ImpactFlagSection;
  rowId: string;
  /** The cell the flag points at, so the form can ring the right field. */
  field: string;
  /** Short, concrete chip text shown inline under the row. */
  message: string;
  /** Blocking flags stop submission; all flags count toward the header total. */
  blocking: boolean;
};

export type FlagObjectiveRow = {
  id: string;
  objective?: string | null;
  deliverable?: string | null;
  hasLink?: boolean;
};

export type FlagProgressRow = {
  id: string;
  deliverable?: string | null; // the row title
  whatYouDid?: string | null;
  outcome?: string | null;
  hasLink?: boolean;
};

export type FlagNextStepRow = {
  id: string;
  action?: string | null;
  deliverableNextWeek?: string | null;
  hasDueDate?: boolean;
};

export type FlagInputRow = {
  id: string;
  request?: string | null;
  hasWho?: boolean;
};

export type ImpactFlagInput = {
  objectives: FlagObjectiveRow[];
  progress: FlagProgressRow[];
  nextSteps: FlagNextStepRow[];
  inputRequests: FlagInputRow[];
};

function trimmed(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function wordCount(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

/** True when present-but-vague: a blocklisted phrase or too short to be a real answer. */
function vaguenessMessage(value: string): string | null {
  if (findVaguePhrase(value)) return "Be more specific — say what was done and what it produced.";
  if (value.length < MIN_SPECIFIC_LENGTH || wordCount(value) < MIN_SPECIFIC_WORDS) {
    return "Add a concrete detail — a number, name, link, or outcome.";
  }
  return null;
}

/**
 * Compute every flag for a person's Weekly Impact form. Empty rows are skipped
 * (the form's "add row" affordance means blank trailing rows are normal); a row is
 * only checked once it has any content.
 */
export function deriveImpactFlags(input: ImpactFlagInput): ImpactFlag[] {
  const flags: ImpactFlag[] = [];

  // Section 1 — Objective & Deliverables
  for (const row of input.objectives) {
    const objective = trimmed(row.objective);
    const deliverable = trimmed(row.deliverable);
    if (!objective && !deliverable) continue;

    const objVague = objective ? vaguenessMessage(objective) : null;
    if (objVague) flags.push({ section: "objective", rowId: row.id, field: "objective", message: objVague, blocking: true });

    if (objective && !deliverable) {
      flags.push({ section: "objective", rowId: row.id, field: "deliverable", message: "Add the deliverable — what it looks like when done.", blocking: true });
    } else if (deliverable) {
      const delVague = vaguenessMessage(deliverable);
      if (delVague) flags.push({ section: "objective", rowId: row.id, field: "deliverable", message: delVague, blocking: true });
    }

    if (!row.hasLink) {
      flags.push({ section: "objective", rowId: row.id, field: "link", message: "Add link to Drive doc", blocking: false });
    }
  }

  // Section 2 — This Week's Progress
  for (const row of input.progress) {
    const what = trimmed(row.whatYouDid);
    const outcome = trimmed(row.outcome);
    const title = trimmed(row.deliverable);
    if (!what && !outcome && !title) continue;

    if (what) {
      const whatVague = vaguenessMessage(what);
      if (whatVague) flags.push({ section: "progress", rowId: row.id, field: "whatYouDid", message: whatVague, blocking: true });
    }
    if (outcome) {
      const outVague = vaguenessMessage(outcome);
      if (outVague) flags.push({ section: "progress", rowId: row.id, field: "outcome", message: "Be more specific about the impact", blocking: true });
    } else if (what) {
      flags.push({ section: "progress", rowId: row.id, field: "outcome", message: "Add the outcome — what changed or what you can show.", blocking: true });
    }
    if ((what || outcome) && !row.hasLink) {
      flags.push({ section: "progress", rowId: row.id, field: "link", message: "Add the link or file you'll show", blocking: false });
    }
  }

  // Section 3 — Next Steps
  for (const row of input.nextSteps) {
    const action = trimmed(row.action);
    const deliverable = trimmed(row.deliverableNextWeek);
    if (!action && !deliverable) continue;

    if (action) {
      const actVague = vaguenessMessage(action);
      if (actVague) flags.push({ section: "nextStep", rowId: row.id, field: "action", message: actVague, blocking: true });
    }
    if (!row.hasDueDate) {
      flags.push({ section: "nextStep", rowId: row.id, field: "dueDate", message: "Add a due date", blocking: true });
    }
  }

  // Section 4 — Input Needed
  for (const row of input.inputRequests) {
    const request = trimmed(row.request);
    if (!request) continue;

    const reqVague = vaguenessMessage(request);
    if (reqVague) flags.push({ section: "input", rowId: row.id, field: "request", message: reqVague, blocking: true });
    if (!row.hasWho) {
      flags.push({ section: "input", rowId: row.id, field: "neededFrom", message: "Say who you need it from", blocking: true });
    }
  }

  return flags;
}

export function countImpactFlags(flags: ImpactFlag[]): number {
  return flags.length;
}

export function hasBlockingFlags(flags: ImpactFlag[]): boolean {
  return flags.some((f) => f.blocking);
}
