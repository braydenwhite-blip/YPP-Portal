"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

function extractRoleSet(session: any): Set<string> {
  const roles = new Set<string>();
  const primaryRole = session?.user?.primaryRole;
  if (typeof primaryRole === "string" && primaryRole) roles.add(primaryRole);
  const rawRoles = session?.user?.roles;
  if (Array.isArray(rawRoles)) {
    for (const role of rawRoles) {
      if (typeof role === "string" && role) roles.add(role);
      if (role && typeof role === "object" && typeof role.role === "string") {
        roles.add(role.role);
      }
    }
  }
  return roles;
}

async function requireActivityAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  const roleSet = extractRoleSet(session);
  const allowed =
    roleSet.has("ADMIN") || roleSet.has("INSTRUCTOR") || roleSet.has("CHAPTER_LEAD");
  if (!allowed) {
    throw new Error("Unauthorized");
  }
  return session;
}

function revalidateActivitySurfaces() {
  revalidatePath("/admin/activities");
  revalidatePath("/activities");
  revalidatePath("/discover/try-it");
  revalidatePath("/challenges");
  revalidatePath("/world");
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

  await prisma.talentChallenge.create({
    data: {
      title,
      description,
      instructions,
      passionIds,
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
