/**
 * Re-hash passwords for prisma/seed.ts demo users using the current SEED_PASSWORD.
 * Use when you changed SEED_PASSWORD after the first db:seed (re-seeding fails on duplicate emails).
 *
 *   npm run db:sync-seed-password
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

/** Must match emails in prisma/seed.ts */
const SEEDED_CREDENTIAL_EMAILS = [
  "brayden.white@youthpassionproject.org",
  "carlygelles@gmail.com",
  "avery.lin@youthpassionproject.org",
  "jordan.patel@youthpassionproject.org",
];

const prisma = new PrismaClient();

async function main() {
  const seedPassword = process.env.SEED_PASSWORD;
  if (!seedPassword) {
    console.error("Set SEED_PASSWORD in .env (same value you use at login), then run again.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(seedPassword, 10);
  const emailVerified = new Date();

  const result = await prisma.user.updateMany({
    where: { email: { in: SEEDED_CREDENTIAL_EMAILS } },
    data: { passwordHash, emailVerified },
  });

  console.log(`Updated ${result.count} seeded user(s) with password from SEED_PASSWORD.`);

  if (result.count === 0) {
    console.warn(
      "No matching rows. Run npm run db:seed first (migrations applied, empty users table), or check DATABASE_URL."
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
