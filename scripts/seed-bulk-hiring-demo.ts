/**
 * Seed bulk hiring demo applicants onto the hire waitlist / applicants board.
 *
 *   npx tsx scripts/seed-bulk-hiring-demo.ts
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, RoleType } from "@prisma/client";

import { seedBulkHiringDemo } from "../prisma/seed-bulk-hiring-demo";

const prisma = new PrismaClient();

async function main() {
  const seedPassword = process.env.SEED_PASSWORD;
  if (!seedPassword) {
    throw new Error("SEED_PASSWORD is required.");
  }

  const passwordHash = await bcrypt.hash(seedPassword, 10);
  const verifiedAt = new Date();

  const chapter =
    (await prisma.chapter.findFirst({
      where: { name: { equals: "Scarsdale", mode: "insensitive" }, archivedAt: null },
      select: { id: true, name: true },
    })) ??
    (await prisma.chapter.findFirst({
      where: { archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }));

  if (!chapter) {
    throw new Error("No chapter found — run npm run db:seed first.");
  }

  let chair = await prisma.user.findUnique({
    where: { email: "hiring.chair@youthpassionproject.org" },
    select: { id: true },
  });
  if (!chair) {
    chair = await prisma.user.create({
      data: {
        name: "Hiring Chair",
        email: "hiring.chair@youthpassionproject.org",
        passwordHash,
        emailVerified: verifiedAt,
        primaryRole: RoleType.HIRING_CHAIR,
        chapterId: chapter.id,
        roles: { create: [{ role: RoleType.HIRING_CHAIR }] },
      },
      select: { id: true },
    });
  }

  let reviewer = await prisma.user.findFirst({
    where: {
      OR: [
        { email: "demo.reviewer@youthpassionproject.org" },
        { roles: { some: { role: RoleType.STAFF } } },
        { primaryRole: RoleType.ADMIN },
      ],
    },
    select: { id: true },
  });
  if (!reviewer) {
    reviewer = chair;
  }

  console.log(`Seeding bulk hiring demo into chapter "${chapter.name}"…`);
  await seedBulkHiringDemo({
    prisma,
    chapterId: chapter.id,
    passwordHash,
    verifiedAt,
    reviewerId: reviewer.id,
    chairId: chair.id,
  });
  console.log("Done. Refresh /admin/applicants/waitlist.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
