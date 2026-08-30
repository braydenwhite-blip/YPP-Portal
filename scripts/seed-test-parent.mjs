/**
 * Create a local-only test PARENT account linked to jordan.patel, bypassing
 * Supabase entirely (unlike the live /signup form, which requires real
 * Supabase credentials). For local dev testing only — safe to delete after.
 *
 *   npm run db:seed-test-parent
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, RoleType } from "@prisma/client";

const PARENT_EMAIL = "test-parent@youthpassionproject.org";
const PARENT_NAME = "Test Parent";
const STUDENT_EMAIL = "jordan.patel@youthpassionproject.org";

const prisma = new PrismaClient();

async function main() {
  const seedPassword = process.env.SEED_PASSWORD;
  if (!seedPassword) {
    console.error("Set SEED_PASSWORD in .env (same value you use at login), then run again.");
    process.exit(1);
  }

  const student = await prisma.user.findUnique({ where: { email: STUDENT_EMAIL } });
  if (!student) {
    console.error(`Could not find student ${STUDENT_EMAIL}. Run npm run db:seed first.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(seedPassword, 10);
  const now = new Date();

  const parent = await prisma.user.upsert({
    where: { email: PARENT_EMAIL },
    create: {
      name: PARENT_NAME,
      email: PARENT_EMAIL,
      passwordHash,
      emailVerified: now,
      primaryRole: RoleType.PARENT,
      roles: { create: [{ role: RoleType.PARENT }] },
    },
    update: {
      name: PARENT_NAME,
      passwordHash,
      emailVerified: now,
      primaryRole: RoleType.PARENT,
      roles: { deleteMany: {}, create: [{ role: RoleType.PARENT }] },
    },
  });

  const existingRelationship = await prisma.studentGuardianRelationship.findFirst({ where: { studentUserId: student.id, guardianUserId: parent.id, revokedAt: null }, }); if (existingRelationship) { await prisma.studentGuardianRelationship.update({ where: { id: existingRelationship.id }, data: { relationshipStatus: "ACTIVE", canViewLearning: true }, }); } else { await prisma.studentGuardianRelationship.create({ data: { studentUserId: student.id, guardianUserId: parent.id, relationshipType: "Guardian", relationshipStatus: "ACTIVE", isPrimaryContact: true, canViewLearning: true, }, }); }

  console.log(`Test parent ready: ${PARENT_EMAIL} / ${seedPassword}, linked to ${STUDENT_EMAIL}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());