/**
 * Pure curriculum-import logic, shared between:
 *   - scripts/import-training-academy-content.mjs (entry point)
 *   - tests/scripts/training-import.test.ts (unit tests via mock prisma)
 *
 * Exports `importCurriculumRegistry` as a named export so tests can import it
 * directly without running the script's top-level `main()`.
 */

// ---------------------------------------------------------------------------
// importCurriculumRegistry
// ---------------------------------------------------------------------------

/**
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {import("../lib/training-curriculum/types").CurriculumDefinition[]} list
 * @param {{ dryRun: boolean, beatConfigSchemas: Record<string, import("zod").ZodTypeAny>, beatSchemaVersions: Record<string, number> }} opts
 */
export async function importCurriculumRegistry(prisma, list, opts) {
  const { dryRun = false, beatConfigSchemas, beatSchemaVersions } = opts;

  const counters = {
    journeysCreated: 0,
    journeysUpdated: 0,
    beatsCreated: 0,
    beatsUpdated: 0,
    beatsSoftDeleted: 0,
    beatsUnSoftDeleted: 0,
  };

  for (const curriculum of list) {
    await importOneCurriculum(prisma, curriculum, {
      dryRun,
      beatConfigSchemas,
      beatSchemaVersions,
      counters,
    });
  }

  return counters;
}

/**
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {import("../lib/training-curriculum/types").CurriculumDefinition} curriculum
 * @param {{ dryRun: boolean, beatConfigSchemas: Record<string, import("zod").ZodTypeAny>, beatSchemaVersions: Record<string, number>, counters: object }} opts
 */
async function importOneCurriculum(prisma, curriculum, opts) {
  const { dryRun, beatConfigSchemas, beatSchemaVersions, counters } = opts;
  const { contentKey, module: mod, journey, beats } = curriculum;

  // Flatten all beats (DFS) preserving their hierarchy info
  const flatBeats = flattenBeats(beats, null);

  // Validate configs before any DB writes (defense-in-depth)
  for (const beat of flatBeats) {
    const schema = beatConfigSchemas[beat.kind];
    if (!schema) {
      throw new Error(
        `[curriculum:import] Unknown beat kind "${beat.kind}" on beat sourceKey="${beat.sourceKey}" in module contentKey="${contentKey}"`
      );
    }
    const result = schema.safeParse(beat.config);
    if (!result.success) {
      throw new Error(
        `[curriculum:import] Invalid config for beat sourceKey="${beat.sourceKey}" kind="${beat.kind}" in module contentKey="${contentKey}": ${result.error.message}`
      );
    }
  }

  if (dryRun) {
    console.log(`[training:import] [dry-run] Would upsert curriculum: ${contentKey}`);
    counters.journeysCreated += 1;
    counters.beatsCreated += flatBeats.length;
    return;
  }

  await prisma.$transaction(async (tx) => {
    // 1. Advisory lock
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"training:import"}))`;

    // 2. Upsert TrainingModule
    const existingModule = await tx.trainingModule.findUnique({
      where: { contentKey },
      select: { id: true },
    });

    let moduleId;
    if (existingModule) {
      await tx.trainingModule.update({
        where: { id: existingModule.id },
        data: {
          type: "INTERACTIVE_JOURNEY",
          required: mod.required,
          sortOrder: mod.sortOrder,
          passScorePct: mod.passScorePct,
          title: mod.title,
          description: mod.description,
          videoUrl: null,
          videoProvider: null,
          videoDuration: null,
          requiresQuiz: false,
          requiresEvidence: false,
          estimatedMinutes: journey.estimatedMinutes,
        },
      });
      moduleId = existingModule.id;
      counters.journeysUpdated += 1;
    } else {
      const created = await tx.trainingModule.create({
        data: {
          contentKey,
          type: "INTERACTIVE_JOURNEY",
          required: mod.required,
          sortOrder: mod.sortOrder,
          passScorePct: mod.passScorePct,
          title: mod.title,
          description: mod.description,
          videoUrl: null,
          videoProvider: null,
          videoDuration: null,
          requiresQuiz: false,
          requiresEvidence: false,
          estimatedMinutes: journey.estimatedMinutes,
        },
        select: { id: true },
      });
      moduleId = created.id;
      counters.journeysCreated += 1;
    }

    // 3. Upsert InteractiveJourney
    const existingJourney = await tx.interactiveJourney.findUnique({
      where: { moduleId },
      select: { id: true },
    });

    let journeyId;
    if (existingJourney) {
      await tx.interactiveJourney.update({
        where: { id: existingJourney.id },
        data: {
          estimatedMinutes: journey.estimatedMinutes,
          passScorePct: mod.passScorePct,
          strictMode: journey.strictMode,
          version: journey.version,
        },
      });
      journeyId = existingJourney.id;
    } else {
      const createdJourney = await tx.interactiveJourney.create({
        data: {
          moduleId,
          estimatedMinutes: journey.estimatedMinutes,
          passScorePct: mod.passScorePct,
          strictMode: journey.strictMode,
          version: journey.version,
        },
        select: { id: true },
      });
      journeyId = createdJourney.id;
    }

    // 4. Get existing beats for this journey
    const existingBeats = await tx.interactiveBeat.findMany({
      where: { journeyId },
      select: { id: true, sourceKey: true, sortOrder: true, removedAt: true },
    });

    const existingBySourceKey = new Map(
      existingBeats.map((b) => [b.sourceKey, b])
    );
    const incomingSourceKeys = new Set(flatBeats.map((b) => b.sourceKey));

    // 5. Temporarily offset existing sortOrders to negative placeholders so the
    //    [journeyId, sortOrder] unique doesn't collide when we re-assign positive
    //    sortOrders below. Each row gets a distinct negative value. We can't use
    //    `updateMany` because it would set every row to the same sortOrder and
    //    immediately violate the unique constraint.
    for (let i = 0; i < existingBeats.length; i++) {
      const beat = existingBeats[i];
      await tx.interactiveBeat.update({
        where: { id: beat.id },
        data: { sortOrder: -(i + 1) },
      });
    }

    // 6. Upsert all beats (pass 1: no parentBeatId)
    const upsertedIds = new Map(); // sourceKey -> id
    for (const beat of flatBeats) {
      const schemaVersion =
        beat.schemaVersion ?? beatSchemaVersions[beat.kind] ?? 1;
      const showWhenJson = beat.showWhen ? beat.showWhen : null;

      const existing = existingBySourceKey.get(beat.sourceKey);
      if (existing) {
        await tx.interactiveBeat.update({
          where: { id: existing.id },
          data: {
            kind: beat.kind,
            title: beat.title,
            prompt: beat.prompt,
            config: beat.config,
            schemaVersion,
            scoringWeight: beat.scoringWeight,
            scoringRule: beat.scoringRule ?? null,
            mediaUrl: beat.mediaUrl ?? null,
            sortOrder: beat.sortOrder,
            showWhen: showWhenJson,
            removedAt: null, // un-soft-delete if was removed
          },
        });
        upsertedIds.set(beat.sourceKey, existing.id);
        if (existing.removedAt !== null) {
          counters.beatsUnSoftDeleted += 1;
        } else {
          counters.beatsUpdated += 1;
        }
      } else {
        const created = await tx.interactiveBeat.create({
          data: {
            journeyId,
            sourceKey: beat.sourceKey,
            kind: beat.kind,
            title: beat.title,
            prompt: beat.prompt,
            config: beat.config,
            schemaVersion,
            scoringWeight: beat.scoringWeight,
            scoringRule: beat.scoringRule ?? null,
            mediaUrl: beat.mediaUrl ?? null,
            sortOrder: beat.sortOrder,
            showWhen: showWhenJson,
            removedAt: null,
          },
          select: { id: true },
        });
        upsertedIds.set(beat.sourceKey, created.id);
        counters.beatsCreated += 1;
      }
    }

    // 7. Second pass: wire parentBeatId
    for (const beat of flatBeats) {
      if (beat.parentSourceKey) {
        const childId = upsertedIds.get(beat.sourceKey);
        const parentId = upsertedIds.get(beat.parentSourceKey);
        if (childId && parentId) {
          await tx.interactiveBeat.update({
            where: { id: childId },
            data: { parentBeatId: parentId },
          });
        }
      }
    }

    // 8. Orphan soft-delete: beats in DB not in incoming set
    const orphanBeats = existingBeats.filter(
      (b) => !incomingSourceKeys.has(b.sourceKey) && b.removedAt === null
    );
    if (orphanBeats.length > 0) {
      const orphanIds = orphanBeats.map((b) => b.id);
      await tx.interactiveBeat.updateMany({
        where: { id: { in: orphanIds } },
        data: { removedAt: new Date() },
      });
      counters.beatsSoftDeleted += orphanBeats.length;
    }
  });
}

/**
 * Flatten the beat tree (DFS) into a sorted list, attaching parentSourceKey
 * from parent context when using the `children` nesting style.
 *
 * @param {import("../lib/training-curriculum/types").BeatDefinition[]} beats
 * @param {string | null} parentSourceKey
 * @returns {Array<import("../lib/training-curriculum/types").BeatDefinition & { parentSourceKey: string | null }>}
 */
function flattenBeats(beats, parentSourceKey) {
  const result = [];
  for (const beat of beats) {
    const resolved = {
      ...beat,
      parentSourceKey: beat.parentSourceKey ?? parentSourceKey,
    };
    // Push without children (children are flattened separately)
    const { children, ...beatWithoutChildren } = resolved;
    result.push({ ...beatWithoutChildren, parentSourceKey: resolved.parentSourceKey });
    if (children && children.length > 0) {
      result.push(...flattenBeats(children, beat.sourceKey));
    }
  }
  return result;
}
