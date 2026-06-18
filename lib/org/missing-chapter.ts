import "server-only";

/**
 * Missing Chapter status + resolution (Phase 6 of
 * docs/ROLES_ACCESS_REVIEWS_MENTORSHIP_PLAN.md).
 *
 * When a record (instructor, class, partner, meeting, …) has no valid chapter,
 * flagging it: (1) records a MissingChapterFlag, (2) auto-creates an action led
 * by the configured Missing Chapter owner (Brayden by default — resolved by
 * email/config, never hardcoded into permission logic), and (3) surfaces it in
 * the Missing Chapter queue with its age. The record is not "fully set up" until
 * the flag is resolved.
 */

import { prisma } from "@/lib/prisma";
import { missingChapterAgeDays, formatMissingChapterAge } from "@/lib/org/missing-chapter-utils";

/** Default owner per the proposal; override per-deploy with MISSING_CHAPTER_OWNER_EMAIL. */
const DEFAULT_MISSING_CHAPTER_OWNER_EMAIL = "brayden.white@youthpassionproject.org";

/**
 * Resolve the user who owns Missing Chapter resolution. Tries the configured
 * email, then any Board-level (SUPER_ADMIN) user, else null.
 */
export async function getMissingChapterOwnerId(): Promise<string | null> {
  const email = (process.env.MISSING_CHAPTER_OWNER_EMAIL || DEFAULT_MISSING_CHAPTER_OWNER_EMAIL)
    .trim()
    .toLowerCase();

  const byEmail = email
    ? await prisma.user.findFirst({ where: { email }, select: { id: true } })
    : null;
  if (byEmail) return byEmail.id;

  const board = await prisma.user.findFirst({
    where: { adminSubtypes: { some: { subtype: "SUPER_ADMIN" } } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return board?.id ?? null;
}

async function createMissingChapterAction(
  ownerId: string,
  label: string,
  recordType: string,
  recordId: string
): Promise<string> {
  const action = await prisma.actionItem.create({
    data: {
      title: `Assign a chapter to ${label}`,
      description: `${label} (${recordType}) is in Missing Chapter status and needs a chapter assignment before it is fully set up.`,
      status: "NOT_STARTED",
      priority: "HIGH",
      deadlineStart: new Date(),
      visibility: "ALL_LEADERSHIP",
      leadId: ownerId,
      createdById: ownerId,
      sourceType: "ENTITY",
      relatedEntityType: recordType,
      relatedEntityId: recordId,
      assignments: { create: [{ userId: ownerId, role: "LEAD" }] },
    },
    select: { id: true },
  });
  return action.id;
}

export interface FlagMissingChapterInput {
  recordType: string;
  recordId: string;
  label: string;
  actorId?: string | null;
}

/**
 * Flag a record as Missing Chapter. Idempotent on (recordType, recordId): an
 * existing unresolved flag is returned as-is; a resolved one is reopened. The
 * owner action is created once.
 */
export async function flagMissingChapter(
  input: FlagMissingChapterInput
): Promise<{ id: string; actionItemId: string | null }> {
  const ownerId = await getMissingChapterOwnerId();

  const existing = await prisma.missingChapterFlag.findUnique({
    where: { recordType_recordId: { recordType: input.recordType, recordId: input.recordId } },
    select: { id: true, actionItemId: true, resolvedAt: true },
  });

  if (existing) {
    // Reopen if it had been resolved; ensure an owner action exists.
    const actionItemId =
      existing.actionItemId ??
      (ownerId ? await createMissingChapterAction(ownerId, input.label, input.recordType, input.recordId) : null);
    await prisma.missingChapterFlag.update({
      where: { id: existing.id },
      data: {
        label: input.label,
        resolvedAt: null,
        resolvedById: null,
        actionItemId,
      },
    });
    return { id: existing.id, actionItemId };
  }

  const actionItemId = ownerId
    ? await createMissingChapterAction(ownerId, input.label, input.recordType, input.recordId)
    : null;

  const flag = await prisma.missingChapterFlag.create({
    data: {
      recordType: input.recordType,
      recordId: input.recordId,
      label: input.label,
      actionItemId,
      createdById: input.actorId ?? null,
    },
    select: { id: true },
  });
  return { id: flag.id, actionItemId };
}

export interface ResolveMissingChapterInput {
  recordType: string;
  recordId: string;
  resolvedById?: string | null;
}

/** Mark a record's Missing Chapter status resolved and complete its owner action. */
export async function resolveMissingChapter(
  input: ResolveMissingChapterInput
): Promise<{ resolved: boolean }> {
  const flag = await prisma.missingChapterFlag.findUnique({
    where: { recordType_recordId: { recordType: input.recordType, recordId: input.recordId } },
    select: { id: true, actionItemId: true, resolvedAt: true },
  });
  if (!flag || flag.resolvedAt) return { resolved: false };

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.missingChapterFlag.update({
      where: { id: flag.id },
      data: { resolvedAt: now, resolvedById: input.resolvedById ?? null },
    });
    if (flag.actionItemId) {
      await tx.actionItem.update({
        where: { id: flag.actionItemId },
        data: { status: "COMPLETE", completedAt: now },
      });
    }
  });
  return { resolved: true };
}

/** True when the record has no unresolved Missing Chapter flag (fully set up). */
export async function isRecordFullySetUp(recordType: string, recordId: string): Promise<boolean> {
  const flag = await prisma.missingChapterFlag.findUnique({
    where: { recordType_recordId: { recordType, recordId } },
    select: { resolvedAt: true },
  });
  return !flag || flag.resolvedAt !== null;
}

export interface MissingChapterQueueRow {
  id: string;
  recordType: string;
  recordId: string;
  label: string;
  actionItemId: string | null;
  ageDays: number;
  ageLabel: string;
  createdAt: Date;
}

/** The Missing Chapter resolution queue — unresolved flags, oldest first. */
export async function getMissingChapterQueue(now: Date = new Date()): Promise<MissingChapterQueueRow[]> {
  const flags = await prisma.missingChapterFlag.findMany({
    where: { resolvedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      recordType: true,
      recordId: true,
      label: true,
      actionItemId: true,
      createdAt: true,
    },
  });

  return flags.map((f) => ({
    id: f.id,
    recordType: f.recordType,
    recordId: f.recordId,
    label: f.label,
    actionItemId: f.actionItemId,
    ageDays: missingChapterAgeDays(f.createdAt, now),
    ageLabel: formatMissingChapterAge(f.createdAt, now),
    createdAt: f.createdAt,
  }));
}
