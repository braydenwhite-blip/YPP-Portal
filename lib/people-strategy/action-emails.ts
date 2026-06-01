import type { ActionAssignmentRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isActionTrackerEmailsEnabled } from "@/lib/feature-flags";
import {
  sendNewAssignmentEmail,
  type ActionAssignmentEmailRole,
} from "@/lib/email";
import { toAbsoluteAppUrl } from "@/lib/public-app-url";

/**
 * People Strategy — Action Tracker assignment emails.
 *
 * `notifyNewActionAssignments` sends exactly one "New Assignment" email per
 * genuinely-new ActionAssignment row. Callers are responsible for passing only
 * assignments that were actually created (not unchanged upserts), so editing an
 * unrelated field never resends an assignment email. The whole helper is a
 * no-op unless `ENABLE_ACTION_TRACKER_EMAILS=true`.
 *
 * Sending happens AFTER the DB write/commit so a failed email never rolls back
 * the assignment, and individual send failures are swallowed (logged) so one
 * bad address can't fail the surrounding server action.
 */

const EMAILABLE_ROLES: ReadonlySet<ActionAssignmentRole> = new Set([
  "LEAD",
  "EXECUTING",
  "INPUT",
]);

function formatDeadline(start: Date, end: Date | null): string {
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d);
  return end ? `${fmt(start)} - ${fmt(end)}` : fmt(start);
}

export async function notifyNewActionAssignments(
  actionItemId: string,
  assignments: Array<{ userId: string; role: ActionAssignmentRole }>
): Promise<void> {
  if (!isActionTrackerEmailsEnabled()) return;

  const emailable = assignments.filter((a) => EMAILABLE_ROLES.has(a.role));
  if (emailable.length === 0) return;

  const item = await prisma.actionItem.findUnique({
    where: { id: actionItemId },
    select: {
      title: true,
      deadlineStart: true,
      deadlineEnd: true,
      lead: { select: { name: true, email: true } },
    },
  });
  if (!item) return;

  const userIds = Array.from(new Set(emailable.map((a) => a.userId)));
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  const leadName = item.lead?.name || item.lead?.email || "your team lead";
  const deadline = formatDeadline(item.deadlineStart, item.deadlineEnd);
  const actionUrl = toAbsoluteAppUrl(`/actions/${actionItemId}`);

  for (const assignment of emailable) {
    const user = userById.get(assignment.userId);
    if (!user?.email) continue;

    try {
      await sendNewAssignmentEmail({
        to: user.email,
        recipientName: user.name,
        role: assignment.role as ActionAssignmentEmailRole,
        leadName,
        actionTitle: item.title,
        deadline,
        actionUrl,
      });
    } catch (error) {
      console.error(
        `[ActionTracker] Failed to send new assignment email to ${user.email}`,
        error
      );
    }
  }
}
