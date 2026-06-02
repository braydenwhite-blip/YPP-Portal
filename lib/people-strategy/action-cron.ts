import type {
  ActionAssignmentRole,
  ActionEmailType,
  ActionItemStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { isActionTrackerEmailsEnabled } from "@/lib/feature-flags";
import { toAbsoluteAppUrl } from "@/lib/public-app-url";
import {
  sendWeeklyActionDigestEmail,
  sendActionDeadlineWarningEmail,
  sendActionDeadlineReachedEmail,
  sendActionOverdueLeadEmail,
  sendCpoEscalationEmail,
  type ActionDigestItem,
} from "@/lib/email";
import { ACTION_STATUS_LABELS } from "./constants";
import {
  escalationDeadline,
  escalationReason,
  escalationSince,
  formatEscalationAge,
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
  department: { name: string };
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

// ── 1. Weekly digest (Mondays) ─────────────────────────────────────────────

export type WeeklyDigestResult = {
  recipients: number;
  emailsSent: number;
};

/**
 * Build one digest per recipient, grouping their open items into Overdue / Due
 * This Week / Upcoming, and send it (idempotent per recipient per week). The
 * week key is the Monday the cron runs, so re-running on the same Monday never
 * double-sends.
 */
export async function runWeeklyActionDigest(now: Date): Promise<WeeklyDigestResult> {
  if (!isActionTrackerEmailsEnabled()) return { recipients: 0, emailsSent: 0 };

  const today = utcDayStart(now);
  const weekEnd = addDays(today, 7); // Mon..Sun inclusive window
  const weekKey = dateKey(today);
  const myActionsUrl = toAbsoluteAppUrl("/my-actions");

  const items = await loadOpenItems();

  // recipientId -> { user, groups }
  const perRecipient = new Map<
    string,
    {
      user: LoadedRecipient;
      overdue: ActionDigestItem[];
      dueThisWeek: ActionDigestItem[];
      upcoming: ActionDigestItem[];
    }
  >();

  for (const item of items) {
    const due = effectiveDeadline(item);
    const dueDay = utcDayStart(due);
    const recipients = recipientsFor(item);

    for (const { user, roles } of recipients.values()) {
      if (!user.email) continue;

      let bucket = perRecipient.get(user.id);
      if (!bucket) {
        bucket = { user, overdue: [], dueThisWeek: [], upcoming: [] };
        perRecipient.set(user.id, bucket);
      }

      const row: ActionDigestItem = {
        title: item.title,
        role: roleLabel(roles),
        department: item.department.name,
        deadline: formatDeadlineDate(due),
        actionUrl: toAbsoluteAppUrl(`/actions/${item.id}`),
      };

      if (item.status === "OVERDUE" || dueDay < today) {
        bucket.overdue.push(row);
      } else if (dueDay < weekEnd) {
        bucket.dueThisWeek.push(row);
      } else {
        bucket.upcoming.push(row);
      }
    }
  }

  let emailsSent = 0;
  for (const bucket of perRecipient.values()) {
    const sent = await sendOnce({
      dedupeKey: `digest:${weekKey}:${bucket.user.id}`,
      type: "WEEKLY_DIGEST",
      recipientId: bucket.user.id,
      actionItemId: null,
      send: () =>
        sendWeeklyActionDigestEmail({
          to: bucket.user.email as string,
          recipientName: bucket.user.name,
          groups: {
            overdue: bucket.overdue,
            dueThisWeek: bucket.dueThisWeek,
            upcoming: bucket.upcoming,
          },
          myActionsUrl,
        }),
    });
    if (sent) emailsSent++;
  }

  logger.info(
    { recipients: perRecipient.size, emailsSent, weekKey },
    "action-cron: weekly digest"
  );
  return { recipients: perRecipient.size, emailsSent };
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
    const flagToCpoUrl = toAbsoluteAppUrl(`/actions/${item.id}#flag-to-cpo`);
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
            department: item.department.name,
            actionTitle: item.title,
            deadline,
            updateStatusUrl,
            flagToCpoUrl,
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
    const flagToCpoUrl = toAbsoluteAppUrl(`/actions/${item.id}#flag-to-cpo`);
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
            department: item.department.name,
            actionTitle: item.title,
            deadline,
            updateStatusUrl,
            flagToCpoUrl,
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
            department: item.department.name,
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

// ── 4. CPO escalation (daily) ───────────────────────────────────────────────

export type CpoEscalationResult = {
  /** Items eligible (flagged/overdue 48h+, unresolved, not yet escalated). */
  eligible: number;
  /** Items newly marked `escalatedToCpoAt` this run. */
  itemsEscalated: number;
  /** CPO/Board notification emails actually sent this run. */
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
  department: { name: string };
  lead: LoadedRecipient | null;
};

/** Unresolved items not yet escalated that are flagged or OVERDUE. */
async function loadEscalationCandidates(): Promise<EscalationCandidate[]> {
  return prisma.actionItem.findMany({
    where: {
      resolvedAt: null,
      escalatedToCpoAt: null,
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

/** CPO / Board recipients (ADMIN + AdminSubtype CPO or SUPER_ADMIN) with email. */
async function loadCpoRecipients(): Promise<LoadedRecipient[]> {
  return prisma.user.findMany({
    where: {
      archivedAt: null,
      adminSubtypes: { some: { subtype: { in: ["CPO", "SUPER_ADMIN"] } } },
    },
    select: { id: true, name: true, email: true },
  });
}

/**
 * Escalate flagged/OVERDUE items that have been unresolved for 48h+ to the CPO.
 *
 * For each eligible item the CPO/Board are notified exactly once: `sendOnce`
 * dedupes per (item, recipient) via `ActionEmailLog`, and the item is then
 * marked `escalatedToCpoAt` with a race-safe conditional update so retries or
 * overlapping runs never double-escalate. Items are only marked when at least
 * one CPO recipient exists, so the escalation re-fires for a later run if no
 * CPO/Board user is configured yet. No-op unless ENABLE_ACTION_TRACKER_EMAILS.
 */
export async function runCpoEscalations(now: Date): Promise<CpoEscalationResult> {
  if (!isActionTrackerEmailsEnabled())
    return { eligible: 0, itemsEscalated: 0, emailsSent: 0 };

  const candidates = await loadEscalationCandidates();
  const eligible = candidates.filter((item) => isEscalationEligible(item, now));
  if (eligible.length === 0) {
    logger.info({ eligible: 0 }, "action-cron: cpo escalation");
    return { eligible: 0, itemsEscalated: 0, emailsSent: 0 };
  }

  const recipients = (await loadCpoRecipients()).filter((r) => r.email);
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

    for (const cpo of recipients) {
      const sent = await sendOnce({
        dedupeKey: `escalation:${item.id}:${cpo.id}`,
        type: "CPO_ESCALATION",
        recipientId: cpo.id,
        actionItemId: item.id,
        send: () =>
          sendCpoEscalationEmail({
            to: cpo.email as string,
            recipientName: cpo.name,
            actionTitle: item.title,
            department: item.department.name,
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
    // with no configured CPO/Board recipient stays eligible for a later run.
    if (recipients.length > 0) {
      const updated = await prisma.actionItem.updateMany({
        where: { id: item.id, escalatedToCpoAt: null },
        data: { escalatedToCpoAt: now },
      });
      if (updated.count > 0) itemsEscalated++;
    }
  }

  logger.info(
    { eligible: eligible.length, itemsEscalated, emailsSent, recipients: recipients.length },
    "action-cron: cpo escalation"
  );
  return { eligible: eligible.length, itemsEscalated, emailsSent };
}
