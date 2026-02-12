"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { PortfolioItemType } from "@prisma/client";
import { validateEnum } from "@/lib/validate-enum";

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
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

export async function createOrUpdatePortfolio(formData: FormData) {
  const session = await requireAuth();
  const title = getString(formData, "title");
  const bio = getString(formData, "bio", false);
  const isPublic = formData.get("isPublic") === "on";

  await prisma.portfolio.upsert({
    where: { userId: session.user.id },
    update: { title, bio: bio || null, isPublic },
    create: { userId: session.user.id, title, bio: bio || null, isPublic },
  });

  revalidatePath("/portfolio");
}

export async function addPortfolioItem(formData: FormData) {
  const session = await requireAuth();
  const title = getString(formData, "title");
  const description = getString(formData, "description", false);
  const type = validateEnum(PortfolioItemType, getString(formData, "type"), "type");
  const url = getString(formData, "url", false);

  // Verify portfolio belongs to user
  const portfolio = await prisma.portfolio.findUnique({
    where: { userId: session.user.id },
  });
  if (!portfolio) {
    throw new Error("Create a portfolio first");
  }

  const maxOrder = await prisma.portfolioItem.aggregate({
    where: { portfolioId: portfolio.id },
    _max: { sortOrder: true },
  });

  await prisma.portfolioItem.create({
    data: {
      portfolioId: portfolio.id,
      title,
      description: description || null,
      type,
      url: url || null,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
    },
  });

  revalidatePath("/portfolio");
}

export async function deletePortfolioItem(formData: FormData) {
  const session = await requireAuth();
  const itemId = getString(formData, "itemId");

  // Verify the item belongs to the current user's portfolio
  const item = await prisma.portfolioItem.findUnique({
    where: { id: itemId },
    include: { portfolio: { select: { userId: true } } },
  });
  if (!item || item.portfolio.userId !== session.user.id) {
    throw new Error("Unauthorized");
  }

  await prisma.portfolioItem.delete({ where: { id: itemId } });

  revalidatePath("/portfolio");
}
