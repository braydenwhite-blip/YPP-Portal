"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";
import { uploadFile } from "@/lib/storage";
import { isRecoverablePrismaError } from "@/lib/prisma-guard";

// ============================================
// CHAPTER SETTINGS & PROFILE MANAGEMENT
// ============================================

async function requireChapterLead() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  const isAdmin = user?.roles.some((r) => r.role === "ADMIN");
  const isChapterLead = user?.roles.some((r) => r.role === "CHAPTER_PRESIDENT");

  if (!isAdmin && !isChapterLead) {
    throw new Error("Only Chapter Presidents and Admins can manage chapter settings");
  }

  if (!user?.chapterId) throw new Error("User is not assigned to a chapter");

  return { user, chapterId: user.chapterId, isAdmin };
}

export async function getChapterSettings() {
  const { chapterId } = await requireChapterLead();

  let chapter;
  try {
    chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        region: true,
        description: true,
        tagline: true,
        logoUrl: true,
        bannerUrl: true,
        isPublic: true,
        joinPolicy: true,
      },
    });
  } catch (error) {
    if (!isRecoverablePrismaError(error)) {
      throw error;
    }

    console.error(
      "[getChapterSettings] Chapter profile fields are unavailable; using basic chapter fallback.",
      error
    );

    const basicChapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        region: true,
      },
    });

    chapter = basicChapter
      ? {
          ...basicChapter,
          description: null,
          tagline: null,
          logoUrl: null,
          bannerUrl: null,
          isPublic: true,
          joinPolicy: "OPEN" as const,
        }
      : null;
  }

  if (!chapter) throw new Error("Chapter not found");
  return chapter;
}

export async function updateChapterProfile(formData: FormData) {
  const { chapterId } = await requireChapterLead();

  const slug = formData.get("slug") as string | null;
  const description = formData.get("description") as string | null;
  const tagline = formData.get("tagline") as string | null;
  const isPublic = formData.get("isPublic") === "true";
  const joinPolicy = formData.get("joinPolicy") as string | null;

  // Validate slug format
  if (slug) {
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(slug)) {
      throw new Error("Slug must only contain lowercase letters, numbers, and hyphens");
    }
    if (slug.length < 3 || slug.length > 50) {
      throw new Error("Slug must be between 3 and 50 characters");
    }

    // Check uniqueness
    const existing = await prisma.chapter.findUnique({ where: { slug } });
    if (existing && existing.id !== chapterId) {
      throw new Error("This slug is already taken by another chapter");
    }
  }

  // Validate joinPolicy
  const validPolicies = ["OPEN", "APPROVAL", "INVITE_ONLY"];
  if (joinPolicy && !validPolicies.includes(joinPolicy)) {
    throw new Error("Invalid join policy");
  }

  await prisma.chapter.update({
    where: { id: chapterId },
    data: {
      slug: slug || undefined,
      description: description || undefined,
      tagline: tagline || undefined,
      isPublic,
      ...(joinPolicy ? { joinPolicy: joinPolicy as "OPEN" | "APPROVAL" | "INVITE_ONLY" } : {}),
    },
  });

  revalidatePath("/chapter/settings");
  revalidatePath("/chapters");
  return { success: true };
}

export async function uploadChapterImage(formData: FormData) {
  const { chapterId } = await requireChapterLead();

  const file = formData.get("file") as File | null;
  const imageType = formData.get("imageType") as string; // "logo" or "banner"

  if (!file || file.size === 0) throw new Error("No file provided");

  // Validate file type
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
  if (!allowedTypes.includes(file.type)) {
    throw new Error("Only JPEG, PNG, WebP, and SVG images are allowed");
  }

  // Validate file size (2MB for logo, 5MB for banner)
  const maxSize = imageType === "logo" ? 2 * 1024 * 1024 : 5 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error(`File too large. Maximum size: ${imageType === "logo" ? "2MB" : "5MB"}`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await uploadFile({
    file: buffer,
    filename: `chapter-${imageType}-${chapterId}.${file.name.split(".").pop()}`,
    contentType: file.type,
  });

  const updateData = imageType === "logo"
    ? { logoUrl: result.url }
    : { bannerUrl: result.url };

  await prisma.chapter.update({
    where: { id: chapterId },
    data: updateData,
  });

  revalidatePath("/chapter/settings");
  revalidatePath("/chapters");
  return { success: true, url: result.url };
}
