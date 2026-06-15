/**
 * People Strategy — deterministic meeting agenda + summary generation.
 *
 * Turns a meeting's linked actions, agenda items, decisions, and follow-ups into
 * a ready-to-paste agenda (before the meeting) and summary (after the meeting).
 * Fully deterministic — the same inputs always yield the same text — so it works
 * with NO AI configured. The meeting workspace renders the output for preview /
 * copy / save; this module is pure (no DB, no React) and unit-testable.
 *
 * Agenda groups (in running order):
 *   1. Urgent decisions      — urgent / high-priority open actions
 *   2. Blocked actions       — work that can't proceed
 *   3. Due soon / overdue    — deadlines at or past the line
 *   4. Updates               — the rest of the open linked work
 *   5. New / misc            — open agenda items not yet converted
 *   6. Carry-forward         — deferred items + open follow-ups
 *
 * Summary groups:
 *   1. Decisions made
 *   2. Action updates
 *   3. New follow-ups (owners + deadlines)
 *   4. Blockers / escalations
 *   5. Deferred items
 *   6. Next-meeting carry-forward
 */

export type AgendaActionPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface AgendaActionInput {
  id: string;
  title: string;
  status: string;
  priority: AgendaActionPriority;
  ownerName: string | null;
  deadlineISO: string | null;
  blocked: boolean;
  overdue: boolean;
  dueSoon: boolean;
}

export interface AgendaItemInput {
  title: string;
  status: "OPEN" | "DISCUSSED" | "DEFERRED" | "CONVERTED";
  ownerName: string | null;
}

export interface OpenFollowUpInput {
  title: string;
  ownerName: string | null;
  dueISO: string | null;
}

export interface MeetingAgendaInput {
  title: string;
  dateISO: string;
  actions: AgendaActionInput[];
  agendaItems: AgendaItemInput[];
  openFollowUps: OpenFollowUpInput[];
}

const SETTLED = new Set(["COMPLETE", "DROPPED"]);

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** "Title — Owner (due Jun 3)" with whatever metadata is present. */
function actionLine(a: AgendaActionInput): string {
  const bits: string[] = [];
  if (a.ownerName) bits.push(a.ownerName);
  const due = fmtDate(a.deadlineISO);
  if (due) bits.push(`due ${due}`);
  return bits.length ? `${a.title} — ${bits.join(", ")}` : a.title;
}

function bullets(lines: string[]): string {
  return lines.map((l) => `- ${l}`).join("\n");
}

function section(heading: string, lines: string[]): string | null {
  if (lines.length === 0) return null;
  return `## ${heading}\n${bullets(lines)}`;
}

/**
 * Build a grouped, ready-to-paste agenda. An empty meeting yields a short
 * scaffold rather than a blank string so the facilitator always has a starting
 * point.
 */
export function generateAgendaText(input: MeetingAgendaInput): string {
  const open = input.actions.filter((a) => !SETTLED.has(a.status));

  const urgent = open.filter((a) => a.priority === "URGENT" || a.priority === "HIGH");
  const urgentIds = new Set(urgent.map((a) => a.id));
  const blocked = open.filter((a) => a.blocked && !urgentIds.has(a.id));
  const blockedIds = new Set(blocked.map((a) => a.id));
  const dueSoon = open.filter(
    (a) => (a.overdue || a.dueSoon) && !urgentIds.has(a.id) && !blockedIds.has(a.id)
  );
  const handled = new Set([...urgentIds, ...blockedIds, ...dueSoon.map((a) => a.id)]);
  const updates = open.filter((a) => !handled.has(a.id));

  const newItems = input.agendaItems.filter((i) => i.status === "OPEN");
  const deferred = input.agendaItems.filter((i) => i.status === "DEFERRED");

  const carryForward = [
    ...deferred.map((i) => (i.ownerName ? `${i.title} — ${i.ownerName}` : i.title)),
    ...input.openFollowUps.map((f) => {
      const due = fmtDate(f.dueISO);
      const meta = [f.ownerName, due ? `due ${due}` : null].filter(Boolean).join(", ");
      return meta ? `${f.title} — ${meta}` : f.title;
    }),
  ];

  const header = `# Agenda — ${input.title}${
    fmtDate(input.dateISO) ? ` (${fmtDate(input.dateISO)})` : ""
  }`;

  const blocks = [
    section("Urgent decisions", urgent.map(actionLine)),
    section("Blocked actions", blocked.map(actionLine)),
    section("Due soon / overdue", dueSoon.map(actionLine)),
    section("Updates", updates.map(actionLine)),
    section("New / misc", newItems.map((i) => (i.ownerName ? `${i.title} — ${i.ownerName}` : i.title))),
    section("Carry-forward", carryForward),
  ].filter((b): b is string => b != null);

  if (blocks.length === 0) {
    return `${header}\n\n## Agenda\n- (No linked actions yet — add agenda items or link actions to this meeting.)`;
  }

  return `${header}\n\n${blocks.join("\n\n")}`;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface DecisionInput {
  decision: string;
  decidedByName: string | null;
}

export interface FollowUpSummaryInput {
  title: string;
  ownerName: string | null;
  dueISO: string | null;
  status: string;
}

export interface MeetingSummaryInput {
  title: string;
  dateISO: string;
  decisions: DecisionInput[];
  actions: AgendaActionInput[];
  followUps: FollowUpSummaryInput[];
  deferredAgendaItems: { title: string }[];
  notesText: string | null;
}

export interface MeetingSummaryResult {
  text: string;
  /** True when there are no notes AND nothing structured to summarize. */
  missingNotes: boolean;
  /** Soft warnings to show before sending (e.g. decisions without actions). */
  warnings: string[];
}

/**
 * Build a grouped, ready-to-paste summary from what the meeting produced. Flags
 * missing notes and decisions-without-actions as warnings so the facilitator
 * can fix the record before circulating it.
 */
export function generateMeetingSummary(input: MeetingSummaryInput): MeetingSummaryResult {
  const open = input.actions.filter((a) => !SETTLED.has(a.status));
  const blocked = open.filter((a) => a.blocked);
  const openFollowUps = input.followUps.filter((f) => f.status !== "COMPLETED");

  const warnings: string[] = [];
  const hasNotes = !!input.notesText && input.notesText.trim().length > 0;
  if (input.decisions.length > 0 && open.length === 0 && openFollowUps.length === 0) {
    warnings.push("Decisions were made but no action or follow-up was assigned.");
  }
  if (!hasNotes && input.decisions.length === 0) {
    warnings.push("No notes captured — the summary is built from structured items only.");
  }

  const header = `# Summary — ${input.title}${
    fmtDate(input.dateISO) ? ` (${fmtDate(input.dateISO)})` : ""
  }`;

  const blocks = [
    section(
      "Decisions made",
      input.decisions.map((d) =>
        d.decidedByName ? `${d.decision} — ${d.decidedByName}` : d.decision
      )
    ),
    section("Action updates", input.actions.slice(0, 20).map((a) => `${actionLine(a)} [${a.status}]`)),
    section(
      "New follow-ups",
      input.followUps.map((f) => {
        const due = fmtDate(f.dueISO);
        const meta = [f.ownerName, due ? `due ${due}` : null].filter(Boolean).join(", ");
        return meta ? `${f.title} — ${meta}` : f.title;
      })
    ),
    section("Blockers / escalations", blocked.map(actionLine)),
    section("Deferred items", input.deferredAgendaItems.map((i) => i.title)),
    section(
      "Next-meeting carry-forward",
      openFollowUps.map((f) => (f.ownerName ? `${f.title} — ${f.ownerName}` : f.title))
    ),
  ].filter((b): b is string => b != null);

  const notesBlock = hasNotes ? `## Notes\n${input.notesText!.trim()}` : null;
  const allBlocks = [...(notesBlock ? [notesBlock] : []), ...blocks];

  const missingNotes = !hasNotes && allBlocks.length === 0;
  const body = allBlocks.length
    ? allBlocks.join("\n\n")
    : "## Summary\n- (Nothing logged yet — add notes, decisions, or follow-ups.)";

  return {
    text: `${header}\n\n${body}`,
    missingNotes,
    warnings,
  };
}
