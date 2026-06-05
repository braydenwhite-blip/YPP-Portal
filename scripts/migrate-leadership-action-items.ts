import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/**
 * People Strategy Command Center — Phase 5 (consolidate trackers, plan §2 / §3
 * item 3). Migrate the legacy "Leadership Action Center" data
 * (`LeadershipActionItem` / `LeadershipMeeting`) into the canonical Action
 * Tracker family (`ActionItem` / `OfficerMeeting` / `ActionAssignment` /
 * `ActionComment`), so `/actions/*` becomes the single source of truth and the
 * legacy `/admin/action-center` surface can be retired.
 *
 * Why a deliberate operator script (not an auto-running Prisma migration):
 *  - The new `ActionItem` requires non-null `leadId` and `createdById` FKs,
 *    whereas the legacy `primaryOwnerId` / `createdById` are nullable, so the
 *    mapping is lossy and must be reviewed against real data before it runs.
 *  - Running it by hand lets an operator dry-run, eyeball the preview, and only
 *    then commit — far safer than a blind deploy-time data backfill.
 *
 * SAFETY / REVERSIBILITY:
 *  - Dry-run by default. Re-run with `--apply` to write.
 *  - Additive: it CREATES new ActionItem/OfficerMeeting rows; it never deletes
 *    legacy rows. On commit it ARCHIVES each migrated legacy row
 *    (`archivedAt = now`), which both preserves the original (reversible) and
 *    makes the script idempotent — re-runs only see `archivedAt: null` rows and
 *    so never double-migrate.
 *  - Only migrates legacy action items that carry BOTH a primary owner and a
 *    creator (the safely-mappable set). Unmappable rows are reported and left
 *    untouched for a human to triage.
 *
 * Usage:
 *   npx tsx scripts/migrate-leadership-action-items.ts            # dry run (preview)
 *   npx tsx scripts/migrate-leadership-action-items.ts --apply    # migrate + archive
 */

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const STATUS_MAP: Record<string, "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE" | "BLOCKED"> = {
  NOT_STARTED: "NOT_STARTED",
  IN_PROGRESS: "IN_PROGRESS",
  BLOCKED: "BLOCKED",
  COMPLETE: "COMPLETE",
};

const PRIORITY_MAP: Record<string, "LOW" | "MEDIUM" | "HIGH" | "URGENT"> = {
  LOW: "LOW",
  NORMAL: "MEDIUM",
  HIGH: "HIGH",
  URGENT: "URGENT",
};

const CATEGORY_LABELS: Record<string, string> = {
  INSTRUCTION: "Instruction",
  TECHNOLOGY: "Technology",
  COMMUNICATION: "Communication",
  STAFF_MANAGEMENT: "Staff Management",
};

async function main() {
  console.log(
    `\nLeadership Action Center → Action Tracker migration (${APPLY ? "APPLY" : "DRY RUN"})\n`
  );

  // 1. Meetings: LeadershipMeeting → OfficerMeeting -------------------------
  const legacyMeetings = await prisma.leadershipMeeting.findMany({
    where: { archivedAt: null },
  });

  /** legacy meeting id → new OfficerMeeting id */
  const meetingMap = new Map<string, string>();
  let meetingsMigrated = 0;

  for (const m of legacyMeetings) {
    const date = m.scheduledAt ?? m.createdAt;
    const status = m.scheduledAt && m.scheduledAt < new Date() ? "COMPLETED" : "SCHEDULED";
    const agendaText = `${m.title} (${m.kind})`;
    if (APPLY) {
      const created = await prisma.officerMeeting.create({
        data: { date, status, agendaText, summaryEmailText: m.notes ?? null },
      });
      meetingMap.set(m.id, created.id);
      await prisma.leadershipMeeting.update({
        where: { id: m.id },
        data: { archivedAt: new Date() },
      });
    }
    meetingsMigrated++;
    console.log(`  meeting  "${m.title}" → OfficerMeeting (${date.toISOString().slice(0, 10)})`);
  }

  // 2. Action items: LeadershipActionItem → ActionItem ----------------------
  const legacyItems = await prisma.leadershipActionItem.findMany({
    where: { archivedAt: null },
    include: {
      inputNeededFrom: { select: { userId: true } },
      updates: { where: { kind: "COMMENT" }, select: { authorId: true, body: true, createdAt: true } },
    },
  });

  let itemsMigrated = 0;
  let commentsCopied = 0;
  const skipped: Array<{ id: string; title: string; reason: string }> = [];

  for (const item of legacyItems) {
    if (!item.primaryOwnerId || !item.createdById) {
      skipped.push({
        id: item.id,
        title: item.title,
        reason: !item.primaryOwnerId ? "no primary owner" : "no creator",
      });
      continue;
    }

    const deadlineStart = item.dueDate ?? item.weekStart ?? item.createdAt;
    const status = STATUS_MAP[item.status] ?? "NOT_STARTED";
    const priority = PRIORITY_MAP[item.priority] ?? "MEDIUM";
    const goalCategory = CATEGORY_LABELS[item.category] ?? null;
    const officerMeetingId = item.meetingId ? meetingMap.get(item.meetingId) ?? null : null;

    // Assignments: LEAD = primary owner; INPUT = each distinct input user
    // (minus the lead, which already holds LEAD and is the implicit executor).
    const inputUserIds = Array.from(
      new Set(item.inputNeededFrom.map((i) => i.userId).filter((id) => id !== item.primaryOwnerId))
    );

    if (APPLY) {
      await prisma.actionItem.create({
        data: {
          title: item.title,
          description: item.description,
          goalCategory,
          status,
          priority,
          deadlineStart,
          completedAt: item.completedAt,
          visibility: "ALL_LEADERSHIP",
          leadId: item.primaryOwnerId,
          createdById: item.createdById,
          officerMeetingId,
          assignments: {
            create: [
              { userId: item.primaryOwnerId, role: "LEAD" },
              ...inputUserIds.map((userId) => ({ userId, role: "INPUT" as const })),
            ],
          },
          comments: {
            create: item.updates.map((u) => ({
              authorId: u.authorId,
              body: u.body,
              type: "NOTE" as const,
              createdAt: u.createdAt,
            })),
          },
        },
      });
      await prisma.leadershipActionItem.update({
        where: { id: item.id },
        data: { archivedAt: new Date() },
      });
    }

    itemsMigrated++;
    commentsCopied += item.updates.length;
    console.log(
      `  action   "${item.title}" → ActionItem (lead ${item.primaryOwnerId}, ${inputUserIds.length} input, ${item.updates.length} comments)`
    );
  }

  // 3. Summary --------------------------------------------------------------
  console.log("\nSummary");
  console.log(`  meetings migrated: ${meetingsMigrated}`);
  console.log(`  action items migrated: ${itemsMigrated}`);
  console.log(`  comments copied: ${commentsCopied}`);
  console.log(`  action items skipped (need manual triage): ${skipped.length}`);
  for (const s of skipped) console.log(`    - "${s.title}" (${s.reason}) [${s.id}]`);

  if (!APPLY) {
    console.log("\nDry run only — re-run with --apply to write these changes.\n");
  } else {
    console.log("\nDone. Legacy rows archived (reversible). Re-runs are idempotent.\n");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
