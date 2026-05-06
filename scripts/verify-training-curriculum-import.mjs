#!/usr/bin/env node
/**
 * Read-only post-import verification for the TypeScript curriculum registry.
 *
 * Reads (no writes) from the DB and confirms that every curriculum registered
 * in `lib/training-curriculum/index.ts` was upserted as expected:
 *   - TrainingModule row exists for each contentKey, type=INTERACTIVE_JOURNEY
 *   - InteractiveJourney attached
 *   - InteractiveBeat rows match expected top-level count and kind set
 *   - No journey has zero non-removed beats
 *
 * Run after `npm run training:import` in a DB-enabled environment.
 *
 *   node scripts/verify-training-curriculum-import.mjs
 *
 * Exits 0 if everything matches, 1 otherwise. Prints a per-module summary.
 */
import { PrismaClient } from "@prisma/client";
import { loadCurriculumRegistry } from "./training-academy-content-utils.mjs";

const prisma = new PrismaClient();

async function main() {
  const { list } = await loadCurriculumRegistry();

  let totalJourneys = 0;
  let totalBeats = 0;
  const failures = [];

  console.log(`[verify] Curricula registered: ${list.length}`);

  for (const curriculum of list) {
    const { contentKey, module: mod, beats: authoredBeats } = curriculum;
    const expectedTopLevelCount = authoredBeats.length;
    const expectedKinds = new Set(authoredBeats.map((b) => b.kind));

    const trainingModule = await prisma.trainingModule.findUnique({
      where: { contentKey },
      select: {
        id: true,
        title: true,
        type: true,
        sortOrder: true,
        interactiveJourney: {
          select: {
            id: true,
            estimatedMinutes: true,
            passScorePct: true,
            beats: {
              where: { removedAt: null },
              select: {
                sourceKey: true,
                kind: true,
                sortOrder: true,
                parentBeatId: true,
              },
            },
          },
        },
      },
    });

    if (!trainingModule) {
      failures.push(`${contentKey}: TrainingModule row not found`);
      console.log(`  [FAIL] ${contentKey} (${mod.title}) — module missing`);
      continue;
    }

    if (trainingModule.type !== "INTERACTIVE_JOURNEY") {
      failures.push(
        `${contentKey}: type=${trainingModule.type}, expected INTERACTIVE_JOURNEY`
      );
    }

    const journey = trainingModule.interactiveJourney;
    if (!journey) {
      failures.push(`${contentKey}: InteractiveJourney row not attached`);
      console.log(`  [FAIL] ${contentKey} (${mod.title}) — journey missing`);
      continue;
    }

    totalJourneys += 1;

    const allBeats = journey.beats;
    const topLevelBeats = allBeats.filter((b) => b.parentBeatId === null);
    const actualKinds = new Set(allBeats.map((b) => b.kind));

    totalBeats += allBeats.length;

    const issues = [];
    if (allBeats.length === 0) issues.push("zero beats");
    if (topLevelBeats.length !== expectedTopLevelCount) {
      issues.push(
        `top-level beat count ${topLevelBeats.length} ≠ expected ${expectedTopLevelCount}`
      );
    }
    for (const kind of expectedKinds) {
      if (!actualKinds.has(kind)) issues.push(`missing kind ${kind}`);
    }

    if (issues.length > 0) {
      failures.push(`${contentKey}: ${issues.join("; ")}`);
      console.log(
        `  [FAIL] ${contentKey} (${mod.title}) — ${issues.join("; ")}`
      );
    } else {
      console.log(
        `  [OK]   ${contentKey} (${mod.title}) — ${topLevelBeats.length} top-level beat(s), ${allBeats.length} total, kinds: ${[...actualKinds].sort().join(", ")}`
      );
    }
  }

  console.log(`\n[verify] Total journeys verified: ${totalJourneys}`);
  console.log(`[verify] Total beats (incl. children): ${totalBeats}`);

  if (failures.length > 0) {
    console.error(`\n[verify] FAILED with ${failures.length} issue(s):`);
    for (const f of failures) console.error(`- ${f}`);
    process.exit(1);
  }

  console.log("[verify] All curricula verified.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
