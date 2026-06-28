import { prisma } from "@/lib/prisma";

// Runtime feature-detection for the two-stage curriculum approval workflow,
// mirroring lib/class-template-compat.ts. The build runs `prisma migrate deploy`
// before `next build`, so in CI / production the CurriculumApproval table exists;
// this guard keeps the server actions honest in any environment where the
// migration hasn't been applied yet (they return a clear "after migration"
// message instead of throwing a P2021).

let cachedPromise: Promise<boolean> | null = null;

/** Whether the `CurriculumApproval` table has been migrated in. */
export async function hasCurriculumApprovalWorkflow(): Promise<boolean> {
  if (!cachedPromise) {
    cachedPromise = prisma
      .$queryRaw<{ table_name: string }[]>`
        select table_name
        from information_schema.tables
        where table_schema = 'public'
          and table_name = 'CurriculumApproval'
      `
      .then((rows) => rows.length > 0)
      .catch((error) => {
        cachedPromise = null;
        throw error;
      });
  }
  return cachedPromise;
}
