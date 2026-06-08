/**
 * Mentorship 2.0 (Action Tracker 3.0, Phase M1) — read helpers.
 *
 * Plain async functions (not `"use server"`) for use from Server Components and
 * server actions. Reads only; all mutations live in the `*-actions.ts` files.
 */

import { prisma } from "@/lib/prisma";
import {
  OPEN_APPLICATION_STATUSES,
  type MentorshipApplicationStatus,
} from "./constants";

/** Active expertise taxonomy, ordered for display. */
export async function listExpertiseAreas() {
  return prisma.expertiseArea.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

/** A single mentor's claimed expertise (with the area joined), display-ordered. */
export async function getMentorExpertise(userId: string) {
  return prisma.mentorExpertise.findMany({
    where: { userId },
    include: { expertiseArea: true },
    orderBy: { expertiseArea: { sortOrder: "asc" } },
  });
}

/**
 * Mentors who claim a given expertise area (by slug). Feeds the Phase M2
 * matching engine and the Part J discovery surfaces ("find a mentor by skill").
 */
export async function getMentorsByExpertiseSlug(slug: string) {
  return prisma.mentorExpertise.findMany({
    where: { expertiseArea: { slug, isActive: true } },
    include: { user: { select: { id: true, name: true } } },
  });
}

/** Officer queue: applications filtered by status, newest first. */
export async function listMentorshipApplications(opts?: {
  statuses?: MentorshipApplicationStatus[];
}) {
  return prisma.mentorshipApplication.findMany({
    where: opts?.statuses?.length ? { status: { in: opts.statuses } } : undefined,
    include: { applicant: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/** All applications a given user has submitted, newest first. */
export async function getMentorshipApplicationsForUser(userId: string) {
  return prisma.mentorshipApplication.findMany({
    where: { applicantId: userId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * The user's current open application, if any — used to prevent duplicate open
 * submissions and to render the mentee's "application pending" state.
 */
export async function getOpenApplicationForUser(userId: string) {
  return prisma.mentorshipApplication.findFirst({
    where: {
      applicantId: userId,
      status: { in: [...OPEN_APPLICATION_STATUSES] },
    },
    orderBy: { createdAt: "desc" },
  });
}
