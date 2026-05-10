"use server";

/**
 * Server actions for the Admin Journey Editor.
 *
 * Each action enforces `requireJourneyEditor()` and writes a JourneyAuditLog
 * row in the same transaction as its mutation. Actions intentionally start
 * minimal and grow per-commit:
 *
 *   - Commit 5 (this file): createJourney
 *   - Commit 6: updateJourneyMeta, createDraftFromPublished
 *   - Commit 7: addBeat, removeBeat, reorderBeats
 *   - Commit 8: updateDraftBeat
 *   - Commit 9: setGates
 *   - Commit 11: publishVersion, rollbackToVersion
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireJourneyEditor } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

const CreateJourneyInput = z.object({
  slug: z.string().regex(SLUG_RE, "Slug must be lowercase letters, digits, and hyphens."),
  title: z.string().min(3, "Title must be at least 3 characters."),
  description: z.string().optional().nullable(),
});

export type CreateJourneyInput = z.infer<typeof CreateJourneyInput>;

export async function createJourney(input: CreateJourneyInput) {
  const editor = await requireJourneyEditor();
  if (!editor.canPublish) {
    throw new Error("Unauthorized — read-only reviewers cannot create journeys.");
  }
  const parsed = CreateJourneyInput.parse(input);

  const journey = await prisma.$transaction(async (tx) => {
    const j = await tx.journey.create({
      data: {
        slug: parsed.slug,
        title: parsed.title,
        description: parsed.description ?? null,
      },
    });
    await tx.journeyVersion.create({
      data: {
        journeyId: j.id,
        versionNumber: 1,
        status: "DRAFT",
        estimatedMinutes: 0,
        passScorePct: 80,
        strictMode: false,
        createdById: editor.id,
      },
    });
    await tx.journeyAuditLog.create({
      data: {
        journeyId: j.id,
        actorId: editor.id,
        action: "CREATE",
        diff: { slug: parsed.slug, title: parsed.title } as object,
      },
    });
    return j;
  });

  revalidatePath("/admin/journeys");
  return { journeyId: journey.id, slug: journey.slug };
}

const UpdateJourneyMetaInput = z.object({
  journeyId: z.string().min(1),
  title: z.string().min(3),
  description: z.string().optional().nullable(),
  slug: z.string().regex(SLUG_RE),
});

export async function updateJourneyMeta(input: z.infer<typeof UpdateJourneyMetaInput>) {
  const editor = await requireJourneyEditor();
  if (!editor.canPublish) {
    throw new Error("Unauthorized — read-only reviewers cannot edit journey metadata.");
  }
  const parsed = UpdateJourneyMetaInput.parse(input);

  await prisma.$transaction(async (tx) => {
    const before = await tx.journey.findUnique({
      where: { id: parsed.journeyId },
      select: { id: true, slug: true, title: true, description: true },
    });
    if (!before) throw new Error("Journey not found.");

    await tx.journey.update({
      where: { id: parsed.journeyId },
      data: {
        slug: parsed.slug,
        title: parsed.title,
        description: parsed.description ?? null,
      },
    });

    await tx.journeyAuditLog.create({
      data: {
        journeyId: parsed.journeyId,
        actorId: editor.id,
        action: "UPDATE_META",
        diff: {
          before: {
            slug: before.slug,
            title: before.title,
            description: before.description,
          },
          after: {
            slug: parsed.slug,
            title: parsed.title,
            description: parsed.description ?? null,
          },
        } as object,
      },
    });
  });

  revalidatePath("/admin/journeys");
  revalidatePath(`/admin/journeys/${parsed.journeyId}`);
}

const CreateDraftFromPublishedInput = z.object({
  journeyId: z.string().min(1),
});

export async function createDraftFromPublished(
  input: z.infer<typeof CreateDraftFromPublishedInput>,
) {
  const editor = await requireJourneyEditor();
  if (!editor.canPublish) {
    throw new Error("Unauthorized — read-only reviewers cannot create drafts.");
  }
  const parsed = CreateDraftFromPublishedInput.parse(input);

  const draft = await prisma.$transaction(async (tx) => {
    // Re-use any existing DRAFT for this journey rather than creating a second.
    const existing = await tx.journeyVersion.findFirst({
      where: { journeyId: parsed.journeyId, status: "DRAFT" },
      orderBy: { versionNumber: "desc" },
    });
    if (existing) return existing;

    const latest = await tx.journeyVersion.findFirst({
      where: { journeyId: parsed.journeyId },
      orderBy: { versionNumber: "desc" },
    });

    const next = await tx.journeyVersion.create({
      data: {
        journeyId: parsed.journeyId,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        status: "DRAFT",
        estimatedMinutes: latest?.estimatedMinutes ?? 0,
        passScorePct: latest?.passScorePct ?? 80,
        strictMode: latest?.strictMode ?? false,
        moduleId: latest?.moduleId ?? null,
        createdById: editor.id,
      },
    });

    await tx.journeyAuditLog.create({
      data: {
        journeyId: parsed.journeyId,
        journeyVersionId: next.id,
        actorId: editor.id,
        action: "CREATE_DRAFT",
        diff: { fromVersion: latest?.versionNumber ?? null } as object,
      },
    });

    return next;
  });

  revalidatePath(`/admin/journeys/${parsed.journeyId}`);
  return { versionId: draft.id, versionNumber: draft.versionNumber };
}
