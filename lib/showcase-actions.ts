"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  const roles: string[] = (session.user as any).roles ?? [];
  if (!roles.includes("ADMIN")) {
    throw new Error("Unauthorized");
  }
  return session as typeof session & { user: { id: string; roles: string[] } };
}

function getString(formData: FormData, key: string, required = true) {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing ${key}`);
  }
  return value ? String(value).trim() : "";
}

// ─── Passion Showcases ───

export async function createShowcase(formData: FormData) {
  await requireAdmin();
  const title = getString(formData, "title");
  const description = getString(formData, "description", false);
  const date = new Date(getString(formData, "date"));
  const location = getString(formData, "location", false);
  const isVirtual = formData.get("isVirtual") === "on";
  const chapterId = getString(formData, "chapterId", false);
  const registrationDeadline = getString(formData, "registrationDeadline", false);
  const maxPresenters = getString(formData, "maxPresenters", false);
  const status = getString(formData, "status");

  if (!["UPCOMING", "REGISTRATION_OPEN", "COMPLETED"].includes(status)) {
    throw new Error("Invalid status");
  }

  await prisma.passionShowcase.create({
    data: {
      title,
      description: description || null,
      date,
      location: location || null,
      isVirtual,
      chapterId: chapterId || null,
      registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null,
      maxPresenters: maxPresenters ? parseInt(maxPresenters, 10) : null,
      status,
    },
  });

  revalidatePath("/admin/showcases");
  revalidatePath("/showcases");
}

export async function updateShowcaseStatus(formData: FormData) {
  await requireAdmin();
  const id = getString(formData, "id");
  const status = getString(formData, "status");

  if (!["UPCOMING", "REGISTRATION_OPEN", "COMPLETED"].includes(status)) {
    throw new Error("Invalid status");
  }

  await prisma.passionShowcase.update({
    where: { id },
    data: { status },
  });

  revalidatePath("/admin/showcases");
  revalidatePath("/showcases");
}

// ─── Success Stories ───

export async function createSuccessStory(formData: FormData) {
  await requireAdmin();
  const name = getString(formData, "name");
  const title = getString(formData, "title");
  const story = getString(formData, "story");
  const passionId = getString(formData, "passionId");
  const personId = getString(formData, "personId", false);
  const videoUrl = getString(formData, "videoUrl", false);
  const currentRole = getString(formData, "currentRole", false);
  const advice = getString(formData, "advice", false);
  const tagsRaw = getString(formData, "tags", false);
  const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [];
  const featured = formData.get("featured") === "on";

  await prisma.successStory.create({
    data: {
      name,
      title,
      story,
      passionId,
      personId: personId || null,
      videoUrl: videoUrl || null,
      currentRole: currentRole || null,
      advice: advice || null,
      tags,
      featured,
    },
  });

  revalidatePath("/admin/stories");
  revalidatePath("/stories");
}

export async function toggleStoryFeatured(formData: FormData) {
  await requireAdmin();
  const id = getString(formData, "id");
  const current = formData.get("currentFeatured") === "true";

  await prisma.successStory.update({
    where: { id },
    data: { featured: !current },
  });

  revalidatePath("/admin/stories");
  revalidatePath("/stories");
}

// ─── Student of the Month ───

export async function createStudentOfMonth(formData: FormData) {
  await requireAdmin();
  const studentId = getString(formData, "studentId");
  const month = new Date(getString(formData, "month"));
  const chapterId = getString(formData, "chapterId", false);
  const nomination = getString(formData, "nomination");
  const achievementsRaw = getString(formData, "achievements", false);
  const achievements = achievementsRaw
    ? achievementsRaw.split("\n").map((a) => a.trim()).filter(Boolean)
    : [];

  await prisma.studentOfMonth.create({
    data: {
      studentId,
      month,
      chapterId: chapterId || null,
      nomination,
      achievements,
    },
  });

  revalidatePath("/admin/student-of-month");
  revalidatePath("/student-of-month");
}

// ─── Wall of Fame ───

export async function createWallOfFameEntry(formData: FormData) {
  await requireAdmin();
  const studentId = getString(formData, "studentId");
  const achievement = getString(formData, "achievement");
  const passionId = getString(formData, "passionId");
  const description = getString(formData, "description");
  const date = new Date(getString(formData, "date"));
  const mediaUrl = getString(formData, "mediaUrl", false);
  const displayOrder = parseInt(getString(formData, "displayOrder"), 10);

  await prisma.wallOfFame.create({
    data: {
      studentId,
      achievement,
      passionId,
      description,
      date,
      mediaUrl: mediaUrl || null,
      displayOrder,
      isActive: true,
    },
  });

  revalidatePath("/admin/wall-of-fame");
  revalidatePath("/wall-of-fame");
}

export async function toggleWallOfFameActive(formData: FormData) {
  await requireAdmin();
  const id = getString(formData, "id");
  const currentActive = formData.get("currentActive") === "true";

  await prisma.wallOfFame.update({
    where: { id },
    data: { isActive: !currentActive },
  });

  revalidatePath("/admin/wall-of-fame");
  revalidatePath("/wall-of-fame");
}
