import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const OPS = ["The Bronx", "Scarsdale"];

async function main() {
  const chapters = await prisma.chapter.findMany({
    select: {
      id: true,
      name: true,
      archivedAt: true,
      isPublic: true,
      _count: { select: { users: true } },
    },
    orderBy: { name: "asc" },
  });
  console.log("=== CHAPTERS ===");
  for (const c of chapters) {
    console.log(
      JSON.stringify({
        name: c.name,
        users: c._count.users,
        archived: !!c.archivedAt,
        public: c.isPublic,
        id: c.id,
      })
    );
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      primaryRole: true,
      chapterId: true,
      chapter: { select: { name: true, archivedAt: true } },
      roles: { select: { role: true } },
    },
  });

  const noChapter = users.filter((u) => !u.chapterId);
  const onArchived = users.filter((u) => u.chapter?.archivedAt);
  const onNonOps = users.filter((u) => u.chapter && !OPS.includes(u.chapter.name));
  const onOps = users.filter((u) => u.chapter && OPS.includes(u.chapter.name));

  console.log("\n=== USER SUMMARY ===");
  console.log({
    total: users.length,
    onOps: onOps.length,
    noChapter: noChapter.length,
    onArchived: onArchived.length,
    onNonOps: onNonOps.length,
  });

  console.log("\n=== NO CHAPTER by primaryRole ===");
  const byRole: Record<string, number> = {};
  for (const u of noChapter) {
    byRole[u.primaryRole] = (byRole[u.primaryRole] || 0) + 1;
  }
  console.log(byRole);

  console.log("\n=== NON-OPERATING / ARCHIVED ===");
  for (const u of [...onArchived, ...onNonOps]) {
    console.log(
      JSON.stringify({
        name: u.name,
        email: u.email,
        role: u.primaryRole,
        chapter: u.chapter?.name,
        archived: !!u.chapter?.archivedAt,
      })
    );
  }

  console.log("\n=== NULL chapter — roles that usually need one ===");
  const need = new Set([
    "CHAPTER_PRESIDENT",
    "INSTRUCTOR",
    "MENTOR",
    "STUDENT",
    "PARENT",
  ]);
  for (const u of noChapter.filter((u) => need.has(u.primaryRole))) {
    console.log(
      JSON.stringify({
        name: u.name,
        email: u.email,
        role: u.primaryRole,
        roles: u.roles.map((r) => r.role),
      })
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
