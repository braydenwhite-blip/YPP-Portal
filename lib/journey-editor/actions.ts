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
