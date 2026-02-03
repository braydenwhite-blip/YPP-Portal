"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

async function requireStudent() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!session?.user?.id || !roles.includes("STUDENT")) {
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

export async function requestEnrollment(formData: FormData) {
  const session = await requireStudent();
  const userId = session.user.id as string;
  const courseId = getString(formData, "courseId");

  const existing = await prisma.enrollment.findFirst({
    where: { userId, courseId }
  });

  if (existing) {
    if (existing.status === "ENROLLED" || existing.status === "PENDING") {
      return;
    }
    await prisma.enrollment.update({
      where: { id: existing.id },
      data: { status: "PENDING" }
    });
  } else {
    await prisma.enrollment.create({
      data: { userId, courseId, status: "PENDING" }
    });
  }

  revalidatePath("/");
  revalidatePath("/curriculum");
  revalidatePath("/pathways");
}
