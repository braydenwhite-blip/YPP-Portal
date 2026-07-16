"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { ReviewRoutingExceptionKind } from "@prisma/client";

async function requireAdmin() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) throw new Error("Unauthorized");
  return session as typeof session & { user: { id: string } };
}

function getString(formData: FormData, key: string, required = true) {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing ${key}`);
  }
  return value ? String(value).trim() : "";
}

async function resolveUserId(email: string): Promise<{ id: string; name: string } | null> {
  if (!email) return null;
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, name: true },
  });
  return user;
}

/** Add a review-routing exception (self-finalize or board-approval route). */
export async function createReviewRoutingException(formData: FormData) {
  const session = await requireAdmin();

  const kind = getString(formData, "kind") as ReviewRoutingExceptionKind;
  if (!Object.values(ReviewRoutingExceptionKind).includes(kind)) {
    throw new Error("Invalid kind");
  }

  const mentorEmail = getString(formData, "mentorEmail", false).toLowerCase();
  const menteeEmail = getString(formData, "menteeEmail", false).toLowerCase();
  const topInstructionMentees = formData.get("topInstructionMentees") === "on";
  const note = getString(formData, "note", false) || null;
  const effectiveFromRaw = getString(formData, "effectiveFrom", false);
  const effectiveFrom = effectiveFromRaw ? new Date(effectiveFromRaw) : null;

  const mentor = await resolveUserId(mentorEmail);
  if (!mentor) throw new Error("Mentor email not found");

  const mentee = menteeEmail ? await resolveUserId(menteeEmail) : null;
  if (!topInstructionMentees && !mentee) {
    throw new Error("Mentee email is required unless this is a top-instructor board route");
  }

  await prisma.reviewRoutingException.create({
    data: {
      kind,
      mentorId: mentor.id,
      menteeId: mentee?.id ?? null,
      topInstructionMentees: kind === "BOARD_APPROVAL" ? topInstructionMentees : false,
      note,
      effectiveFrom,
      createdById: session.user.id,
    },
  });

  revalidatePath("/admin/review-routing");
}

/** Deactivate (non-destructive — the row stays for history) an exception. */
export async function deactivateReviewRoutingException(id: string) {
  await requireAdmin();
  await prisma.reviewRoutingException.update({
    where: { id },
    data: { isActive: false },
  });
  revalidatePath("/admin/review-routing");
}
