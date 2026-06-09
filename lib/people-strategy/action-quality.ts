/**
 * Action System 4.0 — ACTION QUALITY warnings (pure, zero dependencies).
 *
 * The honest weak-action checklist. Kept in its own dependency-free module so it
 * is safe to import from CLIENT components (the creation form's live warnings)
 * without pulling in the query/prisma layer. `action-intel.ts` re-exports these
 * for server-side callers, so there is one source of truth.
 */

/** The minimal shape the quality engine needs — satisfiable from a draft form
 *  state or via `actionToQualityInput` from a loaded row. */
export type ActionQualityInput = {
  title?: string | null;
  /** An executor/owner beyond the implicit creator is assigned. */
  hasOwner: boolean;
  hasDueDate: boolean;
  successDefinition?: string | null;
  status?: string | null;
  blockedReason?: string | null;
  completionNote?: string | null;
  sourceType?: string | null;
  /** A stored, registry-valid strategic link exists. */
  hasStrategicLink: boolean;
  /** The keyword matcher SUGGESTS this is strategic (optional hint). */
  looksStrategic?: boolean;
  isOverdue?: boolean;
  nextFollowUpAt?: Date | string | null;
};

export type ActionWarningCode =
  | "NEEDS_OWNER"
  | "NEEDS_DUE_DATE"
  | "DEFINE_DONE"
  | "VAGUE_TITLE"
  | "BLOCKED_NO_REASON"
  | "OVERDUE_OPEN"
  | "STRATEGIC_UNLINKED"
  | "COMPLETED_NO_NOTE"
  | "NEEDS_FOLLOWUP_DATE";

export type ActionWarningSeverity = "high" | "medium" | "low";

export type ActionWarning = {
  code: ActionWarningCode;
  severity: ActionWarningSeverity;
  message: string;
};

const GENERIC_TITLES = new Set([
  "action",
  "action item",
  "task",
  "todo",
  "to do",
  "follow up",
  "followup",
  "follow-up",
  "note",
  "notes",
  "update",
  "sync",
  "check in",
  "check-in",
  "meeting",
  "misc",
]);

/** A title is vague when it is empty, a single word, very short, or a generic stock phrase. */
export function isVagueTitle(title?: string | null): boolean {
  const t = (title ?? "").trim().toLowerCase();
  if (t.length === 0) return true;
  if (GENERIC_TITLES.has(t)) return true;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return true;
  if (t.length < 6) return true;
  return false;
}

/**
 * The honest weak-action checklist. Returned warnings are ordered high → low so
 * a surface can show the most important first. Helpful, not nagging: each code
 * fires on a real, fixable gap.
 */
export function deriveActionQualityWarnings(input: ActionQualityInput): ActionWarning[] {
  const out: ActionWarning[] = [];
  const status = input.status ?? "NOT_STARTED";
  const settled = status === "COMPLETE" || status === "DROPPED";

  if (isVagueTitle(input.title)) {
    out.push({
      code: "VAGUE_TITLE",
      severity: "medium",
      message: "This title is vague — say what specifically needs to happen.",
    });
  }
  if (!input.hasOwner && !settled) {
    out.push({
      code: "NEEDS_OWNER",
      severity: "high",
      message: "No owner yet — this will disappear unless someone owns it.",
    });
  }
  if (!input.hasDueDate && !settled) {
    out.push({
      code: "NEEDS_DUE_DATE",
      severity: "high",
      message: "No due date — add one so this doesn't quietly drift.",
    });
  }
  if (input.isOverdue) {
    out.push({
      code: "OVERDUE_OPEN",
      severity: "high",
      message: "This action is overdue and still open.",
    });
  }
  if (status === "BLOCKED" && !(input.blockedReason ?? "").trim()) {
    out.push({
      code: "BLOCKED_NO_REASON",
      severity: "high",
      message: "Marked blocked, but no blocker named — say what's needed to unblock.",
    });
  }
  if (!(input.successDefinition ?? "").trim() && !settled) {
    out.push({
      code: "DEFINE_DONE",
      severity: "medium",
      message: "Define what done means before assigning.",
    });
  }
  const strategicSource =
    input.sourceType === "PROJECT" || input.sourceType === "INITIATIVE";
  if ((strategicSource || input.looksStrategic) && !input.hasStrategicLink) {
    out.push({
      code: "STRATEGIC_UNLINKED",
      severity: "low",
      message: "This looks strategic — link it to a project or initiative so it counts.",
    });
  }
  if (status === "COMPLETE" && !(input.completionNote ?? "").trim()) {
    out.push({
      code: "COMPLETED_NO_NOTE",
      severity: "low",
      message: "Completed with no note — capture the outcome while it's fresh.",
    });
  }
  if (input.sourceType === "FOLLOW_UP" && !input.nextFollowUpAt && !settled) {
    out.push({
      code: "NEEDS_FOLLOWUP_DATE",
      severity: "low",
      message: "This is a follow-up — set the date you'll revisit it.",
    });
  }

  const rank: Record<ActionWarningSeverity, number> = { high: 3, medium: 2, low: 1 };
  return out.sort((a, b) => rank[b.severity] - rank[a.severity]);
}
