"use server";

// Chapter OS Phase 3 — the two DIRECT room mutations a Chapter President can run
// from the operating surface. Everything else in the rooms is either the
// existing Track-as-Action bridge (`trackChapterBlocker`) or a deep link into an
// established workflow. Both actions are CP-scoped (requireChapterManager),
// zod-validated, and revalidate the operating surface.

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireChapterManager } from "@/lib/chapters/access";
import { weekStartFor, weekKey } from "@/lib/weekly-meetings/week";
import { kpiSnapshotToRow } from "@/lib/chapters/chapter-growth";
import { loadChapterOS } from "@/lib/chapters/chapter-os";
import { SaveSnapshotSchema, LogPartnerFollowUpSchema } from "@/lib/chapters/room-actions";

export type SaveSnapshotResult =
  | { ok: true; weekStartISO: string }
  | { ok: false; error: string };

/**
 * Persist this week's Chapter Growth KPI snapshot (upsert by chapter + week), so
 * next week has a real measured baseline instead of timestamp reconstruction.
 * Idempotent: re-saving the same week overwrites that week's row.
 */
export async function saveChapterKpiSnapshot(input: unknown): Promise<SaveSnapshotResult> {
  const parsed = SaveSnapshotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { chapterId } = parsed.data;

  try {
    await requireChapterManager(chapterId);
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const model = await loadChapterOS(chapterId);
  if (!model) return { ok: false, error: "Chapter not found" };

  const weekStart = weekStartFor(new Date());
  const row = kpiSnapshotToRow(model.growth.current);

  try {
    await prisma.chapterWeeklyKpiSnapshot.upsert({
      where: { chapterId_weekStart: { chapterId, weekStart } },
      create: { chapterId, weekStart, ...row },
      update: row,
    });
  } catch {
    return { ok: false, error: "Could not save snapshot" };
  }

  revalidatePath("/chapter/operating");
  return { ok: true, weekStartISO: weekKey(weekStart) };
}

export type LogFollowUpResult = { ok: true } | { ok: false; error: string };

/**
 * Log a partner follow-up touchpoint from the Partner Network room: writes a
 * FOLLOW_UP PartnerNote, stamps lastContactedAt, and optionally sets the next
 * follow-up date. CP-scoped and verifies the partner belongs to this chapter
 * (the portal-wide partner actions are admin-only; this is the CP-safe path).
 */
export async function logPartnerFollowUp(input: unknown): Promise<LogFollowUpResult> {
  const parsed = LogPartnerFollowUpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { chapterId, partnerId, note, nextFollowUpAt } = parsed.data;

  let viewer;
  try {
    viewer = await requireChapterManager(chapterId);
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { chapterId: true },
  });
  if (!partner || partner.chapterId !== chapterId) {
    return { ok: false, error: "Partner not in this chapter" };
  }

  const next = nextFollowUpAt ? new Date(nextFollowUpAt) : null;

  try {
    await prisma.$transaction([
      prisma.partnerNote.create({
        data: { partnerId, authorId: viewer.user.id, kind: "FOLLOW_UP", body: note },
      }),
      prisma.partner.update({
        where: { id: partnerId },
        data: { lastContactedAt: new Date(), ...(next ? { nextFollowUpAt: next } : {}) },
      }),
    ]);
  } catch {
    return { ok: false, error: "Could not log follow-up" };
  }

  revalidatePath("/chapter/operating");
  revalidatePath(`/admin/partners/${partnerId}`);
  revalidatePath("/partners");
  return { ok: true };
}
