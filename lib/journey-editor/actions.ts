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
import { BEAT_CONFIG_SCHEMAS } from "@/lib/training-journey/schemas";

import { BEAT_DEFAULTS, EDITOR_SUPPORTED_KINDS } from "./beat-defaults";
import type {
  BeatDraft,
  GateDraft,
  JourneyAssignmentDraft,
  JourneyDraft,
} from "./types";
import { validateDraft } from "./validation";

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const SOURCE_KEY_RE = /^[a-z0-9][a-z0-9_\-]*$/;

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

// ============================================================================
// Beat mutations (DRAFT only)
// ============================================================================

const AddBeatInput = z.object({
  versionId: z.string().min(1),
  kind: z.enum(EDITOR_SUPPORTED_KINDS),
  sourceKey: z
    .string()
    .regex(SOURCE_KEY_RE, "sourceKey must be lowercase letters/digits/hyphens/underscores."),
});

export async function addBeat(input: z.infer<typeof AddBeatInput>) {
  const editor = await requireJourneyEditor();
  if (!editor.canPublish) throw new Error("Unauthorized.");
  const parsed = AddBeatInput.parse(input);

  return prisma.$transaction(async (tx) => {
    const version = await tx.journeyVersion.findUnique({
      where: { id: parsed.versionId },
      select: { id: true, journeyId: true, status: true },
    });
    if (!version) throw new Error("Version not found.");
    if (version.status !== "DRAFT") throw new Error("Cannot edit a non-DRAFT version.");

    const dup = await tx.interactiveBeat.findFirst({
      where: { journeyVersionId: parsed.versionId, sourceKey: parsed.sourceKey },
      select: { id: true },
    });
    if (dup) throw new Error(`A beat with sourceKey "${parsed.sourceKey}" already exists.`);

    const last = await tx.interactiveBeat.findFirst({
      where: { journeyVersionId: parsed.versionId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const nextSortOrder = (last?.sortOrder ?? 0) + 1;

    const defaults = BEAT_DEFAULTS[parsed.kind];

    // Insert via raw SQL because the legacy `journeyId` column is non-nullable.
    // Editor-only journeys have no sibling InteractiveJourney row; we satisfy
    // the FK by stamping `journeyId = journeyVersionId` (the runtime resolver
    // in Commit 12 reads via journeyVersionId, never the legacy column).
    const id = await tx.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO "InteractiveBeat" (
         "id","journeyId","journeyVersionId","sourceKey","sortOrder","kind",
         "title","prompt","config","schemaVersion","scoringWeight","createdAt","updatedAt"
       ) VALUES (
         gen_random_uuid()::text, $1, $1, $2, $3, $4::"InteractiveBeatKind",
         $5, $6, $7::jsonb, 1, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
       ) RETURNING "id"`,
      parsed.versionId,
      parsed.sourceKey,
      nextSortOrder,
      parsed.kind,
      defaults.title,
      defaults.prompt,
      JSON.stringify(defaults.config),
      defaults.scoringWeight,
    );

    await tx.journeyAuditLog.create({
      data: {
        journeyId: version.journeyId,
        journeyVersionId: version.id,
        actorId: editor.id,
        action: "ADD_BEAT",
        diff: { sourceKey: parsed.sourceKey, kind: parsed.kind } as object,
      },
    });

    revalidatePath(`/admin/journeys/${version.journeyId}`);
    return { beatId: id[0]?.id ?? null };
  });
}

const RemoveBeatInput = z.object({
  beatId: z.string().min(1),
});

export async function removeBeat(input: z.infer<typeof RemoveBeatInput>) {
  const editor = await requireJourneyEditor();
  if (!editor.canPublish) throw new Error("Unauthorized.");
  const parsed = RemoveBeatInput.parse(input);

  await prisma.$transaction(async (tx) => {
    const beat = await tx.interactiveBeat.findUnique({
      where: { id: parsed.beatId },
      select: {
        id: true,
        journeyVersionId: true,
        sourceKey: true,
        journeyVersion: { select: { journeyId: true, status: true } },
      },
    });
    if (!beat?.journeyVersionId || !beat.journeyVersion) {
      throw new Error("Beat not found or not part of an editor draft.");
    }
    if (beat.journeyVersion.status !== "DRAFT") {
      throw new Error("Cannot remove a beat from a non-DRAFT version.");
    }

    await tx.interactiveBeat.update({
      where: { id: beat.id },
      data: { removedAt: new Date() },
    });

    await tx.journeyAuditLog.create({
      data: {
        journeyId: beat.journeyVersion.journeyId,
        journeyVersionId: beat.journeyVersionId,
        actorId: editor.id,
        action: "REMOVE_BEAT",
        diff: { sourceKey: beat.sourceKey } as object,
      },
    });

    revalidatePath(`/admin/journeys/${beat.journeyVersion.journeyId}`);
  });
}

const ReorderBeatsInput = z.object({
  versionId: z.string().min(1),
  orderedBeatIds: z.array(z.string()).min(1),
});

export async function reorderBeats(input: z.infer<typeof ReorderBeatsInput>) {
  const editor = await requireJourneyEditor();
  if (!editor.canPublish) throw new Error("Unauthorized.");
  const parsed = ReorderBeatsInput.parse(input);

  await prisma.$transaction(async (tx) => {
    const version = await tx.journeyVersion.findUnique({
      where: { id: parsed.versionId },
      select: { id: true, journeyId: true, status: true },
    });
    if (!version) throw new Error("Version not found.");
    if (version.status !== "DRAFT") throw new Error("Cannot reorder a non-DRAFT version.");

    const liveBeats = await tx.interactiveBeat.findMany({
      where: { journeyVersionId: parsed.versionId, removedAt: null },
      select: { id: true },
    });
    const liveIds = new Set(liveBeats.map((b) => b.id));
    if (
      parsed.orderedBeatIds.length !== liveIds.size ||
      parsed.orderedBeatIds.some((id) => !liveIds.has(id))
    ) {
      throw new Error(
        "orderedBeatIds must contain exactly the live beats of this draft.",
      );
    }

    // Two-pass renumber to dodge the UNIQUE(journeyVersionId, sortOrder) index:
    // first move every beat to a high temporary range, then settle into 1..N.
    const TEMP_OFFSET = 100_000;
    for (let i = 0; i < parsed.orderedBeatIds.length; i += 1) {
      await tx.interactiveBeat.update({
        where: { id: parsed.orderedBeatIds[i] },
        data: { sortOrder: TEMP_OFFSET + i },
      });
    }
    for (let i = 0; i < parsed.orderedBeatIds.length; i += 1) {
      await tx.interactiveBeat.update({
        where: { id: parsed.orderedBeatIds[i] },
        data: { sortOrder: i + 1 },
      });
    }

    await tx.journeyAuditLog.create({
      data: {
        journeyId: version.journeyId,
        journeyVersionId: version.id,
        actorId: editor.id,
        action: "REORDER_BEATS",
        diff: { count: parsed.orderedBeatIds.length } as object,
      },
    });

    revalidatePath(`/admin/journeys/${version.journeyId}`);
  });
}

// ============================================================================
// Beat config update
// ============================================================================

const UpdateDraftBeatInput = z.object({
  beatId: z.string().min(1),
  title: z.string().min(1).optional(),
  prompt: z.string().min(1).optional(),
  config: z.unknown().optional(),
  scoringWeight: z.number().int().min(0).max(100).optional(),
});

export async function updateDraftBeat(input: z.infer<typeof UpdateDraftBeatInput>) {
  const editor = await requireJourneyEditor();
  if (!editor.canPublish) throw new Error("Unauthorized.");
  const parsed = UpdateDraftBeatInput.parse(input);

  await prisma.$transaction(async (tx) => {
    const beat = await tx.interactiveBeat.findUnique({
      where: { id: parsed.beatId },
      select: {
        id: true,
        kind: true,
        journeyVersionId: true,
        journeyVersion: { select: { journeyId: true, status: true } },
      },
    });
    if (!beat?.journeyVersionId || !beat.journeyVersion) {
      throw new Error("Beat not found or not part of an editor draft.");
    }
    if (beat.journeyVersion.status !== "DRAFT") {
      throw new Error("Cannot edit a non-DRAFT beat.");
    }

    if (parsed.config !== undefined) {
      const schema = BEAT_CONFIG_SCHEMAS[beat.kind];
      const result = schema.safeParse(parsed.config);
      if (!result.success) {
        throw new Error(
          `Invalid config for ${beat.kind}: ${result.error.issues.map((i) => i.message).join("; ")}`,
        );
      }
    }

    await tx.interactiveBeat.update({
      where: { id: parsed.beatId },
      data: {
        ...(parsed.title !== undefined ? { title: parsed.title } : {}),
        ...(parsed.prompt !== undefined ? { prompt: parsed.prompt } : {}),
        ...(parsed.config !== undefined
          ? { config: parsed.config as object }
          : {}),
        ...(parsed.scoringWeight !== undefined
          ? { scoringWeight: parsed.scoringWeight }
          : {}),
      },
    });

    await tx.journeyAuditLog.create({
      data: {
        journeyId: beat.journeyVersion.journeyId,
        journeyVersionId: beat.journeyVersionId,
        actorId: editor.id,
        action: "UPDATE_BEAT",
        diff: { beatId: parsed.beatId } as object,
      },
    });

    revalidatePath(`/admin/journeys/${beat.journeyVersion.journeyId}`);
  });
}

// ============================================================================
// Gates
// ============================================================================

const GateInput = z.object({
  kind: z.enum(["READINESS_CHECK", "BEAT_COMPLETE", "MODULE_COMPLETE", "SCORE_THRESHOLD"]),
  targetRef: z.string().regex(/^(beat|module):[A-Za-z0-9_\-]+$/),
  requiredRef: z.string().regex(/^(beat|module):[A-Za-z0-9_\-]+$/),
  threshold: z.number().int().min(0).max(100).nullable().optional(),
});

const SetGatesInput = z.object({
  versionId: z.string().min(1),
  gates: z.array(GateInput),
});

export async function setGates(input: z.infer<typeof SetGatesInput>) {
  const editor = await requireJourneyEditor();
  if (!editor.canPublish) throw new Error("Unauthorized.");
  const parsed = SetGatesInput.parse(input);

  await prisma.$transaction(async (tx) => {
    const version = await tx.journeyVersion.findUnique({
      where: { id: parsed.versionId },
      select: { id: true, journeyId: true, status: true },
    });
    if (!version) throw new Error("Version not found.");
    if (version.status !== "DRAFT") throw new Error("Cannot edit gates on a non-DRAFT version.");

    await tx.journeyGate.deleteMany({ where: { journeyVersionId: parsed.versionId } });
    if (parsed.gates.length > 0) {
      await tx.journeyGate.createMany({
        data: parsed.gates.map((g) => ({
          journeyVersionId: parsed.versionId,
          kind: g.kind,
          targetRef: g.targetRef,
          requiredRef: g.requiredRef,
          threshold: g.threshold ?? null,
        })),
      });
    }

    await tx.journeyAuditLog.create({
      data: {
        journeyId: version.journeyId,
        journeyVersionId: version.id,
        actorId: editor.id,
        action: "SET_GATES",
        diff: { count: parsed.gates.length } as object,
      },
    });

    revalidatePath(`/admin/journeys/${version.journeyId}`);
  });
}

// ============================================================================
// Publish / rollback
// ============================================================================

const PublishVersionInput = z.object({
  versionId: z.string().min(1),
});

export async function publishVersion(input: z.infer<typeof PublishVersionInput>) {
  const editor = await requireJourneyEditor();
  if (!editor.canPublish) throw new Error("Unauthorized.");
  const parsed = PublishVersionInput.parse(input);

  await prisma.$transaction(async (tx) => {
    const version = await tx.journeyVersion.findUnique({
      where: { id: parsed.versionId },
      include: {
        journey: { select: { id: true, slug: true, title: true, description: true } },
        beats: { where: { removedAt: null }, orderBy: { sortOrder: "asc" } },
        gates: true,
      },
    });
    if (!version) throw new Error("Version not found.");
    if (version.status !== "DRAFT") {
      throw new Error("Only DRAFT versions can be published.");
    }

    const assignments = await tx.journeyAssignmentRule.findMany({
      where: { journeyId: version.journeyId },
      select: { audience: true, autoEnroll: true },
    });
    const knownModules = await tx.trainingModule.findMany({
      where: { contentKey: { not: null }, archivedAt: null },
      select: { contentKey: true },
    });

    const draft: JourneyDraft = {
      journeyId: version.journeyId,
      versionId: version.id,
      versionNumber: version.versionNumber,
      status: "DRAFT",
      meta: {
        slug: version.journey.slug,
        title: version.journey.title,
        description: version.journey.description,
        estimatedMinutes: version.estimatedMinutes,
        passScorePct: version.passScorePct,
        strictMode: version.strictMode,
        moduleId: version.moduleId,
      },
      beats: version.beats.map<BeatDraft>((b) => ({
        id: b.id,
        sourceKey: b.sourceKey,
        kind: b.kind,
        title: b.title,
        prompt: b.prompt,
        mediaUrl: b.mediaUrl,
        sortOrder: b.sortOrder,
        parentBeatId: b.parentBeatId,
        showWhen: b.showWhen as object | null,
        scoringWeight: b.scoringWeight,
        scoringRule: b.scoringRule,
        schemaVersion: b.schemaVersion,
        removedAt: b.removedAt ? b.removedAt.toISOString() : null,
        config: b.config,
      })),
      gates: version.gates.map<GateDraft>((g) => ({
        id: g.id,
        kind: g.kind,
        targetRef: g.targetRef,
        requiredRef: g.requiredRef,
        threshold: g.threshold,
      })),
      assignments: assignments.map<JourneyAssignmentDraft>((a) => ({
        audience: a.audience,
        autoEnroll: a.autoEnroll,
      })),
    };

    const result = validateDraft(draft, {
      knownModuleContentKeys: knownModules
        .map((m) => m.contentKey)
        .filter((k): k is string => Boolean(k)),
      forPublish: true,
    });
    if (!result.ok) {
      throw new Error(
        `Cannot publish: ${result.errors.length} validation issue(s). First: ${result.errors[0].message}`,
      );
    }

    await tx.journeyVersion.updateMany({
      where: {
        journeyId: version.journeyId,
        status: "PUBLISHED",
        NOT: { id: version.id },
      },
      data: { status: "ARCHIVED" },
    });

    await tx.journeyVersion.update({
      where: { id: version.id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        publishedById: editor.id,
      },
    });

    await tx.journeyAuditLog.create({
      data: {
        journeyId: version.journeyId,
        journeyVersionId: version.id,
        actorId: editor.id,
        action: "PUBLISH",
        diff: { versionNumber: version.versionNumber } as object,
      },
    });

    revalidatePath("/admin/journeys");
    revalidatePath(`/admin/journeys/${version.journeyId}`);
  });
}

const RollbackToVersionInput = z.object({
  targetVersionId: z.string().min(1),
});

export async function rollbackToVersion(input: z.infer<typeof RollbackToVersionInput>) {
  const editor = await requireJourneyEditor();
  if (!editor.canPublish) throw new Error("Unauthorized.");
  const parsed = RollbackToVersionInput.parse(input);

  await prisma.$transaction(async (tx) => {
    const target = await tx.journeyVersion.findUnique({
      where: { id: parsed.targetVersionId },
      select: { id: true, journeyId: true, status: true, versionNumber: true },
    });
    if (!target) throw new Error("Target version not found.");
    if (target.status === "DRAFT") {
      throw new Error(
        "Rollback target must be a previously PUBLISHED or ARCHIVED version, not a DRAFT.",
      );
    }

    const previouslyPublished = await tx.journeyVersion.findFirst({
      where: { journeyId: target.journeyId, status: "PUBLISHED" },
      select: { id: true, versionNumber: true },
    });

    if (previouslyPublished && previouslyPublished.id !== target.id) {
      await tx.journeyVersion.update({
        where: { id: previouslyPublished.id },
        data: { status: "ARCHIVED" },
      });
    }

    await tx.journeyVersion.update({
      where: { id: target.id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        publishedById: editor.id,
      },
    });

    await tx.journeyAuditLog.create({
      data: {
        journeyId: target.journeyId,
        journeyVersionId: target.id,
        actorId: editor.id,
        action: "ROLLBACK",
        diff: {
          to: target.versionNumber,
          from: previouslyPublished?.versionNumber ?? null,
        } as object,
      },
    });

    revalidatePath("/admin/journeys");
    revalidatePath(`/admin/journeys/${target.journeyId}`);
  });
}
