"use server";

/**
 * Weekly Impact form server actions. A person edits their own entry; admins may
 * edit anyone's. Curation flags (presentToMeeting / decisionNeeded / sendToBoard)
 * are what surface a row in a meeting's Impact Presentations table + Board roll-up.
 */
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { canEditImpactEntry, requireImpactAuthor } from "./permissions";
import { requireChapterManager } from "@/lib/chapters/access";
import { captureChapterKpiSnapshot } from "@/lib/chapters/snapshot-capture";
import {
  AddRowFromContributionSchema,
  AddRowSchema,
  EntryIdSchema,
  RowIdSchema,
  SaveEntrySchema,
  UpdateRowSchema,
} from "./schemas";

async function loadEntryForRow(rowId: string) {
  const row = await prisma.weeklyImpactRow.findUnique({
    where: { id: rowId },
    include: { entry: { select: { id: true, userId: true, status: true } } },
  });
  if (!row) throw new Error("Row not found");
  return row;
}

export async function saveImpactEntry(input: unknown) {
  const viewer = await requireImpactAuthor();
  const data = SaveEntrySchema.parse(input);
  const entry = await prisma.weeklyImpactEntry.findUnique({
    where: { id: data.entryId },
    select: { userId: true },
  });
  if (!entry) throw new Error("Entry not found");
  if (!canEditImpactEntry(viewer, entry.userId)) throw new Error("Unauthorized");

  await prisma.weeklyImpactEntry.update({
    where: { id: data.entryId },
    data: { inputNeeded: data.inputNeeded },
  });
  revalidatePath("/my-weekly-impact");
  return { ok: true };
}

export async function addImpactRow(input: unknown) {
  const viewer = await requireImpactAuthor();
  const { entryId } = AddRowSchema.parse(input);
  const entry = await prisma.weeklyImpactEntry.findUnique({
    where: { id: entryId },
    select: { userId: true },
  });
  if (!entry) throw new Error("Entry not found");
  if (!canEditImpactEntry(viewer, entry.userId)) throw new Error("Unauthorized");

  const max = await prisma.weeklyImpactRow.aggregate({
    where: { entryId },
    _max: { sortOrder: true },
  });
  const row = await prisma.weeklyImpactRow.create({
    data: { entryId, sortOrder: (max._max.sortOrder ?? -1) + 1 },
  });
  revalidatePath("/my-weekly-impact");
  return { ok: true, id: row.id };
}

export async function addImpactRowFromContribution(input: unknown) {
  const viewer = await requireImpactAuthor();
  const data = AddRowFromContributionSchema.parse(input);
  const entry = await prisma.weeklyImpactEntry.findUnique({
    where: { id: data.entryId },
    select: { userId: true },
  });
  if (!entry) throw new Error("Entry not found");
  if (!canEditImpactEntry(viewer, entry.userId)) throw new Error("Unauthorized");

  const max = await prisma.weeklyImpactRow.aggregate({
    where: { entryId: data.entryId },
    _max: { sortOrder: true },
  });
  await prisma.weeklyImpactRow.create({
    data: {
      entryId: data.entryId,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
      type: data.type,
      whatGoal: data.whatGoal,
      evidenceNext: data.evidenceNext,
      rowStatus: "DONE",
    },
  });
  revalidatePath("/my-weekly-impact");
  return { ok: true };
}

export async function updateImpactRow(input: unknown) {
  const viewer = await requireImpactAuthor();
  const data = UpdateRowSchema.parse(input);
  const row = await loadEntryForRow(data.rowId);
  if (!canEditImpactEntry(viewer, row.entry.userId)) throw new Error("Unauthorized");

  await prisma.weeklyImpactRow.update({
    where: { id: data.rowId },
    data: {
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.whatGoal !== undefined ? { whatGoal: data.whatGoal } : {}),
      ...(data.evidenceNext !== undefined ? { evidenceNext: data.evidenceNext } : {}),
      ...(data.due !== undefined ? { due: data.due } : {}),
      ...(data.rowStatus !== undefined ? { rowStatus: data.rowStatus } : {}),
      ...(data.presentToMeeting !== undefined ? { presentToMeeting: data.presentToMeeting } : {}),
      ...(data.decisionNeeded !== undefined ? { decisionNeeded: data.decisionNeeded } : {}),
      ...(data.sendToBoard !== undefined ? { sendToBoard: data.sendToBoard } : {}),
    },
  });
  revalidatePath("/my-weekly-impact");
  return { ok: true };
}

export async function deleteImpactRow(input: unknown) {
  const viewer = await requireImpactAuthor();
  const { rowId } = RowIdSchema.parse(input);
  const row = await loadEntryForRow(rowId);
  if (!canEditImpactEntry(viewer, row.entry.userId)) throw new Error("Unauthorized");
  await prisma.weeklyImpactRow.delete({ where: { id: rowId } });
  revalidatePath("/my-weekly-impact");
  return { ok: true };
}

export async function submitImpactEntry(input: unknown) {
  const viewer = await requireImpactAuthor();
  const { entryId } = EntryIdSchema.parse(input);
  const entry = await prisma.weeklyImpactEntry.findUnique({
    where: { id: entryId },
    select: { userId: true, chapterId: true, weekStart: true, rows: { select: { id: true } } },
  });
  if (!entry) throw new Error("Entry not found");
  if (!canEditImpactEntry(viewer, entry.userId)) throw new Error("Unauthorized");
  if (entry.rows.length === 0) {
    return { ok: false, error: "Add at least one row before submitting." };
  }
  await prisma.weeklyImpactEntry.update({
    where: { id: entryId },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });
  revalidatePath("/my-weekly-impact");

  // Auto-capture the Chapter Growth KPI snapshot for the same reporting week, so
  // the weekly meeting record and the measured baseline are captured together
  // (no separate manual "Save snapshot" step). Best-effort + chapter-scoped:
  // only when this is a chapter entry the submitter actually manages, and never
  // allowed to block the submission itself.
  if (entry.chapterId) {
    const chapterId = entry.chapterId;
    try {
      await requireChapterManager(chapterId);
      await captureChapterKpiSnapshot(chapterId, entry.weekStart);
      revalidatePath("/chapter/operating");
    } catch {
      // not a chapter the submitter manages, or a transient snapshot error
    }
  }

  return { ok: true };
}

export async function reopenImpactEntry(input: unknown) {
  const viewer = await requireImpactAuthor();
  const { entryId } = EntryIdSchema.parse(input);
  const entry = await prisma.weeklyImpactEntry.findUnique({
    where: { id: entryId },
    select: { userId: true },
  });
  if (!entry) throw new Error("Entry not found");
  if (!canEditImpactEntry(viewer, entry.userId)) throw new Error("Unauthorized");
  await prisma.weeklyImpactEntry.update({
    where: { id: entryId },
    data: { status: "DRAFT", submittedAt: null },
  });
  revalidatePath("/my-weekly-impact");
  return { ok: true };
}
