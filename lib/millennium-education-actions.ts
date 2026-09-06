"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import type { MillenniumEducationStatus } from "@prisma/client";

async function requireStaffOrCpAccess() {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  const allowed =
    roles.includes("ADMIN") || roles.includes("STAFF") || roles.includes("CHAPTER_PRESIDENT");
  if (!allowed) throw new Error("Not authorized for Millennium Education tracking.");
  return session;
}

/** CPs and admins see every record — no chapter scoping, per confirmed scope. */
export async function loadMillenniumEducationRecords() {
  await requireStaffOrCpAccess();
  return prisma.millenniumEducationRecord.findMany({
    include: {
      student: {
        select: { id: true, name: true, email: true, chapter: { select: { name: true } } },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

/** Students eligible to be added to a Millennium Education record (any student not already tracked). */
export async function loadUntrackedStudents() {
  await requireStaffOrCpAccess();
  return prisma.user.findMany({
    where: { primaryRole: "STUDENT", millenniumEducationRecords: { none: {} } },
    select: { id: true, name: true, chapter: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
}

export async function createMillenniumEducationRecord(formData: FormData) {
  await requireStaffOrCpAccess();
  const studentId = String(formData.get("studentId") ?? "");
  if (!studentId) throw new Error("A student is required.");

  await prisma.millenniumEducationRecord.create({
    data: {
      studentId,
      status: (formData.get("status") as MillenniumEducationStatus) || "ENROLLED",
      startDate: formData.get("startDate") ? new Date(String(formData.get("startDate"))) : null,
      hoursCompleted: Number(formData.get("hoursCompleted") ?? 0),
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/admin/millennium-education");
  revalidatePath("/chapter/millennium-education");
}

export async function updateMillenniumEducationRecord(formData: FormData) {
  await requireStaffOrCpAccess();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing record id.");

  const status = formData.get("status") as MillenniumEducationStatus;
  const completionDate = formData.get("completionDate")
    ? new Date(String(formData.get("completionDate")))
    : null;

  await prisma.millenniumEducationRecord.update({
    where: { id },
    data: {
      status,
      completionDate,
      hoursCompleted: Number(formData.get("hoursCompleted") ?? 0),
      certificateIssued: formData.get("certificateIssued") === "on",
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/admin/millennium-education");
  revalidatePath("/chapter/millennium-education");
}