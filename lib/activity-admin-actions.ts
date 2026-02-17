"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAnyRole } from "@/lib/authorization";

async function requireActivityAdmin() {
  return requireAnyRole(["ADMIN", "INSTRUCTOR", "CHAPTER_LEAD"]);
}

function revalidateActivitySurfaces() {
  revalidatePath("/admin/activities");
  revalidatePath("/activities");
  revalidatePath("/discover/try-it");
  revalidatePath("/challenges");
  revalidatePath("/world");
}

async function ensureCanonicalPassionArea(
  passionId: string
): Promise<{ id: string; name: string }> {
  const passion = await prisma.passionArea.findFirst({
    where: { id: passionId, isActive: true },
    select: { id: true, name: true },
  });
  if (!passion) {
    throw new Error("Select a valid active passion area.");
  }
  return passion;
}

export async function getActivityAdminCatalog() {
  await requireActivityAdmin();

  const [passionAreas, tryItSessions, talentChallenges, portalChallenges, incubatorProjects] =
    await Promise.all([
      prisma.passionArea
        .findMany({
          where: { isActive: true },
          orderBy: [{ order: "asc" }, { name: "asc" }],
          select: { id: true, name: true },
        })
        .catch(() => []),
      prisma.tryItSession
        .findMany({
          orderBy: [{ isActive: "desc" }, { order: "asc" }, { createdAt: "desc" }],
        })
        .catch(() => []),
      prisma.talentChallenge
        .findMany({
          orderBy: [{ isActive: "desc" }, { order: "asc" }, { id: "desc" }],
        })
        .catch(() => []),
      prisma.challenge
        .findMany({
          orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
          include: { _count: { select: { participants: true } } },
        })
        .catch(() => []),
      prisma.incubatorProject
        .findMany({
          orderBy: { updatedAt: "desc" },
          take: 10,
          include: {
            student: { select: { name: true } },
            cohort: { select: { name: true } },
          },
        })
        .catch(() => []),
    ]);

  return { passionAreas, tryItSessions, talentChallenges, portalChallenges, incubatorProjects };
}

export async function createTryItActivity(formData: FormData) {
  await requireActivityAdmin();

  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const passionId = String(formData.get("passionId") || "").trim();
  const videoUrl = String(formData.get("videoUrl") || "").trim();
  const duration = Number.parseInt(String(formData.get("duration") || "0"), 10);
  const whatYoullLearn = String(formData.get("whatYoullLearn") || "").trim() || null;
  const materialsNeeded = String(formData.get("materialsNeeded") || "").trim() || null;
  const presenter = String(formData.get("presenter") || "").trim() || null;
  const order = Number.parseInt(String(formData.get("order") || "0"), 10) || 0;
  const isActive = formData.get("isActive") === "on";

  if (!title || !description || !passionId || !videoUrl || !duration) {
    throw new Error("Title, description, passion area, video URL, and duration are required");
  }
  await ensureCanonicalPassionArea(passionId);

  await prisma.tryItSession.create({
    data: {
      title,
      description,
      passionId,
      videoUrl,
      duration,
      whatYoullLearn,
      materialsNeeded,
      presenter,
      order,
      isActive,
    },
  });

  revalidateActivitySurfaces();
}

export async function toggleTryItActivity(sessionId: string, isActive: boolean) {
  await requireActivityAdmin();
  await prisma.tryItSession.update({
    where: { id: sessionId },
    data: { isActive },
  });
  revalidateActivitySurfaces();
}

export async function createTalentActivity(formData: FormData) {
  await requireActivityAdmin();

  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const instructions = String(formData.get("instructions") || "").trim();
  const difficulty = String(formData.get("difficulty") || "EASY").trim();
  const estimatedMinutes = Number.parseInt(String(formData.get("estimatedMinutes") || "15"), 10) || 15;
  const videoUrl = String(formData.get("videoUrl") || "").trim() || null;
  const materialsNeeded = String(formData.get("materialsNeeded") || "").trim() || null;
  const order = Number.parseInt(String(formData.get("order") || "0"), 10) || 0;
  const isActive = formData.get("isActive") === "on";
  const rawPassionIds = String(formData.get("passionIds") || "").trim();
  const selectedPassionId = String(formData.get("passionId") || "").trim();
  const passionIds = rawPassionIds
    ? rawPassionIds.split(",").map((value) => value.trim()).filter(Boolean)
    : selectedPassionId
      ? [selectedPassionId]
      : [];

  if (!title || !description || !instructions || passionIds.length === 0) {
    throw new Error("Title, description, instructions, and at least one passion area are required");
  }

  const canonicalPassions = await prisma.passionArea.findMany({
    where: { id: { in: passionIds }, isActive: true },
    select: { id: true },
  });
  const canonicalIdSet = new Set(canonicalPassions.map((entry) => entry.id));
  if (canonicalIdSet.size !== passionIds.length) {
    throw new Error("One or more selected passion areas are invalid or inactive.");
  }

  await prisma.talentChallenge.create({
    data: {
      title,
      description,
      instructions,
      passionIds: Array.from(canonicalIdSet),
      difficulty,
      estimatedMinutes,
      videoUrl,
      materialsNeeded,
      order,
      isActive,
    },
  });

  revalidateActivitySurfaces();
}

export async function toggleTalentActivity(challengeId: string, isActive: boolean) {
  await requireActivityAdmin();
  await prisma.talentChallenge.update({
    where: { id: challengeId },
    data: { isActive },
  });
  revalidateActivitySurfaces();
}
