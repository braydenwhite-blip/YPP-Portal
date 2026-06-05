"use server";

/**
 * Server actions for editing the **live / prebuilt** interactive-journey content
 * that learners actually see.
 *
 * Background: every INTERACTIVE_JOURNEY TrainingModule owns one
 * `InteractiveJourney`, whose `InteractiveBeat` rows ARE the lesson content.
 * Those rows are authored in `lib/training-curriculum/*.ts` and imported via
 * `npm run training:import`. The learner runtime
 * (`app/(app)/training/[id]/page.tsx`) reads them directly by `journeyId`
 * (legacy beats have `journeyVersionId = null`).
 *
 * The Admin Journey Editor (`/admin/journeys`) only edits beats that belong to a
 * DRAFT `JourneyVersion` snapshot — a parallel system not yet wired to the
 * runtime. This module fills the gap: it lets an admin edit the prebuilt beats
 * in place, reusing the exact same Zod `configSchema` the importer + runtime use
 * so nothing can be saved that the player can't render.
 *
 * Edits here go LIVE immediately — there is no draft/publish cycle. Every action
 * therefore re-validates the kind's config schema and refuses to touch a beat
 * that belongs to a versioned draft (those have their own editor).
 */

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { requireJourneyEditor } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import {
  BEAT_CONFIG_SCHEMAS,
  BEAT_SCHEMA_VERSIONS,
} from "@/lib/training-journey/schemas";
import {
  BEAT_DEFAULTS,
  EDITOR_SUPPORTED_KINDS,
} from "@/lib/journey-editor/beat-defaults";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Refresh every surface that renders this module's content. */
function revalidateModule(moduleId: string | null): void {
  if (moduleId) {
    revalidatePath(`/admin/training/${moduleId}/content`);
    revalidatePath(`/training/${moduleId}`);
  }
  revalidatePath("/admin/training");
  revalidatePath("/instructor-training");
  revalidatePath("/student-training");
}

type LiveBeatContext = {
  id: string;
  kind: keyof typeof BEAT_CONFIG_SCHEMAS;
  config: unknown;
  moduleId: string | null;
};

/**
 * Load a beat and assert it is a *live* (prebuilt) beat — i.e. attached to an
 * InteractiveJourney directly, not to a versioned draft snapshot. Versioned
 * beats are edited through `/admin/journeys`.
 */
async function loadLiveBeat(
  tx: Prisma.TransactionClient,
  beatId: string,
): Promise<LiveBeatContext> {
  const beat = await tx.interactiveBeat.findUnique({
    where: { id: beatId },
    select: {
      id: true,
      kind: true,
      config: true,
      journeyVersionId: true,
      journey: { select: { moduleId: true } },
    },
  });
  if (!beat) {
    throw new Error("Beat not found.");
  }
  if (beat.journeyVersionId) {
    throw new Error(
      "This beat belongs to a versioned draft. Edit it from the Journeys editor instead.",
    );
  }
  return {
    id: beat.id,
    kind: beat.kind as LiveBeatContext["kind"],
    config: beat.config,
    moduleId: beat.journey?.moduleId ?? null,
  };
}

/** Reserve a sourceKey unique within the journey (including soft-removed rows,
 *  which keep their key under the `@@unique([journeyId, sourceKey])` index). */
async function reserveSourceKey(
  tx: Prisma.TransactionClient,
  journeyId: string,
  kind: string,
): Promise<string> {
  const base = `admin-${kind.toLowerCase().replace(/_/g, "-")}`;
  for (let i = 1; i < 1000; i += 1) {
    const candidate = `${base}-${i}`;
    const clash = await tx.interactiveBeat.findFirst({
      where: { journeyId, sourceKey: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  return `${base}-${Date.now()}`;
}

// ---------------------------------------------------------------------------
// Update a beat's content (title / prompt / scoring / config)
// ---------------------------------------------------------------------------

const UpdateLiveBeatInput = z.object({
  beatId: z.string().min(1),
  title: z.string().min(1, "Title is required.").optional(),
  prompt: z.string().min(1, "Prompt is required.").optional(),
  config: z.unknown().optional(),
  scoringWeight: z.number().int().min(0).max(100).optional(),
});

export type UpdateLiveBeatInput = z.infer<typeof UpdateLiveBeatInput>;

export async function updateLiveBeat(input: UpdateLiveBeatInput) {
  const editor = await requireJourneyEditor();
  if (!editor.canPublish) {
    throw new Error("Unauthorized — read-only reviewers cannot edit content.");
  }
  const parsed = UpdateLiveBeatInput.parse(input);

  const moduleId = await prisma.$transaction(async (tx) => {
    const beat = await loadLiveBeat(tx, parsed.beatId);

    if (parsed.config !== undefined) {
      const schema = BEAT_CONFIG_SCHEMAS[beat.kind];
      const result = schema.safeParse(parsed.config);
      if (!result.success) {
        throw new Error(
          `Invalid content for ${beat.kind}: ${result.error.issues
            .map((issue) => issue.message)
            .join("; ")}`,
        );
      }
    }

    await tx.interactiveBeat.update({
      where: { id: parsed.beatId },
      data: {
        ...(parsed.title !== undefined ? { title: parsed.title } : {}),
        ...(parsed.prompt !== undefined ? { prompt: parsed.prompt } : {}),
        ...(parsed.config !== undefined
          ? { config: parsed.config as Prisma.InputJsonValue }
          : {}),
        ...(parsed.scoringWeight !== undefined
          ? { scoringWeight: parsed.scoringWeight }
          : {}),
      },
    });

    return beat.moduleId;
  });

  revalidateModule(moduleId);
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Add a new beat to a live journey
// ---------------------------------------------------------------------------

const AddLiveBeatInput = z.object({
  journeyId: z.string().min(1),
  kind: z.enum(EDITOR_SUPPORTED_KINDS),
});

export type AddLiveBeatInput = z.infer<typeof AddLiveBeatInput>;

export async function addLiveBeat(input: AddLiveBeatInput) {
  const editor = await requireJourneyEditor();
  if (!editor.canPublish) {
    throw new Error("Unauthorized — read-only reviewers cannot add content.");
  }
  const parsed = AddLiveBeatInput.parse(input);

  const { beatId, moduleId } = await prisma.$transaction(async (tx) => {
    const journey = await tx.interactiveJourney.findUnique({
      where: { id: parsed.journeyId },
      select: { id: true, moduleId: true },
    });
    if (!journey) throw new Error("Journey not found.");

    const last = await tx.interactiveBeat.findFirst({
      where: { journeyId: parsed.journeyId, journeyVersionId: null },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const nextSortOrder = (last?.sortOrder ?? 0) + 1;

    const sourceKey = await reserveSourceKey(tx, parsed.journeyId, parsed.kind);
    const defaults = BEAT_DEFAULTS[parsed.kind];

    const created = await tx.interactiveBeat.create({
      data: {
        journeyId: parsed.journeyId,
        sourceKey,
        sortOrder: nextSortOrder,
        kind: parsed.kind,
        title: defaults.title,
        prompt: defaults.prompt,
        config: defaults.config as Prisma.InputJsonValue,
        schemaVersion: BEAT_SCHEMA_VERSIONS[parsed.kind],
        scoringWeight: defaults.scoringWeight,
      },
      select: { id: true },
    });

    return { beatId: created.id, moduleId: journey.moduleId };
  });

  revalidateModule(moduleId);
  return { beatId };
}

// ---------------------------------------------------------------------------
// Remove a beat (soft delete — runtime filters `removedAt: null`)
// ---------------------------------------------------------------------------

const RemoveLiveBeatInput = z.object({ beatId: z.string().min(1) });

export async function removeLiveBeat(input: z.infer<typeof RemoveLiveBeatInput>) {
  const editor = await requireJourneyEditor();
  if (!editor.canPublish) {
    throw new Error("Unauthorized — read-only reviewers cannot remove content.");
  }
  const parsed = RemoveLiveBeatInput.parse(input);

  const moduleId = await prisma.$transaction(async (tx) => {
    const beat = await loadLiveBeat(tx, parsed.beatId);
    await tx.interactiveBeat.update({
      where: { id: beat.id },
      data: { removedAt: new Date() },
    });
    return beat.moduleId;
  });

  revalidateModule(moduleId);
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Reorder the live beats of a journey
// ---------------------------------------------------------------------------

const ReorderLiveBeatsInput = z.object({
  journeyId: z.string().min(1),
  orderedBeatIds: z.array(z.string().min(1)).min(1),
});

export async function reorderLiveBeats(
  input: z.infer<typeof ReorderLiveBeatsInput>,
) {
  const editor = await requireJourneyEditor();
  if (!editor.canPublish) {
    throw new Error("Unauthorized — read-only reviewers cannot reorder content.");
  }
  const parsed = ReorderLiveBeatsInput.parse(input);

  const moduleId = await prisma.$transaction(async (tx) => {
    const journey = await tx.interactiveJourney.findUnique({
      where: { id: parsed.journeyId },
      select: { moduleId: true },
    });
    if (!journey) throw new Error("Journey not found.");

    const liveBeats = await tx.interactiveBeat.findMany({
      where: { journeyId: parsed.journeyId, journeyVersionId: null, removedAt: null },
      select: { id: true },
    });
    const liveIds = new Set(liveBeats.map((b) => b.id));
    if (
      parsed.orderedBeatIds.length !== liveIds.size ||
      parsed.orderedBeatIds.some((id) => !liveIds.has(id))
    ) {
      throw new Error(
        "The submitted order must contain exactly the live beats of this module.",
      );
    }

    // (journeyId, sortOrder) is a plain index (not unique) for live beats, so a
    // straight renumber is safe — no temp-offset shuffle needed.
    for (let i = 0; i < parsed.orderedBeatIds.length; i += 1) {
      await tx.interactiveBeat.update({
        where: { id: parsed.orderedBeatIds[i] },
        data: { sortOrder: i + 1 },
      });
    }

    return journey.moduleId;
  });

  revalidateModule(moduleId);
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Update journey-level settings (estimated time / pass score)
// ---------------------------------------------------------------------------

const UpdateJourneySettingsInput = z.object({
  journeyId: z.string().min(1),
  estimatedMinutes: z.number().int().min(0).max(600).optional(),
  passScorePct: z.number().int().min(0).max(100).optional(),
  strictMode: z.boolean().optional(),
});

export async function updateLiveJourneySettings(
  input: z.infer<typeof UpdateJourneySettingsInput>,
) {
  const editor = await requireJourneyEditor();
  if (!editor.canPublish) {
    throw new Error("Unauthorized — read-only reviewers cannot edit settings.");
  }
  const parsed = UpdateJourneySettingsInput.parse(input);

  const journey = await prisma.interactiveJourney.update({
    where: { id: parsed.journeyId },
    data: {
      ...(parsed.estimatedMinutes !== undefined
        ? { estimatedMinutes: parsed.estimatedMinutes }
        : {}),
      ...(parsed.passScorePct !== undefined
        ? { passScorePct: parsed.passScorePct }
        : {}),
      ...(parsed.strictMode !== undefined ? { strictMode: parsed.strictMode } : {}),
    },
    select: { moduleId: true },
  });

  revalidateModule(journey.moduleId);
  return { ok: true as const };
}
