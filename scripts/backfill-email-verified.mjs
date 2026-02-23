/**
 * backfill-email-verified.mjs
 *
 * One-time script: sets emailVerified = now() for all credentials users who
 * have a passwordHash but no emailVerified date, so they are NOT locked out
 * when the emailVerified check is deployed to lib/auth.ts.
 *
 * Run ONCE against production BEFORE deploying the auth.ts check:
 *   npm run backfill:email-verified
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const result = await prisma.user.updateMany({
  where: {
    emailVerified: null,
    passwordHash: { not: "" },
  },
  data: {
    emailVerified: new Date(),
  },
});

console.log(`✓ Backfilled emailVerified for ${result.count} existing credentials user(s).`);

await prisma.$disconnect();
