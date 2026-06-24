// Provisioning: when a Chapter President is approved, the chapter is set up
// automatically — president linked, application data flowed into the chapter's
// setup fields (no re-entry), lifecycle moved to LAUNCHING, and the launch
// checklist seeded as LaunchTask rows (with real ActionItems for the action-y
// items). Designed to run inside the CP-approval transaction.

import type { Prisma, PrismaClient } from "@prisma/client";
import { LAUNCH_CHECKLIST } from "@/lib/chapters/launch-checklist";
import { createChapterActionItem } from "@/lib/chapters/action-bridge";

type Db = PrismaClient | Prisma.TransactionClient;

const DAY_MS = 24 * 60 * 60 * 1000;

export type ChecklistMeta = { key: string | null; actionItemId: string | null };

/** Read the {key, actionItemId} we stash on each chapter LaunchTask's metadata. */
export function readChecklistMeta(metadata: Prisma.JsonValue | null | undefined): ChecklistMeta {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const obj = metadata as Record<string, unknown>;
    return {
      key: typeof obj.key === "string" ? obj.key : null,
      actionItemId: typeof obj.actionItemId === "string" ? obj.actionItemId : null,
    };
  }
  return { key: null, actionItemId: null };
}

/**
 * Seed the canonical launch checklist for a chapter as LaunchTask rows. Idempotent:
 * items already present (matched by metadata.key) are skipped. Action-spawning
 * items also create a chapter ActionItem owned by the president.
 */
export async function seedChapterLaunchChecklist(
  db: Db,
  opts: {
    chapterId: string;
    presidentId: string | null;
    presidentName: string | null;
    actorId: string;
    startDate: Date;
  }
): Promise<void> {
  const existing = await db.launchTask.findMany({
    where: { chapterId: opts.chapterId, scope: "CHAPTER" },
    select: { metadata: true },
  });
  const existingKeys = new Set<string>();
  for (const row of existing) {
    const { key } = readChecklistMeta(row.metadata);
    if (key) existingKeys.add(key);
  }

  for (const item of LAUNCH_CHECKLIST) {
    if (existingKeys.has(item.key)) continue;

    const dueDate = new Date(opts.startDate.getTime() + item.dueInDays * DAY_MS);
    const ownerLabel =
      item.owner === "cp" ? opts.presidentName ?? "Chapter President" : "National leadership";
    const isConfirmCp = item.key === "confirm_cp";

    let actionItemId: string | null = null;
    if (item.spawnsAction && opts.presidentId) {
      const action = await createChapterActionItem(db, {
        chapterId: opts.chapterId,
        title: item.title,
        description: item.description,
        leadId: opts.presidentId,
        createdById: opts.actorId,
        deadlineStart: dueDate,
        goalCategory: "Chapter launch",
      });
      actionItemId = action.id;
    }

    const data: Prisma.LaunchTaskUncheckedCreateInput = {
      title: item.title,
      ownerLabel,
      dueDate,
      status: isConfirmCp ? "COMPLETE" : "NOT_STARTED",
      scope: "CHAPTER",
      chapterId: opts.chapterId,
      createdById: opts.actorId,
      sortOrder: item.order,
      isActive: true,
      metadata: { key: item.key, actionItemId } as Prisma.InputJsonObject,
    };
    await db.launchTask.create({ data });
  }
}

export type ApprovalApplicationData = {
  stateProvince: string | null;
  city: string | null;
  partnerSchool: string | null;
  schoolName: string | null;
  launchPlan: string | null;
};

export type ProvisionChapterInput = {
  chapter: {
    id: string;
    lifecycleStatus: string;
    state: string | null;
    city: string | null;
    partnerSchool: string | null;
    launchPlanText: string | null;
  };
  application: ApprovalApplicationData;
  presidentId: string;
  presidentName: string | null;
  actorId: string;
  now: Date;
};

/**
 * Link the approved president to the chapter, flow application data into empty
 * setup fields, and (for pre-launch chapters) move to LAUNCHING + seed the
 * checklist. Established (already-active) chapters keep their status and just get
 * the new president linked.
 */
export async function provisionChapterForApproval(
  db: Db,
  opts: ProvisionChapterInput
): Promise<{ launching: boolean }> {
  const { chapter, application } = opts;
  const willLaunch =
    chapter.lifecycleStatus === "PROSPECT" || chapter.lifecycleStatus === "APPROVED";

  const data: Prisma.ChapterUncheckedUpdateInput = { presidentId: opts.presidentId };
  // Fill empty setup fields from the application — never overwrite real data.
  if (!chapter.state && application.stateProvince) data.state = application.stateProvince;
  if (!chapter.city && application.city) data.city = application.city;
  if (!chapter.partnerSchool && (application.partnerSchool || application.schoolName)) {
    data.partnerSchool = application.partnerSchool || application.schoolName;
  }
  if (!chapter.launchPlanText && application.launchPlan) {
    data.launchPlanText = application.launchPlan;
  }
  if (willLaunch) {
    data.lifecycleStatus = "LAUNCHING";
    data.lifecycleUpdatedAt = opts.now;
  }

  await db.chapter.update({ where: { id: chapter.id }, data });

  if (willLaunch) {
    await seedChapterLaunchChecklist(db, {
      chapterId: chapter.id,
      presidentId: opts.presidentId,
      presidentName: opts.presidentName,
      actorId: opts.actorId,
      startDate: opts.now,
    });
  }

  return { launching: willLaunch };
}
