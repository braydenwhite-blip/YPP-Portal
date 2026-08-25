"use server";

import { revalidatePath } from "next/cache";
import { RoleType } from "@prisma/client";
import { z } from "zod";

import { requireSessionUser } from "@/lib/authorization";
import { hasAnyRole } from "@/lib/authorization-roles";
import { prisma } from "@/lib/prisma";

export type RosterActionResult = { ok: true } | { ok: false; error: string };

export type ChapterPersonHit = {
  id: string;
  name: string;
  email: string;
  chapterId: string | null;
  chapterName: string | null;
};

async function requireChapterAdmin() {
  const user = await requireSessionUser();
  if (!hasAnyRole(user.roles, ["ADMIN", "STAFF"], user.primaryRole)) {
    throw new Error("Unauthorized");
  }
  return user;
}

function revalidateChapter(chapterId: string) {
  revalidatePath("/admin/chapters");
  revalidatePath(`/admin/chapters/${chapterId}`);
}

const ChapterUserSchema = z.object({
  chapterId: z.string().min(1),
  userId: z.string().min(1),
});

const SearchSchema = z.object({
  query: z.string().trim().min(2).max(80),
  chapterId: z.string().min(1),
});

export async function searchPeopleForChapter(input: unknown): Promise<ChapterPersonHit[]> {
  const parsed = SearchSchema.safeParse(input);
  if (!parsed.success) return [];
  await requireChapterAdmin();

  const { query } = parsed.data;
  const rows = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      chapterId: true,
      chapter: { select: { name: true } },
    },
    orderBy: { name: "asc" },
    take: 12,
  });

  return rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    chapterId: u.chapterId,
    chapterName: u.chapter?.name ?? null,
  }));
}

async function syncPrimaryPresident(chapterId: string, preferredId?: string | null) {
  const [chapter, presidents] = await Promise.all([
    prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { presidentId: true },
    }),
    prisma.user.findMany({
      where: {
        chapterId,
        OR: [
          { primaryRole: RoleType.CHAPTER_PRESIDENT },
          { roles: { some: { role: RoleType.CHAPTER_PRESIDENT } } },
        ],
      },
      select: { id: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!chapter) return;

  const ids = presidents.map((p) => p.id);
  const next =
    (chapter.presidentId && ids.includes(chapter.presidentId) ? chapter.presidentId : null) ??
    (preferredId && ids.includes(preferredId) ? preferredId : null) ??
    ids[0] ??
    null;

  if (next !== chapter.presidentId) {
    await prisma.chapter.update({
      where: { id: chapterId },
      data: { presidentId: next },
    });
  }
}

async function stripPresidentRole(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      primaryRole: true,
      roles: { select: { role: true } },
    },
  });
  if (!user) return;

  await prisma.userRole.deleteMany({
    where: { userId, role: RoleType.CHAPTER_PRESIDENT },
  });

  if (user.primaryRole === RoleType.CHAPTER_PRESIDENT) {
    const fallback =
      user.roles.find((r) => r.role !== RoleType.CHAPTER_PRESIDENT)?.role ?? RoleType.APPLICANT;
    await prisma.user.update({
      where: { id: userId },
      data: { primaryRole: fallback },
    });
  }
}

export async function setChapterPresident(input: unknown): Promise<RosterActionResult> {
  const parsed = ChapterUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  await requireChapterAdmin();
  const { chapterId, userId } = parsed.data;

  const [chapter, user] = await Promise.all([
    prisma.chapter.findUnique({ where: { id: chapterId }, select: { id: true } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, chapterId: true, primaryRole: true },
    }),
  ]);
  if (!chapter) return { ok: false, error: "Chapter not found" };
  if (!user) return { ok: false, error: "Person not found" };

  const previousChapterId = user.chapterId;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { chapterId, primaryRole: RoleType.CHAPTER_PRESIDENT },
    }),
    prisma.userRole.upsert({
      where: { userId_role: { userId, role: RoleType.CHAPTER_PRESIDENT } },
      create: { userId, role: RoleType.CHAPTER_PRESIDENT },
      update: {},
    }),
  ]);

  await syncPrimaryPresident(chapterId, userId);
  if (previousChapterId && previousChapterId !== chapterId) {
    await syncPrimaryPresident(previousChapterId);
  }

  revalidateChapter(chapterId);
  if (previousChapterId && previousChapterId !== chapterId) {
    revalidateChapter(previousChapterId);
  }
  return { ok: true };
}

export async function addChapterMember(input: unknown): Promise<RosterActionResult> {
  const parsed = ChapterUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  await requireChapterAdmin();
  const { chapterId, userId } = parsed.data;

  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: { id: true },
  });
  if (!chapter) return { ok: false, error: "Chapter not found" };

  await prisma.user.update({
    where: { id: userId },
    data: { chapterId },
  });

  revalidateChapter(chapterId);
  return { ok: true };
}

export async function removeChapterMember(input: unknown): Promise<RosterActionResult> {
  const parsed = ChapterUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  await requireChapterAdmin();
  const { chapterId, userId } = parsed.data;

  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: { id: true },
  });
  if (!chapter) return { ok: false, error: "Chapter not found" };

  const member = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, chapterId: true },
  });
  if (!member || member.chapterId !== chapterId) {
    return { ok: false, error: "That person is not in this chapter" };
  }

  await stripPresidentRole(userId);
  await prisma.user.update({
    where: { id: userId },
    data: { chapterId: null },
  });
  await syncPrimaryPresident(chapterId);

  revalidateChapter(chapterId);
  return { ok: true };
}

export async function removeChapterPresident(input: unknown): Promise<RosterActionResult> {
  const parsed = ChapterUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  await requireChapterAdmin();
  const { chapterId, userId } = parsed.data;

  const member = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, chapterId: true },
  });
  if (!member || member.chapterId !== chapterId) {
    return { ok: false, error: "That person is not a president of this chapter" };
  }

  await stripPresidentRole(userId);
  await syncPrimaryPresident(chapterId);

  revalidateChapter(chapterId);
  return { ok: true };
}
