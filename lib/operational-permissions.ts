import { prisma } from "@/lib/prisma";

export type Session4Actor = { userId: string; roles: string[]; chapterIds?: string[] };

export function canOverrideReadiness(roles: string[]) {
  return roles.some((role) => ["ADMIN", "CHAPTER_PRESIDENT", "LEADERSHIP"].includes(role));
}

export function canOverrideAttendanceFinalization(roles: string[]) {
  return roles.some((role) => ["ADMIN", "CHAPTER_PRESIDENT", "LEADERSHIP"].includes(role));
}

const ACTIVE_ASSIGNMENT_STATUSES = ["INSTRUCTOR_CONFIRMED", "CHAPTER_CONFIRMED", "FULLY_CONFIRMED"];

/** True if `assignments` (an offering's regularInstructorAssignments) contains an
 * active co-instructor row for the given user. */
export function hasActiveCoInstructorAssignment(assignments: { instructorId: string; status: string }[] | undefined | null, userId: string) {
  return (assignments ?? []).some((a) => a.instructorId === userId && ACTIVE_ASSIGNMENT_STATUSES.includes(a.status));
}

export function canPublishAnnouncement(roles: string[], announcementType?: string | null) {
  if (roles.some((role) => ["ADMIN", "CHAPTER_PRESIDENT", "LEADERSHIP"].includes(role))) return true;
  return announcementType === "ROUTINE" && roles.includes("INSTRUCTOR");
}

export async function requireOfferingScope(actor: Session4Actor, offeringId: string) {
  if (!actor?.userId) throw new Error("Authentication required");
  if (actor.roles.some((role) => ["ADMIN", "LEADERSHIP"].includes(role))) return;
  const offering = await (prisma as any).classOffering.findUnique({ where: { id: offeringId }, select: { chapterId: true } });
  if (!offering) throw new Error("Class not found");
  if (actor.roles.includes("CHAPTER_PRESIDENT") && !!actor.chapterIds?.length && actor.chapterIds.includes(offering.chapterId)) return;
  throw new Error("Chapter scope denied");
}

export async function requireInstructorAssigned(actor: Session4Actor, offeringId: string) {
  if (!actor?.userId) throw new Error("Authentication required");
  const offering = await (prisma as any).classOffering.findUnique({
    where: { id: offeringId },
    select: { instructorId: true, chapterId: true, regularInstructorAssignments: { select: { instructorId: true, status: true } } },
  });
  if (!offering) throw new Error("Class not found");
  if (actor.roles.some((role) => ["ADMIN", "LEADERSHIP"].includes(role))) return;
  if (actor.roles.includes("CHAPTER_PRESIDENT") && !!actor.chapterIds?.length && actor.chapterIds.includes(offering.chapterId)) return;
  if (actor.roles.includes("INSTRUCTOR") && offering.instructorId === actor.userId) return;
  if (actor.roles.includes("INSTRUCTOR") && hasActiveCoInstructorAssignment(offering.regularInstructorAssignments, actor.userId)) return;
  throw new Error("Instructor assignment required");
}
