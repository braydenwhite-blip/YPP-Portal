import type {
  ActionAssignmentRole,
  ActionEmailType,
  ActionItemStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  isActionTrackerEnabled,
  isActionTrackerEmailsEnabled,
} from "@/lib/feature-flags";
import { toAbsoluteAppUrl } from "@/lib/public-app-url";
import { formatMonthDay } from "@/lib/leadership-action-center/dates";
import {
  sendActionDeadlineWarningEmail,
  sendActionDeadlineReachedEmail,
  sendActionOverdueLeadEmail,
  sendLeadershipEscalationEmail,
  sendBoardEscalationRollupEmail,
  sendWeeklyOfficerDigestEmail,
  type OfficerDigestPriority,
  type OfficerDigestCongratsPerson,
  type OfficerDigestOverdueTask,
  type OfficerDigestOverduePerson,
} from "@/lib/email";
import { OFFICER_TIER_ROLES } from "@/lib/org/role-sets";
import { whereUserHasAnyRole } from "@/lib/user-role-where";
import { weekStartFor } from "@/lib/weekly-meetings/week";
import { ACTION_STATUS_LABELS } from "./constants";
import { listAllActionItems, type ActionItemWithRelations } from "./action-queries";
import { composeCommandCenter } from "./command-center";
import {
  effectiveDeadline as actionEffectiveDeadline,
  isActionOverdue,
} from "./my-actions-selectors";
import { loadCompletedContributionsByMember } from "./completed-contributions";
import { recordPulseSnapshot } from "./pulse-snapshot";
import {
  escalationDeadline,
  escalationReason,
  escalationSince,
  formatEscalationAge,
  isBoardRollupEligible,
  isEscalationEligible,
} from "./escalation";

/**
 * People Strategy — Action Tracker deadline-email engine.
 *
 * All business logic for the three deadline crons lives here so the route
 * handlers stay thin (auth + delegate) and the grouping / idempotency rules are
 * unit-testable without HTTP. Every entry point is a no-op unless
 * `ENABLE_ACTION_TRACKER_EMAILS=true`, and every send is recorded in
 * `ActionEmailLog` so the same (type, action, recipient, deadline) email is
 * never sent twice — even if a cron run is retried or overlaps.
 */

const ROLE_LABELS: Record<ActionAssignmentRole, string> = {
  LEAD: "Lead",
  EXECUTING: "Executing",
  INPUT: "Input",
};

/** Open = anything not yet COMPLETE (NOT_STARTED, IN_PROGRESS, OVERDUE). */
const OPEN_STATUSES: ActionItemStatus[] = ["NOT_STARTED", "IN_PROGRESS", "OVERDUE"];

// ── Date helpers (UTC, calendar-day granularity) ───────────────────────────

function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

/** `YYYY-MM-DD` for a date's UTC calendar day — the idempotency deadline key. */
function dateKey(d: Date): string {
  return utcDayStart(d).toISOString().slice(0, 10);
}

function formatDeadlineDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

// ── Loaded item shape ──────────────────────────────────────────────────────

type LoadedRecipient = { id: string; name: string | null; email: string | null };

type LoadedItem = {
  id: string;
  title: string;
  status: string;
  deadlineStart: Date;
  deadlineEnd: Date | null;
  leadId: string;
  department: { name: string } | null;
  lead: LoadedRecipient | null;
  assignments: Array<{ role: ActionAssignmentRole; user: LoadedRecipient }>;
};

const ITEM_SELECT = {
  id: true,
  title: true,
  status: true,
  deadlineStart: true,
  deadlineEnd: true,
  leadId: true,
  department: { select: { name: true } },
  lead: { select: { id: true, name: true, email: true } },
  assignments: {
    select: {
      role: true,
      user: { select: { id: true, name: true, email: true } },
    },
  },
} as const;

/** The deadline that drives notifications: the end date if present, else start. */
function effectiveDeadline(item: LoadedItem): Date {
  return item.deadlineEnd ?? item.deadlineStart;
}

/**
 * Everyone who should be notified about an item: every assignment holder plus
 * the denormalized Lead (who may not have an explicit LEAD assignment row).
 * Each recipient carries the set of roles they hold on the item, deduped.
 */
function recipientsFor(
  item: LoadedItem
): Map<string, { user: LoadedRecipient; roles: Set<ActionAssignmentRole> }> {
  const map = new Map<
    string,
    { user: LoadedRecipient; roles: Set<ActionAssignmentRole> }
  >();

  const add = (user: LoadedRecipient, role: ActionAssignmentRole) => {
    const existing = map.get(user.id);
    if (existing) {
      existing.roles.add(role);
    } else {
      map.set(user.id, { user, roles: new Set([role]) });
    }
  };

  for (const a of item.assignments) add(a.user, a.role);
  if (item.lead) add(item.lead, "LEAD");

  return map;
}

function roleLabel(roles: Set<ActionAssignmentRole>): string {
  // Stable, human order: Lead, Executing, Input.
  const order: ActionAssignmentRole[] = ["LEAD", "EXECUTING", "INPUT"];
  return order
    .filter((r) => roles.has(r))
    .map((r) => ROLE_LABELS[r])
    .join(" + ");
}

// ── Idempotency ────────────────────────────────────────────────────────────

/**
 * Atomically claim a (dedupeKey) slot. Returns true only for the caller that
 * actually inserted the row, so concurrent/retried runs send at most once.
 * `createMany({ skipDuplicates })` makes the claim a single race-free statement.
 */
async function claimEmail(params: {
  dedupeKey: string;
  type: ActionEmailType;
  recipientId: string;
  actionItemId: string | null;
}): Promise<boolean> {
  const res = await prisma.actionEmailLog.createMany({
    data: [
      {
        dedupeKey: params.dedupeKey,
        type: params.type,
        recipientId: params.recipientId,
        actionItemId: params.actionItemId,
      },
    ],
    skipDuplicates: true,
  });
  return res.count === 1;
}

/**
 * Claim → send → (on failure) release. Returns true when an email was actually
 * sent. If the claim is lost (already sent) we skip silently; if the send
 * throws we delete the claim so a later run can retry rather than dropping it.
 */
async function sendOnce(params: {
  dedupeKey: string;
  type: ActionEmailType;
  recipientId: string;
  actionItemId: string | null;
  send: () => Promise<unknown>;
}): Promise<boolean> {
  const claimed = await claimEmail(params);
  if (!claimed) return false;

  try {
    await params.send();
    return true;
  } catch (err) {
    await prisma.actionEmailLog
      .deleteMany({ where: { dedupeKey: params.dedupeKey } })
      .catch(() => {});
    logger.error(
      { err, type: params.type, recipientId: params.recipientId },
      "action-cron: email send failed"
    );
    return false;
  }
}

// ── Shared loader ──────────────────────────────────────────────────────────

async function loadOpenItems(): Promise<LoadedItem[]> {
  return prisma.actionItem.findMany({
    where: { status: { in: OPEN_STATUSES } },
    select: ITEM_SELECT,
  }) as unknown as Promise<LoadedItem[]>;
}

// ── 1. Weekly officer digest (Mondays) ─────────────────────────────────────

export type WeeklyOfficerDigestResult = {
  recipients: number;
  emailsSent: number;
};

/** Top N items surfaced in the "This week's priorities" section. */
const PRIORITY_LIMIT = 6;

/** Minimal person shape used while merging wins/overdue work across sources. */
type PersonRef = { id: string; name: string | null; email: string | null };

function toPersonRef(user: { id: string; name: string | null; email: string | null }): PersonRef {
  return { id: user.id, name: user.name, email: user.email };
}

/**
 * Candidate members for the "wins" scan: everyone who leads or executes at
 * least one action item, deduped by user id. Sourced from the already-loaded
 * item set rather than a separate query.
 */
function collectCandidateMembers(items: ActionItemWithRelations[]): Map<string, PersonRef> {
  const map = new Map<string, PersonRef>();
  for (const item of items) {
    if (item.lead) map.set(item.lead.id, toPersonRef(item.lead));
    for (const a of item.assignments) {
      if (a.role === "EXECUTING") map.set(a.user.id, toPersonRef(a.user));
    }
  }
  return map;
}

type WinAccumulator = { name: string; email: string; reasons: string[] };

function addWinReason(
  wins: Map<string, WinAccumulator>,
  person: { id: string; name: string | null; email: string | null },
  reason: string
) {
  if (!person.email) return;
  const trimmedReason = reason.trim();
  if (!trimmedReason) return;
  let acc = wins.get(person.id);
  if (!acc) {
    acc = { name: person.name ?? person.email, email: person.email, reasons: [] };
    wins.set(person.id, acc);
  }
  if (!acc.reasons.includes(trimmedReason)) acc.reasons.push(trimmedReason);
}

/**
 * "Reach out & congratulate" — people with a win this week, merged from two
 * sources: action items they completed this week (via the shared
 * completed-contributions selector) and Weekly Impact rows they marked done or
 * sent to the board. Keyed by user id so one person's reasons combine across
 * both sources.
 */
async function buildOfficerWins(
  items: ActionItemWithRelations[],
  now: Date
): Promise<Map<string, WinAccumulator>> {
  const wins = new Map<string, WinAccumulator>();

  const candidates = collectCandidateMembers(items);
  const contributions = await loadCompletedContributionsByMember([...candidates.keys()], {
    now,
    windowDays: 7,
  });
  for (const [id, summary] of contributions) {
    if (summary.thisWeek <= 0 || !summary.label) continue;
    const person = candidates.get(id);
    if (!person) continue;
    addWinReason(wins, person, summary.label);
  }

  const impactRows = await prisma.weeklyImpactRow.findMany({
    where: {
      OR: [{ rowStatus: "DONE" }, { sendToBoard: true }],
      entry: { weekStart: weekStartFor(now), status: "SUBMITTED" },
    },
    select: {
      whatGoal: true,
      entry: { select: { user: { select: { id: true, name: true, email: true } } } },
    },
  });
  for (const row of impactRows) {
    addWinReason(wins, row.entry.user, row.whatGoal?.trim() || "Weekly impact win");
  }

  return wins;
}

type OverdueTaskAccumulator = { title: string; due: Date; source: string };
type OverdueAccumulator = { name: string; email: string; tasks: OverdueTaskAccumulator[] };

function addOverdueTask(
  overdue: Map<string, OverdueAccumulator>,
  person: { id: string; name: string | null; email: string | null },
  task: OverdueTaskAccumulator
) {
  if (!person.email) return;
  let acc = overdue.get(person.id);
  if (!acc) {
    acc = { name: person.name ?? person.email, email: person.email, tasks: [] };
    overdue.set(person.id, acc);
  }
  acc.tasks.push(task);
}

/**
 * "Follow up on overdue work" — people with overdue work, merged from three
 * sources: overdue Action Items (lead + EXECUTING assignees), overdue
 * MeetingFollowUps (the follow-up's owner), and overdue WeeklyImpactRows (the
 * entry's user). Keyed by user id so one person's overdue items across sources
 * land under a single row listing every task.
 */
async function buildOfficerOverdue(
  items: ActionItemWithRelations[],
  now: Date
): Promise<Map<string, OverdueAccumulator>> {
  const overdue = new Map<string, OverdueAccumulator>();

  for (const item of items) {
    if (!isActionOverdue(item, now)) continue;
    const due = actionEffectiveDeadline(item);
    const owners = new Map<string, PersonRef>();
    if (item.lead) owners.set(item.lead.id, toPersonRef(item.lead));
    for (const a of item.assignments) {
      if (a.role === "EXECUTING") owners.set(a.user.id, toPersonRef(a.user));
    }
    for (const owner of owners.values()) {
      addOverdueTask(overdue, owner, { title: item.title, due, source: "Action" });
    }
  }

  const followUps = await prisma.meetingFollowUp.findMany({
    where: {
      dueDate: { not: null, lt: now },
      status: { not: "COMPLETED" },
      ownerId: { not: null },
    },
    select: {
      title: true,
      dueDate: true,
      owner: { select: { id: true, name: true, email: true } },
    },
  });
  for (const fu of followUps) {
    if (!fu.owner || !fu.dueDate) continue;
    addOverdueTask(overdue, fu.owner, {
      title: fu.title,
      due: fu.dueDate,
      source: "Meeting follow-up",
    });
  }

  const impactRows = await prisma.weeklyImpactRow.findMany({
    where: {
      due: { not: null, lt: now },
      rowStatus: { not: "DONE" },
      entry: { status: "SUBMITTED" },
    },
    select: {
      whatGoal: true,
      due: true,
      entry: { select: { user: { select: { id: true, name: true, email: true } } } },
    },
  });
  for (const row of impactRows) {
    if (!row.due) continue;
    addOverdueTask(overdue, row.entry.user, {
      title: row.whatGoal?.trim() || "Weekly impact item",
      due: row.due,
      source: "Weekly impact",
    });
  }

  return overdue;
}

/** Active officers with an email: the OFFICER_TIER_ROLES set, org-wide. */
async function loadOfficerRecipients(): Promise<LoadedRecipient[]> {
  const officers = await prisma.user.findMany({
    where: {
      archivedAt: null,
      ...whereUserHasAnyRole([...OFFICER_TIER_ROLES]),
    },
    select: { id: true, name: true, email: true },
  });
  return officers.filter((o) => o.email);
}

/**
 * Build one identical, org-wide digest and send it to every officer: this
 * week's top priorities (the Command Center attention queue), who to
 * congratulate on a win, and who has overdue work worth a follow-up. Sent
 * Mondays; replaces the old per-recipient weekly action digest and the emailed
 * Leadership Briefing with this single email (idempotent per recipient per
 * week via `ActionEmailLog`).
 *
 * Alongside delivery it records an `ActionPulseSnapshot` for the week so
 * week-over-week trend history keeps accumulating. No-op unless
 * ENABLE_ACTION_TRACKER_EMAILS.
 */
export async function runWeeklyOfficerDigest(now: Date): Promise<WeeklyOfficerDigestResult> {
  if (!isActionTrackerEmailsEnabled()) return { recipients: 0, emailsSent: 0 };

  const items = await listAllActionItems();
  const data = composeCommandCenter(items, now);

  // Record the weekly pulse snapshot so trend history keeps accumulating.
  await recordPulseSnapshot(data.weekStart, data.pulse, data.consideredCount);

  const priorities: OfficerDigestPriority[] = data.attention.slice(0, PRIORITY_LIMIT).map((a) => ({
    title: a.title,
    reason: a.reason,
    ownerName: a.ownerName,
    departmentName: a.departmentName,
    dueLabel: a.dueLabel,
    actionUrl: toAbsoluteAppUrl(`/actions/${a.id}`),
  }));

  const wins = await buildOfficerWins(items, now);
  const congrats: OfficerDigestCongratsPerson[] = Array.from(wins.values())
    .map((w) => ({ name: w.name, email: w.email, reasons: w.reasons }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const overdueByPerson = await buildOfficerOverdue(items, now);
  const overdue: OfficerDigestOverduePerson[] = Array.from(overdueByPerson.values())
    .map((o) => ({
      name: o.name,
      email: o.email,
      tasks: [...o.tasks]
        .sort((a, b) => a.due.getTime() - b.due.getTime())
        .map(
          (t): OfficerDigestOverdueTask => ({
            title: t.title,
            dueLabel: formatDeadlineDate(t.due),
            source: t.source,
          })
        ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const weekKey = dateKey(data.weekStart);
  const weekLabel = formatMonthDay(data.weekStart);
  const commandCenterUrl = toAbsoluteAppUrl("/work");
  const officers = await loadOfficerRecipients();

  let emailsSent = 0;
  for (const officer of officers) {
    const sent = await sendOnce({
      dedupeKey: `officerdigest:${weekKey}:${officer.id}`,
      type: "WEEKLY_DIGEST",
      recipientId: officer.id,
      actionItemId: null,
      send: () =>
        sendWeeklyOfficerDigestEmail({
          to: officer.email as string,
          recipientName: officer.name,
          weekLabel,
          priorities,
          congrats,
          overdue,
          commandCenterUrl,
        }),
    });
    if (sent) emailsSent++;
  }

  logger.info(
    { recipients: officers.length, emailsSent, weekKey },
    "action-cron: weekly officer digest"
  );
  return { recipients: officers.length, emailsSent };
}

// ── 2. 24-hour warning (daily) ─────────────────────────────────────────────

export type DeadlineWarningResult = { items: number; emailsSent: number };

/**
 * Email every assignee (and the Lead) of items whose deadline is exactly
 * tomorrow. Idempotent per (item, recipient, deadline-day).
 */
export async function runDeadlineWarnings(now: Date): Promise<DeadlineWarningResult> {
  if (!isActionTrackerEmailsEnabled()) return { items: 0, emailsSent: 0 };

  const today = utcDayStart(now);
  const tomorrow = addDays(today, 1);
  const dayAfter = addDays(today, 2);

  const items = await loadOpenItems();

  let matched = 0;
  let emailsSent = 0;

  for (const item of items) {
    const due = effectiveDeadline(item);
    const dueDay = utcDayStart(due);
    if (dueDay < tomorrow || dueDay >= dayAfter) continue; // not due *tomorrow*
    matched++;

    const dKey = dateKey(due);
    const updateStatusUrl = toAbsoluteAppUrl(`/actions/${item.id}`);
    const flagToLeadershipUrl = toAbsoluteAppUrl(`/actions/${item.id}#flag-to-leadership`);
    const deadline = formatDeadlineDate(due);

    for (const { user, roles } of recipientsFor(item).values()) {
      if (!user.email) continue;
      const sent = await sendOnce({
        dedupeKey: `warn24:${item.id}:${user.id}:${dKey}`,
        type: "WARNING_24H",
        recipientId: user.id,
        actionItemId: item.id,
        send: () =>
          sendActionDeadlineWarningEmail({
            to: user.email as string,
            recipientName: user.name,
            role: roleLabel(roles),
            department: item.department?.name ?? "Unassigned",
            actionTitle: item.title,
            deadline,
            updateStatusUrl,
            flagToLeadershipUrl,
          }),
      });
      if (sent) emailsSent++;
    }
  }

  logger.info({ items: matched, emailsSent }, "action-cron: 24h warning");
  return { items: matched, emailsSent };
}

// ── 3. Deadline reached + overdue sweep (daily, end of day) ─────────────────

export type DeadlineReachedResult = {
  dueToday: number;
  reachedEmailsSent: number;
  markedOverdue: number;
  leadEmailsSent: number;
};

/**
 * Two responsibilities, run end-of-day:
 *   1. Email assignees (+ Lead) of items whose deadline is today.
 *   2. Any item whose deadline was before today with NO status update (still
 *      NOT_STARTED) is set to OVERDUE and its Lead notified.
 *
 * Both halves are idempotent: the OVERDUE write moves items off NOT_STARTED so
 * a re-run can't re-trigger it, and every email is `ActionEmailLog`-guarded.
 */
export async function runDeadlineReached(now: Date): Promise<DeadlineReachedResult> {
  if (!isActionTrackerEmailsEnabled())
    return { dueToday: 0, reachedEmailsSent: 0, markedOverdue: 0, leadEmailsSent: 0 };

  const today = utcDayStart(now);
  const tomorrow = addDays(today, 1);

  const items = await loadOpenItems();

  let dueToday = 0;
  let reachedEmailsSent = 0;

  // ── Part 1: "due today" emails ──
  for (const item of items) {
    const due = effectiveDeadline(item);
    const dueDay = utcDayStart(due);
    if (dueDay < today || dueDay >= tomorrow) continue; // not due *today*
    dueToday++;

    const dKey = dateKey(due);
    const updateStatusUrl = toAbsoluteAppUrl(`/actions/${item.id}`);
    const flagToLeadershipUrl = toAbsoluteAppUrl(`/actions/${item.id}#flag-to-leadership`);
    const deadline = formatDeadlineDate(due);

    for (const { user, roles } of recipientsFor(item).values()) {
      if (!user.email) continue;
      const sent = await sendOnce({
        dedupeKey: `deadline:${item.id}:${user.id}:${dKey}`,
        type: "DEADLINE_REACHED",
        recipientId: user.id,
        actionItemId: item.id,
        send: () =>
          sendActionDeadlineReachedEmail({
            to: user.email as string,
            recipientName: user.name,
            role: roleLabel(roles),
            department: item.department?.name ?? "Unassigned",
            actionTitle: item.title,
            deadline,
            updateStatusUrl,
            flagToLeadershipUrl,
          }),
      });
      if (sent) reachedEmailsSent++;
    }
  }

  // ── Part 2: overdue sweep — deadline passed, no status update ──
  // "No status update" = still NOT_STARTED. Only previous-day or older items
  // are swept so a manual/early cron run never marks a same-day item overdue.
  // Idempotent: the update moves them off NOT_STARTED.
  let markedOverdue = 0;
  let leadEmailsSent = 0;

  for (const item of items) {
    if (item.status !== "NOT_STARTED") continue;
    const due = effectiveDeadline(item);
    const dueDay = utcDayStart(due);
    if (dueDay >= today) continue; // same-day and future deadlines are not overdue yet

    // Move to OVERDUE only if still NOT_STARTED (race-safe conditional update).
    const updated = await prisma.actionItem.updateMany({
      where: { id: item.id, status: "NOT_STARTED" },
      data: { status: "OVERDUE" },
    });
    if (updated.count === 0) continue; // someone updated it first
    markedOverdue++;

    if (item.lead?.email) {
      const sent = await sendOnce({
        dedupeKey: `overdue:${item.id}:${item.lead.id}:${dateKey(due)}`,
        type: "OVERDUE_LEAD",
        recipientId: item.lead.id,
        actionItemId: item.id,
        send: () =>
          sendActionOverdueLeadEmail({
            to: item.lead!.email as string,
            recipientName: item.lead!.name,
            actionTitle: item.title,
            department: item.department?.name ?? "Unassigned",
            deadline: formatDeadlineDate(due),
            actionUrl: toAbsoluteAppUrl(`/actions/${item.id}`),
          }),
      });
      if (sent) leadEmailsSent++;
    }
  }

  logger.info(
    { dueToday, reachedEmailsSent, markedOverdue, leadEmailsSent },
    "action-cron: deadline reached + overdue sweep"
  );
  return { dueToday, reachedEmailsSent, markedOverdue, leadEmailsSent };
}

// ── 4. Leadership escalation (daily) ───────────────────────────────────────────────

export type LeadershipEscalationResult = {
  /** Items eligible (flagged/overdue 48h+, unresolved, not yet escalated). */
  eligible: number;
  /** Items newly marked `escalatedToLeadershipAt` this run. */
  itemsEscalated: number;
  /** Leadership/Board notification emails actually sent this run. */
  emailsSent: number;
};

/** Item projection used by the escalation sweep. */
type EscalationCandidate = {
  id: string;
  title: string;
  status: ActionItemStatus;
  flaggedAt: Date | null;
  deadlineStart: Date;
  deadlineEnd: Date | null;
  resolvedAt: Date | null;
  department: { name: string } | null;
  lead: LoadedRecipient | null;
};

/** Unresolved items not yet escalated that are flagged or OVERDUE. */
async function loadEscalationCandidates(): Promise<EscalationCandidate[]> {
  return prisma.actionItem.findMany({
    where: {
      resolvedAt: null,
      escalatedToLeadershipAt: null,
      OR: [{ flaggedAt: { not: null } }, { status: "OVERDUE" }],
    },
    select: {
      id: true,
      title: true,
      status: true,
      flaggedAt: true,
      deadlineStart: true,
      deadlineEnd: true,
      resolvedAt: true,
      department: { select: { name: true } },
      lead: { select: { id: true, name: true, email: true } },
    },
  }) as unknown as Promise<EscalationCandidate[]>;
}

/** Leadership / Board recipients (ADMIN + AdminSubtype Leadership or SUPER_ADMIN) with email. */
async function loadLeadershipRecipients(): Promise<LoadedRecipient[]> {
  return prisma.user.findMany({
    where: {
      archivedAt: null,
      adminSubtypes: { some: { subtype: { in: ["LEADERSHIP", "SUPER_ADMIN"] } } },
    },
    select: { id: true, name: true, email: true },
  });
}

/**
 * Escalate flagged/OVERDUE items that have been unresolved for 48h+ to the Leadership.
 *
 * For each eligible item the Leadership/Board are notified exactly once: `sendOnce`
 * dedupes per (item, recipient) via `ActionEmailLog`, and the item is then
 * marked `escalatedToLeadershipAt` with a race-safe conditional update so retries or
 * overlapping runs never double-escalate. Items are only marked when at least
 * one Leadership recipient exists, so the escalation re-fires for a later run if no
 * Leadership/Board user is configured yet. No-op unless ENABLE_ACTION_TRACKER_EMAILS.
 */
export async function runLeadershipEscalations(now: Date): Promise<LeadershipEscalationResult> {
  if (!isActionTrackerEmailsEnabled())
    return { eligible: 0, itemsEscalated: 0, emailsSent: 0 };

  const candidates = await loadEscalationCandidates();
  const eligible = candidates.filter((item) => isEscalationEligible(item, now));
  if (eligible.length === 0) {
    logger.info({ eligible: 0 }, "action-cron: leadership escalation");
    return { eligible: 0, itemsEscalated: 0, emailsSent: 0 };
  }

  const recipients = (await loadLeadershipRecipients()).filter((r) => r.email);
  const queueUrl = toAbsoluteAppUrl("/people");

  let itemsEscalated = 0;
  let emailsSent = 0;

  for (const item of eligible) {
    const since = escalationSince(item);
    if (!since) continue; // defensive; isEscalationEligible already guarantees it
    const reason = escalationReason(item) ?? "Flagged";
    const ageLabel = formatEscalationAge(since, now);
    const deadline = formatDeadlineDate(escalationDeadline(item));
    const actionUrl = toAbsoluteAppUrl(`/actions/${item.id}`);

    for (const recipient of recipients) {
      const sent = await sendOnce({
        dedupeKey: `escalation:${item.id}:${recipient.id}`,
        type: "LEADERSHIP_ESCALATION",
        recipientId: recipient.id,
        actionItemId: item.id,
        send: () =>
          sendLeadershipEscalationEmail({
            to: recipient.email as string,
            recipientName: recipient.name,
            actionTitle: item.title,
            department: item.department?.name ?? "Unassigned",
            leadName: item.lead?.name ?? null,
            statusLabel: ACTION_STATUS_LABELS[item.status],
            reason,
            ageLabel,
            deadline,
            queueUrl,
            actionUrl,
          }),
      });
      if (sent) emailsSent++;
    }

    // Mark escalated once — only when there is someone to notify, so an item
    // with no configured Leadership/Board recipient stays eligible for a later run.
    if (recipients.length > 0) {
      const updated = await prisma.actionItem.updateMany({
        where: { id: item.id, escalatedToLeadershipAt: null },
        data: { escalatedToLeadershipAt: now },
      });
      if (updated.count > 0) itemsEscalated++;
    }
  }

  logger.info(
    { eligible: eligible.length, itemsEscalated, emailsSent, recipients: recipients.length },
    "action-cron: leadership escalation"
  );
  return { eligible: eligible.length, itemsEscalated, emailsSent };
}

// ── 5. Board roll-up (daily) ────────────────────────────────────────────────

export type BoardRollupResult = {
  /** Leadership-escalated, unresolved, not-yet-rolled-up items past the 7-day threshold. */
  eligible: number;
  /** Items newly marked `boardRolledUpAt` this run. */
  itemsRolledUp: number;
  /** Board notification emails actually sent this run. */
  emailsSent: number;
};

/** Item projection used by the Board roll-up sweep. */
type RollupCandidate = {
  id: string;
  title: string;
  status: ActionItemStatus;
  escalatedToLeadershipAt: Date | null;
  resolvedAt: Date | null;
  boardRolledUpAt: Date | null;
  deadlineStart: Date;
  deadlineEnd: Date | null;
  department: { name: string } | null;
  lead: LoadedRecipient | null;
};

/** Leadership-escalated, unresolved items not yet rolled up to the Board. */
async function loadRollupCandidates(): Promise<RollupCandidate[]> {
  return prisma.actionItem.findMany({
    where: {
      resolvedAt: null,
      boardRolledUpAt: null,
      escalatedToLeadershipAt: { not: null },
    },
    select: {
      id: true,
      title: true,
      status: true,
      escalatedToLeadershipAt: true,
      resolvedAt: true,
      boardRolledUpAt: true,
      deadlineStart: true,
      deadlineEnd: true,
      department: { select: { name: true } },
      lead: { select: { id: true, name: true, email: true } },
    },
  }) as unknown as Promise<RollupCandidate[]>;
}

/** Board recipients (ADMIN + AdminSubtype SUPER_ADMIN — the Board stand-in). */
async function loadBoardRecipients(): Promise<LoadedRecipient[]> {
  return prisma.user.findMany({
    where: {
      archivedAt: null,
      adminSubtypes: { some: { subtype: "SUPER_ADMIN" } },
    },
    select: { id: true, name: true, email: true },
  });
}

/**
 * Roll Leadership-escalated, unresolved items that are 7+ days past `escalatedToLeadershipAt`
 * up to the Board.
 *
 * Each item is rolled up exactly once: a race-safe conditional update sets
 * `boardRolledUpAt` (so retries/overlaps never double-roll), and on the winning
 * update an authorless system audit comment is written into the item's history.
 * The marker + audit entry are gated only by ENABLE_ACTION_TRACKER, so the Board
 * roll-up list populates regardless of email config; the Board notification is
 * sent additionally when ENABLE_ACTION_TRACKER_EMAILS is on and Board recipients
 * are discoverable (deduped per item/recipient via `ActionEmailLog`).
 */
export async function runBoardRollups(now: Date): Promise<BoardRollupResult> {
  if (!isActionTrackerEnabled())
    return { eligible: 0, itemsRolledUp: 0, emailsSent: 0 };

  const candidates = await loadRollupCandidates();
  const eligible = candidates.filter((item) => isBoardRollupEligible(item, now));
  if (eligible.length === 0) {
    logger.info({ eligible: 0 }, "action-cron: board rollup");
    return { eligible: 0, itemsRolledUp: 0, emailsSent: 0 };
  }

  const emailsOn = isActionTrackerEmailsEnabled();
  const recipients = emailsOn
    ? (await loadBoardRecipients()).filter((r) => r.email)
    : [];
  const boardUrl = toAbsoluteAppUrl("/actions/people/board-rollup");

  let itemsRolledUp = 0;
  let emailsSent = 0;

  for (const item of eligible) {
    // Mark + audit exactly once (race-safe): only the run that flips
    // boardRolledUpAt records the roll-up and notifies.
    const updated = await prisma.actionItem.updateMany({
      where: { id: item.id, boardRolledUpAt: null, resolvedAt: null },
      data: { boardRolledUpAt: now },
    });
    if (updated.count === 0) continue; // already rolled up / resolved by another run
    itemsRolledUp++;

    const sinceLabel = item.escalatedToLeadershipAt
      ? formatEscalationAge(item.escalatedToLeadershipAt, now)
      : "7 days";

    // Authorless (system) audit entry, visible in the item's comment history.
    await prisma.actionComment.create({
      data: {
        actionItemId: item.id,
        type: "NOTE",
        body: `Rolled up to the Board — unresolved ${sinceLabel} after Leadership escalation.`,
      },
    });

    const deadline = formatDeadlineDate(item.deadlineEnd ?? item.deadlineStart);
    const actionUrl = toAbsoluteAppUrl(`/actions/${item.id}`);

    for (const board of recipients) {
      const sent = await sendOnce({
        dedupeKey: `boardrollup:${item.id}:${board.id}`,
        type: "BOARD_ROLLUP",
        recipientId: board.id,
        actionItemId: item.id,
        send: () =>
          sendBoardEscalationRollupEmail({
            to: board.email as string,
            recipientName: board.name,
            actionTitle: item.title,
            department: item.department?.name ?? "Unassigned",
            leadName: item.lead?.name ?? null,
            statusLabel: ACTION_STATUS_LABELS[item.status],
            daysUnresolvedLabel: sinceLabel,
            leadershipEscalatedLabel: `${sinceLabel} ago`,
            deadline,
            boardUrl,
            actionUrl,
          }),
      });
      if (sent) emailsSent++;
    }
  }

  logger.info(
    { eligible: eligible.length, itemsRolledUp, emailsSent, recipients: recipients.length },
    "action-cron: board rollup"
  );
  return { eligible: eligible.length, itemsRolledUp, emailsSent };
}
