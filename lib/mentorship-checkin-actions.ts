"use server";

import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { createMentorshipNotification } from "@/lib/mentorship-program-actions";

/**
 * Between-review progress check-ins.
 *
 * A check-in is a short progress note a mentee posts between full monthly
 * reviews. The mentor sees it and can leave a one-line response. This keeps
 * momentum visible without waiting for the formal review cycle.
 */

export type CheckInView = {
  id: string;
  notes: string;
  rating: number | null;
  mentorResponse: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
};

function getString(formData: FormData, key: string, required = true) {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing ${key}`);
  }
  return value ? String(value).trim() : "";
}

async function requireAuth() {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function getMentorshipCheckIns(
  mentorshipId: string
): Promise<CheckInView[]> {
  const rows = await prisma.mentorshipCheckIn.findMany({
    where: { mentorshipId },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  return rows.map((row) => ({
    id: row.id,
    notes: row.notes,
    rating: row.rating,
    mentorResponse: row.mentorResponse,
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

/** Posted by the mentee on their own active mentorship. */
export async function postMenteeCheckIn(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user.id;

  const notes = getString(formData, "notes");
  const ratingRaw = getString(formData, "rating", false);
  const rating = ratingRaw ? Number.parseInt(ratingRaw, 10) : null;
  if (rating != null && (!Number.isFinite(rating) || rating < 1 || rating > 5)) {
    throw new Error("Rating must be between 1 and 5.");
  }

  const mentorship = await prisma.mentorship.findFirst({
    where: { menteeId: userId, status: "ACTIVE" },
    select: {
      id: true,
      mentorId: true,
      mentee: { select: { name: true } },
    },
  });
  if (!mentorship) {
    throw new Error("You don't have an active mentorship to check in on.");
  }

  await prisma.mentorshipCheckIn.create({
    data: {
      mentorshipId: mentorship.id,
      // Person-anchor mentee self-check-ins too (author stays null — no leader
      // logged it) so they join the unified Mentorship timeline.
      subjectId: userId,
      notes,
      rating,
    },
  });

  await createMentorshipNotification({
    userId: mentorship.mentorId,
    title: "New progress check-in",
    body: `${mentorship.mentee.name ?? "Your mentee"} posted a progress check-in.`,
    link: `/mentorship/mentees/${userId}#check-ins`,
  });

  revalidatePath("/mentorship");
  revalidatePath(`/mentorship/mentees/${userId}`);
}

/** Posted by the mentor (or an admin) in reply to a mentee check-in. */
export async function respondToMenteeCheckIn(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user.id;
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");

  const checkInId = getString(formData, "checkInId");
  const response = getString(formData, "response", false);

  const checkIn = await prisma.mentorshipCheckIn.findUnique({
    where: { id: checkInId },
    select: {
      id: true,
      mentorship: {
        select: { id: true, mentorId: true, menteeId: true },
      },
    },
  });
  if (!checkIn) {
    throw new Error("Check-in not found.");
  }
  // `mentorshipId` is nullable since the Mentorship consolidation — this legacy
  // responder only applies to pairing-anchored mentee check-ins.
  const pairing = checkIn.mentorship;
  if (!pairing) {
    throw new Error("This check-in has no mentor pairing to respond on.");
  }
  if (!isAdmin && pairing.mentorId !== userId) {
    throw new Error("Only the mentor on this pairing can respond.");
  }

  await prisma.mentorshipCheckIn.update({
    where: { id: checkInId },
    data: {
      mentorResponse: response || null,
      acknowledgedAt: new Date(),
    },
  });

  await createMentorshipNotification({
    userId: pairing.menteeId,
    title: "Your mentor responded to your check-in",
    body: response
      ? response.length > 120
        ? `${response.slice(0, 119)}…`
        : response
      : "Your mentor acknowledged your latest progress check-in.",
    link: "/mentorship",
  });

  revalidatePath("/mentorship");
  revalidatePath(`/mentorship/mentees/${pairing.menteeId}`);
}
