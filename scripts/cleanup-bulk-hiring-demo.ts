/**
 * Remove bulk hiring demo users + related applications seeded by
 * prisma/seed-bulk-hiring-demo.ts, and clear the hire waitlist order file.
 *
 * Usage:
 *   npx tsx scripts/cleanup-bulk-hiring-demo.ts          # dry run
 *   npx tsx scripts/cleanup-bulk-hiring-demo.ts --apply  # delete
 */
import "dotenv/config";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ROLE_DEMO_EMAILS = [
  "demo.staff.only@youthpassionproject.org",
  "demo.parent@youthpassionproject.org",
  "demo.applicant.pool@example.com",
  "demo.staff.chair@youthpassionproject.org",
];

async function main() {
  const apply = process.argv.includes("--apply");

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { startsWith: "bulk.demo." } },
        { email: { in: ROLE_DEMO_EMAILS } },
      ],
    },
    select: {
      id: true,
      email: true,
      name: true,
      _count: {
        select: {
          instructorApplications: true,
          applications: true,
        },
      },
    },
    orderBy: { email: "asc" },
  });

  if (users.length === 0) {
    console.log("No bulk hiring demo users found.");
  } else {
    console.log(`Found ${users.length} demo user(s):`);
    for (const u of users) {
      console.log(
        `  - ${u.name ?? "(no name)"} <${u.email}> ` +
          `(instructor apps ${u._count.instructorApplications}, ` +
          `staff apps ${u._count.applications})`
      );
    }
  }

  if (!apply) {
    console.log("\nDRY RUN — re-run with --apply to hard-delete these users and clear the waitlist file.");
    return;
  }

  const ids = users.map((u) => u.id);
  if (ids.length > 0) {
    // Delete dependent hiring rows first where cascade may not cover every edge.
    await prisma.instructorApplicationChairDecision.deleteMany({
      where: { application: { applicantId: { in: ids } } },
    });
    await prisma.instructorApplication.deleteMany({
      where: { applicantId: { in: ids } },
    });
    await prisma.chapterPresidentApplication.deleteMany({
      where: { applicantId: { in: ids } },
    });
    await prisma.application.deleteMany({
      where: { applicantId: { in: ids } },
    });
    await prisma.userRole.deleteMany({
      where: { userId: { in: ids } },
    });

    const deleted = await prisma.user.deleteMany({
      where: { id: { in: ids } },
    });
    console.log(`\nHard-deleted ${deleted.count} demo user(s) and their applications.`);
  }

  const orderPath = path.join(process.cwd(), "data", "hiring-waitlist-order.json");
  await mkdir(path.dirname(orderPath), { recursive: true });
  await writeFile(orderPath, `${JSON.stringify({ order: [] }, null, 2)}\n`, "utf8");
  console.log("Cleared data/hiring-waitlist-order.json.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
