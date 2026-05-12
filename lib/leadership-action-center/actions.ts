"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireLeadershipManager } from "./authorization";
import { CATEGORY_VALUES, MEETING_KIND_VALUES, PRIORITY_VALUES, STATUS_VALUES } from "./constants";
import { parseDateInput, startOfDay } from "./dates";
import { findDuplicateRows, parseSpreadsheetInput, type ColumnMap } from "./import";

const ACTION_CENTER_PATHS = [
  "/admin/action-center",
  "/admin/action-center/tasks",
  "/admin/action-center/weekly",
  "/admin/action-center/meetings",
];

function revalidateAll() {
  for (const path of ACTION_CENTER_PATHS) {
    revalidatePath(path);
  }
}

const NonEmptyString = z.string().trim().min(1);
const OptionalString = z
  .string()
  .trim()
  .max(5000)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null));
const OptionalDateString = z
  .string()
  .optional()
  .transform((v) => parseDateInput(v ?? ""));
const StringList = z
  .array(z.string().trim().min(1))
  .max(20)
  .optional()
  .transform((v) => v ?? []);

const CreateActionItemSchema = z.object({
  title: NonEmptyString,
  description: OptionalString,
  category: z.enum(CATEGORY_VALUES as [string, ...string[]]),
  status: z.enum(STATUS_VALUES as [string, ...string[]]).default("NOT_STARTED"),
  priority: z.enum(PRIORITY_VALUES as [string, ...string[]]).default("NORMAL"),
  dueDate: OptionalDateString,
  weekStart: OptionalDateString,
  needsOfficerDiscussion: z.boolean().default(false),
  officerDiscussionDate: OptionalDateString,
  meetingId: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : null)),
  primaryOwnerId: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : null)),
  ownerNames: StringList,
  inputNeededNames: StringList,
  inputNeededUserIds: StringList,
  notes: OptionalString,
});

export type CreateActionItemInput = z.input<typeof CreateActionItemSchema>;

export async function createActionItem(input: CreateActionItemInput) {
  const session = await requireLeadershipManager();
  const data = CreateActionItemSchema.parse(input);

  const created = await prisma.leadershipActionItem.create({
    data: {
      title: data.title,
      description: data.description,
      category: data.category as never,
      status: data.status as never,
      priority: data.priority as never,
      dueDate: data.dueDate,
      weekStart: data.weekStart ? startOfDay(data.weekStart) : null,
      needsOfficerDiscussion: data.needsOfficerDiscussion,
      officerDiscussionDate: data.officerDiscussionDate,
      meetingId: data.meetingId,
      primaryOwnerId: data.primaryOwnerId,
      ownerNames: data.ownerNames,
      inputNeededNames: data.inputNeededNames,
      notes: data.notes,
      createdById: session.userId,
      updatedById: session.userId,
      completedAt: data.status === "COMPLETE" ? new Date() : null,
      inputNeededFrom:
        data.inputNeededUserIds.length > 0
          ? {
              create: data.inputNeededUserIds.map((userId) => ({ userId })),
            }
          : undefined,
      updates: {
        create: {
          authorId: session.userId,
          kind: "CREATED",
          body: "Task created",
        },
      },
    },
  });

  revalidateAll();
  return { id: created.id };
}

const UpdateActionItemSchema = CreateActionItemSchema.partial().extend({
  id: NonEmptyString,
});

export type UpdateActionItemInput = z.input<typeof UpdateActionItemSchema>;

export async function updateActionItem(input: UpdateActionItemInput) {
  const session = await requireLeadershipManager();
  const data = UpdateActionItemSchema.parse(input);

  const existing = await prisma.leadershipActionItem.findUnique({
    where: { id: data.id },
    select: { status: true, primaryOwnerId: true, dueDate: true },
  });
  if (!existing) throw new Error("Action item not found");

  const newStatus = data.status ?? existing.status;
  const newOwner =
    data.primaryOwnerId === undefined ? existing.primaryOwnerId : data.primaryOwnerId;
  const newDueDate = data.dueDate === undefined ? existing.dueDate : data.dueDate;

  const updates: Array<{ kind: string; body: string }> = [];
  if (data.status && data.status !== existing.status) {
    updates.push({
      kind: "STATUS_CHANGE",
      body: `Status changed from ${existing.status} to ${data.status}`,
    });
  }
  if (data.primaryOwnerId !== undefined && data.primaryOwnerId !== existing.primaryOwnerId) {
    updates.push({
      kind: "ASSIGNEE_CHANGE",
      body: data.primaryOwnerId ? "Primary owner updated" : "Primary owner cleared",
    });
  }
  if (data.dueDate !== undefined && data.dueDate?.getTime() !== existing.dueDate?.getTime()) {
    updates.push({
      kind: "DEADLINE_CHANGE",
      body: data.dueDate ? `Deadline set to ${data.dueDate.toISOString().slice(0, 10)}` : "Deadline cleared",
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.leadershipActionItem.update({
      where: { id: data.id },
      data: {
        title: data.title,
        description: data.description,
        category: data.category as never,
        status: newStatus as never,
        priority: data.priority as never,
        dueDate: newDueDate,
        weekStart: data.weekStart ? startOfDay(data.weekStart) : data.weekStart,
        needsOfficerDiscussion: data.needsOfficerDiscussion,
        officerDiscussionDate: data.officerDiscussionDate,
        meetingId: data.meetingId,
        primaryOwnerId: newOwner,
        ownerNames: data.ownerNames,
        inputNeededNames: data.inputNeededNames,
        notes: data.notes,
        updatedById: session.userId,
        completedAt:
          newStatus === "COMPLETE"
            ? new Date()
            : data.status && data.status !== "COMPLETE"
              ? null
              : undefined,
      },
    });

    if (data.inputNeededUserIds !== undefined) {
      await tx.leadershipActionItemInput.deleteMany({ where: { actionItemId: data.id } });
      if (data.inputNeededUserIds.length > 0) {
        await tx.leadershipActionItemInput.createMany({
          data: data.inputNeededUserIds.map((userId) => ({ actionItemId: data.id, userId })),
          skipDuplicates: true,
        });
      }
    }

    for (const update of updates) {
      await tx.leadershipActionItemUpdate.create({
        data: {
          actionItemId: data.id,
          authorId: session.userId,
          kind: update.kind as never,
          body: update.body,
        },
      });
    }
  });

  revalidateAll();
}

const QuickStatusSchema = z.object({
  id: NonEmptyString,
  status: z.enum(STATUS_VALUES as [string, ...string[]]),
});

export async function quickUpdateStatus(input: z.input<typeof QuickStatusSchema>) {
  await updateActionItem({ id: input.id, status: input.status });
}

const CommentSchema = z.object({
  id: NonEmptyString,
  body: NonEmptyString.max(2000),
});

export async function addActionItemComment(input: z.input<typeof CommentSchema>) {
  const session = await requireLeadershipManager();
  const data = CommentSchema.parse(input);
  await prisma.leadershipActionItemUpdate.create({
    data: {
      actionItemId: data.id,
      authorId: session.userId,
      kind: "COMMENT",
      body: data.body,
    },
  });
  revalidateAll();
}

export async function archiveActionItem(input: { id: string }) {
  await requireLeadershipManager();
  if (!input.id) throw new Error("id required");
  await prisma.leadershipActionItem.update({
    where: { id: input.id },
    data: { archivedAt: new Date() },
  });
  revalidateAll();
}

export async function restoreActionItem(input: { id: string }) {
  await requireLeadershipManager();
  if (!input.id) throw new Error("id required");
  await prisma.leadershipActionItem.update({
    where: { id: input.id },
    data: { archivedAt: null },
  });
  revalidateAll();
}

const MeetingSchema = z.object({
  title: NonEmptyString,
  kind: z.enum(MEETING_KIND_VALUES as [string, ...string[]]).default("OFFICERS"),
  scheduledAt: z
    .string()
    .optional()
    .transform((v) => {
      if (!v || !v.trim()) return null;
      const parsed = new Date(v);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }),
  notes: OptionalString,
  ownerId: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : null)),
});

export type CreateMeetingInput = z.input<typeof MeetingSchema>;

export async function createMeeting(input: CreateMeetingInput) {
  await requireLeadershipManager();
  const data = MeetingSchema.parse(input);
  const created = await prisma.leadershipMeeting.create({
    data: {
      title: data.title,
      kind: data.kind as never,
      scheduledAt: data.scheduledAt,
      notes: data.notes,
      ownerId: data.ownerId,
    },
  });
  revalidateAll();
  return { id: created.id };
}

const UpdateMeetingSchema = MeetingSchema.partial().extend({ id: NonEmptyString });
export type UpdateMeetingInput = z.input<typeof UpdateMeetingSchema>;

export async function updateMeeting(input: UpdateMeetingInput) {
  await requireLeadershipManager();
  const data = UpdateMeetingSchema.parse(input);
  await prisma.leadershipMeeting.update({
    where: { id: data.id },
    data: {
      title: data.title,
      kind: data.kind as never,
      scheduledAt: data.scheduledAt,
      notes: data.notes,
      ownerId: data.ownerId,
    },
  });
  revalidateAll();
}

export async function archiveMeeting(input: { id: string }) {
  await requireLeadershipManager();
  if (!input.id) throw new Error("id required");
  await prisma.leadershipMeeting.update({
    where: { id: input.id },
    data: { archivedAt: new Date() },
  });
  revalidateAll();
}

const ImportSchema = z.object({
  raw: z.string().min(1).max(200_000),
  rowsToImport: z.array(z.number().int().positive()).optional(),
  defaultMeetingId: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : null)),
  defaultWeekStart: OptionalDateString,
  source: z.enum(["SPREADSHEET", "EMAIL", "IMPORT"]).default("SPREADSHEET"),
});

export type ImportInput = z.input<typeof ImportSchema>;

/**
 * Pure preview — does not write to the DB. Returns the parsed rows + a list
 * of rows that look like duplicates of existing items so the admin can
 * de-select them before saving.
 */
export async function previewImport(input: { raw: string }) {
  await requireLeadershipManager();
  const parsed = parseSpreadsheetInput(input.raw);
  const existing = await prisma.leadershipActionItem.findMany({
    where: { archivedAt: null },
    select: { title: true, dueDate: true, category: true },
  });
  const duplicates = findDuplicateRows(parsed.rows, existing);

  return {
    headers: parsed.headers,
    columnMap: parsed.columnMap,
    rows: parsed.rows,
    skipped: parsed.skipped,
    duplicateRowNumbers: Array.from(duplicates),
  };
}

export async function commitImport(input: ImportInput) {
  const session = await requireLeadershipManager();
  const data = ImportSchema.parse(input);
  const parsed = parseSpreadsheetInput(data.raw);

  const selectedRows = data.rowsToImport
    ? parsed.rows.filter((row) => data.rowsToImport!.includes(row.rowNumber))
    : parsed.rows;

  if (selectedRows.length === 0) {
    return { created: 0 };
  }

  await prisma.$transaction(async (tx) => {
    for (const row of selectedRows) {
      await tx.leadershipActionItem.create({
        data: {
          title: row.title,
          category: row.category,
          status: row.status,
          dueDate: row.dueDate,
          weekStart: data.defaultWeekStart ? startOfDay(data.defaultWeekStart) : null,
          needsOfficerDiscussion: row.needsOfficerDiscussion,
          officerDiscussionDate: row.officerDiscussionDate,
          notes: row.notes,
          ownerNames: row.primaryOwnerName ? [row.primaryOwnerName] : [],
          inputNeededNames: row.inputNeededNames,
          source: data.source as never,
          sourceLabel: `Row ${row.rowNumber}`,
          meetingId: data.defaultMeetingId,
          createdById: session.userId,
          updatedById: session.userId,
          updates: {
            create: {
              authorId: session.userId,
              kind: "IMPORTED",
              body: `Imported from ${data.source.toLowerCase()} (row ${row.rowNumber})`,
            },
          },
        },
      });
    }
  });

  revalidateAll();
  return { created: selectedRows.length };
}
