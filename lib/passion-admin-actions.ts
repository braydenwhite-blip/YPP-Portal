"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PassionCategory } from "@prisma/client";
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

async function requirePassionAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  const roles = extractRoleSet(session);
  if (!roles.has("ADMIN") && !roles.has("INSTRUCTOR") && !roles.has("CHAPTER_LEAD")) {
    throw new Error("Unauthorized");
  }
  return session;
}

function parseCategory(raw: string): PassionCategory {
  return (Object.values(PassionCategory).find((value) => value === raw) ?? PassionCategory.OTHER);
}

function parseRelatedAreaIds(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function revalidatePassionSurfaces() {
  revalidatePath("/admin/passions");
  revalidatePath("/activities");
  revalidatePath("/world");
  revalidatePath("/discover/try-it");
}

export async function getPassionAreasForAdmin() {
  await requirePassionAdmin();
  return prisma.passionArea.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
}

export async function createPassionArea(formData: FormData) {
  await requirePassionAdmin();

  const name = String(formData.get("name") || "").trim();
  const category = parseCategory(String(formData.get("category") || PassionCategory.OTHER));
  const description = String(formData.get("description") || "").trim();
  const icon = String(formData.get("icon") || "").trim() || null;
  const color = String(formData.get("color") || "").trim() || null;
  const order = Number.parseInt(String(formData.get("order") || "0"), 10) || 0;
  const relatedAreaIds = parseRelatedAreaIds(String(formData.get("relatedAreaIds") || ""));
  const isActive = formData.get("isActive") !== "false";

  if (!name || !description) {
    throw new Error("Name and description are required");
  }

  await prisma.passionArea.upsert({
    where: { name },
    update: {
      category,
      description,
      icon,
      color,
      order,
      relatedAreaIds,
      isActive,
    },
    create: {
      name,
      category,
      description,
      icon,
      color,
      order,
      relatedAreaIds,
      isActive,
    },
  });

  revalidatePassionSurfaces();
}

export async function updatePassionArea(formData: FormData) {
  await requirePassionAdmin();

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const category = parseCategory(String(formData.get("category") || PassionCategory.OTHER));
  const description = String(formData.get("description") || "").trim();
  const icon = String(formData.get("icon") || "").trim() || null;
  const color = String(formData.get("color") || "").trim() || null;
  const order = Number.parseInt(String(formData.get("order") || "0"), 10) || 0;
  const relatedAreaIds = parseRelatedAreaIds(String(formData.get("relatedAreaIds") || ""));
  const isActive = formData.get("isActive") === "true";

  if (!id || !name || !description) {
    throw new Error("Id, name, and description are required");
  }

  await prisma.passionArea.update({
    where: { id },
    data: {
      name,
      category,
      description,
      icon,
      color,
      order,
      relatedAreaIds,
      isActive,
    },
  });

  revalidatePassionSurfaces();
}

export async function togglePassionArea(id: string, isActive: boolean) {
  await requirePassionAdmin();
  await prisma.passionArea.update({
    where: { id },
    data: { isActive },
  });
  revalidatePassionSurfaces();
}
