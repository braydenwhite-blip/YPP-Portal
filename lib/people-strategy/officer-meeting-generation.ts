import type { ActionAssignmentRole, ActionItemStatus } from "@prisma/client";

import { ACTION_STATUS_LABELS } from "./constants";
import { formatMonthDayYear, formatWeekday } from "@/lib/leadership-action-center/dates";
import type { OfficerMeetingWithRelations } from "./officer-meetings-queries";

/**
 * People Strategy — Officer Meeting agenda + summary-email generation
 * (Prompt 06B).
 *
 * Deterministic, server-side text composition. There is NO Anthropic / LLM call
 * here yet (that lands in a later prompt) — these "fallback" builders are the
 * sole source of `OfficerMeeting.agendaText` / `summaryEmailText`. Naming them
 * `build…Fallback` keeps them explicit and reusable so a future AI path can fall
 * back to them verbatim when the model is unavailable or disabled.
 *
 * Everything in this module is a pure function of the meeting data passed in: no
 * `new Date()`, no randomness, no I/O. Given the same meeting it always produces
 * byte-identical output, which is what makes it testable.
 */

const TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

const ASSIGNMENT_LABELS: Record<ActionAssignmentRole, string> = {
  LEAD: "Lead",
  EXECUTING: "Executing",
  INPUT: "Input",
};

/** Order roles deterministically regardless of query ordering. */
const ROLE_ORDER: ActionAssignmentRole[] = ["LEAD", "EXECUTING", "INPUT"];

// --- normalized input -------------------------------------------------------

/**
 * Flattened, display-ready shape the builders operate on. Keeping this separate
 * from the Prisma payload means the builders can be unit-tested with plain
 * fixtures, and the (single) mapping from the query result lives in one place.
 */
export interface GenerationAssignee {
  role: ActionAssignmentRole;
  name: string;
}

export interface GenerationActionItem {
  title: string;
  status: ActionItemStatus;
  deadlineStart: Date;
  deadlineEnd: Date | null;
  departmentName: string | null;
  leadName: string | null;
  goalCategory: string | null;
  assignees: GenerationAssignee[];
  discussionNotes: string;
}

export interface GenerationMiscUpdate {
  body: string;
  addedByName: string;
}

export interface OfficerMeetingForGeneration {
  date: Date;
  actionItems: GenerationActionItem[];
  miscUpdates: GenerationMiscUpdate[];
}

/**
 * Map the rich Prisma payload (from `officer-meetings-queries`) into the
 * flattened {@link OfficerMeetingForGeneration} the builders consume. Mirrors
 * the page's `meetingToDTO` so the generated text matches what the UI shows.
 */
export function toGenerationInput(
  meeting: OfficerMeetingWithRelations
): OfficerMeetingForGeneration {
  return {
    date: meeting.date,
    actionItems: meeting.actionItems.map((item) => {
      const note = item.meetingNotes.find(
        (n) => n.officerMeetingId === meeting.id
      );
      return {
        title: item.title,
        status: item.status,
        deadlineStart: item.deadlineStart,
        deadlineEnd: item.deadlineEnd,
        departmentName: item.department?.name ?? null,
        leadName: item.lead?.name ?? item.lead?.email ?? null,
        goalCategory: item.goalCategory,
        assignees: item.assignments.map((assignment) => ({
          role: assignment.role,
          name: assignment.user.name ?? assignment.user.email ?? "Unknown",
        })),
        discussionNotes: (note?.discussionNotes ?? "").trim(),
      };
    }),
    miscUpdates: meeting.miscUpdates.map((u) => ({
      body: u.body,
      addedByName: u.addedBy?.name ?? u.addedBy?.email ?? "Unknown",
    })),
  };
}

// --- shared formatting helpers ----------------------------------------------

function formatMeetingDateTime(date: Date): string {
  return `${formatWeekday(date)}, ${formatMonthDayYear(date)} at ${TIME_FORMATTER.format(date)}`;
}

function formatDeadline(start: Date, end: Date | null): string {
  return end
    ? `${formatMonthDayYear(start)} – ${formatMonthDayYear(end)}`
    : formatMonthDayYear(start);
}

function formatAssignees(assignees: GenerationAssignee[]): string {
  if (assignees.length === 0) return "No assignees listed";
  const ordered = [...assignees].sort(
    (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)
  );
  return ordered
    .map((person) => `${ASSIGNMENT_LABELS[person.role]}: ${person.name}`)
    .join(" · ");
}

// --- summary-email readiness ------------------------------------------------

/**
 * Titles of linked action items still missing discussion notes. The Summary
 * Email is disabled until this list is empty (every discussed item must have a
 * recap before the post-meeting email can be composed).
 */
export function missingDiscussionNotes(
  meeting: OfficerMeetingForGeneration
): string[] {
  return meeting.actionItems
    .filter((item) => item.discussionNotes.trim().length === 0)
    .map((item) => item.title);
}

/** True when every linked action item has discussion notes (summary is ready). */
export function canGenerateSummaryEmail(
  meeting: OfficerMeetingForGeneration
): boolean {
  return missingDiscussionNotes(meeting).length === 0;
}

// --- agenda -----------------------------------------------------------------

/**
 * Compose the deterministic meeting agenda: date, linked action items (with
 * statuses, deadlines, assignees and any discussion notes captured so far),
 * and miscellaneous updates. Always succeeds — the agenda is meant to be
 * generated before the meeting, while notes are still being filled in.
 */
export function buildOfficerMeetingAgendaFallback(
  meeting: OfficerMeetingForGeneration
): string {
  const lines: string[] = [];
  lines.push("Officer Meeting Agenda");
  lines.push(formatMeetingDateTime(meeting.date));
  lines.push("");

  lines.push(`1. Action Items for Discussion (${meeting.actionItems.length})`);
  if (meeting.actionItems.length === 0) {
    lines.push("   No action items linked yet.");
  } else {
    meeting.actionItems.forEach((item, index) => {
      lines.push("");
      lines.push(`   ${index + 1}. ${item.title}`);
      lines.push(
        `      Status: ${ACTION_STATUS_LABELS[item.status]} · Due ${formatDeadline(
          item.deadlineStart,
          item.deadlineEnd
        )}`
      );
      lines.push(
        `      Department: ${item.departmentName ?? "—"} · Goal: ${
          item.goalCategory ?? "Uncategorized"
        }`
      );
      lines.push(`      Lead: ${item.leadName ?? "Unassigned"}`);
      lines.push(`      ${formatAssignees(item.assignees)}`);
      lines.push(
        `      Discussion notes: ${
          item.discussionNotes.length > 0 ? item.discussionNotes : "(none yet)"
        }`
      );
    });
  }

  // Commitments — the "promised by whom, due by when" summary that turns the
  // agenda into a follow-up contract. Only items with an accountable lead.
  const commitments = meeting.actionItems.filter((item) => item.leadName);
  lines.push("");
  lines.push(`2. Commitments (${commitments.length}) — promised by · due by`);
  if (commitments.length === 0) {
    lines.push("   No owned commitments yet.");
  } else {
    for (const item of commitments) {
      lines.push(
        `   • ${item.title} — ${item.leadName} by ${formatDeadline(
          item.deadlineStart,
          item.deadlineEnd
        )}`
      );
    }
  }

  lines.push("");
  lines.push(`3. Miscellaneous Updates (${meeting.miscUpdates.length})`);
  if (meeting.miscUpdates.length === 0) {
    lines.push("   No miscellaneous updates.");
  } else {
    for (const update of meeting.miscUpdates) {
      lines.push(`   • ${update.body} (${update.addedByName})`);
    }
  }

  return lines.join("\n").trim() + "\n";
}

// --- summary email ----------------------------------------------------------

/**
 * Compose the post-meeting recap email body. Callers MUST gate this on
 * {@link canGenerateSummaryEmail} — it throws if any linked item is still
 * missing notes so the disabled state can never be bypassed.
 */
export function buildOfficerMeetingSummaryFallback(
  meeting: OfficerMeetingForGeneration
): string {
  const missing = missingDiscussionNotes(meeting);
  if (missing.length > 0) {
    throw new Error(
      `Cannot generate the summary email until every action item has discussion notes. Missing: ${missing.join(
        ", "
      )}`
    );
  }

  const lines: string[] = [];
  lines.push(`Subject: Officer Meeting Recap — ${formatMonthDayYear(meeting.date)}`);
  lines.push("");
  lines.push("Hi all,");
  lines.push("");
  lines.push(
    `Thank you for joining the officer meeting on ${formatMeetingDateTime(
      meeting.date
    )}. Here is a recap of what we covered and where things stand.`
  );
  lines.push("");

  lines.push("Action Items Discussed");
  if (meeting.actionItems.length === 0) {
    lines.push("• No action items were discussed.");
  } else {
    meeting.actionItems.forEach((item, index) => {
      lines.push("");
      lines.push(`${index + 1}. ${item.title}`);
      lines.push(
        `   Status: ${ACTION_STATUS_LABELS[item.status]} · Due ${formatDeadline(
          item.deadlineStart,
          item.deadlineEnd
        )} · ${formatAssignees(item.assignees)}`
      );
      lines.push(`   Discussion: ${item.discussionNotes}`);
    });
  }

  lines.push("");
  lines.push("Miscellaneous Updates");
  if (meeting.miscUpdates.length === 0) {
    lines.push("• None.");
  } else {
    for (const update of meeting.miscUpdates) {
      lines.push(`• ${update.body} — ${update.addedByName}`);
    }
  }

  lines.push("");
  lines.push(
    "Please review your assigned items and reach out with any questions before the next meeting."
  );
  lines.push("");
  lines.push("Thanks,");
  lines.push("People Strategy");

  return lines.join("\n").trim() + "\n";
}
