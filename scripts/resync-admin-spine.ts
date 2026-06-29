/**
 * Re-sync the org-spine for users whose ladder/level is stale relative to their
 * legacy admin role/subtype. The one-time `backfill-org-authority.ts` only fills
 * NULL `internalLevel` rows; this catches rows that already have a level but
 * whose admin role/subtype now implies a HIGHER one (e.g. an existing ADMIN +
 * SUPER_ADMIN whose internalLevel is still 1).
 *
 * Conservative + idempotent:
 *   - only ever RAISES a level (never lowers a manually-assigned title);
 *   - derives via the same `deriveSpineFromAccess` used by the editors;
 *   - pushes the change into Supabase user_metadata so middleware doesn't drift.
 *
 *   npx tsx scripts/resync-admin-spine.ts           # dry run
 *   npx tsx scripts/resync-admin-spine.ts --apply   # write
 */

import { prisma } from "@/lib/prisma";
import { deriveSpineFromAccess } from "@/lib/org/levels";
import { syncPortalAuthMetadataForPrismaUser } from "@/lib/sync-portal-auth-metadata";

const apply = process.argv.includes("--apply");

async function main(): Promise<void> {
  console.log(apply ? "Applying admin-spine re-sync…\n" : "DRY RUN — pass --apply to write.\n");

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      internalLevel: true,
      canonicalTitle: true,
      primaryRole: true,
      roles: { select: { role: true } },
      adminSubtypes: { select: { subtype: true } },
    },
  });

  let raised = 0;
  for (const user of users) {
    const derived = deriveSpineFromAccess({
      primaryRole: user.primaryRole,
      roles: user.roles.map((r) => r.role),
      adminSubtypes: user.adminSubtypes.map((s) => s.subtype),
    });

    const current = user.internalLevel ?? 0;
    // Only raise; never lower a manually-assigned (possibly higher) title.
    if (derived.internalLevel == null || derived.internalLevel <= current) continue;

    raised += 1;
    console.log(
      `  ${user.name}: level ${current} → ${derived.internalLevel}` +
        ` · ${derived.ladder ?? "?"} · ${derived.canonicalTitle ?? "(no canonical title)"}` +
        `${apply ? "" : " (dry run)"}`
    );

    if (apply) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          internalLevel: derived.internalLevel,
          ladder: derived.ladder ?? undefined,
          canonicalTitle: derived.canonicalTitle ?? undefined,
        },
      });
      await syncPortalAuthMetadataForPrismaUser(user.id);
    }
  }

  console.log(`\nUsers: ${raised} ${apply ? "raised" : "to raise"}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
