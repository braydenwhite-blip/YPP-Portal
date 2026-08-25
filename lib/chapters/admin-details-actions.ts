"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSessionUser } from "@/lib/authorization";
import { hasAnyRole } from "@/lib/authorization-roles";
import { slugifyChapterName } from "@/lib/chapter-calendar";
import { prisma } from "@/lib/prisma";

export type DetailsActionResult = { ok: true } | { ok: false; error: string };

async function requireAdminUser() {
  const user = await requireSessionUser();
  if (!hasAnyRole(user.roles, ["ADMIN"], user.primaryRole)) {
    throw new Error("Unauthorized");
  }
  return user;
}

function revalidateChapter(chapterId: string) {
  revalidatePath("/admin/chapters");
  revalidatePath("/chapters");
  revalidatePath(`/admin/chapters/${chapterId}`);
}

async function uniqueSlug(name: string, chapterId: string) {
  const cleaned = slugifyChapterName(name);
  let candidate = cleaned || "chapter";
  let suffix = 2;
  while (true) {
    const existing = await prisma.chapter.findFirst({
      where: { slug: candidate, id: { not: chapterId } },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${cleaned || "chapter"}-${suffix}`;
    suffix += 1;
  }
}

const OptionalText = z.string().trim().max(120);
const Notes = z.string().trim().max(2000);

const SaveSchema = z.object({
  chapterId: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  city: OptionalText,
  state: OptionalText,
  country: OptionalText,
  partner: OptionalText,
  notes: Notes,
});

export async function saveChapterDetails(input: unknown): Promise<DetailsActionResult> {
  const parsed = SaveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the fields and try again." };
  await requireAdminUser();

  const { chapterId, name, city, state, country, partner, notes } = parsed.data;

  const duplicate = await prisma.chapter.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, id: { not: chapterId } },
    select: { id: true },
  });
  if (duplicate) return { ok: false, error: `Another chapter named "${name}" already exists.` };

  await prisma.chapter.update({
    where: { id: chapterId },
    data: {
      name,
      slug: await uniqueSlug(name, chapterId),
      city: city || null,
      state: state || null,
      region: state || null,
      partnerSchool: partner || null,
      programNotes: notes || null,
    },
  });
  await prisma.$executeRaw`
    UPDATE "Chapter" SET country = NULLIF(${country}, '') WHERE id = ${chapterId}
  `;

  revalidateChapter(chapterId);
  return { ok: true };
}

const ChapterIdSchema = z.object({ chapterId: z.string().min(1) });

export async function archiveChapterDetails(input: unknown): Promise<DetailsActionResult> {
  const parsed = ChapterIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Missing chapter." };
  const user = await requireAdminUser();
  const { chapterId } = parsed.data;

  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: { id: true, archivedAt: true },
  });
  if (!chapter) return { ok: false, error: "Chapter not found." };
  if (!chapter.archivedAt) {
    await prisma.chapter.update({
      where: { id: chapterId },
      data: { archivedAt: new Date(), archivedById: user.id },
    });
  }

  revalidateChapter(chapterId);
  return { ok: true };
}

export async function restoreChapterDetails(input: unknown): Promise<DetailsActionResult> {
  const parsed = ChapterIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Missing chapter." };
  await requireAdminUser();

  await prisma.chapter.update({
    where: { id: parsed.data.chapterId },
    data: { archivedAt: null, archivedById: null },
  });

  revalidateChapter(parsed.data.chapterId);
  return { ok: true };
}

export async function deleteChapterDetails(
  input: unknown
): Promise<DetailsActionResult | { ok: true; deleted: true }> {
  const parsed = ChapterIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Missing chapter." };
  await requireAdminUser();
  const { chapterId } = parsed.data;

  const usersCount = await prisma.user.count({ where: { chapterId } });
  if (usersCount > 0) {
    return { ok: false, error: "Can't delete a chapter with members. Archive it instead." };
  }

  await prisma.$transaction([
    prisma.announcement.deleteMany({ where: { chapterId } }),
    prisma.position.deleteMany({ where: { chapterId } }),
    prisma.event.deleteMany({ where: { chapterId } }),
    prisma.course.updateMany({ where: { chapterId }, data: { chapterId: null } }),
    prisma.goalTemplate.deleteMany({ where: { chapterId } }),
    prisma.marketingStats.deleteMany({ where: { chapterId } }),
    prisma.marketingGoal.deleteMany({ where: { chapterId } }),
    prisma.chapterUpdate.deleteMany({ where: { chapterId } }),
    prisma.chapter.delete({ where: { id: chapterId } }),
  ]);

  revalidatePath("/admin/chapters");
  revalidatePath("/chapters");
  return { ok: true, deleted: true };
}
