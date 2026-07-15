import { prisma } from "@/lib/prisma";
import { auditOperationalEvent } from "@/lib/operational-audit-service";
import { requireInstructorAssigned, canOverrideReadiness, type Session4Actor } from "@/lib/operational-permissions";

export async function updateSessionReadiness(actor: Session4Actor, sessionId: string, input: any) {
  const s = await (prisma as any).classSession.findUnique({ where: { id: sessionId }, include: { offering: true } });
  if (!s) throw new Error("Session not found");
  await requireInstructorAssigned(actor, s.offeringId);

  // Key the preparation row to whichever instructor is actually doing the
  // work: the acting user when they're an assigned/co-assigned instructor,
  // or (for an admin/CP override) the offering's assigned instructor — never
  // a null/unassigned key.
  let instructorId: string | null = null;
  if (actor.roles.includes("INSTRUCTOR")) {
    instructorId = actor.userId;
  } else if (canOverrideReadiness(actor.roles)) {
    instructorId = s.offering.instructorId ?? null;
  }
  if (!instructorId) throw new Error("No assigned instructor to attribute readiness to");

  const data = {
    note: input.note,
    lessonReviewedAt: input.lessonReviewed ? new Date() : undefined,
    materialsReviewedAt: input.materialsReviewed ? new Date() : undefined,
    studentContextReviewedAt: input.studentContextReviewed ? new Date() : undefined,
    completedAt: input.confirmReady ? new Date() : undefined,
  };
  const prep = await (prisma as any).instructorSessionPreparation.upsert({
    where: { sessionId_instructorId: { sessionId, instructorId } },
    update: data,
    create: { sessionId, instructorId, ...data },
  });
  await auditOperationalEvent({ actorUserId: actor.userId, action: "SESSION_READINESS_UPDATED", sourceType: "CLASS_SESSION", sourceId: sessionId, newState: input });
  return prep;
}
