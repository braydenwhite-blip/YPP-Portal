import { prisma } from "@/lib/prisma";

export type Session4Actor = { userId: string; roles: string[] };
export function canOperateChapter(roles: string[]) { return roles.some((r) => ["ADMIN", "STAFF", "CHAPTER_PRESIDENT", "LEADERSHIP"].includes(r)); }
export function canOverrideReadiness(roles: string[]) { return roles.some((r) => ["ADMIN", "STAFF", "LEADERSHIP"].includes(r)); }
export function canReviewSensitiveSupport(roles: string[]) { return roles.some((r) => ["ADMIN", "STAFF", "SAFETY", "SAFETY_RESTRICTED"].includes(r)); }
export function canPublishAnnouncement(roles: string[], type: string) { return ["CLASS_REMINDER", "PREPARATION_NOTE", "MATERIALS_TO_BRING", "COMPLETION_UPDATE"].includes(type) ? roles.some((r)=>["ADMIN","STAFF","CHAPTER_PRESIDENT","INSTRUCTOR"].includes(r)) : roles.some((r)=>["ADMIN","STAFF","CHAPTER_PRESIDENT"].includes(r)); }
export async function requireOfferingScope(actor: Session4Actor, offeringId: string) {
  const offering = await (prisma as any).classOffering.findUnique({ where: { id: offeringId }, select: { id: true, chapterId: true, instructorId: true } });
  if (!offering) throw new Error("Class offering not found");
  if (actor.roles.includes("INSTRUCTOR") && offering.instructorId === actor.userId) return offering;
  if (!canOperateChapter(actor.roles)) throw new Error("Unauthorized");
  return offering;
}
export async function requireInstructorAssigned(actor: Session4Actor, offeringId: string) {
  const offering = await requireOfferingScope(actor, offeringId);
  if (offering.instructorId !== actor.userId && !actor.roles.some((r)=>["ADMIN","STAFF","CHAPTER_PRESIDENT"].includes(r))) throw new Error("Only the assigned instructor may update this workflow.");
  return offering;
}
