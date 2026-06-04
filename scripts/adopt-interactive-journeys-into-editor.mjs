/**
 * Bridge existing interactive-journey training modules into the Admin Journey
 * Editor so non-technical admins can edit their content (reflections, quizzes,
 * sort/match steps, feedback copy) through the visual editor at
 * /admin/journeys — without touching JSON.
 *
 * WHY THIS EXISTS
 * ---------------
 * Real curriculum content lives in the legacy `InteractiveJourney` /
 * `InteractiveBeat` tables (created by `npm run training:import`). The editor
 * operates on the newer `Journey` / `JourneyVersion` model and only shows beats
 * whose `journeyVersionId` points at an editable DRAFT version. Imported beats
 * have `journeyVersionId = null`, so they never appear in the editor.
 *
 * WHAT THIS DOES (idempotent, reversible, no schema change, no data loss)
 * ----------------------------------------------------------------------
 * For every module-bound `InteractiveJourney`:
 *   1. Upserts a `Journey` row (slug derived from the module's contentKey).
 *   2. Ensures a DRAFT `JourneyVersion` bound to that module exists.
 *   3. Back-links the journey's existing beats by SETTING
 *      `InteractiveBeat.journeyVersionId` (an UPDATE — beats are never cloned,
 *      renamed, or deleted, so the legacy `@@unique([journeyId, sourceKey])`
 *      index is never touched).
 *   4. Adds an INSTRUCTOR assignment rule if none exists.
 *   5. Writes a CREATE audit-log entry.
 *
 * SAFETY
 * ------
 *   - DRY-RUN by default. Pass `--apply` to write.
 *   - The instructor runtime reads beats via the `InteractiveJourney` relation
 *     (filtered by `removedAt`, ordered by `sortOrder`) — independent of
 *     `JourneyVersion.status`. Adopting beats into a DRAFT version does NOT
 *     change what instructors see.
 *   - Only beats with `journeyVersionId = null` are adopted, so a beat already
 *     owned by another version is left alone.
 *
 * CAVEAT (documented in the PR summary)
 * -------------------------------------
 * Because adopted beats are the SAME rows the runtime renders, editing them in
 * the DRAFT takes effect live immediately — true copy-on-write draft isolation
 * for legacy journeys awaits the version/legacy beat migration. Editing copy,
 * answers, ordering, and feedback all work and flow straight to instructors.
 *
 * Usage:
 *   node scripts/adopt-interactive-journeys-into-editor.mjs            # dry run
 *   node scripts/adopt-interactive-journeys-into-editor.mjs --apply    # write
 *   node scripts/adopt-interactive-journeys-into-editor.mjs --apply --actor=<userId>
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");
const ACTOR_ARG = process.argv.find((a) => a.startsWith("--actor="));
const ACTOR_ID = ACTOR_ARG ? ACTOR_ARG.split("=")[1] : null;

/** Convert a contentKey / title into an editor-safe slug: [a-z0-9][a-z0-9-]*. */
function toSlug(input, fallback) {
  const base = (input || fallback || "").toString().toLowerCase();
  const slug = base
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return slug || `journey-${Math.random().toString(36).slice(2, 8)}`;
}

async function uniqueSlug(desired, takenByJourneyId) {
  let candidate = desired;
  let n = 2;
  // Avoid colliding with an unrelated Journey that already owns this slug.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.journey.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing || existing.id === takenByJourneyId) return candidate;
    candidate = `${desired}-${n}`;
    n += 1;
  }
}

async function main() {
  const journeys = await prisma.interactiveJourney.findMany({
    include: {
      module: {
        select: {
          id: true,
          contentKey: true,
          title: true,
          description: true,
          archivedAt: true,
          estimatedMinutes: true,
        },
      },
      beats: {
        where: { removedAt: null },
        select: { id: true, sourceKey: true, journeyVersionId: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  console.log(
    `${APPLY ? "APPLYING" : "DRY RUN"} — found ${journeys.length} interactive journey(s).\n`,
  );

  let created = 0;
  let adoptedBeats = 0;
  let skipped = 0;

  for (const ij of journeys) {
    const mod = ij.module;
    if (!mod) {
      console.log(`- [skip] InteractiveJourney ${ij.id}: no module bound.`);
      skipped += 1;
      continue;
    }
    if (mod.archivedAt) {
      console.log(`- [skip] ${mod.title}: module is archived.`);
      skipped += 1;
      continue;
    }

    const orphanBeats = ij.beats.filter((b) => b.journeyVersionId === null);
    const desiredSlug = toSlug(mod.contentKey, mod.title);

    console.log(
      `- ${mod.title}  (contentKey=${mod.contentKey ?? "—"}, beats=${ij.beats.length}, to adopt=${orphanBeats.length})`,
    );

    if (!APPLY) {
      console.log(`    would upsert Journey slug="${desiredSlug}", DRAFT version, adopt ${orphanBeats.length} beat(s).`);
      created += 1;
      adoptedBeats += orphanBeats.length;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      // 1. Journey (find existing binding via an existing version on this module).
      let version = await tx.journeyVersion.findFirst({
        where: { moduleId: mod.id },
        orderBy: { versionNumber: "desc" },
        include: { journey: true },
      });

      let journey = version?.journey ?? null;

      if (!journey) {
        const slug = await uniqueSlug(desiredSlug, null);
        journey = await tx.journey.create({
          data: {
            slug,
            title: mod.title,
            description: mod.description ?? null,
          },
        });
        await tx.journeyAuditLog.create({
          data: {
            journeyId: journey.id,
            actorId: ACTOR_ID,
            action: "CREATE",
            summary: `Adopted legacy interactive journey for module ${mod.contentKey ?? mod.id}.`,
            diff: { kind: "ADOPT_LEGACY", moduleId: mod.id, contentKey: mod.contentKey },
          },
        });
      }

      // 2. Ensure an editable DRAFT version bound to this module.
      if (!version || version.status === "PUBLISHED" || version.status === "ARCHIVED") {
        const existingDraft = await tx.journeyVersion.findFirst({
          where: { journeyId: journey.id, status: "DRAFT" },
          orderBy: { versionNumber: "desc" },
        });
        if (existingDraft) {
          version = existingDraft;
        } else {
          const latest = await tx.journeyVersion.findFirst({
            where: { journeyId: journey.id },
            orderBy: { versionNumber: "desc" },
          });
          version = await tx.journeyVersion.create({
            data: {
              journeyId: journey.id,
              versionNumber: (latest?.versionNumber ?? 0) + 1,
              status: "DRAFT",
              moduleId: mod.id,
              estimatedMinutes: ij.estimatedMinutes ?? mod.estimatedMinutes ?? 0,
              passScorePct: ij.passScorePct ?? 80,
              strictMode: ij.strictMode ?? false,
              createdById: ACTOR_ID,
            },
          });
        }
      }

      // 3. Back-link orphan beats to the DRAFT version (UPDATE only).
      if (orphanBeats.length > 0) {
        const res = await tx.interactiveBeat.updateMany({
          where: { id: { in: orphanBeats.map((b) => b.id) }, journeyVersionId: null },
          data: { journeyVersionId: version.id },
        });
        adoptedBeats += res.count;
      }

      // 4. Default assignment rule.
      const ruleCount = await tx.journeyAssignmentRule.count({
        where: { journeyId: journey.id },
      });
      if (ruleCount === 0) {
        await tx.journeyAssignmentRule.create({
          data: { journeyId: journey.id, audience: "INSTRUCTOR", autoEnroll: false },
        });
      }

      created += 1;
      console.log(`    ✓ Journey ${journey.slug} · DRAFT v${version.versionNumber} · adopted ${orphanBeats.length} beat(s).`);
    });
  }

  console.log(
    `\n${APPLY ? "Done." : "Dry run complete."} journeys=${created}, beats adopted=${adoptedBeats}, skipped=${skipped}.`,
  );
  if (!APPLY) {
    console.log("Re-run with --apply to write these changes.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
