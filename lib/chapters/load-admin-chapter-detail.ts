import { prisma } from "@/lib/prisma";

export type AdminChapterDetail = {
  id: string;
  name: string;
  city: string | null;
  region: string | null;
  state: string | null;
  country: string | null;
  partnerSchool: string | null;
  programNotes: string | null;
  archivedAt: Date | null;
  presidentId: string | null;
  president: { id: string; name: string; email: string } | null;
  users: Array<{
    id: string;
    name: string;
    email: string;
    primaryRole: string | null;
    roles: { role: string }[];
  }>;
};

type ChapterRow = {
  id: string;
  name: string;
  city: string | null;
  region: string | null;
  state: string | null;
  country: string | null;
  partnerSchool: string | null;
  programNotes: string | null;
  archivedAt: Date | null;
  presidentId: string | null;
};

async function loadChapterRow(id: string): Promise<ChapterRow | null> {
  try {
    const rows = await prisma.$queryRaw<ChapterRow[]>`
      SELECT
        id,
        name,
        city,
        region,
        state,
        country,
        "partnerSchool",
        "programNotes",
        "archivedAt",
        "presidentId"
      FROM "Chapter"
      WHERE id = ${id}
      LIMIT 1
    `;
    return rows[0] ?? null;
  } catch {
    const rows = await prisma.$queryRaw<Omit<ChapterRow, "country">[]>`
      SELECT
        id,
        name,
        city,
        region,
        state,
        "partnerSchool",
        "programNotes",
        "archivedAt",
        "presidentId"
      FROM "Chapter"
      WHERE id = ${id}
      LIMIT 1
    `;
    const row = rows[0];
    return row ? { ...row, country: null } : null;
  }
}

export async function loadAdminChapterDetail(id: string): Promise<AdminChapterDetail | null> {
  const chapter = await loadChapterRow(id);
  if (!chapter) return null;

  const [users, president] = await Promise.all([
    prisma.user.findMany({
      where: { chapterId: id },
      select: {
        id: true,
        name: true,
        email: true,
        primaryRole: true,
        roles: { select: { role: true } },
      },
      orderBy: { name: "asc" },
    }),
    chapter.presidentId
      ? prisma.user.findUnique({
          where: { id: chapter.presidentId },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve(null),
  ]);

  return { ...chapter, president, users };
}
