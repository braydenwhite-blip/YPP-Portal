/**
 * Idempotent demo people for Behavioral Science Foundations — Spring Cohort A:
 * current students, parents, and alumni who finished the course (COMPLETED).
 *
 * Usage: npx tsx scripts/seed-class-people-demo.ts
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, RoleType } from "@prisma/client";

const prisma = new PrismaClient();

const OFFERING_TITLE = "Behavioral Science Foundations — Spring Cohort A";

const EXTRA_STUDENTS = [
  { email: "demo.class.student.maya@example.com", name: "Maya Chen" },
  { email: "demo.class.student.noah@example.com", name: "Noah Patel" },
  { email: "demo.class.student.sofia@example.com", name: "Sofia Alvarez" },
  { email: "demo.class.student.ethan@example.com", name: "Ethan Brooks" },
  { email: "demo.class.student.priya@example.com", name: "Priya Nair" },
];

/** Finished the course (COMPLETED) — show under “Was in this class”, not dropped. */
const COMPLETED_STUDENTS = [
  { email: "demo.class.alum.luna@example.com", name: "Luna Park", enrolledDaysAgo: 120, completedDaysAgo: 30 },
  { email: "demo.class.alum.omar@example.com", name: "Omar Hassan", enrolledDaysAgo: 115, completedDaysAgo: 28 },
  { email: "demo.class.alum.isla@example.com", name: "Isla Nguyen", enrolledDaysAgo: 110, completedDaysAgo: 25 },
  { email: "demo.class.alum.caleb@example.com", name: "Caleb Wright", enrolledDaysAgo: 105, completedDaysAgo: 22 },
  { email: "demo.class.alum.zara@example.com", name: "Zara Mensah", enrolledDaysAgo: 100, completedDaysAgo: 20 },
];

const PARENTS = [
  { email: "demo.class.parent.1@example.com", name: "Jordan Rivera", childEmail: "demo.applicant.submitted@example.com" },
  { email: "demo.class.parent.2@example.com", name: "Sam Torres", childEmail: "demo.applicant.interview@example.com" },
  { email: "demo.class.parent.3@example.com", name: "Casey Chen", childEmail: "demo.class.student.maya@example.com" },
  { email: "demo.class.parent.4@example.com", name: "Riley Patel", childEmail: "demo.class.student.noah@example.com" },
  { email: "demo.class.parent.5@example.com", name: "Morgan Alvarez", childEmail: "demo.class.student.sofia@example.com" },
  { email: "demo.class.parent.6@example.com", name: "Avery Brooks", childEmail: "demo.class.student.ethan@example.com" },
  { email: "demo.class.parent.7@example.com", name: "Quinn Nair", childEmail: "demo.class.student.priya@example.com" },
];

async function upsertStudent(email: string, name: string, passwordHash: string, chapterId: string | null) {
  return prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      passwordHash,
      emailVerified: new Date(),
      primaryRole: RoleType.STUDENT,
      chapterId: chapterId ?? undefined,
      roles: { create: [{ role: RoleType.STUDENT }] },
    },
    update: { name, primaryRole: RoleType.STUDENT },
  });
}

async function upsertParent(email: string, name: string, passwordHash: string, chapterId: string | null) {
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      passwordHash,
      emailVerified: new Date(),
      primaryRole: RoleType.PARENT,
      chapterId: chapterId ?? undefined,
      roles: { create: [{ role: RoleType.PARENT }] },
    },
    update: { name, primaryRole: RoleType.PARENT },
  });
  // Ensure PARENT role exists even if user already had STUDENT-only roles.
  await prisma.userRole.upsert({
    where: { userId_role: { userId: user.id, role: RoleType.PARENT } },
    create: { userId: user.id, role: RoleType.PARENT },
    update: {},
  });
  return user;
}

async function main() {
  const offering = await prisma.classOffering.findFirst({
    where: { title: OFFERING_TITLE },
    select: { id: true, title: true, chapterId: true },
  });
  if (!offering) {
    throw new Error(`Offering not found: ${OFFERING_TITLE}`);
  }

  const seedPassword = process.env.SEED_PASSWORD ?? "password123";
  const passwordHash = await bcrypt.hash(seedPassword, 10);
  const chapterId = offering.chapterId;

  console.log(`Seeding people for ${offering.title} (${offering.id})`);

  for (const s of EXTRA_STUDENTS) {
    const student = await upsertStudent(s.email, s.name, passwordHash, chapterId);
    await prisma.classEnrollment.upsert({
      where: {
        studentId_offeringId: { studentId: student.id, offeringId: offering.id },
      },
      create: {
        studentId: student.id,
        offeringId: offering.id,
        status: "ENROLLED",
        outcomesAchieved: [],
      },
      update: { status: "ENROLLED" },
    });
    console.log(`  student ${s.name}`);
  }

  // Also ensure the two existing demo applicants stay enrolled if present.
  for (const email of [
    "demo.applicant.submitted@example.com",
    "demo.applicant.interview@example.com",
  ]) {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true } });
    if (!existing) continue;
    await prisma.classEnrollment.upsert({
      where: {
        studentId_offeringId: { studentId: existing.id, offeringId: offering.id },
      },
      create: {
        studentId: existing.id,
        offeringId: offering.id,
        status: "ENROLLED",
        outcomesAchieved: [],
      },
      update: { status: "ENROLLED" },
    });
  }

  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  };

  for (const alum of COMPLETED_STUDENTS) {
    const student = await upsertStudent(alum.email, alum.name, passwordHash, chapterId);
    const enrolledAt = daysAgo(alum.enrolledDaysAgo);
    const completedAt = daysAgo(alum.completedDaysAgo);
    await prisma.classEnrollment.upsert({
      where: {
        studentId_offeringId: { studentId: student.id, offeringId: offering.id },
      },
      create: {
        studentId: student.id,
        offeringId: offering.id,
        status: "COMPLETED",
        enrolledAt,
        completedAt,
        outcomesAchieved: [],
      },
      update: {
        status: "COMPLETED",
        enrolledAt,
        completedAt,
        droppedAt: null,
      },
    });
    console.log(`  completed ${alum.name} (finished ${completedAt.toISOString().slice(0, 10)})`);
  }

  for (const p of PARENTS) {
    const parent = await upsertParent(p.email, p.name, passwordHash, chapterId);
    const child = await prisma.user.findUnique({
      where: { email: p.childEmail },
      select: { id: true, name: true },
    });
    if (!child) {
      console.warn(`  skip parent link — child missing: ${p.childEmail}`);
      continue;
    }
    await prisma.parentStudent.upsert({
      where: {
        parentId_studentId: { parentId: parent.id, studentId: child.id },
      },
      create: {
        parentId: parent.id,
        studentId: child.id,
        relationship: "Parent",
        isPrimary: true,
        approvalStatus: "APPROVED",
        reviewedAt: new Date(),
      },
      update: {
        archivedAt: null,
        approvalStatus: "APPROVED",
      },
    });
    console.log(`  parent ${p.name} → ${child.name}`);
  }

  // Shared-parent sibling pairs for profile testing.
  const siblingPairs: Array<{ parentEmail: string; childEmail: string; relationship: string }> = [
    // Jordan Rivera is also parent of Jamie → Alex & Jamie are siblings
    {
      parentEmail: "demo.class.parent.1@example.com",
      childEmail: "demo.applicant.interview@example.com",
      relationship: "Parent",
    },
    // Casey Chen also linked to Noah → Maya & Noah siblings
    {
      parentEmail: "demo.class.parent.3@example.com",
      childEmail: "demo.class.student.noah@example.com",
      relationship: "Parent",
    },
  ];
  for (const pair of siblingPairs) {
    const parent = await prisma.user.findUnique({
      where: { email: pair.parentEmail },
      select: { id: true, name: true },
    });
    const child = await prisma.user.findUnique({
      where: { email: pair.childEmail },
      select: { id: true, name: true },
    });
    if (!parent || !child) continue;
    await prisma.parentStudent.upsert({
      where: {
        parentId_studentId: { parentId: parent.id, studentId: child.id },
      },
      create: {
        parentId: parent.id,
        studentId: child.id,
        relationship: pair.relationship,
        isPrimary: false,
        approvalStatus: "APPROVED",
        reviewedAt: new Date(),
      },
      update: { archivedAt: null, approvalStatus: "APPROVED" },
    });
    console.log(`  sibling household ${parent.name} → also ${child.name}`);
  }

  const enrolled = await prisma.classEnrollment.count({
    where: { offeringId: offering.id, status: "ENROLLED" },
  });
  const completed = await prisma.classEnrollment.count({
    where: { offeringId: offering.id, status: "COMPLETED" },
  });
  const parentLinks = await prisma.parentStudent.count({
    where: {
      archivedAt: null,
      studentId: {
        in: (
          await prisma.classEnrollment.findMany({
            where: { offeringId: offering.id, status: { in: ["ENROLLED", "COMPLETED"] } },
            select: { studentId: true },
          })
        ).map((e) => e.studentId),
      },
    },
  });
  console.log(
    `Done. In class: ${enrolled}. Completed (finished course): ${completed}. Linked parents: ${parentLinks}.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
