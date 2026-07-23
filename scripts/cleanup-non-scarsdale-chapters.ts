import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

/** Keep the current operating chapters; remove everything else. */
const KEEP_CHAPTER_NAMES = ["Scarsdale", "The Bronx"] as const;

interface ColumnRef {
  table_schema: string;
  table_name: string;
  column_name: string;
}

async function findChapterIdColumns(): Promise<ColumnRef[]> {
  return prisma.$queryRaw<ColumnRef[]>`
    SELECT table_schema, table_name, column_name
    FROM information_schema.columns
    WHERE column_name = 'chapterId'
      AND table_schema = current_schema()
      AND table_name <> 'Chapter'
  `;
}

async function main() {
  const apply = process.argv.includes("--apply");
  if (!apply) {
    console.log("DRY RUN — re-run with --apply to commit changes.\n");
  }

  const keepChapters = await prisma.chapter.findMany({
    where: { name: { in: [...KEEP_CHAPTER_NAMES] } },
    select: { id: true, name: true },
  });
  if (keepChapters.length === 0) {
    console.error(
      `No operating chapters found (${KEEP_CHAPTER_NAMES.join(", ")}). Run \`npm run db:seed\` first (or create them manually) before running this cleanup.`,
    );
    process.exitCode = 1;
    return;
  }

  const keepIds = new Set(keepChapters.map((c) => c.id));
  const fallbackId =
    keepChapters.find((c) => c.name === "Scarsdale")?.id ?? keepChapters[0].id;

  console.log(
    `Keeping chapters: ${keepChapters.map((c) => `${c.name} (${c.id})`).join(", ")}`,
  );
  console.log(`Remap fallback chapter id: ${fallbackId}`);

  const toRemove = await prisma.chapter.findMany({
    where: { id: { notIn: [...keepIds] } },
    select: { id: true, name: true },
  });
  if (toRemove.length === 0) {
    console.log("No non-operating chapters found. Nothing to do.");
    return;
  }
  console.log(
    `Chapters to remove: ${toRemove.map((c) => `${c.name} (${c.id})`).join(", ")}`,
  );
  const obsoleteIds = toRemove.map((c) => c.id);

  const columns = await findChapterIdColumns();
  console.log(`Found ${columns.length} tables with a chapterId column.\n`);

  const summary: Array<{ table: string; rowsUpdated: number }> = [];

  await prisma
    .$transaction(async (tx) => {
      for (const col of columns) {
        const tableIdent = Prisma.raw(`"${col.table_schema}"."${col.table_name}"`);
        const columnIdent = Prisma.raw(`"${col.column_name}"`);

        const rowsUpdated = await tx.$executeRaw`
        UPDATE ${tableIdent}
        SET ${columnIdent} = ${fallbackId}
        WHERE ${columnIdent} = ANY(${obsoleteIds}::text[])
      `;
        if (rowsUpdated > 0) {
          summary.push({ table: col.table_name, rowsUpdated });
        }
      }

      const chaptersDeleted = await tx.chapter.deleteMany({
        where: { id: { in: obsoleteIds } },
      });

      if (!apply) {
        console.log("Rolling back (dry run).");
        throw new DryRunRollback({
          summary,
          chaptersDeleted: chaptersDeleted.count,
        });
      }

      console.log("Updates committed.");
      summary.push({
        table: "Chapter (deleted)",
        rowsUpdated: chaptersDeleted.count,
      });
    })
    .catch((err: unknown) => {
      if (err instanceof DryRunRollback) {
        console.log("\nDry-run summary (no changes applied):");
        for (const row of err.payload.summary) {
          console.log(`  - ${row.table}: ${row.rowsUpdated} row(s) would be updated`);
        }
        console.log(
          `  - Chapter rows that would be deleted: ${err.payload.chaptersDeleted}`,
        );
        return;
      }
      throw err;
    });

  if (apply) {
    console.log("\nSummary:");
    for (const row of summary) {
      console.log(`  - ${row.table}: ${row.rowsUpdated} row(s)`);
    }
  }
}

class DryRunRollback extends Error {
  constructor(
    public payload: {
      summary: Array<{ table: string; rowsUpdated: number }>;
      chaptersDeleted: number;
    },
  ) {
    super("dry-run");
  }
}

main()
  .catch((error) => {
    console.error("Cleanup failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
