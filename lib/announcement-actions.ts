"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { RoleType } from "@prisma/client";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    throw new Error("Unauthorized");
  }
  return session;
}

function getString(formData: FormData, key: string, required = true) {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing ${key}`);
  }
  return value ? String(value).trim() : "";
}

export async function createAnnouncement(formData: FormData) {
  const session = await requireAdmin();
  const authorId = session?.user?.id;
  if (!authorId) throw new Error("No user ID");

  const title = getString(formData, "title");
  const content = getString(formData, "content");
  const chapterId = getString(formData, "chapterId", false);
  const expiresAtStr = getString(formData, "expiresAt", false);
  const targetRoles = formData.getAll("targetRoles").map((r) => String(r)) as RoleType[];

  await prisma.announcement.create({
    data: {
      title,
      content,
      authorId,
      chapterId: chapterId || null,
      expiresAt: expiresAtStr ? new Date(expiresAtStr) : null,
      targetRoles: targetRoles.length > 0 ? targetRoles : Object.values(RoleType),
      isActive: true
    }
  });

  revalidatePath("/announcements");
  revalidatePath("/admin/announcements");
  revalidatePath("/");
}

export async function updateAnnouncement(formData: FormData) {
  await requireAdmin();
  const id = getString(formData, "id");
  const title = getString(formData, "title");
  const content = getString(formData, "content");
  const chapterId = getString(formData, "chapterId", false);
  const expiresAtStr = getString(formData, "expiresAt", false);
  const isActive = formData.get("isActive") === "on";
  const targetRoles = formData.getAll("targetRoles").map((r) => String(r)) as RoleType[];

  await prisma.announcement.update({
    where: { id },
    data: {
      title,
      content,
      chapterId: chapterId || null,
      expiresAt: expiresAtStr ? new Date(expiresAtStr) : null,
      targetRoles: targetRoles.length > 0 ? targetRoles : Object.values(RoleType),
      isActive
    }
  });

  revalidatePath("/announcements");
  revalidatePath("/admin/announcements");
  revalidatePath("/");
}

export async function deleteAnnouncement(formData: FormData) {
  await requireAdmin();
  const id = getString(formData, "id");

  await prisma.announcement.delete({
    where: { id }
  });

  revalidatePath("/announcements");
  revalidatePath("/admin/announcements");
  revalidatePath("/");
}

export async function toggleAnnouncementActive(formData: FormData) {
  await requireAdmin();
  const id = getString(formData, "id");
  const currentActive = formData.get("currentActive") === "true";

  await prisma.announcement.update({
    where: { id },
    data: { isActive: !currentActive }
  });

  revalidatePath("/announcements");
  revalidatePath("/admin/announcements");
  revalidatePath("/");
}
