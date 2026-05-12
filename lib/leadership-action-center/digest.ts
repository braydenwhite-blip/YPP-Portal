import type { LeadershipActionCategory, LeadershipMeetingKind } from "@prisma/client";
import { CATEGORY_STYLES, MEETING_KIND_LABELS } from "./constants";
import {
  endOfOperatingWeek,
  formatDueDateLong,
  formatMonthDay,
  formatMonthDayYear,
  formatWeekday,
  isOverdue,
  startOfOperatingWeek,
} from "./dates";
import type { ActionItemWithRelations, MeetingWithCounts } from "./queries";

export interface WeeklyDigestInput {
  weekStart: Date;
  weekEnd: Date;
  generatedAt: Date;
  actionItems: ActionItemWithRelations[];
  meetings: MeetingWithCounts[];
}

interface DigestSection {
  heading: string;
  items: ActionItemWithRelations[];
}

export interface BuiltDigest {
  /** "All days until Sunday, May 18, 2026" */
  range: string;
  /** Items grouped by due date (or "No deadline"). */
  sections: DigestSection[];
  /** Off-track items (overdue or blocked). */
  offTrack: ActionItemWithRelations[];
  /** Items needing officer discussion this week. */
  officerDiscussion: ActionItemWithRelations[];
  /** Meetings during the week. */
  meetings: MeetingWithCounts[];
  /** Pretty-printed plain text version for copy/paste into email or Slack. */
  text: string;
  /** Color-coded HTML for the rich preview (and for paste-into-email). */
  html: string;
}

function ownerNames(item: ActionItemWithRelations): string[] {
  const names: string[] = [];
  if (item.primaryOwner?.name) names.push(item.primaryOwner.name);
  for (const name of item.ownerNames) {
    if (!names.includes(name) && name.trim()) names.push(name);
  }
  return names;
}

function inputNames(item: ActionItemWithRelations): string[] {
  const names: string[] = [];
  for (const link of item.inputNeededFrom) {
    if (link.user.name) names.push(link.user.name);
  }
  for (const name of item.inputNeededNames) {
    if (!names.includes(name) && name.trim()) names.push(name);
  }
  return names;
}

function categoryColorBlock(category: LeadershipActionCategory): string {
  return CATEGORY_STYLES[category].colorName;
}

function meetingLine(meeting: MeetingWithCounts): string {
  const label = MEETING_KIND_LABELS[meeting.kind as LeadershipMeetingKind] ?? meeting.kind;
  if (!meeting.scheduledAt) {
    return `• ${meeting.title} (${label}) — TBD`;
  }
  const when = `${formatWeekday(meeting.scheduledAt)}, ${formatMonthDay(meeting.scheduledAt)}`;
  return `• ${meeting.title} (${label}) — ${when}`;
}

function detailLines(item: ActionItemWithRelations): string[] {
  const lines: string[] = [];
  const owners = ownerNames(item);
  if (owners.length > 0) lines.push(`   Owners: ${owners.join(", ")}`);

  const input = inputNames(item);
  if (input.length > 0) lines.push(`   Input from: ${input.join(", ")}`);

  if (item.notes && item.notes.trim()) {
    lines.push(`   Notes: ${item.notes.trim()}`);
  }
  if (item.status === "BLOCKED") {
    lines.push("   ⚠ Blocked");
  } else if (isOverdue(item.dueDate)) {
    lines.push("   ⚠ Overdue");
  }
  return lines;
}

function buildSections(items: ActionItemWithRelations[], weekEnd: Date): DigestSection[] {
  // Bucket: per-date groups + a "no deadline" group + a closing "All days
  // until <end of week>" overview that mirrors the email.
  const byDate = new Map<string, { date: Date; items: ActionItemWithRelations[] }>();
  const noDeadline: ActionItemWithRelations[] = [];

  for (const item of items) {
    if (!item.dueDate) {
      noDeadline.push(item);
      continue;
    }
    const key = formatMonthDayYear(item.dueDate);
    if (!byDate.has(key)) {
      byDate.set(key, { date: item.dueDate, items: [] });
    }
    byDate.get(key)!.items.push(item);
  }

  const dateGroups = Array.from(byDate.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  const sections: DigestSection[] = dateGroups.map((group) => ({
    heading: `${formatWeekday(group.date)}, ${formatMonthDayYear(group.date)}`,
    items: group.items,
  }));

  if (noDeadline.length > 0) {
    sections.push({
      heading: `All days until ${formatWeekday(weekEnd)}, ${formatMonthDayYear(weekEnd)}`,
      items: noDeadline,
    });
  }

  return sections;
}

function buildText(input: WeeklyDigestInput, sections: DigestSection[]): string {
  const lines: string[] = [];
  lines.push(`Weekly Action Update — ${formatMonthDayYear(input.weekStart)} → ${formatMonthDayYear(input.weekEnd)}`);
  lines.push("");
  lines.push("Color key:");
  lines.push("  Pink = Core Instruction");
  lines.push("  Blue = Technology");
  lines.push("  Green = Communication");
  lines.push("  Purple = Staff Management");
  lines.push("");

  for (const section of sections) {
    if (section.items.length === 0) continue;
    lines.push(`▸ ${section.heading}`);
    for (const item of section.items) {
      const color = categoryColorBlock(item.category);
      lines.push(`   • [${color}] ${item.title}`);
      for (const detail of detailLines(item)) {
        lines.push(detail);
      }
    }
    lines.push("");
  }

  if (input.meetings.length > 0) {
    lines.push("Key meetings this week:");
    for (const meeting of input.meetings) {
      lines.push(meetingLine(meeting));
    }
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtml(input: WeeklyDigestInput, sections: DigestSection[]): string {
  const parts: string[] = [];
  parts.push(
    `<h2 style="font-family:Georgia,serif;color:#3b0f6e;margin:0 0 8px;">Weekly Action Update</h2>`
  );
  parts.push(
    `<p style="margin:0 0 16px;color:#475569;">${escapeHtml(
      formatMonthDayYear(input.weekStart)
    )} → ${escapeHtml(formatMonthDayYear(input.weekEnd))}</p>`
  );

  parts.push(
    `<p style="margin:0 0 16px;color:#475569;font-size:13px;"><b>Color key:</b> ` +
      `<span style="color:${CATEGORY_STYLES.INSTRUCTION.accent};">● Pink = Instruction</span> · ` +
      `<span style="color:${CATEGORY_STYLES.TECHNOLOGY.accent};">● Blue = Tech</span> · ` +
      `<span style="color:${CATEGORY_STYLES.COMMUNICATION.accent};">● Green = Comms</span> · ` +
      `<span style="color:${CATEGORY_STYLES.STAFF_MANAGEMENT.accent};">● Purple = Staff Mgmt</span>` +
      `</p>`
  );

  for (const section of sections) {
    if (section.items.length === 0) continue;
    parts.push(
      `<h3 style="font-family:Georgia,serif;color:#3b0f6e;margin:20px 0 8px;">${escapeHtml(section.heading)}</h3>`
    );
    parts.push(`<ul style="margin:0 0 12px;padding-left:18px;color:#1a1a1a;">`);
    for (const item of section.items) {
      const style = CATEGORY_STYLES[item.category];
      const owners = ownerNames(item);
      const inputs = inputNames(item);
      const detailFragments: string[] = [];
      if (owners.length > 0) {
        detailFragments.push(`<i>Owners:</i> ${escapeHtml(owners.join(", "))}`);
      }
      if (inputs.length > 0) {
        detailFragments.push(`<i>Input:</i> ${escapeHtml(inputs.join(", "))}`);
      }
      if (item.notes && item.notes.trim()) {
        detailFragments.push(`<i>Notes:</i> ${escapeHtml(item.notes.trim())}`);
      }
      const flags: string[] = [];
      if (item.status === "BLOCKED") flags.push(`<b style="color:#991b1b;">⚠ Blocked</b>`);
      else if (isOverdue(item.dueDate)) flags.push(`<b style="color:#991b1b;">⚠ Overdue</b>`);
      if (item.needsOfficerDiscussion) {
        flags.push(`<b style="color:#a16207;">★ Officer discussion</b>`);
      }
      const detailHtml =
        detailFragments.length > 0
          ? `<div style="font-size:13px;color:#475569;margin-top:2px;">${detailFragments.join(" · ")}</div>`
          : "";
      const flagHtml =
        flags.length > 0
          ? `<div style="font-size:12px;margin-top:2px;">${flags.join(" · ")}</div>`
          : "";

      parts.push(
        `<li style="margin-bottom:8px;">` +
          `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${style.accent};margin-right:8px;vertical-align:middle;"></span>` +
          `<b>${escapeHtml(item.title)}</b>` +
          detailHtml +
          flagHtml +
          `</li>`
      );
    }
    parts.push(`</ul>`);
  }

  if (input.meetings.length > 0) {
    parts.push(
      `<h3 style="font-family:Georgia,serif;color:#3b0f6e;margin:20px 0 8px;">Key meetings this week</h3>`
    );
    parts.push(`<ul style="margin:0 0 12px;padding-left:18px;color:#1a1a1a;">`);
    for (const meeting of input.meetings) {
      const label = MEETING_KIND_LABELS[meeting.kind as LeadershipMeetingKind] ?? meeting.kind;
      const when = meeting.scheduledAt
        ? `${formatWeekday(meeting.scheduledAt)}, ${formatMonthDayYear(meeting.scheduledAt)}`
        : "TBD";
      parts.push(
        `<li style="margin-bottom:6px;"><b>${escapeHtml(meeting.title)}</b> ` +
          `<span style="color:#64748b;">(${escapeHtml(label)})</span> — ${escapeHtml(when)}</li>`
      );
    }
    parts.push(`</ul>`);
  }

  return parts.join("\n");
}

export function buildWeeklyDigest(input: WeeklyDigestInput): BuiltDigest {
  const sections = buildSections(input.actionItems, input.weekEnd);
  const offTrack = input.actionItems.filter(
    (item) => item.status === "BLOCKED" || isOverdue(item.dueDate, input.generatedAt)
  );
  const officerDiscussion = input.actionItems.filter(
    (item) => item.needsOfficerDiscussion && item.status !== "COMPLETE"
  );

  return {
    range: `${formatDueDateLong(input.weekStart)} – ${formatDueDateLong(input.weekEnd)}`,
    sections,
    offTrack,
    officerDiscussion,
    meetings: input.meetings,
    text: buildText(input, sections),
    html: buildHtml(input, sections),
  };
}

export function digestWeekRange(date: Date): { weekStart: Date; weekEnd: Date } {
  return { weekStart: startOfOperatingWeek(date), weekEnd: endOfOperatingWeek(date) };
}
